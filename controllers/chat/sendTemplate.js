import axios from "axios";
import dotenv from "dotenv";
import { pool } from "../../config/db.js";
import { updateCreditUsage } from "../credit/updateCreditUsage.js";
import { checkCustomerCredit } from "../credit/checkCustomerCredit.js";

dotenv.config();

/**
 * ===== Helpers =====
 */
function formatBodyParams(params) {
  return params.map((p) => {
    if (typeof p === "string") {
      return { type: "text", text: p };
    } else if (p.type === "currency") {
      return {
        type: "currency",
        currency: {
          fallback_value: p.fallback || "0 USD",
          code: p.code || "USD",
          amount_1000: p.amount_1000 || "0",
        },
      };
    } else if (p.type === "date_time") {
      return {
        type: "date_time",
        date_time: {
          fallback_value: p.fallback || "January 1, 2025",
        },
      };
    }
    return p;
  });
}

function headerBuilder(type, value, isId = false) {
  const key = isId ? "id" : "link";
  switch (type?.toLowerCase()) {
    case "text":
      return null;
    case "image":
      return { type: "image", image: { [key]: value } };
    case "video":
      return { type: "video", video: { [key]: value } };
    case "document":
      return { type: "document", document: { [key]: value } };
    default:
      return null;
  }
}

/**
 * ===== Controller: Send WhatsApp Message =====
 */
export const sendTemplate = async (req, res) => {
  const {
    phoneNumber,
    message, // free-form text
    element_name, // template name
    language_code,
    headerType,
    headerValue,
    headerIsId = false,
    parameters = [],
    buttons = [],
    customer_id,
    contact_id,
    media_url = null,
  } = req.body;

  const bodyValues = parameters;
  console.log(req.body);

  try {
    if (!phoneNumber || !customer_id || !contact_id) {
      return res.status(400).json({
        success: false,
        error: "phoneNumber, customer_id, and contact_id are required",
      });
    }

    // ✅ Credit check
    const creditCheck = await checkCustomerCredit(customer_id);
    if (!creditCheck.success) {
      return res
        .status(400)
        .json({ success: false, error: creditCheck.message });
    }

    // ✅ Fetch Gupshup credentials
    const [configRows] = await pool.query(
      `SELECT gupshup_id, token FROM gupshup_configuration WHERE customer_id = ?`,
      [customer_id]
    );
    if (configRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Gupshup configuration not found for this customer",
      });
    }
    const { gupshup_id, token } = configRows[0];

    let responses = [];

    /**
     * ✅ Free-form message (within 24 hours window)
     */
    if (message) {
      const freeFormData = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: "text",
        text: { body: message },
      };
console.log(freeFormData);
      const freeFormResponse = await axios.post(
        `https://partner.gupshup.io/partner/app/${gupshup_id}/v3/message`,
        freeFormData,
        {
          headers: {
            accept: "application/json",
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      const freeFormMessageId = freeFormResponse.data.messages?.[0]?.id || null;

      // ✅ Save only in messages
      await pool.execute(
        `INSERT INTO messages 
          (sender_type, message_type, content, status, external_message_id, sent_at, contact_id, customer_id) 
         VALUES ('shop', 'text', ?, 'sent', ?, NOW(), ?, ?)`,
        [message, freeFormMessageId, contact_id, customer_id]
      );

      await updateCreditUsage(customer_id, "sent");

      responses.push({
        type: "text",
        messageId: freeFormMessageId,
        response: freeFormResponse.data,
      });
    }

    /**
     * ✅ Template message
     */
    if (element_name) {
      const components = [];
      const header = headerBuilder(headerType, headerValue, headerIsId);
      if (header) components.push({ type: "header", parameters: [header] });
      if (bodyValues.length)
        components.push({
          type: "body",
          parameters: formatBodyParams(bodyValues),
        });
      if (buttons.length) {
        components.push({
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: buttons.map((b) => ({
            type: "text",
            text: b.text || b,
          })),
        });
      }

      const templateData = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: "template",
        template: {
          name: element_name,
          language: { code: language_code },
          components,
        },
      };

      console.log(JSON.stringify(templateData, null, 2));

      const templateResponse = await axios.post(
        `https://partner.gupshup.io/partner/app/${gupshup_id}/v3/message`,
        templateData,
        {
          headers: {
            accept: "application/json",
            Authorization: token,
            "Content-Type": "application/json",
          },
        }
      );

      const templateMessageId = templateResponse.data.messages?.[0]?.id || null;

      await pool.execute(
        `INSERT INTO messages 
          (sender_type, message_type, element_name, template_data, media_url, status, external_message_id, sent_at, contact_id, customer_id) 
         VALUES ('shop', 'template', ?, ?, ?, 'sent', ?, NOW(), ?, ?)`,
        [
          element_name,
          JSON.stringify(templateData),
          media_url,
          templateMessageId,
          contact_id,
          customer_id,
        ]
      );

      await updateCreditUsage(customer_id, "sent");

      responses.push({
        type: "template",
        messageId: templateMessageId,
        response: templateResponse.data,
      });
    }

    return res.status(200).json({
      success: true,
      responses,
    });
  } catch (error) {
    console.error(
      "Error sending WhatsApp message:",
      error.response?.data || error.message
    );
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data,
    });
  }
};
