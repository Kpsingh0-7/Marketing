import jwt from "jsonwebtoken";
import axios from "axios";

const SECRET = "super_secret_key_12345";

export const loginShopUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const login_datetime = encodeURIComponent(
      new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    );

    const url = `https://api.foodchow.com/api/UserMaster/AdminUserPOSLogin?email_id=${email}&pwd=${password}&device_type=3&device_id=web&login_datetime=${login_datetime}`;

    const response = await axios.get(url);

    const { success, data, message } = response.data;

    if (!success || !data || data.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = data[0];

    // Generate JWT token
    const token = jwt.sign(
      {
        shop_id: user.shop_id,
        email: email,
      },
      SECRET,
      { expiresIn: "30d" }
    );

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        shop_id: user.shop_id,
        email: email,
        // Add other fields if needed from the response
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
  