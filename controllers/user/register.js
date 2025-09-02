import { pool } from "../../config/db.js";

export const register = async (req, res) => {
  const {
    customer_id,
    first_name,
    last_name,
    mobile_no,
    profile_image,
    email_id,
    password,
    address,
    status = "inactive",
  } = req.body;

  try {
    // ✅ Validate required fields
    if (!customer_id || !email_id || !password) {
      return res.status(400).json({
        status: "error",
        message: "customer_id, email_id, and password are required",
      });
    }

    // ✅ Check if customer_id OR email_id already exist
    const [existing] = await pool.query(
      `SELECT customer_id, email_id FROM customer WHERE customer_id = ? OR email_id = ?`,
      [customer_id, email_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        status: "error",
        message:
          existing[0].customer_id === customer_id
            ? "Customer ID already exists"
            : "Email ID already exists",
      });
    }

    // ✅ Insert into customer table
    const insertCustomerQuery = `
      INSERT INTO customer 
      (customer_id, first_name, last_name, mobile_no, profile_image, email_id, password, address, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.query(insertCustomerQuery, [
      customer_id,
      first_name || null,
      last_name || null,
      mobile_no || null,
      profile_image || null,
      email_id,
      password.toLowerCase(), // 🔑 plain text (no hashing)
      address || null,
      status,
    ]);

    // ✅ Allowed Routes
    const allowedRoutes = JSON.stringify([
      "/login",
      "/register",
      "/forgot-password",
      "/",
      "/dashboard",
      "/contact",
      "/contact/group",
      "/templates",
      "/templates/explore",
      "/chats",
      "/broadcast",
      "/settings",
      "/help",
    ]);

    // ✅ Insert into customer_user_access table
    const insertAccessQuery = `
      INSERT INTO customer_user_access (customer_id, allowed_routes)
      VALUES (?, ?)
    `;

    await pool.query(insertAccessQuery, [customer_id, allowedRoutes]);

    return res.status(201).json({
      status: "success",
      message: "Customer created successfully",
    });
  } catch (error) {
    console.error("Error adding customer:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};
