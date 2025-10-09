import jwt from 'jsonwebtoken';

const SECRET = 'super_secret_key_123451256';

export function authenticateToken(req, res, next) {
  const token = req.cookies?.auth_token ||
    req.headers["authorization"]?.split(" ")[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: 'Access denied. Token missing.' });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
}


import { pool } from "../config/db.js"; 

const runTask = async () => {
  try {
    const [result] = await pool.execute(`
      UPDATE contact
      SET is_active = 0
      WHERE is_active = 1
        AND updated_at <= NOW() - INTERVAL 23 HOUR
    `);
    console.log(`Deactivated ${result.affectedRows} conversations`);
  } catch (err) {
    console.error("Interval job error:", err);
  }
};

// Run once per hour (60 * 60 * 1000)
setInterval(runTask, 3600000);

// Run immediately on startup
runTask();
