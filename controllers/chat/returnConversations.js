import { pool } from "../../config/db.js";

export const returnConversations = async (req, res) => {
  const { customer_id, limit = 10, cursor, search = "" } = req.query;

  if (!customer_id) {
    return res
      .status(400)
      .json({ error: "Missing required parameter: customer_id" });
  }

  const lim = Number(limit) || 10;

  try {
    let sql = `
      SELECT 
        ct.contact_id,
        ct.updated_at,
        ct.first_name,
        ct.last_name,
        ct.country_code,
        ct.mobile_no,
        ct.profile_image,
        ct.unread_count,
        COALESCE(m.content, m.element_name) AS last_message,
        m.message_type AS last_message_type,
        m.sent_at AS last_message_time
      FROM contact ct
      INNER JOIN (
  SELECT *
  FROM (
    SELECT m.*,
           ROW_NUMBER() OVER (
             PARTITION BY contact_id 
             ORDER BY sent_at DESC, message_id DESC
           ) AS rn
    FROM messages m
    WHERE m.customer_id = ?
  ) ranked
  WHERE rn = 1
) m ON ct.contact_id = m.contact_id

      WHERE ct.customer_id = ?
    `;

    const params = [customer_id, customer_id];

    // �� Add search filter if provided
    if (search && search.trim() !== "") {
      sql += `
        AND (
          ct.first_name LIKE ? OR
          ct.last_name LIKE ? OR
          ct.mobile_no LIKE ? OR
          CONCAT(ct.first_name, ' ', ct.last_name) LIKE ?
        )
      `;
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // 👉 If cursor exists, only fetch OLDER conversations
    if (cursor) {
      sql += ` AND m.sent_at < ?`;
      params.push(cursor);
    }

    sql += ` ORDER BY m.sent_at DESC LIMIT ${lim}`;

    console.log("Executing with:", params, "limit:", lim);

    const [rows] = await pool.execute(sql, params);

    // 👉 next cursor = last row’s message_time
    const nextCursor =
      rows.length > 0 ? rows[rows.length - 1].last_message_time : null;

    res.json({
      data: rows,
      nextCursor,
      hasMore: !!nextCursor,
    });
  } catch (err) {
    console.error("Error fetching conversations:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
