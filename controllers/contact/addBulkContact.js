import { pool } from "../../config/db.js";

export const addBulkContact = async (req, res) => {
  const { customer_id, contacts } = req.body;

  if (!customer_id) {
    return res.status(400).json({
      success: false,
      message: "customer_id is required",
    });
  }

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No contacts provided",
    });
  }

  try {
    let inserted = 0;
    let skipped = 0;

    for (let contact of contacts) {
      const first_name = contact.fullName?.toString().trim();
      const mobile_no = contact.mobile?.toString().trim();
      const country_code = contact.country_code?.toString().trim();

      if (!first_name || !mobile_no || !country_code) {
        skipped++;
        continue;
      }

      // Check if already exists
      const [existing] = await pool.execute(
        `SELECT contact_id FROM contact WHERE customer_id = ? AND mobile_no = ?`,
        [customer_id, mobile_no]
      );

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Insert
      await pool.execute(
        `INSERT INTO contact (customer_id, country_code, first_name, mobile_no)
         VALUES (?, ?, ?, ?)`,
        [customer_id, country_code, first_name, mobile_no]
      );

      inserted++;
    }

    return res.json({
      success: true,
      message: "Contacts imported",
      inserted,
      skipped,
      total: contacts.length,
    });
  } catch (error) {
    console.error("❌ Bulk Import Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
