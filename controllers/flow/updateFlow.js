// import { pool } from "../../config/db.js";

// /**
//  * UPDATE FLOW
//  * flow_id required
//  */
// export async function updateFlow(req, res) {
//   try {
//     const { flow_id } = req.params;
//     const {
//       flow_name,
//       triggers,
//       flow_json,
//       priority,
//       type,
//     } = req.body;

//     if (!flow_id) {
//       return res.status(400).json({
//         success: false,
//         message: "flow_id is required",
//       });
//     }

//     // Fetch existing record to merge updated fields
//     const [existing] = await pool.execute(`SELECT * FROM flows WHERE id = ?`, [flow_id]);

//     if (existing.length === 0) {
//       return res.status(404).json({ success: false, message: "Flow not found" });
//     }

//     const updatedValues = {
//       flow_name: flow_name ?? existing[0].flow_name,
//       triggers: triggers ? JSON.stringify(triggers) : existing[0].triggers,
//       flow_json: flow_json ? JSON.stringify(flow_json) : existing[0].flow_json,
//       priority: priority ?? existing[0].priority,
//       type: type ?? existing[0].type,
//     };

//     const sql = `
//       UPDATE flows SET 
//       flow_name = ?, triggers = ?, flow_json = ?, priority = ?, type = ?
//       WHERE id = ?
//     `;

//     await pool.execute(sql, [
//       updatedValues.flow_name,
//       updatedValues.triggers,
//       updatedValues.flow_json,
//       updatedValues.priority,
//       updatedValues.type,
//       flow_id,
//     ]);

//     return res.json({
//       success: true,
//       message: "Flow updated successfully",
//     });

//   } catch (error) {
//     console.error("Error updating flow:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// }

import { pool } from "../../config/db.js";

// Convert ["hi"] → [{keyword:"hi", match_type:"exact"}]
function normalizeTriggers(triggers) {
  return triggers.map(t => {
    if (typeof t === "string") {
      return { keyword: t, match_type: "exact" };
    }
    return t;
  });
}

export async function updateFlow(req, res) {
  let connection;

  try {
    const { flow_id } = req.params;
    const {
      flow_name,
      status,
      triggers,
      flow_json,
      priority,
      type,
    } = req.body;

    if (!flow_id) {
      return res.status(400).json({
        success: false,
        message: "flow_id is required",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Find existing flow
    const [existing] = await connection.execute(
      `SELECT * FROM flows WHERE id = ?`,
      [flow_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Flow not found" });
    }

    const row = existing[0];

    // ---------------------------
    // PROCESS TRIGGERS
    // ---------------------------
    let processedTriggers;

    if (Array.isArray(triggers)) {
      processedTriggers = normalizeTriggers(triggers);
    } else {
      // Parse existing stored ["hi","hello"]
      const existingKeywords = JSON.parse(row.triggers || "[]");
      processedTriggers = normalizeTriggers(
        existingKeywords.map(k => ({ keyword: k, match_type: "exact" }))
      );
    }

    const triggerKeywords = processedTriggers.map(t => t.keyword);

    // ---------------------------
    // Prepare updated values
    // ---------------------------
    const updatedValues = {
      flow_name: flow_name ?? row.flow_name,
      status: status ?? row.status,
      triggers: JSON.stringify(triggerKeywords),
      flow_json: flow_json ? JSON.stringify(flow_json) : row.flow_json,
      priority: priority ?? row.priority,
      type: type ?? row.type,
    };

    // ---------------------------
    // Update flows table
    // ---------------------------
    await connection.execute(
      `
      UPDATE flows SET 
        flow_name = ?, 
        status = ?, 
        triggers = ?, 
        flow_json = ?, 
        priority = ?, 
        type = ?
      WHERE id = ?
      `,
      [
        updatedValues.flow_name,
        updatedValues.status,
        updatedValues.triggers,
        updatedValues.flow_json,
        updatedValues.priority,
        updatedValues.type,
        flow_id,
      ]
    );

    // --------------------------------------------
    // SMART UPDATE LOGIC FOR flow_triggers
    // --------------------------------------------

    // Load existing triggers from DB
    const [existingTriggers] = await connection.execute(
      `SELECT id, keyword, match_type FROM flow_triggers WHERE flow_id = ?`,
      [flow_id]
    );

    const existingMap = new Map();
    existingTriggers.forEach(t => existingMap.set(t.keyword, t));

    const finalTriggerIds = [];

    // Process new triggers
    for (const trg of processedTriggers) {
      const old = existingMap.get(trg.keyword);

      if (old) {
        // Exists → UPDATE match_type
        await connection.execute(
          `UPDATE flow_triggers SET match_type = ? WHERE id = ?`,
          [trg.match_type, old.id]
        );

        finalTriggerIds.push(old.id);

        // Remove from map → mark as handled
        existingMap.delete(trg.keyword);

      } else {
        // New trigger → INSERT
        const [insertRes] = await connection.execute(
          `
          INSERT INTO flow_triggers (customer_id, flow_id, keyword, match_type)
          VALUES (?, ?, ?, ?)
          `,
          [row.customer_id, flow_id, trg.keyword, trg.match_type]
        );

        finalTriggerIds.push(insertRes.insertId);
      }
    }

    // Remaining items in existingMap → removed triggers → DELETE
    for (const removed of existingMap.values()) {
      await connection.execute(`DELETE FROM flow_triggers WHERE id = ?`, [
        removed.id,
      ]);
    }

    await connection.commit();

    return res.json({
      success: true,
      message: "Flow updated successfully",
      flow_id,
      trigger_ids: finalTriggerIds,
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error updating flow:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
}
