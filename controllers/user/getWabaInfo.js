import { pool } from "../../config/db.js";

export const getWabaInfo = async (req, res) => {
  const { customer_id } = req.params;

  if (!customer_id) {
    return res.status(400).json({ error: "customer_id is required" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, customer_id, accountStatus, dockerStatus, messagingLimit, mmLiteStatus, ownershipType,
              phone, phoneQuality, throughput, verifiedName, timezone, canSendMessage, errors, additionalInfo,
              created_at, updated_at
       FROM wabainfo
       WHERE customer_id = ?`,
      [customer_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "No WABA info found for this customer" });
    }

    // Return first record (assuming one WABA account per customer)
    const wabaInfo = rows[0];

    res.json({
      status: "success",
      wabaInfo
    });
  } catch (err) {
    console.error("Failed to fetch WABA info:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Example route in Express
// router.get("/waba/:customer_id", getWabaInfoByCustomer);
