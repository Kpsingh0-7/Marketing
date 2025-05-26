import { Router } from "express";
import multer from "multer";
import jwt from 'jsonwebtoken';
import { authenticateToken } from "../middleware/authenticateToken.js";
import { createWebhookHandler  }  from "../webhooks/webhook.js";

// Controllers that don't need io
import { getTemplate } from '../controllers/getTemplate.js';
import { sendTemplate } from '../controllers/sendTemplate.js';
import { sendTemplates } from '../controllers/sendTemplates.js';
import { createTemplate } from '../controllers/createTemplate.js';
import { deleteTemplate } from '../controllers/deleteTemplate.js';
import { updateTemplate } from '../controllers/editTemplate.js';
import { setupSubscription } from "../controllers/setSubscription.js";
import { addBulkContacts } from "../controllers/addBulkContacts.js";
import { sendBroadcast } from "../controllers/sendBroadcast.js";
import { getBroadcastCustomers } from "../controllers/getBroadcastCustomers.js";
import { getBroadcasts } from '../controllers/getBroadcasts.js';
import { getTemplateAnalytics } from '../controllers/getTemplateAnalytics.js';

// Controllers that require io passed (factories)
import { returnTemplates } from '../controllers/returnTemplates.js';
import { returnMessages } from '../controllers/returnMessages.js';
import { returnGroups } from '../controllers/returnGroups.js';
import { returnContacts } from '../controllers/returnContacts.js';
import { returnConversationId } from '../controllers/returnConversationId.js';
import { returnConversations } from '../controllers/returnConversations.js';

// Controllers you renamed with _ prefix (if needed)
import { addSingleContact } from '../controllers/addSingleContact.js';
import { processConversationMessage } from '../controllers/processConversationMessage.js';

const router = Router();
const upload = multer({ dest: "uploads/" });

const SECRET = 'super_secret_key_12345';
const REACT_APP_BASE_URL = 'https://marketing.tenacioustechies.com.au/login';

const users = [
  { email: 'john@example.com', password: 'userPassword' }
];

// You must have your `io` instance from your main server file:
// e.g. import io from './socket.js';
// For example, suppose you pass io here:
export default function createRouter(io) {
  // Public Routes
  router.post('/authenticate', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
  
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  
    const token = jwt.sign({ email }, SECRET, { expiresIn: '1d' });
    const redirectUrl = `${REACT_APP_BASE_URL}?token=${token}`;
    return res.json({ success: true, redirectUrl });
  });
  
  router.post("/webhook", createWebhookHandler(io));
  
  // Protected Routes (Requires JWT)
  router.post('/send', sendTemplate);
  router.post('/sendTemplates', sendTemplates);
  router.post('/subscription', setupSubscription);
  router.post('/createtemplate', createTemplate);
  router.post('/sendmessage',  processConversationMessage);
  router.post("/addcustomer", addSingleContact);
  router.post("/addcustomers", upload.single("file"), addBulkContacts);
  router.post("/sendBroadcast", sendBroadcast);
  router.post("/getBroadcastCustomers", getBroadcastCustomers);
  
  
  router.delete('/deletetemplate', authenticateToken, deleteTemplate);
  router.put('/edit', authenticateToken, updateTemplate);
  
  router.get('/gettemplates', authenticateToken, getTemplate);
  router.get('/contacts', authenticateToken, returnContacts); // if returnContacts needs io, change to returnContacts(io)
  router.get('/templates', authenticateToken, returnTemplates);
  router.get('/conversations', authenticateToken, returnConversations);
  router.get('/messages',  returnMessages);
  router.get('/conversationid', authenticateToken, returnConversationId);
  router.get('/returnGroups', authenticateToken, returnGroups);
  router.get('/getBroadcasts', authenticateToken, getBroadcasts);
  router.get("/getTemplateAnalytics", getTemplateAnalytics);
  
  return router;
}
