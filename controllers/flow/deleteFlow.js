// import { pool } from "../../config/db.js";

// /**
//  * DELETE FLOW
//  * flow_id required
//  */
// export async function deleteFlow(req, res) {
//   try {
//     const { flow_id } = req.params;

//     if (!flow_id) {
//       return res.status(400).json({ success: false, message: "flow_id is required" });
//     }

//     const [result] = await pool.execute(`DELETE FROM flows WHERE id = ?`, [flow_id]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ success: false, message: "Flow not found" });
//     }

//     return res.json({
//       success: true,
//       message: "Flow deleted successfully",
//     });

//   } catch (error) {
//     console.error("Error deleting flow:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// }

import { pool } from "../../config/db.js";

/**
 * DELETE FLOW (flow + triggers + related data)
 */
export async function deleteFlow(req, res) {
  let connection;

  try {
    const { flow_id } = req.params;

    if (!flow_id) {
      return res.status(400).json({
        success: false,
        message: "flow_id is required",
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1️⃣ Delete triggers
    await connection.execute(
      `DELETE FROM flow_triggers WHERE flow_id = ?`,
      [flow_id]
    );

    // 2️⃣ Delete sessions (if your system uses flow_sessions)
    await connection.execute(
      `DELETE FROM user_sessions WHERE active_flow_id = ?`,
      [flow_id]
    );

    // 3️⃣ Delete main flow
    const [flowDelete] = await connection.execute(
      `DELETE FROM flows WHERE id = ?`,
      [flow_id]
    );

    if (flowDelete.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Flow not found",
      });
    }

    await connection.commit();

    return res.json({
      success: true,
      message: "Flow deleted successfully",
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error deleting flow:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
}
