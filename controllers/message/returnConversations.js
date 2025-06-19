import { pool } from '../../config/db.js';

export const returnConversations = async (req, res) => {
  const { customer_id } = req.query;
if (!customer_id) {
    return res
      .status(400)
      .json({ error: "Missing required parameter: customer_id" });
  }
  try {
    const [rows] = await pool.execute(`
      SELECT 
        c.contact_id, 
        c.conversation_id, 
        c.updated_at,
        wp.first_name,
        wp.last_name,
        wp.profile_image,
        wp.mobile_no
      FROM 
        conversations c
      JOIN 
        contact wp ON c.contact_id = wp.contact_id
      WHERE 
        c.customer_id = ?
      ORDER BY 
        c.updated_at DESC
    `, [customer_id]);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
