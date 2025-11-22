import { handleReply } from "../controllers/chat/replyController.js";
import { updateCreditUsage } from "../controllers/credit/updateCreditUsage.js";
import { pool } from "../config/db.js";
import fs from "fs/promises";
import path from "path";

export function createWebhookHandler(io) {
  return async function handleWebhook(req, res) {
    const webhookData = JSON.stringify(req.body, null, 2);
    const filePath = path.join(process.cwd(), "webhook.txt");
    const logEntry = `\n\n=== Webhook Received at ${new Date().toISOString()} ===\n${webhookData}\n`;

    // Log webhook asynchronously
    fs.appendFile(filePath, logEntry).catch(console.error);

    // Respond immediately
    res.status(200).json({ success: true });

    try {
      const messages = req.body.entry?.[0]?.changes || [];
      const gsAppId = req.body.gs_app_id;

      for (const change of messages) {
        const value = change.value;

        // Template status update
        if (change.field === "message_template_status_update") {
          await handleTemplateStatusUpdate(value, gsAppId);
          continue; // skip to next change
        }

        // Parallelize status and message processing
        await Promise.all([
          handleStatusUpdates(value?.statuses),
          handleIncomingMessage(value, gsAppId, io),
        ]);
      }
    } catch (err) {
      console.error("Error in webhook logic:", err);
    }
  };
}

async function handleStatusUpdates(statuses = []) {
  const statusPriority = { sent: 1, delivered: 2, read: 3 };

  for (const { gs_id, status } of statuses) {
    // 1. Check in messages table
    const [existing] = await pool.query(
      `SELECT status FROM messages WHERE external_message_id = ?`,
      [gs_id]
    );

    if (existing.length > 0) {
      const currentStatus = existing[0].status;

      if (
        currentStatus !== "read" &&
        statusPriority[status] > (statusPriority[currentStatus] || 0)
      ) {
        await pool.query(
          `UPDATE messages 
           SET status = ?, 
               delivered_at = IF(? = 'delivered', NOW(), delivered_at),
               read_at = IF(? = 'read', NOW(), read_at)
           WHERE external_message_id = ?`,
          [status, status, status, gs_id]
        );
        console.log(`Updated status for ${gs_id} in messages table`);
      }
    } else {
      // 2. Check in broadcast_messages table
      const [broadcastRows] = await pool.query(
        `SELECT status, broadcast_id FROM broadcast_messages WHERE message_id = ?`,
        [gs_id]
      );

      if (broadcastRows.length > 0) {
        const { status: currentStatus, broadcast_id } = broadcastRows[0];

        if (
          currentStatus !== "read" &&
          statusPriority[status] > (statusPriority[currentStatus] || 0)
        ) {
          await pool.query(
            `UPDATE broadcast_messages SET status = ? WHERE message_id = ?`,
            [status, gs_id]
          );
          console.log(`Updated status for ${gs_id} in broadcast_messages`);

          // 🔼 Increment only when upgrading
          if (status === "delivered" && currentStatus !== "delivered") {
            await pool.query(
              `UPDATE broadcasts SET delivered = delivered + 1 WHERE broadcast_id = ?`,
              [broadcast_id]
            );
          } else if (status === "read") {
            if (currentStatus !== "read") {
              await pool.query(
                `UPDATE broadcasts SET \`read\` = \`read\` + 1 WHERE broadcast_id = ?`,
                [broadcast_id]
              );
            }
          }
        } else {
          console.log(`No status upgrade needed for ${gs_id}`);
        }
      } else {
        console.warn(
          `No message found in broadcast_messages for gs_id: ${gs_id}`
        );
      }
    }
  }
}

