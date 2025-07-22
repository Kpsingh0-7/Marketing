import { pool } from "../../config/db.js";
import axios from "axios";


// 🚀 Express route handler to fetch broadcasts
export const getBroadcasts = async (req, res) => {
  try {
    const { customer_id } = req.query; // or use req.body if sent in body

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "Missing customer_id",
      });
    }

    const [broadcasts] = await pool.execute(
      `
      SELECT 
        broadcast_id,
        broadcast_name,
        group_id,
        message_type,
        schedule,
        schedule_date,
        status,
        type,
        selected_template,
        template_id,
        created_at,
        sent,
        delivered,
        \`read\`,
        clicked,
        updated_at
      FROM broadcasts
      WHERE customer_id = ?
      ORDER BY created_at DESC
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

