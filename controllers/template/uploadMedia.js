import fs from "fs";
import FormData from "form-data";
import axios from "axios";
import { pool } from "../../config/db.js"; // adjust path as needed

export const uploadMedia = async (req, res) => {
  const { customer_id, fileType } = req.body;

  if (!req.file || !customer_id || !fileType) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: file, customer_id, or fileType",
    });
  }

  try {
    // ✅ Fetch Gupshup credentials from DB
    const [configRows] = await pool.query(
      "SELECT gupshup_id AS appId, token FROM gupshup_configuration WHERE customer_id = ? LIMIT 1",
      [customer_id]
    );

    if (configRows.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: "Gupshup configuration not found for this customer",
      });
    }

    const { appId, token } = configRows[0];

    // ✅ Prepare form data
    const form = new FormData();
    form.append("file_type", fileType);
    form.append("file", fs.createReadStream(req.file.path));

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

    // cleanup local file
    fs.unlinkSync(req.file.path);

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
      //gupshupResponse: response.data,
    });
  } catch (error) {
    if (fs.existsSync(req.file?.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("❌ Error uploading media:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
    });
  }
};
