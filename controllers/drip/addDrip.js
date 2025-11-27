import { pool } from "../../config/db.js";

export async function addDrip(req, res) {
  try {
    const data = req.body;

    // ------ Validation ------
    if (!data.customer_id)
      return res
        .status(400)
        .json({ success: false, message: "customer_id is required" });

    if (!data.drip_name)
      return res
        .status(400)
        .json({ success: false, message: "drip_name is required" });

    if (!data.steps || !Array.isArray(data.steps) || data.steps.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "steps array is required" });

    // ------ Sanitize & Normalize Steps ------
    const normalizedSteps = data.steps.map((step, index) => ({
      step: step.step ?? index + 1,
      step_name: step.step_name || `Step ${index + 1}`,
      template_name: step.template_name || null,
      parameters: Array.isArray(step.parameters) ? step.parameters : [],
      delay_minutes: step.delay_minutes ?? 0,
      languageCode: step.languageCode || "en",
      message_preview: step.message_preview || "",
    }));

    // ------ Save JSON ------
    const dripJson = JSON.stringify({ steps: normalizedSteps });

    // ------ Delivery Settings ------
    const delivery = data.delivery_preferences || {};

    const allow_once = delivery.allow_once ?? false;
    const continue_after_delivery = delivery.continue_after_delivery ?? true;
    const days = JSON.stringify(
      delivery.days || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    );
    const time_from = delivery.time_from || null;
    const time_to = delivery.time_to || null;
    const time_type = delivery.time_type || "Time Range";

    // ------ SQL Query ------
    const sql = `
  INSERT INTO drip (
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
    time_type
  )
  VALUES (?, ?, ?, ?, CAST(? AS JSON), ?, ?, CAST(? AS JSON), ?, ?, ?)
`;

    const values = [
      data.customer_id,
      data.drip_name,
      data.drip_description || null,
      data.status || "active",
      dripJson,
      allow_once,
      continue_after_delivery,
      days,
      time_from,
      time_to,
      time_type,
    ];

    const [result] = await pool.execute(sql, values);

    return res.json({
      success: true,
      message: "Drip created successfully",
      drip_id: result.insertId,
      saved_steps: normalizedSteps.length,
    });
  } catch (error) {
    console.error("❌ Error adding drip:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
