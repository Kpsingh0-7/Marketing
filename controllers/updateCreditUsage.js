import { pool } from '../config/db.js';
import moment from 'moment';

export const updateCreditUsage = async (customer_id, direction = 'sent') => {
  const today = moment().format('YYYY-MM-DD');
  const creditConsumed = direction === 'sent' ? 1 : 1;
  const costPerMsg = direction === 'sent' ? 0.65 : 0.65;
  const gsFee = direction === 'sent' ? 0.20 : 0.20;
  const metaFee = direction === 'sent' ? 0.45 : 0.45;

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
           messages_sent = messages_sent + ?,
           messages_received = messages_received + ?,
           credit_consumed = credit_consumed + ?,
           credit_remaining = ?,
           total_cost = total_cost + ?,
           gupshup_fees = gupshup_fees + ?,
           meta_fees = meta_fees + ?,
           updated_at = NOW()
         WHERE customer_id = ? AND usage_date = ?`,
        [
          direction === 'sent' ? 1 : 0,
          direction === 'received' ? 1 : 0,
          creditConsumed,
          newRemaining,
          costPerMsg,
          gsFee,
          metaFee,
          customer_id,
          today
        ]
      );
    } else {
      // Get previous day's credit_remaining
      const [[prevUsage]] = await pool.execute(
        `SELECT credit_remaining FROM customer_credit_usage 
         WHERE customer_id = ? AND usage_date < ? 
         ORDER BY usage_date DESC 
         LIMIT 1`,
        [customer_id, today]
      );

      let previousCredit = prevUsage ? parseFloat(prevUsage.credit_remaining || 0) : null;

      // If no previous usage, get credit from customer table
      if (previousCredit === null) {
        const [[customerData]] = await pool.execute(
          `SELECT credit FROM customer WHERE customer_id = ?`,
          [customer_id]
        );
        previousCredit = parseFloat(customerData?.credit || 0);
      }

      const remainingCredit = Math.max(previousCredit - creditConsumed, 0);

      await pool.execute(
        `INSERT INTO customer_credit_usage 
         (customer_id, usage_date, credit_consumed, credit_remaining, messages_sent, messages_received, total_cost, gupshup_fees, meta_fees) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customer_id,
          today,
          creditConsumed,
          remainingCredit,
          direction === 'sent' ? 1 : 0,
          direction === 'received' ? 1 : 0,
          costPerMsg,
          gsFee,
          metaFee
        ]
      );
    }
  } catch (err) {
    console.error('Error updating credit usage:', err.message);
    throw err;
  }
};
