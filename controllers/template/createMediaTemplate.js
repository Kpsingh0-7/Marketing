import axios from "axios";
import { pool } from "../../config/db.js";

export const createMediaTemplate = async (req, res) => {
  const {
    elementName,
    languageCode = "en",
    content,
    footer,
    category = "MARKETING",
    templateType = "TEXT",
    buttons = [],
    vertical = "Ticket update",
    example,
    exampleMedia,
    enableSample = true,
    allowTemplateCategoryChange = true,
    customer_id,
  } = req.body;

  // ✅ Validate required fields
  if (!elementName || !content || !customer_id) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: elementName, content, or customer_id",
    });
  }

  try {
    // ✅ Fetch Gupshup credentials from DB
    const [configRows] = await pool.query(
      "SELECT gupshup_id, token FROM gupshup_configuration WHERE customer_id = ?",
      [customer_id]
    );

    if (configRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Gupshup configuration not found for this customer",
      });
    }

    const { gupshup_id, token } = configRows[0];

    // ✅ Build request params
    const encodedParams = new URLSearchParams();
    if (elementName) encodedParams.set("elementName", elementName);
    if (languageCode) encodedParams.set("languageCode", languageCode);
    if (content) encodedParams.set("content", content);
    if (footer) encodedParams.set("footer", footer);
    if (category) encodedParams.set("category", category);
    if (templateType) encodedParams.set("templateType", templateType);
    if (buttons?.length > 0) encodedParams.set("buttons", JSON.stringify(buttons));
    if (vertical) encodedParams.set("vertical", vertical);
    if (example) encodedParams.set("example", example);
    if (exampleMedia) encodedParams.set("exampleMedia", exampleMedia);
    if (enableSample !== undefined) encodedParams.set("enableSample", String(enableSample));
    if (allowTemplateCategoryChange !== undefined)
      encodedParams.set("allowTemplateCategoryChange", String(allowTemplateCategoryChange));

    // ✅ Call Gupshup API
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

    // ✅ Save into DB
    await pool.execute(
      `INSERT INTO whatsapp_templates (
        id, external_id, app_id, waba_id,
        element_name, category, language_code, template_type,
        status, data, container_meta, created_on, modified_on
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
        template.containerMeta,
        template.createdOn,
        template.modifiedOn,
      ]
    );

    await pool.execute(
      `INSERT INTO customer_template_map (customer_id, template_id) VALUES (?, ?)`,
      [customer_id, template.id]
    );

    return res.status(200).json({
      success: true,
      templateId: template.id,
      gupshupResponse: template,
    });
  } catch (error) {
    console.error("❌ Error creating template:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
    });
  }
};
