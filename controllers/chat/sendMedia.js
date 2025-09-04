import fs from "fs";
import FormData from "form-data";
import axios from "axios";
import { pool } from "../../config/db.js"; // adjust path as needed

export const sendMedia = async (req, res) => {
  const { customer_id, fileType } = req.body;

  if (!req.file || !customer_id) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: file, customer_id",
    });
  }

  try {
    // ✅ Fetch Gupshup credentials from DB
    const [configRows] = await pool.query(
      "SELECT gupshup_id AS appId, token FROM gupshup_configuration WHERE customer_id = ? LIMIT 1",
      [customer_id]
    );

    if (configRows.length === 0) {
      fs.unlinkSync(req.file.path); // cleanup
      return res.status(404).json({
        success: false,
        message: "Gupshup configuration not found for this customer",
      });
    }

    const { appId, token } = configRows[0];

    // ✅ Prepare form data
    const form = new FormData();
    form.append("file_type", fileType || req.file.mimetype);
    form.append("file", fs.createReadStream(req.file.path), req.file.originalname);

    // ✅ Upload to Gupshup
    const response = await axios.post(
      `https://partner.gupshup.io/partner/app/${appId}/media`,
      form,
      {
        headers: {
          token, // Gupshup expects "token"
          accept: "application/json",
          ...form.getHeaders(),
        },
      }
    );

    // ✅ Cleanup local file after upload
    fs.unlinkSync(req.file.path);

    // ✅ Use mediaId instead of handleId
    const mediaId = response.data?.mediaId;
    if (!mediaId) {
      return res.status(500).json({
        success: false,
        message: "Failed to get mediaId from Gupshup",
        response: response.data,
      });
    }

    return res.status(200).json({
      success: true,
      mediaId,
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("❌ Error uploading media:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
    });
  }
};
