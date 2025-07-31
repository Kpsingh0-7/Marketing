import axios from 'axios';

export const sendFlowTemplates = async (req, res) => {
  const {
    phoneNumber,
    element_name,
    languageCode = 'en_US',
    parameters = []
  } = req.body;

  try {
    if (!phoneNumber || !element_name) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber and element_name are required'
      });
    }

    const templateData = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'template',
      template: {
        name: element_name,
        language: { code: languageCode },
        category: 'MARKETING',
        components: []
      }
    };

    // Add parameters to body
    if (parameters.length > 0) {
      templateData.template.components.push({
        type: 'body',
        parameters: parameters.map(text => ({
          type: 'text',
          text
        }))
      });
    }

    // Add FLOW Button if needed
    templateData.template.components.push({
      type: 'buttons',
      buttons: [
        {
          type: 'flow',
          text: 'Sign up',
          flow_action: 'navigate',
          navigate_screen: 'WELCOME_SCREEN',
          flow_id: '1268162441482072' // Replace with your actual flow_id
        }
      ]
    });

    // Send to Gupshup API
    const templateResponse = await axios.post(
      'https://partner.gupshup.io/partner/app/e6fc2b8d-6e8d-4713-8d91-da5323e400da/v3/message',
      templateData,
      {
        headers: {
          accept: 'application/json',
          Authorization: 'Bearer sk_4830e6e27ce44be5af5892c5913396b8', // Use 'Bearer' if needed
          'Content-Type': 'application/json'
        }
      }
    );

    const templateMessageId = templateResponse.data.messages?.[0]?.id || null;

    return res.status(200).json({
      success: true,
      messageId: templateMessageId,
      response: templateResponse.data
    });

  } catch (error) {
    console.error('Error sending WhatsApp Flow template:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      details: error.response?.data
    });
  }
};
