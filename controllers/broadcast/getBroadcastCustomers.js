import { pool } from "../../config/db.js";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import mammoth from "mammoth";
import { sendBroadcast } from "./sendBroadcast.js";

// export const getBroadcastCustomers = async (req, res) => {
//   const {
//     customer_id,
//     broadcastName,
//     group_id,
//     messageType,
//     schedule,
//     scheduleDate,
//     template_name: element_name,
//      template_id,
//     status,
//     type,
//   } = req.body;

//   console.log(req.body);

//   try {
//     if (!broadcastName || !group_id || !element_name) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Missing required fields: broadcast_name, group_id, or element_name.",
//       });
//     }

//     // ✅ Fetch file path from contact_group
//     const [groupRows] = await pool.execute(
//       `SELECT group_name, file_path FROM contact_group WHERE group_id = ? AND customer_id = ?`,
//       [group_id, customer_id]
//     );

//     if (groupRows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: `Group not found for this customer.`,
//       });
//     }

//     const { group_name, file_path } = groupRows[0];

//     console.log(file_path);

//     // ✅ Save broadcast
//     const [insertResult] = await pool.execute(
//       `INSERT INTO broadcasts
//        (customer_id, broadcast_name, group_id, message_type, schedule, schedule_date, status, type, selected_template, template_id)
//        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         customer_id,
//         broadcastName,
//         group_id,
//         messageType,
//         schedule,
//         schedule === "Yes" ? new Date(scheduleDate) : null,
//         status,
//         type,
//         element_name,
//         template_id,
//       ]
//     );

//     const broadcast_id = insertResult.insertId;

//     // ⏰ Scheduled broadcast
//     if (schedule === "Yes") {
//       return res.status(200).json({
//         success: true,
//         message: "Broadcast scheduled successfully",
//         broadcast_id,
//       });
//     }

//     // 🚀 Immediate Broadcast — extract phone numbers from file
//     const extension = path.extname(file_path).toLowerCase();
//     let phoneNumbers = [];

//     try {
//       if (extension === ".csv" || extension === ".tsv") {
//         const content = await fs.promises.readFile(file_path, "utf-8");
//         const delimiter = content.includes("\t") ? "\t" : ",";

//         const records = parse(content, {
//           delimiter,
//           skip_empty_lines: true,
//         });

//         const headers = records[0].map((h) => h.toLowerCase().trim());

//         // Look for both variations
//         const countryIndex = headers.findIndex(
//           (h) => h.includes("country") || h.includes("countrycode")
//         );
//         const phoneIndex = headers.findIndex(
//           (h) => h.includes("phone") || h.includes("mobile")
//         );

//         if (countryIndex === -1 || phoneIndex === -1) {
//           return res.status(400).json({
//             success: false,
//             message:
//               "CSV/TSV must contain 'CountryCode' (or countrycode) and 'Mobile' (or phone).",
//             foundHeaders: headers,
//           });
//         }

//         phoneNumbers = records
//           .slice(1)
//           .map((row) => {
//             const country = row[countryIndex]?.trim().replace("+", "");
//             const phone = row[phoneIndex]?.trim();
//             return country && phone ? `${country}${phone}` : null;
//           })
//           .filter(Boolean);

//         // ✅ Deduplicate numbers
//         phoneNumbers = [...new Set(phoneNumbers)];
//       } else if (extension === ".docx") {
//         const { value } = await mammoth.extractRawText({ path: file_path });
//         const lines = value.split("\n").slice(1); // skip header
//         phoneNumbers = lines
//           .map((line) => line.split(","))
//           .map(
//             (fields) => `${fields[0]?.trim() || ""}${fields[1]?.trim() || ""}`
//           )
//           .filter((num) => num.length > 6);
//       }
//     } catch (fileError) {
//       console.error("❌ Error reading file:", fileError);
//       return res.status(500).json({
//         success: false,
//         message: "Error reading contact file",
//         error: fileError.message,
//       });
//     }

//     phoneNumbers = phoneNumbers.filter((n) => n.length > 6); // Simple filter for invalid rows
//     console.log("📱 Extracted Numbers:", phoneNumbers);

//     if (!phoneNumbers.length) {
//       return res.status(404).json({
//         success: false,
//         message: "No valid contacts found in the group file.",
//       });
//     }

//     // ✅ Send Broadcast
//     const fakeRequest = {
//       body: {
//         phoneNumbers,
//         element_name,
//         customer_id,
//       },
//     };
//     console.log(fakeRequest);

