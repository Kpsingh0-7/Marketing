import { pool } from "../../config/db.js";

/**
 * UPDATE FLOW
 * flow_id required
 */
export async function updateFlow(req, res) {
  try {
    const { flow_id } = req.params;
    const {
      flow_name,
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

    // Fetch existing record to merge updated fields
    const [existing] = await pool.execute(`SELECT * FROM flows WHERE id = ?`, [flow_id]);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Flow not found" });
    }

    const updatedValues = {
      flow_name: flow_name ?? existing[0].flow_name,
      triggers: triggers ? JSON.stringify(triggers) : existing[0].triggers,
      flow_json: flow_json ? JSON.stringify(flow_json) : existing[0].flow_json,
      priority: priority ?? existing[0].priority,
      type: type ?? existing[0].type,
    };

    const sql = `
      UPDATE flows SET 
      flow_name = ?, triggers = ?, flow_json = ?, priority = ?, type = ?
      WHERE id = ?
    `;

    await pool.execute(sql, [
      updatedValues.flow_name,
      updatedValues.triggers,
      updatedValues.flow_json,
      updatedValues.priority,
      updatedValues.type,
      flow_id,
    ]);

    return res.json({
      success: true,
      message: "Flow updated successfully",
    });

  } catch (error) {
    console.error("Error updating flow:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

