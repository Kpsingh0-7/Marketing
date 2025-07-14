import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export const setupSubscription = async (req, res) => {
  const {
    modes = "SENT, READ, DELIVERED, ALL, TEMPLATE", // SENT, READ, DELIVERED,
    tag = "FoodChowApp_v1",
    url = "https://pika-driving-gannet.ngrok-free.app/webhook",
    version = 3,
    showOnUI = false,
    meta = null,
  } = req.body;

  try {
    // Validate required fields
    if (!url) {
      return res.status(400).json({
        success: false,
        error: "Webhook URL is required",
      });
    }

    const encodedParams = new URLSearchParams();
    encodedParams.set("modes", modes);
    encodedParams.set("tag", tag);
    encodedParams.set("url", url);
    encodedParams.set("version", version.toString());
    encodedParams.set("showOnUI", showOnUI.toString());
    if (meta) encodedParams.set("meta", JSON.stringify(meta));

    const response = await axios.post(
      `https://partner.gupshup.io/partner/app/e6fc2b8d-6e8d-4713-8d91-da5323e400da/subscription`,
      encodedParams.toString(),
      {
        headers: {
          Authorization: "sk_4830e6e27ce44be5af5892c5913396b8",
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return res.status(200).json({
      success: true,
      subscription: response.data.subscription,
    });
  } catch (error) {
    console.error("Subscription error:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || "Failed to setup subscription",
      details: error.response?.data,
    });
  }
};