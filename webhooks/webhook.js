import { handleReply } from "../controllers/message/replyController.js";
import { pool } from "../config/db.js";
import fs from "fs/promises"; // Use promise-based fs
import path from "path";

export function createWebhookHandler(io) {
  return async function handleWebhook(req, res) {
  const webhookData = JSON.stringify(req.body, null, 2);
  const filePath = path.join(process.cwd(), "webhook.txt");
  const logEntry = `\n\n=== Webhook Received at ${new Date().toISOString()} ===\n${webhookData}\n`;

  try {
    await fs.appendFile(filePath, logEntry);
    console.log("Webhook saved.");
  } catch (err) {
    console.error("Error writing webhook:", err);
    // Don't send response here – continue anyway
  }

  // Immediately respond to webhook
  res.status(200).json({ success: true });

  try {
    const messages = req.body.entry?.[0]?.changes || [];
    const gsAppId = req.body.gs_app_id;

    for (const change of messages) {
      const value = change.value;

      // Status updates
      if (value?.statuses) {
        const statusPriority = { sent: 1, delivered: 2, read: 3 };

        for (const statusUpdate of value.statuses) {
          const { gs_id, status } = statusUpdate;
          const [existing] = await pool.query(
            `SELECT status FROM messages WHERE external_message_id = ?`,
            [gs_id]
          );

          if (existing.length) {
            const currentStatus = existing[0].status;

            if (
              currentStatus !== "read" &&
              (!statusPriority[currentStatus] ||
                statusPriority[status] > statusPriority[currentStatus])
            ) {
              await pool.query(
                `UPDATE messages 
                 SET status = ?, 
                     delivered_at = IF(? = 'delivered', NOW(), delivered_at),
                     read_at = IF(? = 'read', NOW(), read_at)
                 WHERE external_message_id = ?`,
                [status, status, status, gs_id]
              );
              console.log(`Updated status for ${gs_id}`);
            }
          } else {
            console.warn(`No message found for status: ${gs_id}`);
          }
        }
        continue;
      }

      // Incoming message
      const msg = value?.messages?.[0];
      if (msg) {
        const customerNumber = msg.from;
        // Extract mobile number and country code
        const mobile_no = customerNumber.slice(-10);
        const country_code = customerNumber.slice(
          0,
          customerNumber.length - 10
        );
        const customerName = value.contacts?.[0]?.profile?.name || "Unknown";
        let messageText = "No text";
        let mediaUrl = null;

        switch (msg.type) {
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
            console.warn("Unsupported message type received:", msg.type);
        }

        const messageType = msg.type;
        const messageId = msg.id;
        const timestamp = msg.timestamp;

        const [configRows] = await pool.query(
          `SELECT customer_id FROM gupshup_configuration WHERE gupshup_id = ?`,
          [gsAppId]
        );
        if (configRows.length === 0) throw new Error("Shop not found");

        const customer_id = configRows[0].customer_id;

        // Check if guest exists using mobile_no and customer_id
        const [guestRows] = await pool.query(
          `SELECT contact_id FROM contact WHERE mobile_no = ? AND customer_id = ?`,
          [mobile_no, customer_id]
        );

        let contact_id;
        if (guestRows.length === 0) {
          const [insertGuest] = await pool.query(
            `INSERT INTO contact (first_name, mobile_no, country_code, customer_id) VALUES (?, ?, ?, ?)`,
            [customerName, mobile_no, country_code, customer_id]
          );
          contact_id = insertGuest.insertId;
        } else {
          contact_id = guestRows[0].contact_id;
        }

        const [convRows] = await pool.query(
          `SELECT conversation_id FROM conversations WHERE contact_id = ? AND customer_id = ?`,
          [contact_id, customer_id]
        );

        let conversation_id;
        if (convRows.length === 0) {
          const [insertConv] = await pool.query(
            `INSERT INTO conversations (contact_id, customer_id, is_active) VALUES (?, ?, 1)`,
            [contact_id, customer_id]
          );
          conversation_id = insertConv.insertId;
        } else {
          conversation_id = convRows[0].conversation_id;
          await pool.query(
            `UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE conversation_id = ?`,
            [conversation_id]
          );
        }

        const [existingMessage] = await pool.query(
          `SELECT message_id FROM messages WHERE external_message_id = ?`,
          [messageId]
        );

        if (existingMessage.length === 0) {
          await pool.query(
            `INSERT INTO messages (
      conversation_id, sender_type, sender_id, message_type, content, media_url, received_at, status, external_message_id
    ) VALUES (?, 'guest', ?, ?, ?, ?, FROM_UNIXTIME(?), 'received', ?)`,
            [
              conversation_id,
              contact_id,
              messageType,
              messageText,
              mediaUrl,
              timestamp,
              messageId,
            ]
          );

          console.log(`Inserted message: ${messageId}`);

          // Emit to WebSocket clients in this conversation room
          const newMessage = {
            conversation_id,
            sender_type: "guest",
            sender_id: contact_id,
            message_type: messageType,
            content: messageText,
            media_url: mediaUrl,
            sent_at: new Date(timestamp * 1000).toISOString(),
            status: "received",
            external_message_id: messageId,
          };

          io.to(String(conversation_id)).emit("newMessage", newMessage);

          console.log(`Emitting to room ${conversation_id}`, newMessage);

        } else {
          console.log(`Message already exists: ${messageId}`);
        }

        try {
          await handleReply({
            from: customerNumber,
            message: messageText,
            payload: msg.button?.payload || null,
            timestamp: timestamp,
            contact_id: contact_id,
            customer_id: customer_id,
          });
        } catch (err) {
          console.error("Error in handleReply:", err);
        }
      }
    }
  } catch (err) {
    console.error("Error in webhook logic:", err);
  }
}
}