import fetch from "node-fetch";
import { pool } from "../../config/db.js";

export const updateBlockedUsers = async (req, res) => {
  const { customer_id } = req.params;

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

    let afterCursor = null;
    const blockedNumbers = [];

    // 2️⃣ Fetch all blocked users (handle pagination)
    do {
      let apiUrl = `https://partner.gupshup.io/partner/app/${gupshup_id}/user/blocklist?limit=100`;
      if (afterCursor) apiUrl += `&after=${afterCursor}`;

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          accept: "application/json",
          Authorization: token,
        },
      });

      const data = await response.json();

      if (data.status !== "success") {
        console.error("Gupshup API Error:", data);
        return res.status(400).json({
          success: false,
          message: "Failed to fetch blocklist",
          details: data,
        });
      }

      const numbers = data.data.map(u => u.wa_id);
      blockedNumbers.push(...numbers);

      afterCursor = data?.paging?.cursors?.after || null;
    } while (afterCursor);

    // 3️⃣ Update local contact table by matching full number (country_code + mobile_no)
    if (blockedNumbers.length > 0) {
      const placeholders = blockedNumbers.map(() => "?").join(",");
      const sql = `
        UPDATE contact 
        SET block = 1 
        WHERE customer_id = ?
        AND CONCAT(country_code, mobile_no) IN (${placeholders})
      `;

      const values = [customer_id, ...blockedNumbers];
      const [result] = await pool.query(sql, values);

      res.json({
        success: true,
        message: "Blocked contacts updated successfully",
        totalBlocked: blockedNumbers.length,
        rowsAffected: result.affectedRows,
      });
    } else {
      res.json({
        success: true,
        message: "No blocked users found from Gupshup",
        totalBlocked: 0,
      });
    }

  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating blocked users",
      error: error.message,
    });
  }
};
