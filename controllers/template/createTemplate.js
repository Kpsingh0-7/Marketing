import axios from "axios";
import { pool } from "../../config/db.js";
import dotenv from "dotenv";
dotenv.config();

export const createTemplate = async (req, res) => {
  const {
    elementName,
    content,
    category = "MARKETING",
    templateType,
    languageCode = "en",
    header,
    footer,
    buttons = [],
    example,
    exampleHeader,
    messageSendTTL,
    customer_id, // ✅ Needed to fetch credentials
  } = req.body;

  console.log({
    elementName,
    content,
    category,
    templateType,
    languageCode,
    header,
    footer,
    buttons,
    example,
    exampleHeader,
    messageSendTTL,
    customer_id,
  });

  try {
    // ✅ Validate required fields
    if (!elementName || !content || !customer_id) {
      return res.status(400).json({
        success: false,
        error: "elementName, content, and customer_id are required fields",
      });
    }

    // ✅ Fetch gupshup credentials
    const [configRows] = await pool.query(
      "SELECT gupshup_id, token FROM gupshup_configuration WHERE customer_id = ?",
      [customer_id]
    );

    if (configRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Gupshup configuration not found for this customer",
      });
    }

    const { gupshup_id, token } = configRows[0];

    // ✅ Prepare request body
    const encodedParams = new URLSearchParams();
    encodedParams.set("elementName", elementName);
    encodedParams.set("languageCode", languageCode);
    encodedParams.set("category", category);
    encodedParams.set("templateType", templateType);
    encodedParams.set("vertical", "TEXT");
    encodedParams.set("content", content);
    encodedParams.set("allowTemplateCategoryChange", "false");
    encodedParams.set(
      "message_send_ttl_seconds",
      messageSendTTL?.toString() || "3600"
    );
    encodedParams.set("enableSample", "true");

    if (header) encodedParams.set("header", header);
    if (footer) encodedParams.set("footer", footer);
    if (exampleHeader) encodedParams.set("exampleHeader", exampleHeader);
    if (buttons.length > 0) {
      encodedParams.set("buttons", JSON.stringify(buttons));
    }

    const generatedExample =
      example ||
      content.replace(/\{\{1\}\}/g, "4").replace(/\{\{2\}\}/g, "2025-04-25");
    encodedParams.set("example", generatedExample);

    // ✅ Send template creation request
    const response = await axios.post(
      `https://partner.gupshup.io/partner/app/${gupshup_id}/templates`,
      encodedParams.toString(),
      {
        headers: {
          accept: "application/json",
          token: token,
          "content-type": "application/x-www-form-urlencoded",
        },
      }
    );

    const template = response.data.template;

    // ✅ Save to whatsapp_templates
    const insertQuery = `
  INSERT INTO whatsapp_templates (
    id, external_id, app_id, waba_id,
    element_name, category, language_code, template_type,
    status, data, container_meta, created_on, modified_on
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

    const values = [
      template.id,
      null,
      template.appId,
      template.wabaId,
      template.elementName,
      template.category,
      template.languageCode,
      template.templateType,
      template.status,
      template.data,
      //JSON.stringify(template.containerMeta),
      template.containerMeta,
      template.createdOn,
      template.modifiedOn,
    ];

    await pool.execute(insertQuery, values);

    // ✅ Then insert into customer_template_map
    

    await pool.execute(
      `INSERT INTO customer_template_map (customer_id, template_id) VALUES (?, ?)`,
      [customer_id, template.id]
    );

    return res.status(200).json({
      success: true,
      templateId: template.id,
      response: template,
    });
  } catch (error) {
    console.error(
      "Template creation error:",
      error.response?.data || error.message
    );
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data,
    });
  }
};


// import axios from "axios";
// import { pool } from "../../config/db.js";
// import dotenv from "dotenv";
// dotenv.config();

// export const createTemplate = async (req, res) => {
//   const {
//     elementName,
//     content,
//     category = "MARKETING",
//     templateType = "IMAGE", // IMAGE for media header
//     languageCode = "en_US",
//     footer,
//     example,
//     exampleMedia, // Handle ID of the image
//     messageSendTTL,
//     customer_id,
//   } = req.body;

//   try {
//     if (!elementName || !content || !customer_id || !exampleMedia) {
//       return res.status(400).json({
//         success: false,
//         error: "elementName, content, customer_id, and exampleMedia are required",
//       });
//     }

//     const [configRows] = await pool.query(
//       "SELECT gupshup_id, token FROM gupshup_configuration WHERE customer_id = ?",
//       [customer_id]
//     );

//     if (configRows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         error: "Gupshup configuration not found for this customer",
//       });
//     }

//     const { gupshup_id, token } = configRows[0];

//     const encodedParams = new URLSearchParams();
//     encodedParams.set("appId", gupshup_id);
//     encodedParams.set("elementName", elementName);
//     encodedParams.set("languageCode", languageCode);
//     encodedParams.set("content", content); // Example: "Your verification code is {{1}}."
//     if (footer) encodedParams.set("footer", footer);
//     encodedParams.set("category", category);
//     encodedParams.set("templateType", templateType); // "IMAGE"
//     encodedParams.set("vertical", "media_gs_32"); // Example vertical
//     encodedParams.set("enableSample", "true");
//     encodedParams.set("allowTemplateCategoryChange", "false");
//     encodedParams.set("example", example || content.replace(/\{\{1\}\}/g, "213"));
//     encodedParams.set("exampleMedia", exampleMedia); // Image Handle ID

//     if (messageSendTTL)
//       encodedParams.set("message_send_ttl_seconds", messageSendTTL.toString());

//     const response = await axios.post(
//       `https://partner.gupshup.io/partner/app/${gupshup_id}/templates`,
//       encodedParams.toString(),
//       {
//         headers: {
//           Authorization: token,
//           "Content-Type": "application/x-www-form-urlencoded",
//         },
//       }
//     );

//     const template = response.data.template;

//     // Save to DB (as you had before)
//     const insertQuery = `
//       INSERT INTO whatsapp_templates (
//         id, external_id, app_id, waba_id,
//         element_name, category, language_code, template_type,
//         status, data, container_meta, created_on, modified_on
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `;

//     const values = [
//       template.id,
//       null,
//       template.appId,
//       template.wabaId,
//       template.elementName,
//       template.category,
//       template.languageCode,
//       template.templateType,
//       template.status,
//       template.data,
//       JSON.stringify(template.containerMeta),
//       template.createdOn,
//       template.modifiedOn,
//     ];

//     await pool.execute(insertQuery, values);

//     await pool.execute(
//       `INSERT INTO customer_template_map (customer_id, template_id) VALUES (?, ?)`,
//       [customer_id, template.id]
//     );

//     return res.status(200).json({
//       success: true,
//       templateId: template.id,
//       response: template,
//     });
//   } catch (error) {
//     return res.status(error.response?.status || 500).json({
//       success: false,
//       error: error.response?.data?.message || error.message,
//       details: error.response?.data,
//     });
//   }
// };



