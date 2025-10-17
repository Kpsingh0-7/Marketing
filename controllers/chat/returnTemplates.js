import { pool } from "../../config/db.js";

export const returnTemplates = async (req, res) => {
  try {
    const { customer_id, page = 1, limit = 10, search = "" } = req.query;

    if (!customer_id) {
      return res.status(400).json({ error: "customer_id is required" });
    }

    // ✅ Force integers
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const offset = (pageNum - 1) * limitNum;

    const connection = await pool.getConnection();

    // 🔹 Build dynamic WHERE conditions
    let conditions = ["customer_id = ?"];
    let params = [customer_id];

    if (search) {
  conditions.push(`(
    element_name LIKE ? 
    OR category LIKE ? 
    OR sub_category LIKE ?
  )`);
  params.push(`%${search}%`, `%${search}%`, `%${search}%`);
}


    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // 1️⃣ Count total templates
    const [countRows] = await connection.execute(
      `SELECT COUNT(*) as total 
       FROM whatsapp_templates
       ${whereClause}`,
      params
    );
    const totalRecords = countRows[0].total;
    const totalPages = Math.ceil(totalRecords / limitNum);

    // 2️⃣ Fetch templates with pagination
    const [templates] = await connection.query(
      `SELECT 
        id,
        created_on,
        element_name,
        language_code,
        template_type,
        category,
        sub_category,
        status,
        data,
        container_meta,
        media_url
      FROM whatsapp_templates
      ${whereClause}
      ORDER BY created_on DESC
      LIMIT ${limitNum} OFFSET ${offset}`, // ✅ inline safe integers
      params
    );

    connection.release();

    if (templates.length === 0) {
      return res
        .status(404)
        .json({ message: "No templates found for this customer_id" });
    }

    // 🔹 Safe JSON parsing
    const safeJSONParse = (value) => {
      try {
        return typeof value === "string" ? JSON.parse(value) : value;
      } catch {
        return value;
      }
    };

    const parsedTemplates = templates.map((template) => {
      const data = safeJSONParse(template.data);
      const containerMeta = safeJSONParse(template.container_meta);

      return {
        ...template,
        data,
        container_meta: containerMeta,
        container_type: containerMeta?.buttons
          ? "button_template"
          : "text_template",
      };
    });

    return res.json({
      success: true,
      templates: parsedTemplates,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalRecords,
        totalPages,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching templates:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
