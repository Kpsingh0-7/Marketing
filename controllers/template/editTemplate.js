import axios from "axios";
import dotenv from 'dotenv';
dotenv.config();

// use template ID to edit a template
export const updateTemplate = async (req, res) => {
  const { templateId } = req.query;
  const {
    content,
    category,
    templateType,
    example,
    exampleMedia,
    header,
    footer,
    buttons,
    mediaId,
    exampleHeader
  } = req.body;

  try {
    // Validate required parameters
    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Template ID is required'
      });
    }

    const encodedParams = new URLSearchParams();

    // Required parameters
    if (content) encodedParams.set('content', content);
    if (category) encodedParams.set('category', category);
    if (templateType) encodedParams.set('templateType', templateType);
    
    // Optional parameters
    if (example) encodedParams.set('example', example);
    if (exampleMedia) encodedParams.set('exampleMedia', exampleMedia);
    if (header) encodedParams.set('header', header);
    if (footer) encodedParams.set('footer', footer);
    if (buttons) encodedParams.set('buttons', JSON.stringify(buttons));
    if (mediaId) encodedParams.set('mediaId', mediaId);
    if (exampleHeader) encodedParams.set('exampleHeader', exampleHeader);

    const response = await axios.put(
      `https://partner.gupshup.io/partner/app/e6fc2b8d-6e8d-4713-8d91-da5323e400da/templates/${templateId}`,
      encodedParams.toString(),
      {
        headers: {
          'Authorization': "sk_4830e6e27ce44be5af5892c5913396b8",
          'Content-Type': 'application/x-www-form-urlencoded',
          'accept': 'application/json'
        }
      }
    );

    return res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Error updating template:', {
      error: error.response?.data || error.message,
      templateId,
      requestBody: req.body
    });

    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};