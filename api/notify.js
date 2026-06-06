const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { regId, data } = req.body;
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const ADMIN_GROUP_ID = process.env.ADMIN_GROUP_ID;

    // Player Details အားလုံး ပါဝင်အောင် ပြင်ဆင်ခြင်း
    let playerDetails = "";
    if (data.mode === "5vs5") {
        playerDetails = data.players.map((p, i) => `${i+1}. ${p.name} (ID: ${p.id})`).join('\n');
    } else {
        playerDetails = `Player: ${data.playerName}\nID: ${data.mlbbId}`;
    }

    // မက်ဆေ့ချ် ပုံစံ
    const message = `🔔 *New Registration Received!*\n\n` +
                    `🎮 *Mode:* ${data.mode}\n` +
                    `💰 *Fee:* ${data.fee} Ks\n\n` +
                    `👤 *Identity:*\n${data.squadName ? `Squad: ${data.squadName}\n${playerDetails}` : playerDetails}\n\n` +
                    `💳 *Payment Info:*\nName: ${data.kpayName}\nPhone: ${data.kpayPhone}\n\n` +
                    `🖼️ [View Payment Proof](${data.paymentURL})\n` +
                    `🆔 *Reg ID:* ${regId}`;

    // Confirm/Reject ခလုတ်များ ထည့်ခြင်း
    const inline_keyboard = [[
      { text: "✅ Confirm", callback_data: `confirm_${regId}` },
      { text: "❌ Reject", callback_data: `reject_${regId}` }
    ]];

    // Telegram သို့ ပို့ဆောင်ခြင်း
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: ADMIN_GROUP_ID,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: inline_keyboard }
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in notify API:", error);
    return res.status(500).json({ error: error.message });
  }
}