import axios from 'axios';
import dotenv from 'dotenv';
import { pool } from '../../config/db.js';

dotenv.config();

export const getTemplate = async (req, res) => {
  const { customer_id } = req.query; // assuming it's passed as query param

  if (!customer_id) {
    return res.status(400).json({
      success: false,
      error: "customer_id is required",
    });
  }

  try {
    // 🔐 Fetch credentials from DB
    const [configRows] = await pool.query(
      "SELECT gupshup_id, token FROM gupshup_configuration WHERE customer_id = ?",
      [customer_id]
    );

    if (configRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Gupshup configuration not found for this customer",
      });
    }

    const { gupshup_id, token } = configRows[0];

    // 📥 Fetch templates
    const response = await axios.get(
      `https://partner.gupshup.io/partner/app/${gupshup_id}/templates`,
      {
        headers: {
          accept: "application/json",
          Authorization: token,
        },
      }
    );

    return res.status(200).json(response.data);
  } catch (error) {
    console.error("Get Template Error:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data,
    });
  }
};
