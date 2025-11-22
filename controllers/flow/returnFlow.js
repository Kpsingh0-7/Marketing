import { pool } from "../../config/db.js";

export async function returnFlow(req, res) {
  try {
    const { customer_id, flow_id } = req.query;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "customer_id is required",
      });
    }

    let sql = `SELECT * FROM flows WHERE customer_id = ?`;
    let values = [customer_id];

    if (flow_id) {
      sql += ` AND id = ?`;
      values.push(flow_id);
    }

    const [rows] = await pool.execute(sql, values);

    return res.json({
      success: true,
      data: rows,
    });

  } catch (error) {
    console.error("Error returning flow:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}