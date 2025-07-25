import { pool } from "../../config/db.js";

export const checkCustomerCredit = async (customer_id) => {
  try {
    const [rows] = await pool.execute(
      `SELECT credit_remaining 
       FROM customer_credit_usage 
       WHERE customer_id = ? 
       ORDER BY usage_date DESC 
       LIMIT 1`,
      [customer_id]
    );

    if (rows.length === 0) {
      return { success: false, message: "No credit data found for this customer." };
    }

    const creditRemaining = parseFloat(rows[0].credit_remaining);

    if (creditRemaining <= 0) {
      return {
        success: false,
        message: "Credit amount is not enough to send message. Please add credit and then try.",
        
      };
    }

    return { success: true, credit_remaining: creditRemaining };
  } catch (error) {
    console.error("Error checking customer credit:", error);
    return { success: false, message: "Error checking customer credit." };
  }
};
