// import { pool } from "../../config/db.js";

// export async function runFlow(body) {
//   const { phone, message, customer_id } = body;

//   if (!phone || !message) {
//     return {
//       success: false,
//       message: "phone and message are required",
//     };
//   }

//   try {
//     // 1️⃣ Check if user session exists
//     const [sessionRows] = await pool.query(
//       `SELECT * FROM user_sessions WHERE phone = ?`,
//       [phone]
//     );

//     if (sessionRows.length > 0 && sessionRows[0].active_flow_id) {
//       const reply = await continueFlow(sessionRows[0], message, phone);
//       return {
//         success: true,
//         status: "continue",
//         reply,
//       };
//     }

//     // 2️⃣ Detect triggered flow
//     const flow = await getFlowRepliesByNode(customer_id, message);
//     console.log("flow",JSON.stringify(flow, null, 2));
//     if (!flow) {
//       return {
//         success: false,
//         status: "no_match",
//         reply: { type: "text", text: "No matching flow." },
//       };
//     }

//     // 3️⃣ Parse flow JSON
//     const flowJson = safeParse(flow.flow_json);
//     const edges = flowJson?.flowEdges || [];

//     // Find first connected node
//     const firstConnection = edges.find((e) => e.sourceNodeId === "start");

//     const firstNode = firstConnection
//       ? flowJson.flowNodes.find((n) => n.id === firstConnection.targetNodeId)
//       : flowJson.flowNodes.find((n) => n.id === "start");

//     // 4️⃣ Save session
//     await pool.query(
//       `INSERT INTO user_sessions (phone, active_flow_id, current_node_id)
//       VALUES (?, ?, ?)
//       ON DUPLICATE KEY UPDATE 
//         active_flow_id = VALUES(active_flow_id), 
//         current_node_id = VALUES(current_node_id)`,
//       [phone, flow.id, firstNode?.id]
//     );

//     return {
//       success: true,
//       status: "started",
//       reply: firstNode,
//     };
//   } catch (error) {
//     console.error("❌ Flow Error:", error);
//     return {
//       success: false,
//       message: "Internal Server Error",
//       error: error.message,
//     };
//   }
// }


// export async function getFlowRepliesByNode(customer_id, nodeId) {
//   try {
//     if (!customer_id || !nodeId)
//       throw new Error("customer_id and nodeId are required");

//     // Fetch flow JSON from DB
//     const [rows] = await pool.query(
//       `SELECT flow_json FROM flows WHERE customer_id = ? LIMIT 1`,
//       [customer_id]
//     );

//     if (!rows.length) return null;

//     let flowData = rows[0].flow_json;

//     // If DB returned string JSON → parse it
//     if (typeof flowData === "string") {
//       flowData = JSON.parse(flowData);
//     }

//     // If still not valid
//     if (!flowData || !flowData.flowNodes) return null;

//     // Find the node
//     const node = flowData.flowNodes.find(n => n.id === nodeId);

//     if (!node) return null;

//     // Ensure reply is cloned to avoid mutation
//     return JSON.parse(JSON.stringify(node.flowReplies));

//   } catch (err) {
//     console.error("Error in getFlowRepliesByNode:", err);
//     return null;
//   }
// }

//  const replies = await getFlowRepliesByNode("1", "Hi");

//  console.log(replies);


 
import { pool } from "../../config/db.js";

export async function getFlowRepliesByNode(customer_id, nodeId, flow_id = null) {
  try {
    if (!customer_id || !nodeId)
      throw new Error("customer_id and nodeId are required");

    let query = "";
    let params = [];

    // If flow_id passed → use customer_id + flow_id
    if (flow_id) {
      query = `SELECT flow_json FROM flows WHERE customer_id = ? AND id = ? LIMIT 1`;
      params = [customer_id, flow_id];
    } 
    
    // If flow_id NOT passed → use only customer_id
    else {
      query = `SELECT flow_json FROM flows WHERE customer_id = ? LIMIT 1`;
      params = [customer_id];
    }

    const [rows] = await pool.query(query, params);

    if (!rows.length) return null;

    let flowData = rows[0].flow_json;

    if (typeof flowData === "string") {
      flowData = JSON.parse(flowData);
    }

    if (!flowData || !flowData.flowNodes) return null;

    const node = flowData.flowNodes.find(n => n.id === nodeId);

    return node ? JSON.parse(JSON.stringify(node.flowReplies)) : null;

  } catch (err) {
    console.error("Error in getFlowRepliesByNode:", err);
    return null;
  }
}