async function handleIncomingMessage(value, gsAppId, io) {
  const msg = value?.messages?.[0];
  if (!msg) return;

  const customerNumber = msg.from;
  const mobile_no = customerNumber.slice(-10);
  const country_code = customerNumber.slice(0, customerNumber.length - 10);
  const customerName = value.contacts?.[0]?.profile?.name || "Unknown";

  const [configRows] = await pool.query(
    `SELECT customer_id FROM gupshup_configuration WHERE gupshup_id = ?`,
    [gsAppId]
  );
  if (configRows.length === 0) throw new Error("Shop not found");

  const customer_id = configRows[0].customer_id;

  // ✅ Check or insert contact
  const [guestRows] = await pool.query(
    `SELECT contact_id FROM contact WHERE mobile_no = ? AND customer_id = ?`,
    [mobile_no, customer_id]
  );

  let contact_id;
  if (guestRows.length === 0) {
    const [insertGuest] = await pool.query(
      `INSERT INTO contact (first_name, mobile_no, country_code, customer_id, is_active) 
       VALUES (?, ?, ?, ?, 1)`,
      [customerName, mobile_no, country_code, customer_id]
    );
    contact_id = insertGuest.insertId;
  } else {
    contact_id = guestRows[0].contact_id;
    await pool.query(
      `UPDATE contact SET unread_count = COALESCE(unread_count, 0) + 1, updated_at = CURRENT_TIMESTAMP, is_active = 1 WHERE contact_id = ?`,
      [contact_id]
    );
  }

  const messageId = msg.id;
  const timestamp = msg.timestamp;
  let messageText = "No text";
  let mediaUrl = null;
let buttonId ="";
  // ✅ Click tracking for button replies
  if (msg.type === "button" && msg.context?.gs_id) {
    const gs_id = msg.context.gs_id;
    const [rows] = await pool.query(
      `SELECT broadcast_id FROM broadcast_messages WHERE message_id = ?`,
      [gs_id]
    );
    if (rows.length > 0) {
      await pool.query(
        `UPDATE broadcasts SET clicked = clicked + 1 WHERE broadcast_id = ?`,
        [rows[0].broadcast_id]
      );
      console.log(`🔘 Click recorded for broadcast_id ${rows[0].broadcast_id}`);
    }
  }

  switch (msg.type) {
    case "interactive":
    // Interactive button reply
    if (msg.interactive?.button_reply) {
      messageText = msg.interactive.button_reply.title;   // BUTTON TITLE
      buttonId = msg.interactive.button_reply.id;          // BUTTON ID (optional)
    } else if (msg.interactive?.list_reply) {
      messageText = msg.interactive.list_reply.title;      // LIST TITLE
      buttonId = msg.interactive.list_reply.id;
    }
    break;
    case "text":
      messageText = msg.text?.body;
      break;
    case "image":
      mediaUrl = msg.image?.url;
      messageText = "📷 Image received";
      break;
    case "video":
      mediaUrl = msg.video?.url;
      messageText = "📹 Video received";
      break;
    case "audio":
      mediaUrl = msg.audio?.url;
      messageText = "🔊 Audio received";
      break;
    case "document":
      mediaUrl = msg.document?.url;
      messageText = msg.document?.filename;
      break;
    case "sticker":
      mediaUrl = msg.sticker?.url;
      messageText = "🧃 Sticker received";
      break;
    case "button":
      messageText = msg.button?.text;
      break;
    default:
      messageText = "Unsupported message type";
  }

  // ✅ Check duplicate
  const [existingMessage] = await pool.query(
    `SELECT message_id FROM messages WHERE external_message_id = ?`,
    [messageId]
  );

  if (existingMessage.length === 0) {
    await pool.query(
      `INSERT INTO messages (
        contact_id, customer_id, sender_type, message_type, content, media_url, sent_at, received_at, status, external_message_id
      ) VALUES (?, ?, 'guest', ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?), 'received', ?)`,
      [
        contact_id,
        customer_id,
        msg.type,
        messageText,
        mediaUrl,
        timestamp,
        timestamp,
        messageId,
      ]
    );

    await updateCreditUsage(customer_id, "received");
    // Emit unread count update to UI
    const [[{ unread_count }]] = await pool.query(
      `SELECT unread_count FROM contact WHERE contact_id = ? AND customer_id = ?`,
      [contact_id, customer_id]
    );
    const newMessage = {
      contact_id,
      customer_id,
      unread_count,
      sender_type: "guest",
      message_type: msg.type,
      content: messageText,
      media_url: mediaUrl,
      sent_at: new Date(timestamp * 1000).toISOString(),
      status: "received",
      external_message_id: messageId,
    };

    // ✅ WebSocket: emit per contact instead of conversation
    io.to(String(contact_id)).emit("newMessage", newMessage);

    // ✅ Emit to toast notification
    io.to(String(customer_id)).emit("newMessageAlert", {
      contact_id,
      name: customerName,
      content: messageText,
      type: msg.type,
      time: newMessage.sent_at,
    });
    console.log(`🔔 Emitted newMessageAlert to customer ${customer_id}`);
  } else {
    console.log(`Message already exists: ${messageId}`);
  }

  // Defer reply logic
  setImmediate(() => {
    handleReply({
      from: customerNumber,
      message: messageText,
      payload: msg.button?.payload || null,
      timestamp: timestamp,
      buttonId,
      contact_id,
      customer_id,
    }).catch((err) => console.error("handleReply error:", err));
  });
}

async function handleTemplateStatusUpdate(value, gsAppId) {
  const gs_template_id = value?.gs_template_id;
  const newStatus = value?.event;
  if (!gs_template_id || !newStatus) return;

  try {
    const [result] = await pool.query(
      `UPDATE whatsapp_templates 
       SET status = ? 
       WHERE id = ? AND app_id = ?`,
      [newStatus, gs_template_id, gsAppId]
    );
    if (result.affectedRows > 0) {
      console.log(
        `✅ Template ${gs_template_id} updated to status "${newStatus}"`
      );
    }
  } catch (err) {
    console.error("❌ Error updating template status:", err);
  }
}
