import fetch from "node-fetch";
import { pool } from "../../config/db.js";

export const blockUsers = async (req, res) => {
  const { customer_id } = req.params;
  const { contact_ids } = req.body; // expect array of contact_ids e.g. [101, 102, 103]

  if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
    return res.status(400).json({ success: false, message: "contact_ids must be a non-empty array" });
  }

  try {
    // 1️⃣ Fetch Gupshup credentials for the given customer
    const [configRows] = await pool.query(
      "SELECT gupshup_id, token FROM gupshup_configuration WHERE customer_id = ? LIMIT 1",
      [customer_id]
    );

    if (!configRows || configRows.length === 0) {
      return res.status(404).json({ success: false, message: "Gupshup configuration not found" });
    }

    const { gupshup_id, token } = configRows[0];

    // 2️⃣ Get full WhatsApp numbers for the given contact_ids
    const [contacts] = await pool.query(
      `SELECT contact_id, CONCAT(country_code, mobile_no) AS full_no
       FROM contact 
       WHERE customer_id = ? AND contact_id IN (${contact_ids.map(() => "?").join(",")})`,
      [customer_id, ...contact_ids]
    );

    if (!contacts || contacts.length === 0) {
      return res.status(404).json({ success: false, message: "No matching contacts found" });
    }

    const phone_numbers = contacts.map(c => c.full_no);

    // 3️⃣ Prepare block list payload
    const payload = {
      messaging_product: "whatsapp",
      block_users: phone_numbers.map(num => ({ user: num })),
    };

    // 4️⃣ Call Gupshup API to block users
    const response = await fetch(`https://partner.gupshup.io/partner/app/${gupshup_id}/user/block`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.status !== "success") {
      console.error("Gupshup API block error:", data);
      return res.status(400).json({
        success: false,
        message: "Failed to block users on Gupshup",
        details: data,
      });
    }

    // 5️⃣ Update local contact table for all contact_ids
    await pool.query(
      `UPDATE contact 
       SET block = 1 
       WHERE customer_id = ? AND contact_id IN (${contact_ids.map(() => "?").join(",")})`,
      [customer_id, ...contact_ids]
    );

    // 6️⃣ Respond with result
    res.json({
      success: true,
      message: "Users blocked successfully",
      totalBlocked: contact_ids.length,
      blockedContacts: contacts,
    });

  } catch (error) {
    console.error("Error blocking users:", error);
    res.status(500).json({
      success: false,
      message: "Server error while blocking users",
      error: error.message,
    });
  }
};
