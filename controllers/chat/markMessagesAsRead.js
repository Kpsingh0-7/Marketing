// POST /api/messages/mark-read
import { pool } from "../../config/db.js";

export const markMessagesAsRead = async (req, res) => {
  const { contact_id } = req.body;

  if (!contact_id) {
    return res.status(400).json({ error: "contact_id is required" });
  }

  try {
    const [result] = await pool.execute(
  `UPDATE messages
   SET read_at = CURRENT_TIMESTAMP
   WHERE contact_id = ? AND status = 'received'`,
  [contact_id]
);

    // Optionally emit a socket event here if needed
    // req.app.get("io").to(contact_id.toString()).emit("message_read", { contact_id });

    return res.json({
      success: true,
      contact_id,
      updated_rows: result.affectedRows,
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
