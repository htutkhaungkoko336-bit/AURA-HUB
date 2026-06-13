const axios = require('axios');
const admin = require('firebase-admin');

// Firebase Admin ကို တစ်ကြိမ်ပဲ Initialize လုပ်ပါ
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { regId, data } = req.body;
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const REGISTRATION_GROUP_ID = process.env.REGISTRATION_GROUP_ID;

    // Refund Request လား၊ New Registration လား စစ်ဆေးခြင်း
    const isRefund = data && data.isRefund === true;

    let message = "";
    let inline_keyboard = [];

    if (isRefund) {
        // Refund တောင်းထားရင် Telegram Message ပို့မယ်
        message = `⚠️ *Refund Request!*\n\nID: ${regId} သည် ငွေပြန်အမ်းရန် တောင်းဆိုထားပါသည်။`;
        inline_keyboard = [[
            { text: '🔍 View Detail', callback_data: `view_detail_${regId}` },
            { text: '✅ Confirm Refund', callback_data: `confirm_refund_${regId}` }
        ]];
    } else {
        // New Registration အတွက် (Data ပြည့်စုံအောင် ဆွဲထုတ်ခြင်း)
        const resubTag = data.isResubmission ? "⚠️ *[Re-submission]*\n" : "";
        const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Yangon' });
        
        let playerDetails = "";
        if (data.mode === "5vs5") {
            playerDetails = data.players ? data.players.map((p, i) => `${i+1}. ${p.name} (ID: ${p.id})`).join('\n') : "No data";
        } else {
            playerDetails = `Player: ${data.playerName || 'N/A'}\nID: ${data.mlbbId || 'N/A'}`;
        }

        const logoSection = data.squadLogo ? `\n🖼️ [View Squad Logo](${data.squadLogo})` : "";

        message = `${resubTag}🔔 *New Registration Received!*\n\n` +
                  `🕒 *Time:* ${timestamp}\n` +
                  `🎮 *Mode:* ${data.mode || 'N/A'}\n` +
                  `💰 *Fee:* ${data.fee || 0} Ks\n\n` +
                  `👤 *Identity:*\n${data.squadName ? `Squad: ${data.squadName}\n${playerDetails}` : playerDetails}\n` +
                  logoSection + `\n\n` + 
                  `💳 *Payment Info:*\nName: ${data.kpayName || 'N/A'}\nPhone: ${data.kpayPhone || 'N/A'}\n\n` +
                  `🖼️ [View Payment Proof](${data.paymentURL || ''})\n` +
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