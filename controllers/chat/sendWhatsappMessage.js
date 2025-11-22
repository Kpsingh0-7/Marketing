import axios from "axios";
import dotenv from "dotenv";
import { pool } from "../../config/db.js";
import { updateCreditUsage } from "../credit/updateCreditUsage.js";
import { checkCustomerCredit } from "../credit/checkCustomerCredit.js";

dotenv.config();

/* ---------------------------------------------------
   MAIN CONTROLLER (NO TEMPLATE SUPPORT)
----------------------------------------------------*/
export const sendWhatsappMessage = async (req, res) => {
  const {
    phoneNumber,
    customer_id,
    contact_id,

    type, // text | image | video | interactive

    // TEXT
    text,

    // IMAGE / VIDEO
    mediaId,
    mediaUrl,
    caption,

    // INTERACTIVE
    bodyText,
    footerText,
    headerText,
    headerTypeInteractive, // text | image | video | document
    headerMediaId,
    headerMediaUrl,
    buttons, // [{id, title}]
  } = req.body;

  console.log("REQUEST BODY:", req.body);

  try {
    /* ---------------------------------------------------
       VALIDATION
    ----------------------------------------------------*/
    if (!phoneNumber || !customer_id || !contact_id || !type) {
      return res.status(400).json({
        success: false,
        error: "phoneNumber, customer_id, contact_id, type are required",
      });
    }

    /* ---------------------------------------------------
       CREDIT CHECK
    ----------------------------------------------------*/
    const creditCheck = await checkCustomerCredit(customer_id);
    if (!creditCheck.success) {
      return res
        .status(400)
        .json({ success: false, error: creditCheck.message });
    }

    /* ---------------------------------------------------
       GET GUPSHUP CONFIG
    ----------------------------------------------------*/
    const [configRows] = await pool.query(
      `SELECT gupshup_id, token FROM gupshup_configuration WHERE customer_id = ?`,
      [customer_id]
    );

    if (configRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Gupshup configuration not found",
      });
    }

    const { gupshup_id, token } = configRows[0];

    /* ---------------------------------------------------
       BASE PAYLOAD
    ----------------------------------------------------*/
    let payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type,
    };

    /* ---------------------------------------------------
       TEXT MESSAGE
    ----------------------------------------------------*/
    if (type === "text") {
      if (!text)
        return res.status(400).json({
          success: false,
          error: "text is required for type=text",
        });

      payload.text = { body: text };
    }

    /* ---------------------------------------------------
       IMAGE MESSAGE
    ----------------------------------------------------*/
    if (type === "image") {
      if (!mediaId && !mediaUrl)
        return res.status(400).json({
          success: false,
          error: "mediaId or mediaUrl is required for image messages",
        });

      payload.image = {};
      if (mediaId) payload.image.id = mediaId;
      if (mediaUrl) payload.image.link = mediaUrl;
      if (caption) payload.image.caption = caption;
    }

    /* ---------------------------------------------------
       VIDEO MESSAGE
    ----------------------------------------------------*/
    if (type === "video") {
      if (!mediaId && !mediaUrl)
        return res.status(400).json({
          success: false,
          error: "mediaId or mediaUrl is required for video messages",
        });

      payload.video = {};
      if (mediaId) payload.video.id = mediaId;
      if (mediaUrl) payload.video.link = mediaUrl;
      if (caption) payload.video.caption = caption;
    }

    /* ---------------------------------------------------
       INTERACTIVE MESSAGE
    ----------------------------------------------------*/
    if (type === "interactive") {
      if (!bodyText)
        return res.status(400).json({
          success: false,
          error: "bodyText is required for interactive messages",
        });

      if (!Array.isArray(buttons) || buttons.length === 0) {
        return res.status(400).json({
          success: false,
          error: "buttons[] is required for interactive messages",
        });
      }

      payload.interactive = {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map((btn) => ({
            type: "reply",
            reply: { id: btn.id, title: btn.title },
          })),
        },
      };

      /* OPTIONAL FOOTER */
      if (footerText) {
        payload.interactive.footer = { text: footerText };
      }

      /* OPTIONAL HEADER */
      if (headerTypeInteractive) {
        let header = { type: headerTypeInteractive };

        // TEXT HEADER
        if (headerTypeInteractive === "text") {
          header.text = headerText || "";
        }

        // MEDIA HEADERS
        if (["image", "video", "document"].includes(headerTypeInteractive)) {
          if (!headerMediaId && !headerMediaUrl) {
            return res.status(400).json({
              success: false,
              error: `headerMediaId or headerMediaUrl required when headerTypeInteractive=${headerTypeInteractive}`,
            });
          }

          header[headerTypeInteractive] = {};

          if (headerMediaId)
            header[headerTypeInteractive].id = headerMediaId;
          if (headerMediaUrl)
            header[headerTypeInteractive].link = headerMediaUrl;
        }

        payload.interactive.header = header;
      }
    }

    /* ---------------------------------------------------
       SEND MESSAGE TO GUPSHUP
    ----------------------------------------------------*/
    const response = await axios.post(
      `https://partner.gupshup.io/partner/app/${gupshup_id}/v3/message`,
      payload,
      {
        headers: {
          accept: "application/json",
          Authorization: token,
          "Content-Type": "application/json",
        },
      }
    );

    const messageId = response.data.messages?.[0]?.id || null;

    /* ---------------------------------------------------
       SAVE TO DB
    ----------------------------------------------------*/
    const contentToSave =
      text || caption || bodyText || "[interactive message]";

    const mediaToSave = mediaUrl || headerMediaUrl || null;

    await pool.execute(
      `INSERT INTO messages 
        (sender_type, message_type, content, media_url, status, external_message_id, sent_at, contact_id, customer_id)
       VALUES ('shop', ?, ?, ?, 'sent', ?, NOW(), ?, ?)`,
      [
        type,
        contentToSave,
        mediaToSave,
        messageId,
        contact_id,
        customer_id,
      ]
    );

    await updateCreditUsage(customer_id, "sent");

    /* ---------------------------------------------------
       RETURN RESPONSE
    ----------------------------------------------------*/
    return res.status(200).json({
      success: true,
      messageId,
      payloadSent: payload,
      gupshupResponse: response.data,
    });
  } catch (error) {
    console.error("SEND ERROR:", error.response?.data || error.message);

    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
};
