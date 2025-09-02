import { pool } from "../../config/db.js";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import mammoth from "mammoth";
import { sendBroadcast } from "./sendBroadcast.js";

export const getBroadcastCustomers = async (req, res) => {
  const {
    customer_id,
    broadcastName,
    group_id,
    messageType,
    schedule,
    scheduleDate,
    selectedTemplate = {},
    status,
    type,
  } = req.body;

  const element_name = selectedTemplate?.element_name || "";
  const template_id = selectedTemplate?.id;
  console.log(req.body);

  try {
    if (!broadcastName || !group_id || !element_name) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: broadcast_name, group_id, or element_name.",
      });
    }

    // ✅ Fetch file path from contact_group
    const [groupRows] = await pool.execute(
      `SELECT group_name, file_path FROM contact_group WHERE group_id = ? AND customer_id = ?`,
      [group_id, customer_id]
    );

    if (groupRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Group not found for this customer.`,
      });
    }

    const { group_name, file_path } = groupRows[0];

    console.log(file_path);

    // ✅ Save broadcast
    const [insertResult] = await pool.execute(
      `INSERT INTO broadcasts 
       (customer_id, broadcast_name, group_id, message_type, schedule, schedule_date, status, type, selected_template, template_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer_id,
        broadcastName,
        group_id,
        messageType,
        schedule,
        schedule === "Yes" ? new Date(scheduleDate) : null,
        status,
        type,
        element_name,
        template_id,
      ]
    );

    const broadcast_id = insertResult.insertId;

    // ⏰ Scheduled broadcast
    if (schedule === "Yes") {
      return res.status(200).json({
        success: true,
        message: "Broadcast scheduled successfully",
        broadcast_id,
      });
    }

    // 🚀 Immediate Broadcast — extract phone numbers from file
    const extension = path.extname(file_path).toLowerCase();
    let phoneNumbers = [];

    try {
      if (extension === ".csv" || extension === ".tsv") {
        const content = fs.readFileSync(file_path, "utf-8");
        const delimiter = content.includes("\t") ? "\t" : ",";

        const records = parse(content, {
          delimiter,
          skip_empty_lines: true,
        });

        const headers = records[0].map((h) => h.toLowerCase());
        const countryIndex = headers.findIndex((h) => h.includes("country"));
        const phoneIndex = headers.findIndex((h) => h.includes("phone"));

        if (countryIndex === -1 || phoneIndex === -1) {
          return res.status(400).json({
            success: false,
            message:
              "CSV/TSV file must contain 'CountryCode' and 'Phone' columns.",
          });
        }

        phoneNumbers = records
          .slice(1)
          .map((row) => {
            const country = row[countryIndex]?.trim();
            const phone = row[phoneIndex]?.trim();
            return country && phone ? `${country}${phone}` : null;
          })
          .filter(Boolean);
      } else if (extension === ".docx") {
        const { value } = await mammoth.extractRawText({ path: file_path });
        const lines = value.split("\n").slice(1); // skip header
        phoneNumbers = lines
          .map((line) => line.split(","))
          .map((fields) => `${fields[0]?.trim() || ""}${fields[1]?.trim() || ""}`)
          .filter((num) => num.length > 6);
      }
    } catch (fileError) {
      console.error("❌ Error reading file:", fileError);
      return res.status(500).json({
        success: false,
        message: "Error reading contact file",
        error: fileError.message,
      });
    }

    phoneNumbers = phoneNumbers.filter((n) => n.length > 6); // Simple filter for invalid rows
    console.log("📱 Extracted Numbers:", phoneNumbers);

    if (!phoneNumbers.length) {
      return res.status(404).json({
        success: false,
        message: "No valid contacts found in the group file.",
      });
    }

    // ✅ Send Broadcast
    const fakeRequest = {
      body: {
        phoneNumbers,
        element_name,
        customer_id,
      },
    };
        console.log(fakeRequest);


    // ✅ Trigger the broadcast but don't wait for DB update
    await sendBroadcast(fakeRequest, {
  status: (code) => ({
    json: async (data) => {
      try {
        console.log("🚀 sendBroadcast response json() triggered!");
        console.log(`Response (${code}):`, JSON.stringify(data, null, 2));

        const successResults = data.results.filter((r) => r.success);
        const successCount = successResults.length;

        const messageValues = successResults
          .filter((r) => r.response?.messages?.[0]?.id)
          .map((r) => [
            broadcast_id,
            r.response.messages[0].id,
            r.response.contacts?.[0]?.wa_id || r.phoneNumber,
            "sent",
            Math.floor(Date.now() / 1000),
            null,
          ]);

        console.log("📥 messageValues:", messageValues);

        if (messageValues.length > 0) {
          // ✅ Fix for MySQL2 bulk insert syntax
          const placeholders = messageValues.map(() => "(?,?,?,?,?,?)").join(",");
          const flatValues = messageValues.flat();
          
          await pool.query(
            `INSERT INTO broadcast_messages 
             (broadcast_id, message_id, recipient_id, status, timestamp, error_message)
             VALUES ${placeholders}`,
            flatValues
          );
          console.log("✅ Message logs inserted into broadcast_messages");
        }

        await pool.execute(
          `UPDATE broadcasts SET status = ?, sent = ? WHERE broadcast_id = ?`,
          ["Sent", successCount, broadcast_id]
        );
        console.log("✅ Broadcast status updated in DB");
      } catch (err) {
        console.error("❌ Error in fakeResponse.json():", err);
      }
    },
  }),
});


    // ✅ Send response immediately
    return res.status(200).json({
      success: true,
      message: "Broadcast sent successfully",
      broadcast_name: broadcastName,
      group_name,
      element_name,
      mobile_numbers: phoneNumbers,
    });
  } catch (error) {
    console.error("❌ Error in getBroadcastCustomers:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


// 🔁 Scheduled Broadcast Sender (File-based groups)
const sendBroadcastById = async (broadcast_id) => {
  try {
    // 1️⃣ Get broadcast details
    const [rows] = await pool.execute(
      `SELECT * FROM broadcasts WHERE broadcast_id = ?`,
      [broadcast_id]
    );
    if (!rows.length) return;
    const broadcast = rows[0];

    // 2️⃣ Get group file path
    const [groupRows] = await pool.execute(
      `SELECT group_name, file_path FROM contact_group WHERE group_id = ? AND customer_id = ?`,
      [broadcast.group_id, broadcast.customer_id]
    );
    if (!groupRows.length) return;

    const { group_name, file_path } = groupRows[0];

    // 3️⃣ Extract phone numbers from file
    const extension = path.extname(file_path).toLowerCase();
    let phoneNumbers = [];

    if (extension === ".csv" || extension === ".tsv") {
      const content = fs.readFileSync(file_path, "utf-8");
      const delimiter = content.includes("\t") ? "\t" : ",";
      const records = parse(content, { delimiter, skip_empty_lines: true });

      const headers = records[0].map((h) => h.toLowerCase());
      const countryIndex = headers.findIndex((h) => h.includes("country"));
      const phoneIndex = headers.findIndex((h) => h.includes("phone"));

      if (countryIndex !== -1 && phoneIndex !== -1) {
        phoneNumbers = records
          .slice(1)
          .map((row) => {
            const country = row[countryIndex]?.trim();
            const phone = row[phoneIndex]?.trim();
            return country && phone ? `${country}${phone}` : null;
          })
          .filter(Boolean);
      }
    } else if (extension === ".docx") {
      const { value } = await mammoth.extractRawText({ path: file_path });
      const lines = value.split("\n").slice(1);
      phoneNumbers = lines
        .map((line) => line.split(","))
        .map((fields) => `${fields[0]?.trim() || ""}${fields[1]?.trim() || ""}`)
        .filter((num) => num.length > 6);
    }

    phoneNumbers = phoneNumbers.filter((n) => n.length > 6);
    if (!phoneNumbers.length) return;

    // 4️⃣ Fake request/response to trigger sendBroadcast
    const fakeRequest = {
      body: {
        phoneNumbers,
        element_name: broadcast.selected_template,
        customer_id: broadcast.customer_id,
      },
    };

    const fakeResponse = {
      status: (code) => ({
        json: async (data) => {
          try {
            console.log(`Scheduled Response (${code}):`, JSON.stringify(data, null, 2));

            // ✅ Log successful messages
            const successResults = data.results.filter((r) => r.success);
            const successCount = successResults.length;

            const messageValues = successResults
              .filter((r) => r.response?.messages?.[0]?.id)
              .map((r) => [
                broadcast_id,
                r.response.messages[0].id,
                r.response.contacts?.[0]?.wa_id || r.phoneNumber,
                "sent",
                Math.floor(Date.now() / 1000),
                null,
              ]);

            if (messageValues.length > 0) {
              const placeholders = messageValues.map(() => "(?,?,?,?,?,?)").join(",");
              const flatValues = messageValues.flat();

              await pool.query(
                `INSERT INTO broadcast_messages 
                 (broadcast_id, message_id, recipient_id, status, timestamp, error_message)
                 VALUES ${placeholders}`,
                flatValues
              );
            }

            await pool.execute(
              `UPDATE broadcasts SET status = ?, sent = ? WHERE broadcast_id = ?`,
              ["Sent", successCount, broadcast_id]
            );
          } catch (err) {
            console.error("❌ Error in scheduled fakeResponse.json():", err);
          }
        },
      }),
    };

    await sendBroadcast(fakeRequest, fakeResponse);
  } catch (error) {
    console.error("❌ sendBroadcastById (file-based) error:", error);
  }
};

// 🔁 Background Scheduler (runs every 60 seconds)
setInterval(async () => {
  try {
    const [scheduledBroadcasts] = await pool.execute(`
      SELECT * FROM broadcasts
      WHERE schedule = 'Yes'
        AND status = 'Scheduled'
        AND schedule_date <= NOW()
    `);

    for (const broadcast of scheduledBroadcasts) {
      try {
        await pool.execute(`UPDATE broadcasts SET status = 'Running' WHERE broadcast_id = ?`, [
          broadcast.broadcast_id,
        ]);

        await sendBroadcastById(broadcast.broadcast_id);

        // ✅ Status update happens inside sendBroadcastById’s fakeResponse.json()
      } catch (err) {
        console.error("🔁 Scheduled broadcast failed:", err);
        await pool.execute(`UPDATE broadcasts SET status = 'Failed' WHERE broadcast_id = ?`, [
          broadcast.broadcast_id,
        ]);
      }
    }
  } catch (error) {
    console.error("❌ Scheduler interval error:", error);
  }
}, 60 * 1000);
