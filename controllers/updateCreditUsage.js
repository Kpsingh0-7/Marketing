import { pool } from '../config/db.js';
import moment from 'moment';

export const updateCreditUsage = async (customer_id) => {
  const today = moment().format('YYYY-MM-DD');
  const creditConsumed = 1;
  const costPerMsg = 0.65;
  const gsFee = 0.20;
  const metaFee = 0.45;

  try {
    const [existingUsage] = await pool.execute(
      `SELECT id, credit_remaining FROM customer_credit_usage 
       WHERE customer_id = ? AND usage_date = ?`,
      [customer_id, today]
    );

    if (existingUsage.length > 0) {
      const currentRemaining = parseFloat(existingUsage[0].credit_remaining || 0);
      const newRemaining = Math.max(currentRemaining - creditConsumed, 0);

      await pool.execute(
        `UPDATE customer_credit_usage 
         SET 
           messages_sent = messages_sent + 1,
           credit_consumed = credit_consumed + ?,
           credit_remaining = ?,
           total_cost = total_cost + ?,
           gupshup_fees = gupshup_fees + ?,
           meta_fees = meta_fees + ?,
           updated_at = NOW()
         WHERE customer_id = ? AND usage_date = ?`,
        [creditConsumed, newRemaining, costPerMsg, gsFee, metaFee, customer_id, today]
      );
    } else {
      const [[customerData]] = await pool.execute(
        `SELECT credit FROM customer WHERE customer_id = ?`,
        [customer_id]
      );

      const totalCredit = parseFloat(customerData?.credit || 0);
      const remainingCredit = Math.max(totalCredit - creditConsumed, 0);

      await pool.execute(
        `INSERT INTO customer_credit_usage 
         (customer_id, usage_date, credit_consumed, credit_remaining, messages_sent, total_cost, gupshup_fees, meta_fees) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [customer_id, today, creditConsumed, remainingCredit, 1, costPerMsg, gsFee, metaFee]
      );
    }
  } catch (err) {
    console.error('Error updating credit usage:', err.message);
    throw err;
  }
};
