import { pool } from "../../config/db.js";

// Create or update access
const upsertUserAccess = async (customer_id, user_id, allowed_routes) => {
  const [existing] = await pool.query(
    `SELECT id FROM customer_user_access WHERE customer_id = ? AND user_id = ?`,
    [customer_id, user_id]
  );

  if (existing.length > 0) {
    await pool.query(
      `UPDATE customer_user_access SET allowed_routes = ? WHERE customer_id = ? AND user_id = ?`,
      [JSON.stringify(allowed_routes), customer_id, user_id]
    );
  } else {
    await pool.query(
      `INSERT INTO customer_user_access (customer_id, user_id, allowed_routes) VALUES (?, ?, ?)`,
      [customer_id, user_id, JSON.stringify(allowed_routes)]
    );
  }
};

// Create Sub-User
export const createUser = async (req, res) => {
  const { customer_id, name, email, mobile_no, password, allowed_routes } = req.body;
console.log(customer_id, name);
  if (!customer_id || !email || !password) {
    return res.status(400).json({ success: false, error: "Missing required fields." });
  }

  try {
    const [existing] = await pool.query(
      `SELECT user_id FROM customer_users WHERE email = ?`,
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: "Email already exists." });
    }

    const [result] = await pool.query(
      `INSERT INTO customer_users (customer_id, name, email, mobile_no, password) VALUES (?, ?, ?, ?, ?)`,
      [customer_id, name, email, mobile_no, password]
    );

    const user_id = result.insertId;

    await upsertUserAccess(customer_id, user_id, allowed_routes || []);

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      user_id,
    });
  } catch (err) {
    console.error("Create User Error:", err.message);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

// Update Sub-User
export const updateUser = async (req, res) => {
  const { user_id } = req.params;
  const { name, email, mobile_no, password, allowed_routes } = req.body;

  try {
    const [existing] = await pool.query(
      `SELECT customer_id FROM customer_users WHERE user_id = ?`,
      [user_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: "User not found." });
    }

    const customer_id = existing[0].customer_id;

    await pool.query(
      `UPDATE customer_users SET name = ?, email = ?, mobile_no = ?, password = ? WHERE user_id = ?`,
      [name, email, mobile_no, password, user_id]
    );

    if (allowed_routes) {
      await upsertUserAccess(customer_id, user_id, allowed_routes);
    }

    return res.json({ success: true, message: "User updated successfully." });
  } catch (err) {
    console.error("Update User Error:", err.message);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};
