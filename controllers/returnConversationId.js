import { pool } from "../config/db.js";

export const returnConversationId = async (req, res) => {
  const { customer_id } = req.query;

  if (!customer_id) {
    return res.status(400).json({ error: "Missing required parameter: customer_id" });
  }

  try {
    // Step 1: Get shop_id from wp_customer_marketing
    const [shopResult] = await pool.execute(
      `SELECT shop_id FROM wp_customer_marketing WHERE customer_id = ?`,
      [customer_id]
    );

    if (shopResult.length === 0) {
      return res.status(404).json({ error: "No shop found for given customer_id" });
    }

    const shop_id = shopResult[0].shop_id;

    // Step 2: Check if conversation exists
    const [conversationResult] = await pool.execute(
      `SELECT conversation_id FROM conversations WHERE customer_id = ? AND shop_id = ?`,
      [customer_id, shop_id]
    );

    if (conversationResult.length > 0) {
      // Conversation exists
      return res.json({ conversation_id: conversationResult[0].conversation_id });
    }

    // Step 3: Insert new conversation
    const [insertResult] = await pool.execute(
      `INSERT INTO conversations (customer_id, shop_id) VALUES (?, ?)`,
      [customer_id, shop_id]
    );

    return res.json({ conversation_id: insertResult.insertId });

  } catch (error) {
    console.error("Error handling conversation:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
