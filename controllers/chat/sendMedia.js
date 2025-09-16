import fs from "fs";
import FormData from "form-data";
import axios from "axios";
import { pool } from "../../config/db.js";
import path from "path";

const uploadDir = path.join(process.cwd(), "uploads", "media");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

export const sendMedia = async (req, res) => {
  const { customer_id, fileType } = req.body;

  if (!req.file || !customer_id) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: file, customer_id",
    });
  }

  try {
    // Generate safe filename
    const ext = path.extname(req.file.originalname);
    const safeName = req.file.originalname.replace(/\s+/g, "_");
    const fileName = `${customer_id}_${Date.now()}_${safeName}`;
    const newPath = path.join(uploadDir, fileName);

    // Move uploaded file
    fs.renameSync(req.file.path, newPath);

    // Fetch Gupshup credentials
    const [configRows] = await pool.query(
      "SELECT gupshup_id AS appId, token FROM gupshup_configuration WHERE customer_id = ? LIMIT 1",
      [customer_id]
    );

    if (configRows.length === 0) {
      if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
      return res.status(404).json({
        success: false,
        message: "Gupshup configuration not found for this customer",
      });
    }

    const { appId, token } = configRows[0];

    // Prepare form data
    const form = new FormData();
    form.append("file_type", fileType || req.file.mimetype);
    form.append("file", fs.createReadStream(newPath), req.file.originalname);

    // Upload to Gupshup
    const response = await axios.post(
      `https://partner.gupshup.io/partner/app/${appId}/media`,
      form,
      {
        headers: {
          token,
          accept: "application/json",
          ...form.getHeaders(),
        },
      }
    );

    const mediaId = response.data?.mediaId;
    if (!mediaId) {
      if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
      return res.status(500).json({
        success: false,
        message: "Failed to get mediaId from Gupshup",
        response: response.data,
      });
    }

    return res.status(200).json({
      success: true,
      mediaId,
      fileName,
    });
  } catch (error) {
    if (fs.existsSync(req.file?.path)) fs.unlinkSync(req.file.path);
    console.error("❌ Error uploading media:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
    });
  }
};
