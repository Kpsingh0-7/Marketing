import fs from "fs";
import path from "path";
import FormData from "form-data";
import axios from "axios";
import { pool } from "../../config/db.js";

export const uploadMedia = async (req, res) => {
  const { customer_id, fileType } = req.body;

  if (!req.file || !customer_id || !fileType) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: file, customer_id, or fileType",
    });
  }

  try {
    // ✅ Create uploads/media folder if not exists
    const uploadDir = path.join(process.cwd(), "uploads", "media");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // ✅ Generate proper filename
    const ext = path.extname(req.file.originalname); // preserve original extension
    const safeName = req.file.originalname.replace(/\s+/g, "_"); // replace spaces
    const fileName = `${customer_id}_${Date.now()}_${safeName}`;
    const newPath = path.join(uploadDir, fileName);

    // ✅ Move file to new path with proper name
    fs.renameSync(req.file.path, newPath);

    // ✅ Fetch Gupshup credentials from DB
    const [configRows] = await pool.query(
      "SELECT gupshup_id AS appId, token FROM gupshup_configuration WHERE customer_id = ? LIMIT 1",
      [customer_id]
    );

    if (configRows.length === 0) {
      fs.unlinkSync(newPath);
      return res.status(404).json({
        success: false,
        message: "Gupshup configuration not found for this customer",
      });
    }

    const { appId, token } = configRows[0];

    // ✅ Prepare form data
    const form = new FormData();
    form.append("file_type", fileType);
    form.append("file", fs.createReadStream(newPath));

    // ✅ Upload file to Gupshup
    const response = await axios.post(
      `https://partner.gupshup.io/partner/app/${appId}/upload/media`,
      form,
      {
        headers: {
          Authorization: token,
          accept: "application/json",
          ...form.getHeaders(),
        },
      }
    );
    console.log(fileType);
    const handleId = response.data?.handleId?.message;
    if (!handleId) {
      return res.status(500).json({
        success: false,
        message: "Failed to get handleId from upload",
      });
    }

    return res.status(200).json({
      success: true,
      handleId,
      filePath: newPath, // store final file path
      fileName,
    });
  } catch (error) {
    if (fs.existsSync(req.file?.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error(
      "❌ Error uploading media:",
      error.response?.data || error.message
    );
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
    });
  }
};
