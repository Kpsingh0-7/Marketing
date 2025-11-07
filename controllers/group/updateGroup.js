// import { pool } from "../../config/db.js";
// import fs from "fs";
// import path from "path";
// import { parse } from "csv-parse/sync";
// import mammoth from "mammoth";

// export const updateGroup = async (req, res) => {
//   let connection;
//   try {
//     const group_id = parseInt(req.body.group_id, 10);
//     const customer_id = parseInt(req.body.customer_id, 10);
//     const group_name_raw = req.body.group_name;
//     const description_raw = req.body.description;
//     const file = req.file;

//     const group_name = typeof group_name_raw === "string" ? group_name_raw.trim() : null;
//     const description = typeof description_raw === "string" ? description_raw.trim() : null;

//     if (!group_id || !customer_id) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields: group_id or customer_id",
//       });
//     }

//     connection = await pool.getConnection();

//     // Fetch existing group details
//     const [rows] = await connection.execute(
//       `SELECT file_path, file_name FROM contact_group WHERE group_id = ? AND customer_id = ?`,
//       [group_id, customer_id]
//     );

//     if (rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Group not found.",
//       });
//     }

//     const existing = rows[0];
//     let updatedFilePath = existing.file_path;
//     let updatedFileName = existing.file_name;
//     let total_contacts = null;

//     if (file) {
//       const extension = path.extname(file.originalname).toLowerCase();
//       const mimeType = file.mimetype;

//       if (
//         ![".csv", ".docx"].includes(extension) ||
//         !["text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(mimeType)
//       ) {
//         return res.status(400).json({
//           success: false,
//           message: "Unsupported file format or MIME type",
//         });
//       }

//       const tempPath = file.path;
//       const targetDir = path.join("uploads", "contacts");
//       const targetFileName = `${Date.now()}_${customer_id}_${file.originalname}`;
//       const targetPath = path.join(targetDir, targetFileName);

//       await fs.promises.mkdir(targetDir, { recursive: true });
//       await fs.promises.rename(tempPath, targetPath);

//       if (extension === ".csv") {
//         const content = await fs.promises.readFile(targetPath, "utf-8");
//         const records = parse(content, {
//           skip_empty_lines: true,
//           relax_column_count: true,
//         });
//         if (records.length > 0) records.splice(0, 1);
//         total_contacts = records.length;
//       } else if (extension === ".docx") {
//         const { value } = await mammoth.extractRawText({ path: targetPath });
//         const lines = value
//           .trim()
//           .split("\n")
//           .map((line) => line.trim())
//           .filter(Boolean);
//         total_contacts = Math.max(0, lines.length - 1);
//       }

//       // Delete old file
//       if (existing.file_path && fs.existsSync(existing.file_path)) {
//         fs.unlink(existing.file_path, (err) => {
//           if (err) console.error("❌ Error deleting old file:", err);
//         });
//       }

//       updatedFilePath = path.join("uploads", "contacts", targetFileName); // relative path
//       updatedFileName = file.originalname;
//     }

//     // Build update fields
//     const fields = [];
//     const values = [];

//     if (group_name) {
//       fields.push("group_name = ?");
//       values.push(group_name);
//     }

//     if (description !== undefined) {
//       fields.push("description = ?");
//       values.push(description);
//     }

//     if (file) {
//       fields.push("file_name = ?", "file_path = ?", "total_contacts = ?");
//       values.push(updatedFileName, updatedFilePath, total_contacts);
//     }

//     if (fields.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No data provided to update.",
//       });
//     }

//     values.push(group_id, customer_id);

//     await connection.execute(
//       `UPDATE contact_group SET ${fields.join(", ")} WHERE group_id = ? AND customer_id = ?`,
//       values
//     );

//     return res.status(200).json({
//       success: true,
//       message: "Group updated successfully.",
//     });
//   } catch (error) {
//     console.error("❌ Failed to update group:", error);

//     if (req.file && fs.existsSync(req.file.path)) {
//       fs.unlink(req.file.path, (err) => {
//         if (err) console.error("❌ Failed to clean up temp file:", err);
//       });
//     }

//     return res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   } finally {
//     if (connection) connection.release();
//   }
// };



import { pool } from "../../config/db.js";

export const updateGroup = async (req, res) => {
  let connection;
  try {
    const { group_id, customer_id, group_name, description, contacts_json } = req.body;
console.log(req.body);
    if (!group_id || !customer_id) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: group_id or customer_id",
      });
    }

    if (!group_name && !description && !contacts_json) {
      return res.status(400).json({
        success: false,
        message: "No data provided to update.",
      });
    }

    const total_contacts = Array.isArray(contacts_json) ? contacts_json.length : null;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const fields = [];
    const values = [];

    if (group_name) {
      fields.push("group_name = ?");
      values.push(group_name.trim());
    }

    if (description !== undefined) {
      fields.push("description = ?");
      values.push(description?.trim() || null);
    }

    if (contacts_json) {
      fields.push("contacts_json = ?", "total_contacts = ?");
      values.push(JSON.stringify(contacts_json), total_contacts);
    }

    values.push(group_id, customer_id);

    await connection.execute(
      `UPDATE contact_group SET ${fields.join(", ")} WHERE group_id = ? AND customer_id = ?`,
      values
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Group updated successfully.",
      data: {
        group_id,
        group_name: group_name || undefined,
        total_contacts,
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("❌ Failed to update group:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

