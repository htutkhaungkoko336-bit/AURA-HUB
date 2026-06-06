// axios ကို install လုပ်ထားပြီးသားဖြစ်ပါစေ
const axios = require('axios');

export default async function handler(req, res) {
  // POST method သာ လက်ခံမည်
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { regId, data } = req.body;
    
    // Environment Variables များမှ Token နှင့် ID ကို ခေါ်ယူခြင်း
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const ADMIN_GROUP_ID = process.env.ADMIN_GROUP_ID;

    // Telegram သို့ ပို့မည့် Message ပုံစံ
    const message = `🔔 *New Registration Received!*\n\n` +
                    `Mode: ${data.mode}\n` +
                    `Fee: ${data.fee} Ks\n` +
                    `Name: ${data.squadName || data.playerName}\n` +
                    `[View Payment Proof](${data.paymentURL})\n\n` +
                    `ID: ${regId}`;

    // Telegram API သို့ ပို့ခြင်း
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