import { pool } from '../config/db.js';

export const returnConversations = async (req, res) => {
  const { shop_id } = req.query;

  try {
    const [rows] = await pool.execute(`
      SELECT 
        c.customer_id, 
        c.conversation_id, 
        c.updated_at,
        wp.name,
        wp.last_name,
        wp.profile_image,
        wp.mobile_no
      FROM 
        conversations c
      JOIN 
        wp_customer_marketing wp ON c.customer_id = wp.customer_id
      WHERE 
        c.shop_id = ?
      ORDER BY 
        c.updated_at DESC
    `, [shop_id]);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
