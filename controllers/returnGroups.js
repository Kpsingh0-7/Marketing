import { pool } from "../config/db.js";

export const returnGroups = async (req, res) => {
  const { group_id } = req.query;

  try {
    if (!group_id) {
      // ✅ Only return group_id and group_name
      const [groups] = await pool.execute(
        `SELECT group_id, group_name FROM contact_group ORDER BY group_name`
      );

      return res.status(200).json({
        success: true,
        data: groups, // Array of { group_id, group_name }
      });
    } else {
      // ✅ Return customers (contact_id, name, mobile_no) in that group
      const [customers] = await pool.execute(
        `
        SELECT c.contact_id, c.name, c.last_name, c.mobile_no
        FROM contact_group_map gm
        JOIN contact c ON gm.contact_id = c.contact_id
        WHERE gm.group_id = ?
        `,
        [group_id]
      );

      return res.status(200).json({
        success: true,
        data: customers, // Array of { contact_id, name, mobile_no }
      });
    }
  } catch (error) {
    console.error("❌ Error fetching group or customer data:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
