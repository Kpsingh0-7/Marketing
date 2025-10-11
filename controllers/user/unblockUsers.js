import fetch from "node-fetch";
import { pool } from "../../config/db.js";

export const unblockUsers = async (req, res) => {
  const { customer_id } = req.params;
  const { contact_ids } = req.body; // e.g. [1, 2, 3]

  if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: "contact_ids must be a non-empty array",
    });
  }

  try {
    // 1️⃣ Get Gupshup credentials
    const [configRows] = await pool.query(
      "SELECT gupshup_id, token FROM gupshup_configuration WHERE customer_id = ? LIMIT 1",
      [customer_id]
    );

    if (!configRows || configRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gupshup configuration not found",
      });
    }

    const { gupshup_id, token } = configRows[0];

    // 2️⃣ Get full WhatsApp numbers for provided contact_ids
    const [contacts] = await pool.query(
      `SELECT CONCAT(country_code, mobile_no) AS full_no
       FROM contact 
       WHERE customer_id = ? AND contact_id IN (${contact_ids.map(() => "?").join(",")})`,
      [customer_id, ...contact_ids]
    );

    if (contacts.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No matching contacts found for given contact_ids",
      });
    }

    const phone_numbers = contacts.map(c => c.full_no);

    // 3️⃣ Prepare payload
    const payload = {
      messaging_product: "whatsapp",
      block_users: phone_numbers.map(num => ({ user: num })),
    };

    // 4️⃣ Call Gupshup unblock API
    const response = await fetch(
      `https://partner.gupshup.io/partner/app/${gupshup_id}/user/unblock`,
      {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (data.status !== "success") {
      console.error("Gupshup API Unblock Error:", data);
      return res.status(400).json({
        success: false,
        message: "Failed to unblock users on Gupshup",
        details: data,
      });
    }

    // 5️⃣ Update DB: set block = 0 for these contacts
    const placeholders = contact_ids.map(() => "?").join(",");
    const sql = `
      UPDATE contact 
      SET block = 0 
      WHERE customer_id = ? AND contact_id IN (${placeholders})
    `;

    const values = [customer_id, ...contact_ids];
    const [result] = await pool.query(sql, values);

    // 6️⃣ Success response
    res.json({
      success: true,
      message: "Users unblocked successfully",
      totalUnblocked: data.block_users?.removed_users?.length || 0,
      rowsAffected: result.affectedRows,
      unblockedNumbers: phone_numbers,
    });
  } catch (error) {
    console.error("Error unblocking users:", error);
    res.status(500).json({
      success: false,
      message: "Server error while unblocking users",
      error: error.message,
    });
  }
};
