import { pool } from "../config/db.js";

export const returnCustomerCreditUsage = async (req, res) => {
  const { customer_id } = req.query;

  if (!customer_id) {
    return res.status(400).json({ error: "customer_id is required" });
  }

  try {
    const [rows] = await pool.execute(
      `
   SELECT 
  customer_id,
  DATE_FORMAT(usage_date, '%Y-%m-%d') AS usage_date,
  credit_consumed,
  credit_remaining,
  messages_sent,
  messages_received,
  total_cost,
  gupshup_fees,
  meta_fees
FROM 
  customer_credit_usage
WHERE 
  customer_id = ?
ORDER BY 
  usage_date ASC

      `,
      [customer_id]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching credit usage:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
