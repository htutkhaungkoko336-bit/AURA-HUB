const admin = require('firebase-admin');
const axios = require('axios');

// Firebase Initialize လုပ်ခြင်း
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { callback_query } = req.body;
    const data = callback_query.data; // ဥပမာ: confirm_12345
    const [action, regId] = data.split('_');
    const chatId = callback_query.message.chat.id;
    const messageId = callback_query.message.message_id;

    // Firebase ထဲမှာ Status Update လုပ်ခြင်း
    const status = action === 'confirm' ? 'approved' : 'rejected';
    await db.collection('registrations').doc(regId).update({ status: status });

    // Telegram မှာ Button ကို ဖျက်ပြီး Status ပြခြင်း
    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
      chat_id: chatId,
      message_id: messageId,
      text: callback_query.message.text + `\n\n✅ *Status: ${status.toUpperCase()}*`,
      parse_mode: 'Markdown'
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Callback Error:", error);
    return res.status(500).json({ error: error.message });
  }
}