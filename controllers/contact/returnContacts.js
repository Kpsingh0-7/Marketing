// import { pool } from "../../config/db.js";

// export const returnContacts = async (req, res) => {
//   const { customer_id, page = 1, limit = 10, search = "" } = req.query;

//   if (!customer_id) {
//     return res
//       .status(400)
//       .json({ error: "Missing required parameter: customer_id" });
//   }

//   // Make sure limit/offset are numbers
//   const limitNum = parseInt(limit, 10) || 10;
//   const pageNum = parseInt(page, 10) || 1;
//   const offset = (pageNum - 1) * limitNum;

//   try {
//     let whereClause = `WHERE customer_id = ?`;
//     let params = [customer_id];

//     if (search) {
//       whereClause += ` AND (first_name LIKE ? OR last_name LIKE ? OR mobile_no LIKE ?)`;
//       params.push(`%${search}%`, `%${search}%`, `%${search}%`);
//     }

//     // ✅ Main query with search + pagination
//     const [rows] = await pool.query(
//       `
//         SELECT 
//           created_at,
//           first_name,
//           last_name,
//           mobile_no,
//           contact_id,
//           country_code,
//           is_active,
//           block
//         FROM 
//           contact
//         ${whereClause}
//         ORDER BY 
//           created_at DESC
//         LIMIT ${limitNum} OFFSET ${offset}
//       `,
//       params
//     );

//     // ✅ Total count (for pagination)
//     const [[{ total }]] = await pool.query(
//       `SELECT COUNT(*) AS total FROM contact ${whereClause}`,
//       params
//     );

//     res.json({
//       data: rows,
//       pagination: {
//         total,
//         page: pageNum,
//         limit: limitNum,
//         totalPages: Math.ceil(total / limitNum),
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching contacts:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };

import { pool } from "../../config/db.js";

export const returnContacts = async (req, res) => {
  const {
    customer_id,
    page = 1,
    limit = 10,
    search = "",
    createdFrom,
    createdTo,
    optedIn,        // "yes", "no", "all"
    blocked,        // "yes", "no", "all"
    readStatus,     // "read", "unread", "all"
    tag,            // "premium", "VIP", ...
    couponcode,
  } = req.query;

  if (!customer_id) {
    return res.status(400).json({ error: "customer_id is required" });
  }

  const limitNum = parseInt(limit, 10);
  const offset = (page - 1) * limitNum;

  try {
    let where = `WHERE customer_id = ?`;
    const params = [customer_id];

    // 🔍 Search filter
    if (search) {
      where += ` AND (first_name LIKE ? OR last_name LIKE ? OR mobile_no LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // 🗓 Created Date Filter
    if (createdFrom && createdTo) {
      where += ` AND created_at BETWEEN ? AND ?`;
      params.push(createdFrom, createdTo);
    }

    // 👍 Opted In Filter (using is_active)
    if (optedIn === "yes") where += ` AND is_active = 1`;
    if (optedIn === "no") where += ` AND is_active = 0`;

    // 🚫 Block Filter
    if (blocked === "yes") where += ` AND block = 1`;
    if (blocked === "no") where += ` AND block = 0`;

    // 📩 Read Status Filter
    if (readStatus === "read") where += ` AND unread_count = 0`;
    if (readStatus === "unread") where += ` AND unread_count > 0`;

    // 🏷 Tag Filter
    if (tag) {
      where += ` AND tag = ?`;
      params.push(tag);
    }

    // 🎟 Coupon filter
    if (couponcode) {
      where += ` AND couponcode = ?`;
      params.push(couponcode);
    }

    // ----------- FETCH DATA -----------
    const [rows] = await pool.query(
      `
      SELECT *
      FROM contact
      ${where}
      ORDER BY created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
      `,
      params
    );

    // ----------- COUNT FOR PAGINATION -----------
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM contact ${where}`,
      params
    );

    res.json({
      data: rows,
      pagination: {
        total,
        page: Number(page),
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