// ========================= RUN FLOW =========================

// export async function runFlow(body) {
//   const { phone, message, customer_id, button_id } = body;

//   if (!phone || !message || !customer_id) {
//     return { success: false, message: "phone, message and customer_id are required" };
//   }

//   const cleanedMessage = message.trim().toLowerCase();

//   // 🛑 STOP → end session
//   if (cleanedMessage === "stop") {
//     await pool.query(
//       `DELETE FROM user_sessions WHERE phone = ? AND customer_id = ?`,
//       [phone, customer_id]
//     );

//     return {
//       success: true,
//       message: "Flow stopped — session cleared."
//     };
//   }

//   try {
//     // 1️⃣ Check for existing session
//     const [sessionRows] = await pool.query(
//       `SELECT active_flow_id, current_node_id 
//        FROM user_sessions 
//        WHERE phone = ? AND customer_id = ? LIMIT 1`,
//       [phone, customer_id]
//     );

//     if (sessionRows.length > 0) {
//       const { active_flow_id, current_node_id } = sessionRows[0];

//       let nextNodeId = null;

//       // 🆕 PRIORITY: If button_id exists → it is the next node
//       if (button_id) {
//         nextNodeId = button_id;
//       } else {
//         // 🆕 Treat text like a node name first
//         const possibleNode = await getFlowRepliesByNode(customer_id, cleanedMessage);
//         if (possibleNode) {
//           nextNodeId = cleanedMessage;
//         } else {
//           // Fetch current flow node replies
//           const flowReplies = await getFlowRepliesByNode(customer_id, current_node_id);

//           if (flowReplies) {
//             // Try matching button text or ID
//             nextNodeId = detectNextNode(flowReplies, cleanedMessage);

//             // No match → repeat same question
//             if (!nextNodeId) {
//               return { success: true, reply: flowReplies };
//             }
//           }
//         }
//       }

//       // Move session to new node (button or user typed)
//       if (nextNodeId) {
//         await pool.query(
//           `UPDATE user_sessions SET current_node_id = ?, last_interaction = NOW()
//            WHERE phone = ? AND customer_id = ?`,
//           [nextNodeId, phone, customer_id]
//         );

//         const nextReplies = await getFlowRepliesByNode(customer_id, nextNodeId);

//         return nextReplies
//           ? { success: true, reply: nextReplies }
//           : { success: false, message: "Node not found in flow." };
//       }
//     }

//     // 2️⃣ No session → Trigger Search
//     const [triggers] = await pool.query(
//       `SELECT keyword, match_type, flow_id 
//        FROM flow_triggers 
//        WHERE customer_id = ?`,
//       [customer_id]
//     );
// console.log("triggers",triggers);

//     const matchedTrigger = findMatchedTrigger(cleanedMessage, triggers);
// console.log("triggers",matchedTrigger);
//     if (matchedTrigger) {
//       await pool.query(
//         `INSERT INTO user_sessions (phone, customer_id, active_flow_id, current_node_id)
//          VALUES (?, ?, ?, 'start')
//          ON DUPLICATE KEY UPDATE active_flow_id = ?, current_node_id = 'start'`,
//         [phone, customer_id, matchedTrigger.flow_id, matchedTrigger.flow_id]
//       );

//       const startReplies = await getFlowRepliesByNode(customer_id, "start");
//       return { success: true, reply: startReplies };
//     }

//     // 3️⃣ No trigger → Help user
//     return {
//       success: false,
//       message: "Please select a valid option:",
//       options: triggers.map(t => t.keyword)
//     };

//   } catch (err) {
//     console.error("❌ Error in runFlow:", err);
//     return { success: false, message: "Internal server error" };
//   }
// }


