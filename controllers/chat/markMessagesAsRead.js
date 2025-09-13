// POST /api/messages/mark-read
import { pool } from "../../config/db.js";

export const markMessagesAsRead = async (req, res) => {
  const { contact_id } = req.body;

  if (!contact_id) {
    return res.status(400).json({ error: "contact_id is required" });
  }

  try {
    // 1. Update messages from 'received' → 'read'
    const [result] = await pool.execute(
      `UPDATE messages
       SET read_at = CURRENT_TIMESTAMP
       WHERE contact_id = ? AND status = 'received'`,
      [contact_id]
    );

    // 2. Reset unread counter in contact
    await pool.execute(
      `UPDATE contact
       SET unread_count = 0
       WHERE contact_id = ?`,
      [contact_id]
    );

    // // 3. Emit socket event so UI updates instantly
    // const io = req.app.get("io");
    // io.to(String(contact_id)).emit("unreadUpdate", {
    //   contact_id,
    //   unread_count: 0,
    // });

    return res.json({
      success: true,
      contact_id,
      updated_rows: result.affectedRows,
    });
  } catch (error) {
    console.error("❌ Error marking messages as read:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
