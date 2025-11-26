import { pool } from "../../config/db.js";

export async function addFlow(req, res) {
  let connection;

  try {
    connection = await pool.getConnection();

    let {
      customer_id,
      flow_name,
      status,
      triggers = [],   // can be ["hi"] or [{keyword:"hi", match_type:"exact"}]
      flow_json,
      priority = 1,
      type = "inbound",
    } = req.body;

    // ------------------------------
    // Basic validation
    // ------------------------------
    if (!customer_id || !flow_name || !status || !flow_json) {
      return res.status(400).json({
        success: false,
        message: "customer_id, flow_name, status and flow_json are required",
      });
    }

    // ------------------------------
    // Normalize triggers
    // ------------------------------

    // If user sent: ["hi","hello"]
    if (Array.isArray(triggers) && typeof triggers[0] === "string") {
      triggers = triggers.map(t => ({
        keyword: t,
        match_type: "exact",
      }));
    }

    // Validate
    if (!Array.isArray(triggers) || triggers.some(t => !t.keyword)) {
      return res.status(400).json({
        success: false,
        message: "triggers must be an array of string OR array of {keyword, match_type}",
      });
    }

    // Prepare JSON for flows table
    const triggersJSON = triggers.map(t => t.keyword);

    // ------------------------------
    // Start transaction
    // ------------------------------
    await connection.beginTransaction();

    // ------------------------------
    // Insert into flows
    // ------------------------------
    const insertFlowSQL = `
      INSERT INTO flows 
      (customer_id, flow_name, status, triggers, flow_json, priority, type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [flowResult] = await connection.execute(insertFlowSQL, [
      customer_id,
      flow_name,
      status,
      JSON.stringify(triggersJSON),   // store only keywords in flows table
      JSON.stringify(flow_json),
      priority,
      type,
    ]);

    const flow_id = flowResult.insertId;

    // ------------------------------
    // Insert into flow_triggers
    // ------------------------------
    const trigger_ids = [];

    if (triggers.length > 0) {
      const insertTriggerSQL = `
        INSERT INTO flow_triggers
        (customer_id, flow_id, keyword, match_type)
        VALUES (?, ?, ?, ?)
      `;

      for (const trg of triggers) {
        const [trgResult] = await connection.execute(insertTriggerSQL, [
          customer_id,
          flow_id,
          trg.keyword,
          trg.match_type || "exact",
        ]);

        trigger_ids.push(trgResult.insertId);
      }
    }

    // ------------------------------
    // Commit
    // ------------------------------
    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Flow created successfully",
      flow_id,
      trigger_ids,
    });

  } catch (error) {
    console.error("Error inserting flow:", error);

    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
}
