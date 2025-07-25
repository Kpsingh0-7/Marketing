import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

export const deleteTemplate = async (req, res) => {
  const { elementName, customer_id } = req.body; // Get template name from URL params

  try {
    // Validate input
    if (!elementName) {
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

    const response = await axios.delete(
      `https://partner.gupshup.io/partner/${gupshup_id}/template/${elementName}`,
      {
        headers: {
          accept: "application/json",
          Authorization: token,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Template deleted successfully",
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Error deleting template:",
      error.response?.data || error.message
    );

    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data,
    });
  }
};