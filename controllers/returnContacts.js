import { pool } from "../config/db.js";

export const returnContacts = async (req, res) => {
  const { shop_id } = req.query;

  // Validate shop_id
  if (!shop_id) {
    return res
      .status(400)
      .json({ error: "Missing required parameter: shop_id" });
  }
  try {
    const [rows] = await pool.execute(
      `
        SELECT 
          fg.created_at,
          fg.name,
          fg.last_name,
          fg.mobile_no,
          fg.customer_id,
          fg.user_country_code,
          c.is_active
        FROM 
          wp_customer_marketing fg
        LEFT JOIN 
          conversations c 
        ON 
          fg.customer_id = c.customer_id AND fg.shop_id = c.shop_id
        WHERE 
          fg.shop_id = ?
        ORDER BY 
          fg.created_at DESC
      `,
      [shop_id]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching guests:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
