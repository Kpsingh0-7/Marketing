import { pool } from "../../config/db.js";

export const deleteConversations = async (req, res) => {
  const { contact_ids, customer_id } = req.body;

  console.log("Received contact_ids:", contact_ids);
  console.log("Received customer_id:", customer_id);

  if (!Array.isArray(contact_ids) || contact_ids.length === 0 || !customer_id) {
    return res.status(400).json({
      success: false,
      message: "Missing or invalid fields: contact_ids (array) and customer_id are required",
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const contact_id of contact_ids) {
      await connection.execute(
        `DELETE FROM conversations WHERE contact_id = ? AND customer_id = ?`,
        [contact_id, customer_id]
      );
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Conversations deleted successfully",
    });
  } catch (error) {
    await connection.rollback();
    console.error("❌ Error deleting conversations:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};
