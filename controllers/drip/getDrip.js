import { pool } from "../../config/db.js";

export async function getDrip(req, res) {
  try {
    const { customer_id } = req.params;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "customer_id is required",
      });
    }

    const sql = `
      SELECT
        id AS drip_id,
        customer_id,
        drip_name,
        drip_description,
        status,
        drip_json,
        allow_once,
        continue_after_delivery,
        days,
        time_from,
        time_to,
        time_type,
        created_at
      FROM drip
      WHERE customer_id = ?
      ORDER BY id DESC
    `;

    const [rows] = await pool.execute(sql, [customer_id]);

    if (rows.length === 0) {
      return res.json({
        success: true,
        message: "No drips found for this customer",
        data: [],
      });
    }

    const drips = rows.map((drip) => {
      let parsedSteps = [];
      let parsedDays = [];

      // ---- Parse drip_json safely inside code ----
      try {
        if (typeof drip.drip_json === "string") {
          // Ignore invalid "[object Object]"
          if (drip.drip_json !== "[object Object]") {
            const json = JSON.parse(drip.drip_json);
            parsedSteps = json.steps || [];
          }
        } else if (typeof drip.drip_json === "object") {
          parsedSteps = drip.drip_json.steps || [];
        }
      } catch (e) {
        console.error("Error parsing drip_json:", e);
      }

      // ---- Parse days safely inside code ----
      try {
        if (typeof drip.days === "string") {
          if (drip.days.includes(",")) {
            parsedDays = drip.days.split(",").map((d) => d.trim());
          } else {
            parsedDays = JSON.parse(drip.days);
          }
        } else if (Array.isArray(drip.days)) {
          parsedDays = drip.days;
        }
      } catch (e) {
        console.error("Error parsing days:", e);
      }

      return {
        drip_id: drip.drip_id,
        customer_id: drip.customer_id,
        drip_name: drip.drip_name,
        drip_description: drip.drip_description,
        status: drip.status,
        steps: parsedSteps,
        delivery_preferences: {
          allow_once: drip.allow_once,
          continue_after_delivery: drip.continue_after_delivery,
          days: parsedDays,
          time_from: drip.time_from,
          time_to: drip.time_to,
          time_type: drip.time_type,
        },
        created_at: drip.created_at,
      };
    });

    return res.json({
      success: true,
      message: "Drips fetched successfully",
      count: drips.length,
      data: drips,
    });
  } catch (error) {
    console.error("❌ Error getting drips:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
