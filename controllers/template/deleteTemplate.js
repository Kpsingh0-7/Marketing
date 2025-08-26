import dotenv from 'dotenv'; 
import axios from 'axios';
import { pool } from "../../config/db.js";

dotenv.config();

export const deleteTemplate = async (req, res) => {
  const { elementName, customer_id } = req.body;

  try {
    // ✅ Validate input
    if (!elementName || !customer_id) {
      return res.status(400).json({
        success: false,
        error: "elementName and customer_id are required fields",
      });
    }

    // ✅ Fetch gupshup credentials
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

    let gupshupResponse;
    try {
      // ✅ Call Gupshup API to delete template
      const response = await axios.delete(
        `https://partner.gupshup.io/partner/app/${gupshup_id}/template/${elementName}`,
        {
          headers: {
            accept: "application/json",
            Authorization: token, // no Bearer
          },
        }
      );
      gupshupResponse = response.data;
    } catch (apiError) {
      // If API says "Template Does not exists.", treat as success for DB cleanup
      if (apiError.response?.data?.message === "Template Does not exists.") {
        gupshupResponse = apiError.response.data;
      } else {
        throw apiError; // rethrow if it's another error
      }
    }

    // ✅ Always try to remove from local DB
    const [deleteResult] = await pool.query(
      "DELETE FROM whatsapp_templates WHERE element_name = ? AND customer_id = ?",
      [elementName, customer_id]
    );

    return res.status(200).json({
      success: true,
      message: "Template deleted from database" + 
               (gupshupResponse?.status === "error" ? " (not found on Gupshup)" : " and Gupshup"),
      gupshupResponse,
      dbDeleted: deleteResult.affectedRows > 0,
    });

  } catch (error) {
    console.error("Error deleting template:", error.response?.data || error.message);

    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data,
    });
  }
};
