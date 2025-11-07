import axios from "axios";
import { pool } from "../../config/db.js";

export const syncContacts = async (req, res) => {
  const { customer_id } = req.query;

  // ✅ Step 1: Validate input
  if (!customer_id) {
    return res.status(400).json({
      success: false,
      message: "Missing required field: customer_id",
    });
  }

  try {
    // ✅ Step 2: Fetch data from FoodChow API
    const { data } = await axios.get(
      `https://api.foodchow.com/api/UserMaster/GetFoodPosCustomers?shop_id=${customer_id}`
    );

    // ✅ Step 3: Handle empty or invalid response
    if (!data.success || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No contacts found...",
        inserted: 0,
        skipped: 0,
      });
    }

    // ✅ Step 4: Filter valid WhatsApp numbers
    const validContacts = data.data.filter(
      (c) => c.whatsapp_number && c.whatsapp_number.trim() !== ""
    );

    if (validContacts.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No valid WhatsApp contacts found",
        inserted: 0,
        skipped: 0,
      });
    }

    // ✅ Step 5: Remove duplicates within fetched data
    const uniqueContacts = Array.from(
      new Map(validContacts.map((c) => [c.whatsapp_number, c])).values()
    );

    let inserted = 0;
    let skipped = 0;

    // ✅ Step 6: Process each contact
    for (const contact of uniqueContacts) {
      const { name, whatsapp_country_code, whatsapp_number } = contact;

      // Check if already exists in DB
      const [existing] = await pool.execute(
        `SELECT contact_id FROM contact WHERE customer_id = ? AND mobile_no = ? LIMIT 1`,
        [customer_id, whatsapp_number]
      );

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Insert new contact
      await pool.execute(
        `
        INSERT INTO contact (customer_id, country_code, first_name, mobile_no)
        VALUES (?, ?, ?, ?)
      `,
        [customer_id, whatsapp_country_code || "", name || "Guest", whatsapp_number]
      );

      inserted++;
    }

    // ✅ Step 7: Return summary response
    return res.status(200).json({
      success: true,
      message: "Contact sync completed successfully",
      inserted,
      skipped,
      totalFetched: validContacts.length,
      uniqueFetched: uniqueContacts.length,
    });
  } catch (error) {
    console.error("❌ Error syncing contacts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
