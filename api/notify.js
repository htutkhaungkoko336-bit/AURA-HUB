const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { regId, data } = req.body;
    
    // Environment Variables တွေကို ခေါ်သုံးခြင်း (Vercel settings ထဲကနေ လာမှာပါ)
// အရင်က ကုဒ်နေရာမှာ အခုလို ပြင်ပါ
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // TELEGRAM_BOT_TOKEN အဖြစ် ပြင်လိုက်ပါ
const ADMIN_GROUP_ID = process.env.ADMIN_GROUP_ID;
    // အကယ်၍ Token သို့မဟုတ် ID မရှိရင် error တက်အောင်လုပ်ခြင်း
    if (!BOT_TOKEN || !ADMIN_GROUP_ID) {
        throw new Error("Missing BOT_TOKEN or ADMIN_GROUP_ID in environment variables");
    }

    const message = `🔔 *New Registration Received!*\n\n` +
                    `Mode: ${data.mode}\n` +
                    `Fee: ${data.fee} Ks\n` +
                    `Name: ${data.squadName || data.playerName}\n` +
                    `[View Payment Proof](${data.paymentURL})\n\n` +
                    `ID: ${regId}`;

    // Telegram ကို စာပို့ခြင်း
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: ADMIN_GROUP_ID,
        text: message,
        parse_mode: 'Markdown'
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in notify API:", error);
    return res.status(500).json({ error: error.message });
  }
}