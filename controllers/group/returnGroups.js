import { pool } from "../../config/db.js";

export const returnGroups = async (req, res) => {
  try {
    const {
      customer_id,
      page = 1,
      limit = 10,
      search = "",
    } = req.query;

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
    let conditions = ["customer_id = ?"];
    let params = [customer_id];

    if (search) {
      conditions.push("group_name LIKE ?");
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // 1️⃣ Count total groups (with optional search)
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total 
       FROM contact_group
       ${whereClause}`,
      params
    );
    const totalRecords = countRows[0].total;
    const totalPages = Math.ceil(totalRecords / limitNum);

    // 2️⃣ Fetch groups with pagination + search
    const [groups] = await pool.query(
      `
      SELECT 
        group_id,
        description,
        group_name,
        created_at,
        total_contacts
      FROM contact_group
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}  -- ✅ inline safe integers
      `,
      params
    );

    return res.status(200).json({
      success: true,
      data: groups, // Array of groups
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRecords,
        totalPages,
      },
      
    });
  } catch (error) {
    console.error("❌ Error fetching group data:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
