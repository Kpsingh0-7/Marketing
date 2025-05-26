// middleware/authenticateToken.js
import jwt from 'jsonwebtoken';

const SECRET = 'super_secret_key_12345';

export function authenticateToken(req, res, next) {
const authHeader = req.headers['authorization'];
const token = authHeader?.split(' ')[1]; // expected format: "Bearer <token>"

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