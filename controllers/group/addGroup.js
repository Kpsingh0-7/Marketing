import { pool } from "../../config/db.js";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import mammoth from "mammoth";

export const addGroup = async (req, res) => {
  let connection;
  try {
    const customer_id = parseInt(req.body.customer_id, 10);
    const group_name_raw = req.body.group_name;
    const file = req.file;
    const description_raw = req.body.description;

    const group_name =
      typeof group_name_raw === "string" ? group_name_raw.trim() : null;
    const description =
      typeof description_raw === "string" ? description_raw.trim() : null;

    console.log("✅ Parsed values:", {
      customer_id,
      group_name,
      fileExists: !!file,
    });

    // Validation
    if (!customer_id || !group_name || !file) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: customer_id, group_name, or file",
        debug: { customer_id, group_name, fileExists: !!file },
      });
    }

    // MIME type and extension validation
    const extension = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;
    if (
      ![".csv", ".docx"].includes(extension) ||
      !["text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(mimeType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Unsupported or mismatched file type",
      });
    }

    const originalFileName = file.originalname;
    const tempPath = file.path;

    const targetDir = path.join("uploads", "contacts");
    const targetFileName = `${Date.now()}_${customer_id}_${originalFileName}`;
    const targetPath = path.join(targetDir, targetFileName);

    // Ensure upload directory exists
    await fs.promises.mkdir(targetDir, { recursive: true });

    // Move uploaded file
    await fs.promises.rename(tempPath, targetPath);

    // ✅ Step: Parse contacts
    let total_contacts = 0;

    if (extension === ".csv") {
      const content = await fs.promises.readFile(targetPath, "utf-8");
      const records = parse(content, {
        skip_empty_lines: true,
        relax_column_count: true,
      });
      if (records.length > 0) records.splice(0, 1); // Remove header
      total_contacts = records.length;
    } else if (extension === ".docx") {
      const { value } = await mammoth.extractRawText({ path: targetPath });
      const lines = value
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      total_contacts = Math.max(0, lines.length - 1); // remove header
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const relativeFilePath = path.join("uploads", "contacts", targetFileName);

    const [groupInsert] = await connection.execute(
      `INSERT INTO contact_group 
        (group_name, description, customer_id, file_name, file_path, total_contacts)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [group_name, description, customer_id, originalFileName, relativeFilePath, total_contacts]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: `Group '${group_name}' created with ${total_contacts} contact(s) from file '${originalFileName}'.`,
      data: {
        group_id: groupInsert.insertId,
        group_name,
        file_name: originalFileName,
        total_contacts,
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("❌ Failed to create group with file:", error);

    // Delete uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("❌ Error cleaning temp file:", err);
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};
