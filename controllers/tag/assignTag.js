// src/controllers/tags/assignTag.js
import { pool } from "../../config/db.js";

export async function assignTag(req, res) {
  try {
    const { contact_id, tag_id } = req.body;

    // ---------- Validation ----------
    if (!contact_id)
      return res.status(400).json({
        success: false,
        message: "contact_id is required",
      });

    if (!tag_id)
      return res.status(400).json({
        success: false,
        message: "tag_id is required",
      });

    // ---------- SQL ----------
    const sql = `
      INSERT IGNORE INTO contact_tags (contact_id, tag_id)
      VALUES (?, ?)
    `;

    await pool.execute(sql, [contact_id, tag_id]);

    return res.json({
      success: true,
      message: "Tag assigned to contact successfully",
    });
  } catch (error) {
    console.error("❌ Error assigning tag:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
