import { pool } from "../../config/db.js";

// 🚀 Express route handler to fetch broadcasts with pagination + search
export const getBroadcasts = async (req, res) => {
  try {
    const { customer_id, page = 1, limit = 10, search = "" } = req.query;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "Missing customer_id",
      });
    }

    // ✅ Force integers
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const offset = (pageNum - 1) * limitNum;

    // 🔹 Build dynamic WHERE conditions
    let conditions = ["b.customer_id = ?"];
    let params = [customer_id];

    if (search) {
      conditions.push("b.broadcast_name LIKE ?");
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // 1️⃣ Count total broadcasts (with optional search)
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total 
       FROM broadcasts b
       ${whereClause}`,
      params
    );
    const totalRecords = countRows[0].total;
    const totalPages = Math.ceil(totalRecords / limitNum);

    // 2️⃣ Fetch broadcasts with pagination + search
    const [broadcasts] = await pool.query(
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
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}`, // ✅ inline values
      params
    );

    return res.status(200).json({
      success: true,
      data:broadcasts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRecords,
        totalPages,
      },
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
