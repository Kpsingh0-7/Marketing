import { pool } from "../../config/db.js";

export const returnAllCustomer = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    // Get total count for pagination
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM customer`);
    const total = countRows[0].total;

    // Fetch paginated customers
    const [customers] = await pool.query(
      `SELECT 
         customer_id, first_name, last_name, mobile_no, profile_image, 
         email_id, address, total_credit, total_credit_consumed, 
         total_credit_remaining, created_at 
       FROM customer
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const enrichedCustomers = await Promise.all(
      customers.map(async (cust) => {
        // Get main customer access
        const [access] = await pool.query(
          `SELECT allowed_routes FROM customer_user_access 
           WHERE customer_id = ? AND user_id IS NULL`,
          [cust.customer_id]
        );

        let allowed_routes = [];

        if (access.length > 0) {
          const raw = access[0].allowed_routes;

          if (typeof raw === "string") {
            try {
              allowed_routes = JSON.parse(raw);
            } catch {
              allowed_routes = raw.split(",");
            }
          } else if (Array.isArray(raw)) {
            allowed_routes = raw;
          }
        }

        // Get sub-users
        const [sub_users] = await pool.query(
          `SELECT cu.*, cua.allowed_routes 
           FROM customer_users cu
           LEFT JOIN customer_user_access cua 
           ON cu.customer_id = cua.customer_id AND cu.user_id = cua.user_id
           WHERE cu.customer_id = ?`,
          [cust.customer_id]
        );

        const enrichedSubUsers = sub_users.map((user) => {
          let routes = [];

          if (user.allowed_routes) {
            if (typeof user.allowed_routes === "string") {
              try {
                routes = JSON.parse(user.allowed_routes);
              } catch {
                routes = user.allowed_routes.split(",");
              }
            } else if (Array.isArray(user.allowed_routes)) {
              routes = user.allowed_routes;
            }
          }

          return {
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            mobile_no: user.mobile_no,
            created_at: user.created_at,
            updated_at: user.updated_at,
            allowed_routes: routes,
          };
        });

        return {
          ...cust,
          allowed_routes,
          sub_users: enrichedSubUsers,
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Customer list retrieved successfully.",
      data: enrichedCustomers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching customer details:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
 