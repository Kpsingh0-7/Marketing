// import { pool } from "../../config/db.js";

// export async function returnFlow(req, res) {
//   try {
//     const { customer_id, flow_id } = req.query;

//     if (!customer_id) {
//       return res.status(400).json({
//         success: false,
//         message: "customer_id is required",
//       });
//     }

//     let sql = `SELECT * FROM flows WHERE customer_id = ?`;
//     let values = [customer_id];

//     if (flow_id) {
//       sql += ` AND id = ?`;
//       values.push(flow_id);
//     }

//     const [rows] = await pool.execute(sql, values);

//     return res.json({
//       success: true,
//       data: rows,
//     });

//   } catch (error) {
//     console.error("Error returning flow:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// }

import { pool } from "../../config/db.js";

export async function returnFlow(req, res) {
  try {
    const { customer_id, flow_id } = req.query;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "customer_id is required",
      });
    }

    // ------------------------------
    // Get flows
    // ------------------------------
    let sql = `SELECT * FROM flows WHERE customer_id = ?`;
    let values = [customer_id];

    if (flow_id) {
      sql += ` AND id = ?`;
      values.push(flow_id);
    }

    const [flows] = await pool.execute(sql, values);

    if (flows.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    // ------------------------------
    // Collect flow_ids to pull triggers
    // ------------------------------
    const flowIds = flows.map(f => f.id);

    const [triggerRows] = await pool.execute(
      `SELECT * FROM flow_triggers WHERE customer_id = ? AND flow_id IN (${flowIds.map(() => "?").join(",")})`,
      [customer_id, ...flowIds]
    );

    // ------------------------------
    // Merge triggers into each flow record
    // ------------------------------
    const flowMap = flows.map(flow => ({
      ...flow,
      triggers_list: triggerRows.filter(t => t.flow_id === flow.id)
    }));

    return res.json({
      success: true,
      data: flowMap,
    });

  } catch (error) {
    console.error("Error returning flow:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}