export async function runFlow(body) {
  const { phone, message, customer_id, button_id } = body;

  if (!phone || !message || !customer_id) {
    return { success: false, message: "phone, message and customer_id are required" };
  }

  const cleanedMessage = message.trim().toLowerCase();

  // STOP command resets session
  if (cleanedMessage === "stop") {
    await pool.query(
      `DELETE FROM user_sessions WHERE phone = ? AND customer_id = ?`,
      [phone, customer_id]
    );
    return { success: true, message: "Flow stopped — session cleared." };
  }

  try {
    // Fetch existing session
    const [sessionRows] = await pool.query(
      `SELECT active_flow_id, current_node_id 
       FROM user_sessions 
       WHERE phone = ? AND customer_id = ? LIMIT 1`,
      [phone, customer_id]
    );

    // Session Exists → Continue flow
    if (sessionRows.length > 0) {
      const { active_flow_id, current_node_id } = sessionRows[0];

      let nextNodeId = null;

      // Priority → Button Action
      if (button_id) {
        nextNodeId = button_id;
      } else {
        const currentReplies = await getFlowRepliesByNode(customer_id, current_node_id, active_flow_id);

        if (!currentReplies)
          return { success: false, message: "⚠️ Invalid flow node." };

        // Match by button text or ID
        nextNodeId = detectNextNode(currentReplies, cleanedMessage);

        // Handle if flow requires user input (free text)
        if (!nextNodeId && currentReplies.acceptsInput) {
          await saveUserAnswer(active_flow_id, current_node_id, phone, cleanedMessage);
          nextNodeId = currentReplies.nextNode;
        }

        // No match → repeat with feedback
        if (!nextNodeId) {
          return {
            success: true,
            reply: currentReplies,
            feedback: "⚠️ Please select a valid option."
          };
        }
      }

      // Update session pointer
      await pool.query(
        `UPDATE user_sessions SET current_node_id = ?, last_interaction = NOW()
         WHERE phone = ? AND customer_id = ?`,
        [nextNodeId, phone, customer_id]
      );

      const nextReplies = await getFlowRepliesByNode(customer_id, nextNodeId, active_flow_id);

      return nextReplies
        ? { success: true, reply: nextReplies }
        : { success: false, message: "⚠️ Flow step not found." };
    }

    // No session → Check triggers
    const [triggers] = await pool.query(
      `SELECT keyword, match_type, flow_id 
       FROM flow_triggers 
       WHERE customer_id = ?`,
      [customer_id]
    );

    const matchedTrigger = findMatchedTrigger(cleanedMessage, triggers);

    if (matchedTrigger) {
      await pool.query(
        `INSERT INTO user_sessions (phone, customer_id, active_flow_id, current_node_id)
         VALUES (?, ?, ?, 'start')
         ON DUPLICATE KEY UPDATE active_flow_id = ?, current_node_id = 'start'`,
        [phone, customer_id, matchedTrigger.flow_id, matchedTrigger.flow_id]
      );

      const startReplies = await getFlowRepliesByNode(customer_id, "start", matchedTrigger.flow_id);

      return { success: true, reply: startReplies };
    }

    // No trigger found → Show help
    return {
      success: false,
      message: "I didn't understand. Try one of these:",
      options: triggers.map(t => t.keyword)
    };

  } catch (err) {
    console.error("❌ Error in runFlow:", err);
    return { success: false, message: "Internal server error" };
  }
}



// --------------------------------------------
// 🔍 Match Trigger Based on match_type
// exact | contains | regex
// --------------------------------------------
function findMatchedTrigger(message, triggers) {
  for (let t of triggers) {
    const keyword = t.keyword.toLowerCase();

    if (t.match_type === "exact" && message === keyword) return t;

    if (t.match_type === "contains" && message.includes(keyword)) return t;

    if (t.match_type === "regex") {
      try {
        const regex = new RegExp(keyword, "i");
        if (regex.test(message)) return t;
      } catch (err) {
        console.error("Invalid regex keyword:", keyword);
      }
    }
  }

  return null;
}



// --------------------------------------------
// 🧠 Detect Next Node from available replies
// --------------------------------------------
function detectNextNode(flowReplies, userMessage) {
  try {
    const match = flowReplies.find(reply =>
      reply.buttonId && userMessage.includes(reply.buttonId.toLowerCase())
    );

    return match?.nextNodeId || null;
  } catch {
    return null;
  }
}