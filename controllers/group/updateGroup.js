import { pool } from "../../config/db.js";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import mammoth from "mammoth";

export const updateGroup = async (req, res) => {
  const group_id = parseInt(req.body.group_id, 10);
  const customer_id = parseInt(req.body.customer_id, 10);
  const group_name = req.body.group_name?.trim();
  const file = req.file;

  if (!group_id || !customer_id) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: group_id or customer_id",
    });
  }

  const connection = await pool.getConnection();

  try {
    // Fetch existing group details
    const [rows] = await connection.execute(
      `SELECT file_path, file_name FROM contact_group WHERE group_id = ? AND customer_id = ?`,
      [group_id, customer_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Group not found.",
      });
    }

    const existing = rows[0];
    let updatedFilePath = existing.file_path;
    let updatedFileName = existing.file_name;
    let total_contacts = null;

    // If new file is uploaded
    if (file) {
      const extension = path.extname(file.originalname).toLowerCase();
      const tempPath = file.path;
      const targetDir = path.join("uploads", "contacts");
      const targetFileName = `${Date.now()}_${customer_id}_${file.originalname}`;
      const targetPath = path.join(targetDir, targetFileName);

      // Make sure target directory exists
      fs.mkdirSync(targetDir, { recursive: true });

      // Move file
      fs.renameSync(tempPath, targetPath);

      // Count contacts
      if (extension === ".csv") {
        const content = fs.readFileSync(targetPath, "utf-8");
        const records = parse(content, {
          skip_empty_lines: true,
          relax_column_count: true,
        });
        records.splice(0, 1);
        total_contacts = records.length;
      } else if (extension === ".docx") {
        const { value } = await mammoth.extractRawText({ path: targetPath });
        const lines = value
          .trim()
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        total_contacts = Math.max(0, lines.length - 1);
      } else {
        return res.status(400).json({
          success: false,
          message: "Unsupported file format",
        });
      }

      // Delete old file
      if (existing.file_path && fs.existsSync(existing.file_path)) {
        fs.unlinkSync(existing.file_path);
      }

      updatedFilePath = targetPath;
      updatedFileName = file.originalname;
    }

    // Build dynamic update query
    const fields = [];
    const values = [];

    if (group_name) {
      fields.push("group_name = ?");
      values.push(group_name);
    }

    if (file) {
      fields.push("file_name = ?", "file_path = ?", "total_contacts = ?");
      values.push(updatedFileName, updatedFilePath, total_contacts);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No data provided to update.",
      });
    }

    values.push(group_id, customer_id);

    await connection.execute(
      `UPDATE contact_group SET ${fields.join(", ")} WHERE group_id = ? AND customer_id = ?`,
      values
    );

    return res.status(200).json({
      success: true,
      message: "Group updated successfully.",
    });
  } catch (error) {
    console.error("❌ Failed to update group:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};
