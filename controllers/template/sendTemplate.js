router.post("/send-template", async (req, res) => {
  const {
    phoneNumber,
    element_name,
    languageCode = "en",
    parameters = [],
    imageUrl,
    buttons = [],
    gupshup_id,
    token
  } = req.body;

  if (!phoneNumber || !element_name || !gupshup_id || !token) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: phoneNumber, element_name, gupshup_id, or token",
    });
  }

  try {
    const components = [];

    // Add image header if provided
    if (imageUrl) {
      components.push({
        type: "header",
        parameters: [
          {
            type: "image",
            image: {
              link: imageUrl,
            },
          },
        ],
      });
    }

    // Add body text parameters
    if (parameters.length > 0) {
      components.push({
        type: "body",
        parameters: parameters.map((text) => ({
          type: "text",
          text,
        })),
      });
    }

    // Add quick reply buttons if provided
    if (Array.isArray(buttons)) {
      buttons.forEach((btn) => {
        components.push({
          type: "button",
          sub_type: "quick_reply",
          index: btn.index,
          parameters: [
            {
              type: "payload",
              payload: btn.payload,
            },
          ],
        });
      });
    }

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "template",
      template: {
        name: element_name,
        language: {
          code: languageCode,
        },
        components,
      },
    };

    const response = await axios.post(
      `https://partner.gupshup.io/partner/app/${gupshup_id}/v3/message`,
      payload,
      {
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          Authorization: token,
        },
      }
    );

    return res.status(200).json({
      success: true,
      messageId: response.data?.messages?.[0]?.id,
      gupshupResponse: response.data,
    });
  } catch (error) {
    console.error("Error sending template:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
    });
  }
});