import { pool } from "../../config/db.js";

/**
 * DELETE FLOW
 * flow_id required
 */
export async function deleteFlow(req, res) {
  try {
    const { flow_id } = req.params;

    if (!flow_id) {
      return res.status(400).json({ success: false, message: "flow_id is required" });
    }

    const [result] = await pool.execute(`DELETE FROM flows WHERE id = ?`, [flow_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Flow not found" });
    }

    return res.json({
      success: true,
      message: "Flow deleted successfully",
    });

  } catch (error) {
    console.error("Error deleting flow:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}