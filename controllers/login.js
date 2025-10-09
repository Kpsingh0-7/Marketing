// // authController.js
// import jwt from "jsonwebtoken";
// import axios from "axios";

// // Secret key for signing JWT
// const SECRET = "super_secret_key_12345";

// // Cookie options
// const cookieOptions = {
//   httpOnly: true,
//   secure: true, // ⚠️ Set to false in local dev without HTTPS
//   sameSite: "None",

//   maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
// };

// // LOGIN Route
// export const loginUser = async (req, res) => {
//   const { email, password } = req.body;

//   if (!email || !password) {
//     return res.status(400).json({ error: "Email and password are required." });
//   }

//   try {
//     const login_datetime = encodeURIComponent(
//       new Date().toLocaleString("en-GB", {
//         day: "2-digit",
//         month: "2-digit",
//         year: "numeric",
//         hour: "2-digit",
//         minute: "2-digit",
//         hour12: true,
//       })
//     );

//     const url = `https://api.foodchow.com/api/UserMaster/AdminUserPOSLogin?email_id=${email}&pwd=${password}&device_type=3&device_id=web&login_datetime=${login_datetime}`;

//     const response = await axios.get(url);
//     const { success, data } = response.data;

//     if (!success || !data || data.length === 0) {
//       return res.status(401).json({ error: "Invalid email or password." });
//     }

//     const user = data[0];

//     // Generate JWT
//     const token = jwt.sign(
//       {
//         customer_id: user.shop_id,
//         email: email,
//       },
//       SECRET,
//       { expiresIn: "30d" }
//     );

//     // Set JWT as httpOnly cookie
//     res.cookie("auth_token", token, cookieOptions);

//     return res.json({
//       success: true,
//       message: "Login successful",
//       user: {
//         customer_id: user.shop_id,
//         email: email,
//       },
//     });
//   } catch (err) {
//     console.error("Login error:", err.message);
//     return res.status(500).json({ error: "Internal Server Error" });
//   }
// };

// // ME Route
// export const getMe = (req, res) => {
//   const token = req.cookies.auth_token;

//   if (!token) {
//     return res.status(401).json({ success: false, error: "No token found" });
//   }

//   try {
//     const decoded = jwt.verify(token, SECRET);
//     res.json({
//       success: true,
//       user: {
//         customer_id: decoded.customer_id,
//         email: decoded.email,
//       },
//     });
//   } catch (err) {
//     res.status(401).json({ success: false, error: "Invalid or expired token" });
//   }
// };

// // LOGOUT Route
// export const logoutUser = (req, res) => {
//   res.clearCookie("auth_token", {
//     httpOnly: true,
//     secure: true,
//     sameSite: "Strict",
//   });

//   return res.json({ success: true, message: "Logged out successfully" });
// };

import jwt from "jsonwebtoken";
import md5 from "md5";
import { pool } from "../config/db.js";
import axios from "axios";

const SECRET = "super_secret_key_123451256";

const isProd = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProd, // Set to false in local development
  sameSite: isProd ? "None" : "Lax",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

const BASE_URL = "https://partner.gupshup.io/partner";
export const getWabaInfoByCustomer = async (customer_id) => {
  try {
    // 1️⃣ Get gupshup_id and token from DB
    const [rows] = await pool.query(
      "SELECT gupshup_id, token FROM gupshup_configuration WHERE customer_id = ?",
      [customer_id]
    );

    if (rows.length === 0) {
      throw new Error("No Gupshup configuration found for this customer");
    }

    const { gupshup_id, token } = rows[0];

    // 2️⃣ Call Gupshup API
    const response = await axios.get(
      `${BASE_URL}/app/${gupshup_id}/waba/info/`,
      {
        headers: {
          accept: "application/json",
          token,
        },
      }
    );

    const wabaInfo = response.data?.wabaInfo;
    if (!wabaInfo) return response.data;

    // 3️⃣ Insert or update wabainfo table
    await pool.query(
      `
      INSERT INTO wabainfo (
        customer_id,
        accountStatus,
        dockerStatus,
        messagingLimit,
        mmLiteStatus,
        ownershipType,
        phone,
        phoneQuality,
        throughput,
        verifiedName,
        wabaId,
        canSendMessage,
        timezone,
        errors,
        additionalInfo,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        accountStatus = VALUES(accountStatus),
        dockerStatus = VALUES(dockerStatus),
        messagingLimit = VALUES(messagingLimit),
        mmLiteStatus = VALUES(mmLiteStatus),
        ownershipType = VALUES(ownershipType),
        phone = VALUES(phone),
        phoneQuality = VALUES(phoneQuality),
        throughput = VALUES(throughput),
        verifiedName = VALUES(verifiedName),
        canSendMessage = VALUES(canSendMessage),
        timezone = VALUES(timezone),
        errors = VALUES(errors),
        additionalInfo = VALUES(additionalInfo),
        updated_at = NOW()
      `,
      [
        customer_id,
        wabaInfo.accountStatus,
        wabaInfo.dockerStatus,
        wabaInfo.messagingLimit,
        wabaInfo.mmLiteStatus,
        wabaInfo.ownershipType,
        wabaInfo.phone,
        wabaInfo.phoneQuality,
        wabaInfo.throughput,
        wabaInfo.verifiedName,
        wabaInfo.wabaId,
        wabaInfo.canSendMessage,
        wabaInfo.timezone,
        JSON.stringify(wabaInfo.errors || []),
        JSON.stringify(wabaInfo.additionalInfo || []),
      ]
    );

    return response.data;
  } catch (err) {
    console.error("Error fetching WABA info:", err.message, err.response?.data);
    throw err;
  }
};

