import axios from "axios";
import { pool } from "../config/db.js";
import { updateCreditUsage } from "../controllers/credit/updateCreditUsage.js";
import { checkCustomerCredit } from "../controllers/credit/checkCustomerCredit.js";

export async function sendTemplateService({
  phoneNumber,
  name,
  element_name,
  languageCode = "en",
  parameters = [],
  shop_id,
}) {
  if (!phoneNumber || !name || !shop_id || !element_name) {
    throw new Error("phoneNumber, name, shop_id, and element_name are required");
  }

  const customer_id = shop_id;
  const first_name = name;

  // 🔍 Credit Check
  const creditCheck = await checkCustomerCredit(customer_id);
  if (!creditCheck.success) {
    throw new Error("Insufficient credit to send message");
  }

  // 🔐 Get Gupshup Credentials
  const [configRows] = await pool.query(
    `SELECT gupshup_id, token FROM gupshup_configuration WHERE customer_id = ?`,
    [customer_id]
  );

  if (configRows.length === 0) {
    throw new Error("Gupshup configuration not found for this customer");
  }

  const { gupshup_id, token } = configRows[0];

  // 📱 Normalize Phone
  const cleanPhone = phoneNumber.toString().replace(/\D/g, "");
  const mobileNo = cleanPhone.slice(-10);
  const userCountryCode = cleanPhone.slice(0, -10);

  // 👤 Ensure Contact Exists
  const [existingCustomer] = await pool.execute(
    `SELECT contact_id FROM contact WHERE mobile_no = ? AND customer_id = ?`,
    [mobileNo, customer_id]
  );

  let contact_id;

  if (existingCustomer.length > 0) {
    contact_id = existingCustomer[0].contact_id;
  } else {
    const [insert] = await pool.execute(
      `INSERT INTO contact (mobile_no, first_name, customer_id, country_code)
       VALUES (?, ?, ?, ?)`,
      [mobileNo, first_name, customer_id, userCountryCode]
    );
    contact_id = insert.insertId;
  }

  // 📦 Build Template Payload
  const templateData = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    type: "template",
    template: {
      namespace: "3c7773f5_5bf9_423f_80d4_200817ac205e",
      name: element_name,
      language: { code: languageCode },
      components: [],
    },
  };

  if (parameters.length > 0) {
    templateData.template.components.push({
      type: "body",
      parameters: parameters.map((t) => ({ type: "text", text: t })),
    });
  }

  console.log("📤 Sending Template:", JSON.stringify(templateData, null, 2));

  // 🚀 Call Gupshup API
  let response;
  try {
    response = await axios.post(
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
  } catch (err) {
    throw {
      message: err.response?.data?.message || "Gupshup API Error",
      details: err.response?.data,
      statusCode: err.response?.status || 500,
    };
  }

  const messageId = response.data?.messages?.[0]?.id || null;

  // 🗂 Log to Messages Table
  await pool.execute(
    `INSERT INTO messages 
     (sender_type, message_type, element_name, template_data, status, external_message_id, sent_at, contact_id, customer_id) 
     VALUES ('system', 'template', ?, ?, 'sent', ?, NOW(), ?, ?)`,
    [
      element_name,
      JSON.stringify(templateData),
      messageId,
      contact_id,
      customer_id,
    ]
  );

  // 💳 Deduct Credit
  await updateCreditUsage(customer_id, "sent");

  return {
    success: true,
    messageId,
    response: response.data,
  };
}
