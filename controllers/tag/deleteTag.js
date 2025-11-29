// src/controllers/tags/deleteTag.js
import { pool } from "../../config/db.js";

export async function deleteTag(req, res) {
  try {
    const { tag_id } = req.params;

    if (!tag_id)
      return res.status(400).json({
        success: false,
        message: "tag_id is required",
      });

    const sql = `DELETE FROM tags WHERE id = ?`;

    const [result] = await pool.execute(sql, [tag_id]);

    if (result.affectedRows === 0)
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });

    return res.json({
      success: true,
      message: "Tag deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting tag:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
