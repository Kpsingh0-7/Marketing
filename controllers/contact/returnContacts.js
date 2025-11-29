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
    optedIn,
    blocked,
    readStatus,
    tag,
    couponcode,
  } = req.query;

  if (!customer_id) {
    return res.status(400).json({ error: "customer_id is required" });
  }

  const limitNum = parseInt(limit, 10);
  const offset = (page - 1) * limitNum;

  try {
    let where = `WHERE c.customer_id = ?`;
    const params = [customer_id];

    if (search) {
      where += ` AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.mobile_no LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (createdFrom && createdTo) {
      where += ` AND c.created_at BETWEEN ? AND ?`;
      params.push(createdFrom, createdTo);
    }

    if (optedIn === "yes") where += ` AND c.is_active = 1`;
    if (optedIn === "no") where += ` AND c.is_active = 0`;

    if (blocked === "yes") where += ` AND c.block = 1`;
    if (blocked === "no") where += ` AND c.block = 0`;

    if (readStatus === "read") where += ` AND c.unread_count = 0`;
    if (readStatus === "unread") where += ` AND c.unread_count > 0`;

    if (tag) {
      where += ` AND c.contact_id IN (
        SELECT ct.contact_id 
        FROM contact_tags ct
        JOIN tags t ON ct.tag_id = t.id
        WHERE t.tag = ?
      )`;
      params.push(tag);
    }

    if (couponcode) {
      where += ` AND c.couponcode = ?`;
      params.push(couponcode);
    }

    // ------------- GET CONTACTS + TAGS ----------------
    const [rows] = await pool.query(
      `
      SELECT 
        c.*,
        GROUP_CONCAT(t.tag) AS tags
      FROM contact c
      LEFT JOIN contact_tags ct ON c.contact_id = ct.contact_id
      LEFT JOIN tags t ON ct.tag_id = t.id
      ${where}
      GROUP BY c.contact_id
      ORDER BY c.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
      `,
      params
    );

    // ------------- GET TOTAL COUNT ----------------
    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM contact c
      ${where}
      `,
      params
    );

    // ✨ Convert tags from "a,b,c" → ["a","b","c"]
    rows.forEach(row => {
      row.tags = row.tags ? row.tags.split(",") : [];
    });

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
