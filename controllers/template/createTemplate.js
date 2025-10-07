import axios from "axios";
import { pool } from "../../config/db.js";
import dotenv from "dotenv";
dotenv.config();

export const createTemplate = async (req, res) => {
  const {
    elementName,
    content,
    category = "MARKETING",
    sub_category,
    templateType = "TEXT",
    languageCode = "en",
    header,
    footer,
    buttons = [],
    example,
    exampleHeader,
    messageSendTTL = 43200,
    customer_id,
    codeExpirationMinutes = 15,
    allowTemplateCategoryChange = true,
    addSecurityRecommendation = true,
  } = req.body;
  try {
    // ✅ Validate required fields
    if (!elementName || !content || !customer_id) {
      return res.status(400).json({
        success: false,
        error: "elementName, content, and customer_id are required fields",
      });
    }

    // ✅ Fetch Gupshup credentials
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

    // ✅ Prepare request payload
    const encodedParams = new URLSearchParams();
    encodedParams.set("elementName", elementName);
    encodedParams.set("languageCode", languageCode);
    encodedParams.set("category", category);
    encodedParams.set("templateType", templateType);
    encodedParams.set("vertical", "TEXT");
    encodedParams.set("content", content);
    encodedParams.set("message_send_ttl_seconds", messageSendTTL.toString());
    encodedParams.set("enableSample", "true");

    // ✅ Category-specific logic
    if (category === "AUTHENTICATION") {
      encodedParams.set(
        "allowTemplateCategoryChange",
        allowTemplateCategoryChange.toString()
      );
      encodedParams.set(
        "addSecurityRecommendation",
        addSecurityRecommendation.toString()
      );
      encodedParams.set(
        "codeExpirationMinutes",
        codeExpirationMinutes.toString()
      );

      // Set default example if not provided
      encodedParams.set("example", example || "111 is your verification code.");

      // Set default button: COPY_CODE
      const otpButtons = [{ "type":"OTP","otp_type": "COPY_CODE", "text": "Copy Code"}];
      encodedParams.set("buttons", JSON.stringify(otpButtons));
    } else {
      // For MARKETING, UTILITY, etc.
      if (allowTemplateCategoryChange === false)
        encodedParams.set("allowTemplateCategoryChange", "false");

      if (header) encodedParams.set("header", header);
      if (footer) encodedParams.set("footer", footer);
      if (exampleHeader) encodedParams.set("exampleHeader", exampleHeader);
      if (buttons?.length > 0) {
        encodedParams.set("buttons", JSON.stringify(buttons));
      }

      // Generate example if not provided
      const generatedExample =
        example ||
        content.replace(/\{\{1\}\}/g, "4").replace(/\{\{2\}\}/g, "2025-04-25");
      encodedParams.set("example", generatedExample);
    }
    console.log(encodedParams);
    // ✅ Send request to Gupshup
    const response = await axios.post(
      `https://partner.gupshup.io/partner/app/${gupshup_id}/templates`,
      encodedParams.toString(),
      {
        headers: {
          accept: "application/json",
          token,
          "content-type": "application/x-www-form-urlencoded",
        },
      }
    );

    const template = response.data.template;

    // ✅ Save to whatsapp_templates
    const insertQuery = `
      INSERT INTO whatsapp_templates (
        id, customer_id, app_id, waba_id,
        element_name, category, sub_category, language_code, template_type,
        status, data, container_meta, created_on, modified_on
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      template.id,
      customer_id,
      template.appId,
      template.wabaId,
      template.elementName,
      template.category,
      sub_category,
      template.languageCode,
      template.templateType,
      template.status,
      template.data,
      template.containerMeta,
      template.createdOn,
      template.modifiedOn,
    ];

    await pool.execute(insertQuery, values);

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
