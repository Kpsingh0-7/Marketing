// src/controllers/tags/addTag.js
import { pool } from "../../config/db.js";

export async function addTag(req, res) {
  try {
    const data = req.body;

    // ---------- Validation ----------
    if (!data.customer_id)
      return res.status(400).json({
        success: false,
        message: "customer_id is required",
      });

    if (!data.tag)
      return res.status(400).json({
        success: false,
        message: "tag is required",
      });

    // ---------- Check if tag already exists for same customer ----------
    const checkSql = `
      SELECT id FROM tags 
      WHERE customer_id = ? AND tag = ?
      LIMIT 1
    `;
    const [existing] = await pool.execute(checkSql, [
      data.customer_id,
      data.tag,
    ]);

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Tag already exists for this customer",
      });
    }

    // ---------- Insert New Tag ----------
    const sql = `
      INSERT INTO tags (customer_id, tag)
      VALUES (?, ?)
    `;

    const values = [data.customer_id, data.tag];
    const [result] = await pool.execute(sql, values);

    return res.json({
      success: true,
      message: "Tag created successfully",
      tag_id: result.insertId,
    });

  } catch (error) {
    console.error("❌ Error adding tag:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