//     // ✅ Trigger the broadcast but don't wait for DB update
//     await sendBroadcast(fakeRequest, {
//       status: (code) => ({
//         json: async (data) => {
//           try {
//             console.log("🚀 sendBroadcast response json() triggered!");
//             console.log(`Response (${code}):`, JSON.stringify(data, null, 2));

//             const successResults = data.results.filter((r) => r.success);
//             const successCount = successResults.length;

//             const messageValues = successResults
//               .filter((r) => r.response?.messages?.[0]?.id)
//               .map((r) => [
//                 broadcast_id,
//                 r.response.messages[0].id,
//                 r.response.contacts?.[0]?.wa_id || r.phoneNumber,
//                 "sent",
//                 Math.floor(Date.now() / 1000),
//                 null,
//               ]);

//             console.log("📥 messageValues:", messageValues);

//             if (messageValues.length > 0) {
//               // ✅ Fix for MySQL2 bulk insert syntax
//               const placeholders = messageValues
//                 .map(() => "(?,?,?,?,?,?)")
//                 .join(",");
//               const flatValues = messageValues.flat();

//               await pool.query(
//                 `INSERT INTO broadcast_messages
//              (broadcast_id, message_id, recipient_id, status, timestamp, error_message)
//              VALUES ${placeholders}`,
//                 flatValues
//               );
//               console.log("✅ Message logs inserted into broadcast_messages");
//             }

//             await pool.execute(
//               `UPDATE broadcasts SET status = ?, sent = ? WHERE broadcast_id = ?`,
//               ["Sent", successCount, broadcast_id]
//             );
//             console.log("✅ Broadcast status updated in DB");
//           } catch (err) {
//             console.error("❌ Error in fakeResponse.json():", err);
//           }
//         },
//       }),
//     });

//     // ✅ Send response immediately
//     return res.status(200).json({
//       success: true,
//       message: "Broadcast sent successfully",
//       broadcast_name: broadcastName,
//       group_name,
//       element_name,
//       mobile_numbers: phoneNumbers,
//     });
//   } catch (error) {
//     console.error("❌ Error in getBroadcastCustomers:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// };

