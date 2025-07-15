import { pool } from '../../config/db.js';

export const returnAllMessage = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);
  const offset = (pageNumber - 1) * limitNumber;

  try {
    const connection = await pool.getConnection();

    // Get total count
    const [countResult] = await connection.query(
      `SELECT COUNT(*) as total FROM messages`
    );
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limitNumber);

    // Get paginated messages
    const [messages] = await connection.query(
      `SELECT 
        message_id,
        conversation_id,
        sender_type,
        sender_id,
        message_type,
        content,
        element_name,
        template_data,
        media_url,
        sent_at,
        delivered_at,
        read_at,
        received_at,
        status,
        external_message_id
       FROM messages
       ORDER BY sent_at DESC
       LIMIT ? OFFSET ?`,
      [limitNumber, offset]
    );

    connection.release();

    const safeJSONParse = (value) => {
      try {
        return typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        return value;
      }
    };

    // If template_data is JSON, safely parse it
    const parsedMessages = messages.map(msg => ({
      ...msg,
      template_data: safeJSONParse(msg.template_data)
    }));

    return res.json({
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages,
      messages: parsedMessages
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
