import { pool } from "../../config/db.js";
import fs from "fs";
import path from "path";

export const deleteGroup = async (req, res) => {
  const { group_id, customer_id } = req.body;

  if (!group_id || !customer_id) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: group_id and customer_id",
    });
  }

  try {
    // Fetch group to get file path
    const [rows] = await pool.query(
      `SELECT file_path FROM contact_group WHERE group_id = ? AND customer_id = ?`,
      [group_id, customer_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Group not found.",
      });
    }

    const filePath = rows[0].file_path;

    // Delete the group from DB
    await pool.query(
      `DELETE FROM contact_group WHERE group_id = ? AND customer_id = ?`,
      [group_id, customer_id]
    );

    // Delete file from server if it exists
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // Remove file
    }

    return res.status(200).json({
      success: true,
      message: "Group and associated file deleted successfully.",
    });
  } catch (error) {
    console.error("❌ Error deleting group:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