export const getBroadcastCustomers = async (req, res) => {
  const {
    customer_id,
    broadcastName,
    group_id,
    messageType,
    schedule,
    scheduleDate,
    template_name: element_name,
    template_id,
    status,
    type,
  } = req.body;

  console.log(req.body);
  if (!broadcastName || !group_id || !element_name) {
    return res.status(400).json({
      success: false,
      message:
        "Missing required fields: broadcast_name, group_id, or element_name.",
    });
  }

  try {
    // ✅ Fetch contacts_json directly
    const [groupRows] = await pool.execute(
      `SELECT group_name, contacts_json FROM contact_group WHERE group_id = ? AND customer_id = ?`,
      [group_id, customer_id]
    );

    if (groupRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Group not found for this customer.",
      });
    }

    const { group_name, contacts_json } = groupRows[0];

    // Parse JSON and extract phone numbers
    let phoneNumbers = [];
    try {
      let contacts;

      if (typeof contacts_json === "string") {
        contacts = JSON.parse(contacts_json || "[]");
      } else if (Array.isArray(contacts_json)) {
        contacts = contacts_json;
      } else if (typeof contacts_json === "object" && contacts_json !== null) {
        contacts = [contacts_json];
      } else {
        contacts = [];
      }

      phoneNumbers = contacts
        .map((c) => c.phone?.trim() || c.Phone?.trim()) // handle both formats
        .filter((p) => p && p.length > 6);

      phoneNumbers = [...new Set(phoneNumbers)];
    } catch (jsonError) {
      console.error("❌ Error parsing contacts_json:", jsonError);
      return res.status(500).json({
        success: false,
        message: "Invalid contacts JSON",
        error: jsonError.message,
      });
    }

    if (!phoneNumbers.length) {
      return res.status(404).json({
        success: false,
        message: "No valid contacts found in this group.",
      });
    }

    // ✅ Save broadcast
    const [insertResult] = await pool.execute(
      `INSERT INTO broadcasts
       (customer_id, broadcast_name, message_type, schedule, schedule_date,
        status, type, selected_template, template_id, contacts_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer_id,
        broadcastName,
        messageType,
        schedule,
        schedule === "Yes" ? new Date(scheduleDate) : null,
        status,
        type,
        element_name,
        template_id,
        contacts_json,
      ]
    );

    const broadcast_id = insertResult.insertId;

    if (schedule === "Yes") {
      return res.status(200).json({
        success: true,
        message: "Broadcast scheduled successfully",
        broadcast_id,
      });
    }

    // 🚀 Immediate broadcast using contacts_json
    const fakeRequest = { body: { phoneNumbers, element_name, customer_id } };

    await sendBroadcast(fakeRequest, {
      status: (code) => ({
        json: async (data) => {
          try {
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
              const placeholders = messageValues
                .map(() => "(?,?,?,?,?,?)")
                .join(",");
              await pool.query(
                `INSERT INTO broadcast_messages 
                 (broadcast_id, message_id, recipient_id, status, timestamp, error_message)
                 VALUES ${placeholders}`,
                messageValues.flat()
              );
            }

            await pool.execute(
              `UPDATE broadcasts SET status = ?, sent = ? WHERE broadcast_id = ?`,
              ["Sent", successCount, broadcast_id]
            );
          } catch (err) {
            console.error("❌ Error logging messages:", err);
          }
        },
      }),
    });

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
// const sendBroadcastById = async (broadcast_id) => {
//   try {
//     // 1️⃣ Get broadcast details
//     const [rows] = await pool.execute(
//       `SELECT * FROM broadcasts WHERE broadcast_id = ?`,
//       [broadcast_id]
//     );
//     if (!rows.length) return;
//     const broadcast = rows[0];

//     // 2️⃣ Get group file path
//     const [groupRows] = await pool.execute(
//       `SELECT group_name, file_path FROM contact_group WHERE group_id = ? AND customer_id = ?`,
//       [broadcast.group_id, broadcast.customer_id]
//     );
//     if (!groupRows.length) return;

//     const { group_name, file_path } = groupRows[0];

//     // 3️⃣ Extract phone numbers from file
//     const extension = path.extname(file_path).toLowerCase();
//     let phoneNumbers = [];

//     if (extension === ".csv" || extension === ".tsv") {
//       const content = await fs.promises.readFile(file_path, "utf-8");
//       const delimiter = content.includes("\t") ? "\t" : ",";

//       const records = parse(content, {
//         delimiter,
//         skip_empty_lines: true,
//       });

//       const headers = records[0].map((h) => h.toLowerCase().trim());

//       // Look for both variations
//       const countryIndex = headers.findIndex(
//         (h) => h.includes("country") || h.includes("countrycode")
//       );
//       const phoneIndex = headers.findIndex(
//         (h) => h.includes("phone") || h.includes("mobile")
//       );

//       if (countryIndex === -1 || phoneIndex === -1) {
//         return res.status(400).json({
//           success: false,
//           message:
//             "CSV/TSV must contain 'CountryCode' (or countrycode) and 'Mobile' (or phone).",
//           foundHeaders: headers,
//         });
//       }

//       phoneNumbers = records
//         .slice(1)
//         .map((row) => {
//           const country = row[countryIndex]?.trim().replace("+", "");
//           const phone = row[phoneIndex]?.trim();
//           return country && phone ? `${country}${phone}` : null;
//         })
//         .filter(Boolean);

//       // ✅ Deduplicate numbers
//       phoneNumbers = [...new Set(phoneNumbers)];
//     } else if (extension === ".docx") {
//       const { value } = await mammoth.extractRawText({ path: file_path });
//       const lines = value.split("\n").slice(1);
//       phoneNumbers = lines
//         .map((line) => line.split(","))
//         .map((fields) => `${fields[0]?.trim() || ""}${fields[1]?.trim() || ""}`)
//         .filter((num) => num.length > 6);
//     }

//     phoneNumbers = phoneNumbers.filter((n) => n.length > 6);
//     if (!phoneNumbers.length) return;

//     // 4️⃣ Fake request/response to trigger sendBroadcast
//     const fakeRequest = {
//       body: {
//         phoneNumbers,
//         element_name: broadcast.selected_template,
//         customer_id: broadcast.customer_id,
//       },
//     };

//     const fakeResponse = {
//       status: (code) => ({
//         json: async (data) => {
//           try {
//             console.log(
//               `Scheduled Response (${code}):`,
//               JSON.stringify(data, null, 2)
//             );

//             // ✅ Log successful messages
//             const successResults = data.results.filter((r) => r.success);
//             const successCount = successResults.length;

//             const messageValues = successResults
//               .filter((r) => r.response?.messages?.[0]?.id)
//               .map((r) => [
//                 broadcast_id,
//                 r.response.messages[0].id,
//                 r.response.contacts?.[0]?.wa_id || r.phoneNumber,
//                 "sent",
//                 Math.floor(Date.now() / 1000),
//                 null,
//               ]);

//             if (messageValues.length > 0) {
//               const placeholders = messageValues
//                 .map(() => "(?,?,?,?,?,?)")
//                 .join(",");
//               const flatValues = messageValues.flat();

//               await pool.query(
//                 `INSERT INTO broadcast_messages
//                  (broadcast_id, message_id, recipient_id, status, timestamp, error_message)
//                  VALUES ${placeholders}`,
//                 flatValues
//               );
//             }

//             await pool.execute(
//               `UPDATE broadcasts SET status = ?, sent = ? WHERE broadcast_id = ?`,
//               ["Sent", successCount, broadcast_id]
//             );
//           } catch (err) {
//             console.error("❌ Error in scheduled fakeResponse.json():", err);
//           }
//         },
//       }),
//     };

//     await sendBroadcast(fakeRequest, fakeResponse);
//   } catch (error) {
//     console.error("❌ sendBroadcastById (file-based) error:", error);
//   }
// };

// 🔁 Scheduled Broadcast Sender (Now uses contacts_json like getBroadcastCustomers)
const sendBroadcastById = async (broadcast_id) => {
  try {
    // 1️⃣ Get broadcast details
    const [rows] = await pool.execute(
      `SELECT * FROM broadcasts WHERE broadcast_id = ?`,
      [broadcast_id]
    );
    if (!rows.length) return;
    const broadcast = rows[0];

    // 2️⃣ Parse contacts_json directly from broadcasts table
    let phoneNumbers = [];
    try {
      let contacts;

      if (typeof broadcast.contacts_json === "string") {
        contacts = JSON.parse(broadcast.contacts_json || "[]");
      } else if (Array.isArray(broadcast.contacts_json)) {
        contacts = broadcast.contacts_json;
      } else if (
        typeof broadcast.contacts_json === "object" &&
        broadcast.contacts_json !== null
      ) {
        contacts = [broadcast.contacts_json];
      } else {
        contacts = [];
      }

      phoneNumbers = contacts
        .map((c) => c.phone?.trim() || c.Phone?.trim())
        .filter((p) => p && p.length > 6);

      phoneNumbers = [...new Set(phoneNumbers)];
    } catch (jsonError) {
      console.error(
        "❌ Error parsing contacts_json in scheduled broadcast:",
        jsonError
      );
      return;
    }

    if (!phoneNumbers.length) {
      console.warn(
        "⚠️ No valid contacts found for scheduled broadcast:",
        broadcast_id
      );
      return;
    }

    // 3️⃣ Fake request/response to trigger sendBroadcast
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
            console.log(
              `Scheduled Response (${code}) for broadcast ${broadcast_id}:`,
              JSON.stringify(data, null, 2)
            );

            // ✅ Log successful messages
            const successResults = Array.isArray(data?.results)
              ? data.results.filter((r) => r.success)
              : [];
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
              const placeholders = messageValues
                .map(() => "(?,?,?,?,?,?)")
                .join(",");
              const flatValues = messageValues.flat();

              await pool.query(
                `INSERT INTO broadcast_messages 
                 (broadcast_id, message_id, recipient_id, status, timestamp, error_message)
                 VALUES ${placeholders}`,
                flatValues
              );
            }

            // ✅ Update broadcast status & sent count
            await pool.execute(
              `UPDATE broadcasts SET status = ?, sent = ? WHERE broadcast_id = ?`,
              ["Sent", successCount, broadcast_id]
            );
          } catch (err) {
            console.error("❌ Error in scheduled fakeResponse.json():", err);
            await pool.execute(
              `UPDATE broadcasts SET status = 'Failed' WHERE broadcast_id = ?`,
              [broadcast_id]
            );
          }
        },
      }),
    };

    await sendBroadcast(fakeRequest, fakeResponse);
  } catch (error) {
    console.error("❌ sendBroadcastById error:", error);
    await pool.execute(
      `UPDATE broadcasts SET status = 'Failed' WHERE broadcast_id = ?`,
      [broadcast_id]
    );
  }
};
//sendBroadcastById(201);
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
        await pool.execute(
          `UPDATE broadcasts SET status = 'Running' WHERE broadcast_id = ?`,
          [broadcast.broadcast_id]
        );

        await sendBroadcastById(broadcast.broadcast_id);
        console.log("sendBroadcastById got id:", broadcast.broadcast_id);
        // ✅ Status update happens inside sendBroadcastById’s fakeResponse.json()
      } catch (err) {
        console.error("🔁 Scheduled broadcast failed:", err);
        await pool.execute(
          `UPDATE broadcasts SET status = 'Failed' WHERE broadcast_id = ?`,
          [broadcast.broadcast_id]
        );
      }
    }
  } catch (error) {
    console.error("❌ Scheduler interval error:", error);
  }
}, 60 * 1000);
