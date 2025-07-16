import { pool } from "../../config/db.js";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import mammoth from "mammoth";

export const addGroup = async (req, res) => {
  const customer_id = parseInt(req.body.customer_id, 10);
  const group_name_raw = req.body.group_name;
  const file = req.file;

  const group_name =
    typeof group_name_raw === "string" ? group_name_raw.trim() : null;

  console.log("✅ Parsed values:", {
    customer_id,
    group_name,
    fileExists: !!file,
  });

  if (!customer_id || !group_name || !file) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: customer_id, group_name, or file",
      debug: { customer_id, group_name, fileExists: !!file },
    });
  }

  const extension = path.extname(file.originalname).toLowerCase();
  const originalFileName = file.originalname;
  const tempPath = file.path;

  const targetDir = path.join("uploads", "contacts");
  const targetFileName = `${Date.now()}_${customer_id}_${originalFileName}`;
  const targetPath = path.join(targetDir, targetFileName);

  const connection = await pool.getConnection();

  try {
    // Ensure upload directory exists
    fs.mkdirSync(targetDir, { recursive: true });

    // Move uploaded file to permanent location
    fs.renameSync(tempPath, targetPath);

    // ✅ Step: Parse file to count valid contacts
    let total_contacts = 0;

    if (extension === ".csv") {
      const content = fs.readFileSync(targetPath, "utf-8");
      const records = parse(content, {
        skip_empty_lines: true,
        relax_column_count: true,
      });
      records.splice(0, 1); // Remove header row
      total_contacts = records.length;
    } else if (extension === ".docx") {
      const { value } = await mammoth.extractRawText({ path: targetPath });
      const lines = value
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      total_contacts = Math.max(0, lines.length - 1); // remove header
    } else {
      return res.status(400).json({
        success: false,
        message: "Unsupported file format",
      });
    }

    await connection.beginTransaction();

    // Insert new group with file metadata and total_contacts
    const [groupInsert] = await connection.execute(
      `INSERT INTO contact_group 
        (group_name, customer_id, file_name, file_path, total_contacts)
       VALUES (?, ?, ?, ?, ?)`,
      [group_name, customer_id, originalFileName, targetPath, total_contacts]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: `Group '${group_name}' created with ${total_contacts} contact(s) from file '${originalFileName}'.`,
      data: {
        group_id: groupInsert.insertId,
        group_name,
        file_name: originalFileName,
        file_path: targetPath,
        total_contacts,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error("❌ Failed to create group with file:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};
