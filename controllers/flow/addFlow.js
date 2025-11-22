import { pool } from "../../config/db.js";

export async function addFlow(req, res) {
  try {
    const {
      customer_id,
      flow_name,
      triggers = [],
      flow_json,
      priority = 10,
      type = "inbound",
    } = req.body;

    // ------------------------------
    // Input Validations
    // ------------------------------
    if (!customer_id || !flow_name || !flow_json) {
      return res.status(400).json({
        success: false,
        message: "customer_id, flow_name and flow_json are required",
      });
    }

    if (!Array.isArray(triggers)) {
      return res.status(400).json({
        success: false,
        message: "triggers must be an array",
      });
    }

    // Validate JSON object
    try {
      JSON.stringify(flow_json);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "flow_json is not valid JSON",
      });
    }

    // ------------------------------
    // MySQL Insert Query
    // ------------------------------
    const sql = `
      INSERT INTO flows 
      (customer_id, flow_name, triggers, flow_json, priority, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
      customer_id,
      flow_name,
      JSON.stringify(triggers),
      JSON.stringify(flow_json),
      priority,
      type,
    ];

    const [result] = await pool.execute(sql, values);

    return res.status(201).json({
      success: true,
      message: "Flow created successfully",
      flow_id: result.insertId,
    });

  } catch (error) {
    console.error("Error inserting flow:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}
