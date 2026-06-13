const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { regId, data } = req.body;
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const REGISTRATION_GROUP_ID = process.env.REGISTRATION_GROUP_ID;

    // Refund Request လား၊ New Registration လား ခွဲခြားခြင်း
    const isRefund = data.isRefund === true;

    let message = "";
    let inline_keyboard = [];

    if (isRefund) {
        // Refund Request အတွက်
        message = `⚠️ *Refund Request!*\n\nID: ${regId} သည် ငွေပြန်အမ်းရန် တောင်းဆိုထားပါသည်။`;
        inline_keyboard = [[{ text: '✅ Confirm Refund', callback_data: `confirm_refund_${regId}` }]];
    } else {
        // New Registration အတွက် (သင်ရေးထားတဲ့ မူလ Logic)
        const resubTag = data.isResubmission ? "⚠️ *[Re-submission]*\n" : "";
        const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Yangon' });
        
        let playerDetails = "";
        if (data.mode === "5vs5") {
            playerDetails = data.players.map((p, i) => `${i+1}. ${p.name} (ID: ${p.id})`).join('\n');
        } else {
            playerDetails = `Player: ${data.playerName}\nID: ${data.mlbbId}`;
        }

        const logoSection = data.squadLogo ? `\n🖼️ [View Squad Logo](${data.squadLogo})` : "";

        message = `${resubTag}🔔 *New Registration Received!*\n\n` +
                  `🕒 *Time:* ${timestamp}\n` +
                  `🎮 *Mode:* ${data.mode}\n` +
                  `💰 *Fee:* ${data.fee} Ks\n\n` +
                  `👤 *Identity:*\n${data.squadName ? `Squad: ${data.squadName}\n${playerDetails}` : playerDetails}\n` +
                  logoSection + `\n\n` + 
                  `💳 *Payment Info:*\nName: ${data.kpayName}\nPhone: ${data.kpayPhone}\n\n` +
                  `🖼️ [View Payment Proof](${data.paymentURL})\n` +
                  `🆔 *Reg ID:* ${regId}`;

        inline_keyboard = [[
            { text: '✅ Confirm', callback_data: `regConfirm_${regId}` },
            { text: '❌ Reject', callback_data: `regReject_${regId}` }
        ]];
    }

    // Telegram ကို ပို့ဆောင်ခြင်း
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: REGISTRATION_GROUP_ID,
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