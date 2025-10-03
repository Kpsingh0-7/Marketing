// import axios from 'axios';
// import { pool } from "../../config/db.js";
// import { updateCreditUsage } from "../credit/updateCreditUsage.js";
// import { checkCustomerCredit } from "../credit/checkCustomerCredit.js";

// export const sendBroadcast = async (req, res) => {
//   const {
//     customer_id,
//     phoneNumbers,
//     element_name,
//     parameters = [],
//     languageCode = 'en'
//   } = req.body;

//   // Validation
//   if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0 || !element_name) {
//     return res.status(400).json({
//       success: false,
//       error: 'phoneNumbers (array) and element_name are required'
//     });
//   }

//   if (parameters.length > 0 && parameters.length !== phoneNumbers.length) {
//     return res.status(400).json({
//       success: false,
//       error: 'If parameters are provided, their count must match phoneNumbers'
//     });
//   }

//   try {
//     const creditCheck = await checkCustomerCredit(customer_id);

//     if (!creditCheck.success) {
//       return res
//         .status(400)
//         .json({ success: false, error: creditCheck.message });
//     }
//     // Fetch Gupshup credentials from the database
//     const [configRows] = await pool.query(
//       'SELECT gupshup_id, token FROM gupshup_configuration WHERE customer_id = ?',
//       [customer_id]
//     );

//     if (configRows.length === 0) {
//       return res.status(404).json({ success: false, error: 'Gupshup configuration not found for customer' });
//     }

//     const { gupshup_id, token } = configRows[0];
//     const responses = [];

//     for (let i = 0; i < phoneNumbers.length; i++) {
//       const phoneNumber = phoneNumbers[i];
//       const paramSet = parameters[i] || [];

//       const templateData = {
//         messaging_product: 'whatsapp',
//         recipient_type: 'individual',
//         to: phoneNumber,
//         type: 'template',
//         template: {
//           name: element_name,
//           language: { code: languageCode },
//           components: []
//         }
//       };

//       if (Array.isArray(paramSet) && paramSet.length > 0) {
//         templateData.template.components.push({
//           type: 'body',
//           parameters: paramSet.map(param => ({
//             type: 'text',
//             text: param
//           }))
//         });
//       }
// console.log(JSON.stringify(templateData, null, 2));
//       try {
//         const templateResponse = await axios.post(
//           `https://partner.gupshup.io/partner/app/${gupshup_id}/v3/message`,
//           templateData,
//           {
//             headers: {
//               'accept': 'application/json',
//               'Authorization': token,
//               'Content-Type': 'application/json'
//             }
//           }
//         );

//         responses.push({
//           phoneNumber,
//           success: true,
//           response: templateResponse.data
//         });

//         await updateCreditUsage(customer_id);

//       } catch (error) {
//         console.error(`Error sending to ${phoneNumber}:`, error.response?.data || error.message);
//         responses.push({
//           phoneNumber,
//           success: false,
//           error: error.response?.data?.message || error.message,
//           details: error.response?.data
//         });
//       }
//     }

//     return res.status(207).json({ results: responses });

//   } catch (dbError) {
//     console.error("Database error:", dbError.message);
//     return res.status(500).json({ success: false, error: "Internal server error" });
//   }
// };

import axios from "axios";
import { pool } from "../../config/db.js";
import { updateCreditUsage } from "../credit/updateCreditUsage.js";
import { checkCustomerCredit } from "../credit/checkCustomerCredit.js";

/**
 * ===== Helpers (reuse from sendTemplate) =====
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
 * ===== Controller: Send WhatsApp Broadcast =====
 */
export const sendBroadcast = async (req, res) => {
  const {
    customer_id,
    phoneNumbers,
    element_name,
    parameters = [], // per-recipient body parameters
    languageCode = "en",
    headerType,
    headerValue,
    headerIsId = false,
    buttons = [], // optional buttons
  } = req.body;

  // Validation
  if (
    !Array.isArray(phoneNumbers) ||
    phoneNumbers.length === 0 ||
    !element_name
  ) {
    return res.status(400).json({
      success: false,
      error: "phoneNumbers (array) and element_name are required",
    });
  }
const bodyValues = parameters;
  try {
    // ✅ Credit check
    const creditCheck = await checkCustomerCredit(customer_id);
    console.log(creditCheck);
    if (!creditCheck.success) {
      return res
        .status(400)
        .json({ success: false, error: creditCheck.message });
    }

    // ✅ Fetch Gupshup credentials
    const [configRows] = await pool.query(
      "SELECT gupshup_id, token FROM gupshup_configuration WHERE customer_id = ?",
      [customer_id]
    );

    if (configRows.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          error: "Gupshup configuration not found for customer",
        });
    }

    const { gupshup_id, token } = configRows[0];
    const responses = [];

    for (let i = 0; i < phoneNumbers.length; i++) {
      const phoneNumber = phoneNumbers[i];
      const paramSet = parameters[i] || [];

      // 🔹 Build template components
      const components = [];

      // ✅ Header
      const header = headerBuilder(headerType, headerValue, headerIsId);
      if (header) {
        components.push({
          type: "header",
          parameters: [header], // Meta expects array of {type, image|video|document}
        });
      }

      // Body
      if (bodyValues.length)
        components.push({
          type: "body",
          parameters: formatBodyParams(bodyValues),
        });

      // Buttons
      if (buttons.length) {
        buttons.forEach((btn, index) => {
          components.push({
            type: "button",
            sub_type: btn.sub_type || "url",
            index: index.toString(),
            parameters: [{ type: "text", text: btn.text || btn }],
          });
        });
      }

      const templateData = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: "template",
        template: {
          name: element_name,
          language: { code: languageCode },
          components,
        },
      };

      console.log(
        "📤 Sending template:",
        JSON.stringify(templateData, null, 2)
      );

      try {
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

        const templateMessageId =
          templateResponse.data.messages?.[0]?.id || null;

        // ✅ Only update credit usage (no DB insert for messages)
        await updateCreditUsage(customer_id, "sent");

        responses.push({
          phoneNumber,
          success: true,
          messageId: templateMessageId,
          response: templateResponse.data,
        });
      } catch (error) {
        console.error(
          `❌ Error sending to ${phoneNumber}:`,
          error.response?.data || error.message
        );
        responses.push({
          phoneNumber,
          success: false,
          error: error.response?.data?.message || error.message,
          details: error.response?.data,
        });
      }
    }

    return res.status(207).json({ results: responses });
  } catch (dbError) {
    console.error("Database error:", dbError.message);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
};
