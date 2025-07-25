import axios from 'axios';
import { pool } from "../../config/db.js";
import { updateCreditUsage } from "../credit/updateCreditUsage.js";
import { checkCustomerCredit } from "../credit/checkCustomerCredit.js";


export const sendBroadcast = async (req, res) => {
  const {
    customer_id,
    phoneNumbers,
    element_name,
    parameters = [],
    languageCode = 'en'
  } = req.body;

  // Validation
  if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0 || !element_name) {
    return res.status(400).json({
      success: false,
      error: 'phoneNumbers (array) and element_name are required'
    });
  }

  if (parameters.length > 0 && parameters.length !== phoneNumbers.length) {
    return res.status(400).json({
      success: false,
      error: 'If parameters are provided, their count must match phoneNumbers'
    });
  }

  try {
    const creditCheck = await checkCustomerCredit(customer_id);

    if (!creditCheck.success) {
      return res
        .status(400)
        .json({ success: false, error: creditCheck.message });
    }
    // Fetch Gupshup credentials from the database
    const [configRows] = await pool.query(
      'SELECT gupshup_id, token FROM gupshup_configuration WHERE customer_id = ?',
      [customer_id]
    );

    if (configRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Gupshup configuration not found for customer' });
    }

    const { gupshup_id, token } = configRows[0];
    const responses = [];

    for (let i = 0; i < phoneNumbers.length; i++) {
      const phoneNumber = phoneNumbers[i];
      const paramSet = parameters[i] || [];

      const templateData = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'template',
        template: {
          name: element_name,
          language: { code: languageCode },
          components: []
        }
      };

      if (Array.isArray(paramSet) && paramSet.length > 0) {
        templateData.template.components.push({
          type: 'body',
          parameters: paramSet.map(param => ({
            type: 'text',
            text: param
          }))
        });
      }

      try {
        const templateResponse = await axios.post(
          `https://partner.gupshup.io/partner/app/${gupshup_id}/v3/message`,
          templateData,
          {
            headers: {
              'accept': 'application/json',
              'Authorization': token,
              'Content-Type': 'application/json'
            }
          }
        );

        responses.push({
          phoneNumber,
          success: true,
          response: templateResponse.data
        });

        await updateCreditUsage(customer_id);

      } catch (error) {
        console.error(`Error sending to ${phoneNumber}:`, error.response?.data || error.message);
        responses.push({
          phoneNumber,
          success: false,
          error: error.response?.data?.message || error.message,
          details: error.response?.data
        });
      }
    }

    return res.status(207).json({ results: responses });

  } catch (dbError) {
    console.error("Database error:", dbError.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};
