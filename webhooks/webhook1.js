import axios from 'axios';
import fs from 'fs';
import path from 'path';

export const webhook1 = async (req, res) => {
  // ✅ Ensure folder exists
  const folderPath = path.join(process.cwd(), 'webhooks');
  const logPath = path.join(folderPath, 'webhook.txt');

  // ✅ Create folder if it doesn't exist
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  // ✅ Prepare full log entry
  const fullLog = [
    `\n--- Webhook Received at ${new Date().toISOString()} ---`,
    `Headers:\n${JSON.stringify(req.headers, null, 2)}`,
    `Body:\n${JSON.stringify(req.body, null, 2)}`,
    '----------------------------------------------\n'
  ].join('\n');

  // ✅ Append to webhook/webhook.txt
  try {
    fs.appendFileSync(logPath, fullLog, 'utf8');
  } catch (err) {
    console.error('❌ Failed to write webhook log:', err.message);
  }

  // ✅ Continue with business logic
  const contact = req.body?.contact;
  if (!contact || !contact.id) {
    return res.status(400).json({ error: 'Invalid or missing contact data' });
  }

  const fields = contact.fields || [];
  const getFieldValue = (slug) => {
    const field = fields.find(f => f.slug === slug);
    return field?.value || '';
  };

  const phoneNumber = getFieldValue('phone_number');
  const firstName = getFieldValue('first_name');
  const lastName = getFieldValue('surname');
  const fullName = `${firstName} ${lastName}`.trim();

  const payload = {
    phoneNumber: `+${phoneNumber}`,
    name: fullName,
    shop_id: '1',
    element_name: 'welcome_owner',
    parameters: [fullName]
  };

  try {
    const response = await axios.post('https://marketing.foodchow.co.uk/sendTemplates', payload);
    console.log('✅ External API response:', response.data);

    return res.status(200).json({ success: true, message: 'API triggered successfully' });
  } catch (error) {
    console.error('❌ Error calling external API:', error?.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to call external API' });
  }
};
