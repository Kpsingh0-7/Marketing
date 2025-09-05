import { pool } from "../../config/db.js";

export const returnMessages = async (req, res) => {
  const {
    contact_id,
    limit = 50,
    cursor,
    includeTemplate = "false",
  } = req.query;

  if (!contact_id) {
    return res.status(400).json({ error: "contact_id is required" });
  }

  const lim = Math.min(parseInt(limit, 10) || 50, 200); // cap at 200
  const realLimit = lim + 1; // fetch one extra row
  const joinTemplate = includeTemplate === "true";

  let sql = `
    SELECT 
      m.message_id,
      m.message_type,
      m.content,
      m.element_name,
      m.media_url,
      m.status,
      m.sent_at,
      m.template_data
      ${joinTemplate ? ", wt.data, wt.container_meta" : ""}
    FROM messages m
    ${
      joinTemplate
        ? 'LEFT JOIN whatsapp_templates wt ON m.element_name = wt.element_name AND m.message_type = "template"'
        : ""
    }
    WHERE m.contact_id = ?
  `;

  const params = [contact_id];

  // 👉 if cursor exists, only fetch OLDER messages
  if (cursor) {
    sql += ` AND m.sent_at < ?`;
    params.push(cursor);
  }

  sql += ` ORDER BY m.sent_at DESC, m.message_id DESC LIMIT ${realLimit};`;

  try {
    const [rows] = await pool.execute(sql, params);

    let hasMore = false;
    let sliced = rows;

    // if more than limit rows → remove the extra and mark hasMore
    if (rows.length > lim) {
      hasMore = true;
      sliced = rows.slice(0, lim);
    }

    const safeJSON = (v) => {
      if (v == null) return v;
      if (typeof v !== "string") return v;
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    };

    const messages = sliced.map((r) => {
      const containerMeta = safeJSON(r.container_meta);
      return {
        message_id: r.message_id,
        message_type: r.message_type,
        content: r.content,
        element_name: r.element_name,
        media_url: r.media_url,
        status: r.status,
        sent_at: r.sent_at,
        template_data: safeJSON(r.template_data),
        data: safeJSON(r.data),
        container_meta: containerMeta,
        container_type: containerMeta?.buttons
          ? "button_template"
          : "text_template",
      };
    });

    // nextCursor = oldest message (last after ASC order)
    const reversed = messages.reverse(); // oldest → newest for UI
    const nextCursor = reversed.length > 0 ? reversed[0].sent_at : null;

    res.json({
      messages: reversed,
      pagination: {
        nextCursor,
        hasMore,
        limit: lim,
      },
    });
  } catch (e) {
    console.error("returnMessages error:", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
