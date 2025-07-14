import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

export const deleteTemplate = async (req, res) => {
  const { templateName } = req.body; // Get template name from URL params

  try {
    // Validate input
    if (!templateName) {
      return res.status(400).json({
        success: false,
        error: "Template name is required",
      });
    }

    const response = await axios.delete(
      `https://partner.gupshup.io/partner/app/e6fc2b8d-6e8d-4713-8d91-da5323e400da/template/${templateName}`,
      {
        headers: {
          accept: "application/json",
          Authorization: "sk_4830e6e27ce44be5af5892c5913396b8",
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