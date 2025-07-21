import axios from "axios";
import { pool } from "../../config/db.js";
import { updateCreditUsage } from "../updateCreditUsage.js";

export const sendTemplates = async (req, res) => {
  const {
    phoneNumber,
    name,
    element_name,
    languageCode = "en",
    parameters = [],
    shop_id,
  } = req.body;

  try {
    if (!phoneNumber || !name || !shop_id || !element_name) {
      return res.status(400).json({
        success: false,
        error: "phoneNumber, name, shop_id, and element_name are required",
      });
    }

    const customer_id = shop_id;
    const first_name = name;

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

    // Normalize phone number
    const normalizedPhone = phoneNumber.replace(/\D/g, "");
    const mobileNo = normalizedPhone.slice(-10);
    const userCountryCode = normalizedPhone.slice(0, -10);

    // Check or insert contact
    const [existingCustomer] = await pool.execute(
      `SELECT contact_id FROM contact WHERE mobile_no = ? AND customer_id = ?`,
      [mobileNo, customer_id]
    );

    let contact_id;
    if (existingCustomer.length > 0) {
      contact_id = existingCustomer[0].contact_id;
    } else {
      const [insertResult] = await pool.execute(
        `INSERT INTO contact (mobile_no, first_name, customer_id, country_code) VALUES (?, ?, ?, ?)`,
        [mobileNo, first_name, customer_id, userCountryCode]
      );
      contact_id = insertResult.insertId;
    }

    // Check or insert conversation
    const [existingConversation] = await pool.execute(
      `SELECT conversation_id FROM conversations WHERE customer_id = ? AND contact_id = ?`,
      [customer_id, contact_id]
    );

    let conversation_id;
    if (existingConversation.length > 0) {
      conversation_id = existingConversation[0].conversation_id;
    } else {
      const [insertConversation] = await pool.execute(
        `INSERT INTO conversations (customer_id, contact_id) VALUES (?, ?)`,
        [customer_id, contact_id]
      );
      conversation_id = insertConversation.insertId;
    }

    // Build template data
    const templateData = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "template",
      template: {
        name: element_name,
        language: { code: languageCode },
        components: [],
      },
    };

    if (parameters.length > 0) {
      templateData.template.components.push({
        type: "body",
        parameters: parameters.map((param) => ({
          type: "text",
          text: param,
        })),
      });
    }

    // Send message using dynamic gupshup_id & token
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

    // Log the sent message
    await pool.execute(
      `INSERT INTO messages 
        (conversation_id, sender_type, sender_id, message_type, element_name, template_data, status, external_message_id, sent_at) 
       VALUES (?, 'shop', ?, 'template', ?, ?, 'sent', ?, NOW())`,
      [
        conversation_id,
        customer_id,
        element_name,
        JSON.stringify(templateData),
        templateMessageId,
      ]
    );

    await updateCreditUsage(customer_id, 'sent');

    return res.status(200).json({
      success: true,
      messageId: templateMessageId,
      conversation_id,
      response: templateResponse.data,
    });

  } catch (error) {
    console.error("Error sending WhatsApp template message:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data,
    });
  }
};
