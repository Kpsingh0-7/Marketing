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

  try {
    if (!broadcastName || !group_id || !element_name) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: broadcast_name, group_id, or element_name.",
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

    if (extension === ".csv" || extension === ".tsv") {
      const content = fs.readFileSync(file_path, "utf-8");
      const delimiter = content.includes("\t") ? "\t" : ",";

      const records = parse(content, {
        delimiter,
        skip_empty_lines: true,
      });

      const headers = records[0].map((h) => h.toLowerCase());
      const countryIndex = headers.findIndex((h) =>
        h.includes("country")
      );
      const phoneIndex = headers.findIndex((h) =>
        h.includes("phone")
      );

      if (countryIndex === -1 || phoneIndex === -1) {
        return res.status(400).json({
          success: false,
          message: "CSV/TSV file must contain 'CountryCode' and 'Phone' columns.",
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
    const fakeResponse = {
      status: (code) => ({
        json: (data) => console.log(`Response (${code}):`, data),
      }),
    };

     await sendBroadcast(fakeRequest, fakeResponse);

    await pool.execute(
      `UPDATE broadcasts SET status = ? WHERE broadcast_id = ?`,
      ["Sent", broadcast_id]
    );

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
