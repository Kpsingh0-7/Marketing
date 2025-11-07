import { pool } from "../../config/db.js";

export const deleteGroup = async (req, res) => {
  const { group_id, customer_id } = req.body;

  if (!group_id || !customer_id) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: group_id and customer_id",
    });
  }

  try {
    // Check if group exists
    const [rows] = await pool.query(
      `SELECT * FROM contact_group WHERE group_id = ? AND customer_id = ?`,
      [group_id, customer_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Group not found.",
      });
    }

    // Delete the group from DB
    await pool.query(
      `DELETE FROM contact_group WHERE group_id = ? AND customer_id = ?`,
      [group_id, customer_id]
    );

    return res.status(200).json({
      success: true,
      message: "Group deleted successfully.",
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
