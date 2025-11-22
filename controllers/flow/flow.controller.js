import { pool } from "../../config/db.js";

export async function runFlow(body) {
  const { phone, message, customer_id } = body;

  if (!phone || !message) {
    return {
      success: false,
      message: "phone and message are required",
    };
  }

  try {

    // 1️⃣ Check if user session exists
    const [sessionRows] = await pool.query(
      `SELECT * FROM user_sessions WHERE phone = ?`,
      [phone]
    );

    if (sessionRows.length > 0 && sessionRows[0].active_flow_id) {
      const reply = await continueFlow(sessionRows[0], message, phone);
      return {
        success: true,
        status: "continue",
        reply,
      };
    }

    // 2️⃣ Detect triggered flow
    const flow = await detectFlowTrigger(message, customer_id);

    if (!flow) {
      return {
        success: false,
        status: "no_match",
        reply: { type: "text", text: "No matching flow." },
      };
    }

    // 3️⃣ Parse flow JSON
    const flowJson = safeParse(flow.flow_json);
    const edges = flowJson?.flowEdges || [];

    // Find first connected node
    const firstConnection = edges.find(e => e.sourceNodeId === "start");

    const firstNode = firstConnection
      ? flowJson.flowNodes.find(n => n.id === firstConnection.targetNodeId)
      : flowJson.flowNodes.find(n => n.id === "start");

    // 4️⃣ Save session
    await pool.query(
      `INSERT INTO user_sessions (phone, active_flow_id, current_node_id)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        active_flow_id = VALUES(active_flow_id), 
        current_node_id = VALUES(current_node_id)`,
      [phone, flow.id, firstNode?.id]
    );

    return {
      success: true,
      status: "started",
      reply: firstNode,
    };

  } catch (error) {
    console.error("❌ Flow Error:", error);
    return {
      success: false,
      message: "Internal Server Error",
      error: error.message,
    };
  }
}


/* -----------------------------------------
   Detect Flow Trigger
------------------------------------------*/
async function detectFlowTrigger(inputText, customer_id) {
  const text = (inputText || "").toLowerCase().trim();

  let sql = `SELECT id, triggers, flow_json FROM flows`;
  const params = [];

  if (customer_id) {
    sql += ` WHERE customer_id = ?`;
    params.push(customer_id);
  }

  const [flows] = await pool.query(sql, params);

  for (const f of flows) {
    let triggersArray = [];

    if (f.triggers) {
      if (typeof f.triggers === "string") {
        try {
          // Try parse JSON string
          const parsed = JSON.parse(f.triggers);
          if (Array.isArray(parsed)) {
            triggersArray = parsed;
          } else {
            triggersArray = [String(parsed)];
          }
        } catch {
          // Not JSON → treat as comma-separated text
          triggersArray = f.triggers
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      } 
      else if (Array.isArray(f.triggers)) {
        triggersArray = f.triggers;
      }
      else {
        // If object or number
        triggersArray = [String(f.triggers)];
      }
    } 
    else {
      // If no triggers column → fallback to flow_json.triggerConfig.keywords
      const parsedFlow = safeParse(f.flow_json);
      triggersArray = parsedFlow?.triggerConfig?.keywords || [];
    }

    // Normalize and match text
    for (const key of triggersArray) {
      if (!key) continue;
      if (text === key.toLowerCase() || text.includes(key.toLowerCase())) {
        return f;
      }
    }
  }

  return null;
}


/* -----------------------------------------
   Continue Flow Execution
------------------------------------------*/
async function continueFlow(session, userInput, phone) {
  const [[flowRow]] = await pool.query(
    `SELECT flow_json FROM flows WHERE id = ?`,
    [session.active_flow_id]
  );

  if (!flowRow) return { error: true, message: "Flow not found." };

  const json = safeParse(flowRow.flow_json);
  const node = json?.flowNodes?.find(n => n.id === session.current_node_id);

  if (!node) return { error: true, message: "Invalid step." };

  const cleanedInput = userInput.trim();

  // 1️⃣ Match by button ID first
  let match = node.interactiveButtonsItems?.find(
    btn => btn.id === cleanedInput
  );

  // 2️⃣ Fallback → match by text (old behavior)
  if (!match) {
    match = node.interactiveButtonsItems?.find(btn =>
      cleanedInput.toLowerCase().includes(btn.buttonText.toLowerCase())
    );
  }

  // No match = repeat same node
  if (!match) return node;

  const nextNode = json.flowNodes.find(n => n.id === match.nodeResultId);

  if (!nextNode) return { message: "End of flow." };

  // update session
  await pool.query(
    `UPDATE user_sessions SET current_node_id = ?, updated_at = NOW() WHERE phone = ?`,
    [nextNode.id, phone]
  );

  return nextNode; // return full node json
}


/* -----------------------------------------
   Helper Functions
------------------------------------------*/
function safeParse(val) {
  if (!val) return null;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

function formatNode(node) {
  if (!node) return { type: "text", text: "Message missing in node." };

  if (node.flowNodeType === "InteractiveButtons") {
    return {
      type: "buttons",
      text: node.interactiveButtonsBody || node.data?.label || "",
      options: node.interactiveButtonsItems?.map((b) => b.buttonText) || [],
    };
  }

  return {
    type: "text",
    text: node.data?.label || "Message missing in node.",
  };
}