// LOGIN Route
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    // Hash entered password
    const hashedPassword = md5(password);

    // 1. Try main user login
    const [mainRows] = await pool.query(
      `SELECT customer_id, email_id AS email, password, first_name, last_name, status FROM customer WHERE email_id = ?`,
      [email]
    );

    if (mainRows.length > 0 && mainRows[0].password === hashedPassword) {
      const user = mainRows[0];
      // ✅ Check status
      if (user.status === "inactive") {
        try {
          const wabaInfo = await getWabaInfoByCustomer(user.customer_id);
          console.log("WABA Info:", wabaInfo);

          if (wabaInfo?.wabaInfo?.accountStatus === "ACTIVE") {
            await pool.query(
              `UPDATE customer SET status = 'active' WHERE customer_id = ?`,
              [user.customer_id]
            );
            user.status = "active"; // update local object too
          }
        } catch (err) {
          console.error(
            "Failed to fetch WABA info for customer",
            user.customer_id,
            err.message
          );
        }
      }

      const [accessRows] = await pool.query(
        `SELECT allowed_routes FROM customer_user_access 
         WHERE customer_id = ? AND user_id IS NULL`,
        [user.customer_id]
      );

      const allowed_routes = accessRows.length
        ? typeof accessRows[0].allowed_routes === "string"
          ? JSON.parse(accessRows[0].allowed_routes)
          : accessRows[0].allowed_routes
        : [];

      const token = jwt.sign(
        {
          customer_id: user.customer_id,
          email: user.email,
        },
        SECRET,
        { expiresIn: "30d" }
      );
      res.cookie("auth_token", token, cookieOptions);

      return res.json({
        success: true,
        message: "Login successful",
        user: {
          customer_id: user.customer_id,
          email: user.email,
          status: user.status,
          name: [user.first_name, user.last_name].filter(Boolean).join(""),
          role: "main",
          allowed_routes,
          plan: "basic",
        },
      });
    }

    // 2. Try sub-user login
    const [subRows] = await pool.query(
      `SELECT user_id, customer_id, email, password, name FROM customer_users WHERE email = ?`,
      [email]
    );

    if (subRows.length > 0 && subRows[0].password === hashedPassword) {
      const user = subRows[0];

      const [accessRows] = await pool.query(
        `SELECT allowed_routes FROM customer_user_access 
         WHERE customer_id = ? AND user_id = ?`,
        [user.customer_id, user.user_id]
      );

      const allowed_routes = accessRows.length
        ? typeof accessRows[0].allowed_routes === "string"
          ? JSON.parse(accessRows[0].allowed_routes)
          : accessRows[0].allowed_routes
        : [];

      const token = jwt.sign(
        {
          customer_id: user.customer_id,
          user_id: user.user_id,
          email: user.email,
        },
        SECRET,
        { expiresIn: "30d" }
      );

      res.cookie("auth_token", token, cookieOptions);

      return res.json({
        success: true,
        message: "Login successful",
        user: {
          customer_id: user.customer_id,
          email: user.email,
          name:
            user.name ||
            [user.first_name, user.last_name].filter(Boolean).join(" ") ||
            "",
          role: "sub_user",
          allowed_routes,
        },
      });
    }

    return res.status(401).json({ error: "Invalid email or password." });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ME Route
export const getMe = (req, res) => {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ success: false, error: "No token found" });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    res.json({
      success: true,
      user: {
        customer_id: decoded.customer_id,
        email: decoded.email,
      },
    });
  } catch (err) {
    res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
};

// LOGOUT Route
export const logoutUser = (req, res) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
  });

  return res.json({ success: true, message: "Logged out successfully" });
};
