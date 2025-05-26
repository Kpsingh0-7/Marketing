import { pool } from "../config/db.js";

export const addSingleContact = async (req, res) => {
  const { shop_id, user_country_code, name, mobile_no } = req.body;

  // ✅ Step 1: Validate input
  if (!shop_id || !user_country_code || !name || !mobile_no) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: shop_id, user_country_code, name, or mobile_no",
    });
  }

  try {
    // ✅ Step 2: Check for existing contact
    const [existing] = await pool.execute(
      `SELECT customer_id FROM wp_customer_marketing WHERE shop_id = ? AND mobile_no = ?`,
      [shop_id, mobile_no]
    ); 

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Mobile number already exists for this shop",
      });
    }

    // ✅ Step 3: Insert new contact
    const [result] = await pool.execute(
      `
        INSERT INTO wp_customer_marketing (shop_id, user_country_code, name, mobile_no)
        VALUES (?, ?, ?, ?)
      `,
      [shop_id, user_country_code, name, mobile_no]
    );

    return res.status(201).json({
      success: true,
      message: "Customer added successfully",
      customer_id: result.insertId,
    });

  } catch (error) {
    console.error("❌ Error adding contact:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
