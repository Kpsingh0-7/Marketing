import dotenv from 'dotenv';
import axios from 'axios';
import { pool } from '../config/db.js';

dotenv.config();

const BASE_URL = 'https://partner.gupshup.io/partner';
const CALLBACK_URL = 'https://marketing.foodchow.co.uk/webhook'; // static

const loginToGupshup = async (email, password) => {
  const response = await axios.post(
    `${BASE_URL}/account/login`,
    new URLSearchParams({ email, password }),
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );
  return response.data.token;
};

const createGupshupAppByName = async (token, name) => {
  try {
    const response = await axios.post(
      `${BASE_URL}/app`,
      new URLSearchParams({
        name,
        templateMessaging: 'true',
        disableOptinPrefUrl: 'true',
      }),
      {
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
          token,
        },
      }
    );
    return { appId: response.data.appId };
  } catch (err) {
    if (err.response?.data?.message === 'Bot Already Exists') {
      const apps = await axios.get(`${BASE_URL}/app`, {
        headers: { accept: 'application/json', token },
      });
      const existingApp = apps.data?.apps?.find(app => app.name === name);
      if (existingApp) return { appId: existingApp.appId };
      throw new Error('Bot exists but not found in app list');
    }
    throw err;
  }
};

const setGupshupCallback = async (token, appId) => {
  await axios.put(
    `${BASE_URL}/app/${appId}/callback`,
    new URLSearchParams({
      url: CALLBACK_URL,
      directForwarding: 'true',
      notifyWithPhone: 'true',
      modes: 'SENT, READ, DELIVERED, ALL, TEMPLATE',
    }),
    {
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
        token,
      },
    }
  );
};

const getAppToken = async (partnerToken, appId) => {
  const response = await axios.get(`${BASE_URL}/app/${appId}/token`, {
    headers: {
      accept: 'application/json',
      token: partnerToken,
    },
  });
  return response.data.token;
};

const generateOnboardingLink = async (token, appId, user = 'Default User', lang = 'English') => {
  const response = await axios.get(
    `${BASE_URL}/app/${appId}/onboarding/embed/link?regenerate=true&user=${encodeURIComponent(
      user
    )}&lang=${encodeURIComponent(lang)}`,
    {
      headers: {
        accept: 'application/json',
        token,
      },
    }
  );
  return response.data;
};

export const createGupshupApp = async (req, res) => {
  const { customer_id, name, user = 'Foodchow Client', lang = 'English' } = req.body;

  if (!customer_id || !name) {
    return res.status(400).json({
      success: false,
      error: 'Both customer_id and name are required.',
    });
  }

  try {
    // Step 1: Check if config exists in DB
    const [rows] = await pool.query(
      'SELECT gupshup_id, token FROM gupshup_configuration WHERE customer_id = ?',
      [customer_id]
    );

    let gupshup_id, token;

    if (rows.length > 0 && rows[0].gupshup_id && rows[0].token) {
      gupshup_id = rows[0].gupshup_id;
      token = rows[0].token;
    } else {
      // Step 2: Login
      const loginToken = await loginToGupshup(process.env.GS_EMAIL, process.env.GS_PASSWORD);

      // Step 3: Create App
      const { appId } = await createGupshupAppByName(loginToken, name);
      gupshup_id = appId;

      // Step 4: Get App Token
      token = await getAppToken(loginToken, appId);

      // Step 5: Save in DB
      await pool.query(
        `INSERT INTO gupshup_configuration (customer_id, gupshup_id, token)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE gupshup_id = VALUES(gupshup_id), token = VALUES(token)`,
        [customer_id, gupshup_id, token]
      );

      // Step 6: Set Callback
      await setGupshupCallback(token, gupshup_id);
    }

    // Step 7: Generate Onboarding Link
    const onboarding = await generateOnboardingLink(token, gupshup_id, user, lang);

    return res.status(200).json({
      success: true,
      message: 'Onboarding link ready.',
      appId: gupshup_id,
      onboardingLink: onboarding,
    });
  } catch (err) {
    console.error('Gupshup Error:', err.message, err.response?.data || '');
    return res.status(err.response?.status || 500).json({
      success: false,
      error: err.response?.data?.message || err.message,
      details: err.response?.data,
    });
  }
};
