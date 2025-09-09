import { pool } from "../../config/db.js";

export const returnContacts = async (req, res) => {
  const { customer_id, page = 1, limit = 10, search = "" } = req.query;

  if (!customer_id) {
    return res
      .status(400)
      .json({ error: "Missing required parameter: customer_id" });
  }

  // Make sure limit/offset are numbers
  const limitNum = parseInt(limit, 10) || 10;
  const pageNum = parseInt(page, 10) || 1;
  const offset = (pageNum - 1) * limitNum;

  try {
    let whereClause = `WHERE customer_id = ?`;
    let params = [customer_id];

    if (search) {
      whereClause += ` AND (first_name LIKE ? OR last_name LIKE ? OR mobile_no LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // ✅ Main query with search + pagination
    const [rows] = await pool.query(
      `
        SELECT 
          created_at,
          first_name,
          last_name,
          mobile_no,
          contact_id,
          country_code,
          is_active,
        FROM 
          contact
        ${whereClause}
        ORDER BY 
          created_at DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `,
      params
    );

    // ✅ Total count (for pagination)
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM contact ${whereClause}`,
      params
    );

    res.json({
      data: rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
