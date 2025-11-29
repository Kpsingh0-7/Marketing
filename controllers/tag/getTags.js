// src/controllers/tags/getTags.js
import { pool } from "../../config/db.js";

export async function getTags(req, res) {
  try {
    const { customer_id } = req.params;

    // ---------- Validation ----------
    if (!customer_id)
      return res.status(400).json({
        success: false,
        message: "customer_id is required",
      });

    const sql = `
      SELECT id, customer_id, tag, created_at
      FROM tags
      WHERE customer_id = ?
      ORDER BY id DESC
    `;

    const [rows] = await pool.execute(sql, [customer_id]);

    return res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("❌ Error fetching tags:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
