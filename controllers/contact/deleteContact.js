import { pool } from "../../config/db.js";

export const deleteContact = async (req, res) => {
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
      // Step 1: Delete messages if conversation exists
      const [conversationRows] = await connection.execute(
        `SELECT conversation_id FROM conversations WHERE contact_id = ? AND customer_id = ?`,
        [contact_id, customer_id]
      );

      if (conversationRows.length > 0) {
        const conversation_id = conversationRows[0].conversation_id;

        await connection.execute(
          `DELETE FROM messages WHERE conversation_id = ?`,
          [conversation_id]
        );

        await connection.execute(
          `DELETE FROM conversations WHERE conversation_id = ?`,
          [conversation_id]
        );
      }

      // Step 2: Remove from contact_group_map
      const [groupMapRows] = await connection.execute(
        `SELECT group_id FROM contact_group_map WHERE contact_id = ?`,
        [contact_id]
      );

      if (groupMapRows.length > 0) {
        for (const row of groupMapRows) {
          await connection.execute(
            `DELETE FROM contact_group_map WHERE contact_id = ? AND group_id = ?`,
            [contact_id, row.group_id]
          );

          // Step 5: Delete group if unused
          const [remaining] = await connection.execute(
            `SELECT * FROM contact_group_map WHERE group_id = ?`,
            [row.group_id]
          );

          if (remaining.length === 0) {
            await connection.execute(
              `DELETE FROM contact_group WHERE group_id = ? AND customer_id = ?`,
              [row.group_id, customer_id]
            );
          }
        }
      }

      // Step 3: Delete from contact table
      await connection.execute(
        `DELETE FROM contact WHERE contact_id = ? AND customer_id = ?`,
        [contact_id, customer_id]
      );
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Contacts deleted successfully",
    });
  } catch (error) {
    await connection.rollback();
    console.error("❌ Error deleting contacts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};
