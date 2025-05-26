import { pool } from '../config/db.js';

export const returnTemplates = async (req, res) => {
  const { shop_id } = req.query;

  if (!shop_id) {
    return res.status(400).json({ error: 'shop_id is required' });
  }

  try {
    const connection = await pool.getConnection();

    const [templateRows] = await connection.query(
      `SELECT template_id FROM shop_template_map WHERE shop_id = ?`,
      [shop_id]
    );

    const templateIds = templateRows.map(row => row.template_id);

    if (templateIds.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'No templates found for this shop_id' });
    }

    const [templates] = await connection.query(
      `SELECT id, created_on, element_name, template_type, category, status, data, container_meta
       FROM whatsapp_templates
       WHERE id IN (?)`,
      [templateIds]
    );

    connection.release();

    const safeJSONParse = (value) => {
      try {
        return typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        return value;
      }
    };

    const parsedTemplates = templates.map(template => {
      const data = safeJSONParse(template.data);
      const containerMeta = safeJSONParse(template.container_meta);

      return {
        ...template,
        data,
        container_meta: containerMeta,
        container_type: containerMeta?.buttons ? 'button_template' : 'text_template'
      };
    });

    return res.json({ templates: parsedTemplates });

  } catch (error) {
    console.error('Error fetching templates:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
