import { pool } from "../../config/db.js";

export const returnGroups = async (req, res) => {
  const { customer_id } = req.query;

  try {
    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "Missing customer_id",
      });
    }

    // ✅ Fetch only groups for that customer
    const [groups] = await pool.execute(
      `
      SELECT 
        group_id,
        group_name,
        created_at,
        total_contacts
      FROM contact_group
      WHERE customer_id = ?
      ORDER BY created_at DESC
      `,
      [customer_id]
    );

    return res.status(200).json({
      success: true,
      data: groups, // Array of { group_id, group_name, total_contacts, created_at }
    });
  } catch (error) {
    console.error("❌ Error fetching group data:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
