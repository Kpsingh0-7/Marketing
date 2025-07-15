import { pool } from "../../config/db.js";

// GET /users?customer_id=123
export const getSubUser = async (req, res) => {
  const { customer_id } = req.query;

  if (!customer_id) {
    return res.status(400).json({
      success: false,
      message: "customer_id is required",
    });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        cu.user_id,
        cu.name,
        cu.email,
        cu.mobile_no,
        cu.created_at,
        cu.updated_at,
        IFNULL(cua.allowed_routes, '[]') AS allowed_routes
      FROM customer_users cu
      LEFT JOIN customer_user_access cua
        ON cu.user_id = cua.user_id AND cu.customer_id = cua.customer_id
      WHERE cu.customer_id = ?
      `,
      [customer_id]
    );

    // Parse JSON field
    const users = rows.map((row) => ({
      ...row,
      allowed_routes: JSON.parse(row.allowed_routes),
    }));

    return res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("❌ Error fetching customer users:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
