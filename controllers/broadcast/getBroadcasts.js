import { pool } from "../../config/db.js";
import axios from "axios";

// 🚀 Express route handler to fetch broadcasts
export const getBroadcasts = async (req, res) => {
  try {
    const { customer_id } = req.query;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "Missing customer_id",
      });
    }

    const [broadcasts] = await pool.execute(
      `SELECT 
        b.broadcast_id,
        b.broadcast_name,
        b.group_id,
        b.message_type,
        b.schedule,
        b.schedule_date,
        b.status,
        b.type,
        b.selected_template,
        b.template_id,
        b.created_at,
        b.sent,
        b.delivered,
        b.\`read\`,
        b.clicked,
        b.updated_at,
        wt.container_meta
      FROM broadcasts b
      LEFT JOIN whatsapp_templates wt ON b.template_id = wt.id
      WHERE b.customer_id = ?
      ORDER BY b.created_at DESC
    `,
      [customer_id]
    );

    return res.status(200).json({
      success: true,
      broadcasts,
    });
  } catch (error) {
    console.error("❌ Error fetching broadcasts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
