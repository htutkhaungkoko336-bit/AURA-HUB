const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { regId, data } = req.body;
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const REGISTRATION_GROUP_ID = process.env.REGISTRATION_GROUP_ID;

    // ၁။ Re-submission Tag (စစ်ဆေးခြင်း)
    const resubTag = data.isResubmission ? "⚠️ *[Re-submission]*\n" : "";

    const timestamp = new Date().toLocaleString('en-US', { 
        timeZone: 'Asia/Yangon',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true 
    });

    // ၂။ Player Details
    let playerDetails = "";
    if (data.mode === "5vs5") {
        playerDetails = data.players.map((p, i) => `${i+1}. ${p.name} (ID: ${p.id})`).join('\n');
    } else {
        playerDetails = `Player: ${data.playerName}\nID: ${data.mlbbId}`;
    }

    // ၃။ Squad Logo လင့်ခ်ရှိရင် ထည့်ရန်
    const logoSection = data.squadLogo ? `\n🖼️ [View Squad Logo](${data.squadLogo})` : "";

    // ၄။ မက်ဆေ့ချ် ပုံစံ (resubTag ကို ထိပ်ဆုံးမှာ ထည့်သွင်းထားပါတယ်)
    const message = `${resubTag}🔔 *New Registration Received!*\n\n` +
                    `🕒 *Time:* ${timestamp}\n` +
                    `🎮 *Mode:* ${data.mode}\n` +
                    `💰 *Fee:* ${data.fee} Ks\n\n` +
                    `👤 *Identity:*\n${data.squadName ? `Squad: ${data.squadName}\n${playerDetails}` : playerDetails}\n` +
                    logoSection + `\n\n` + 
                    `💳 *Payment Info:*\nName: ${data.kpayName}\nPhone: ${data.kpayPhone}\n\n` +
                    `🖼️ [View Payment Proof](${data.paymentURL})\n` +
                    `🆔 *Reg ID:* ${regId}`;

    const inline_keyboard = [[
        { text: '✅ Confirm', callback_data: `regConfirm_${regId}` },
        { text: '❌ Reject', callback_data: `regReject_${regId}` }
    ]];

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
async function sendRefundToAdmin(docId) {
    // ၁။ Database မှ User အချက်အလက်များကို အရင်ဆွဲထုတ်ပါ
    const doc = await db.collection("registrations").doc(docId).get();
    const data = doc.data();

    // ၂။ Refund GP အတွက် Message ပြင်ဆင်ပါ
    const message = `🚨 <b>New Refund Request</b>\n\n` +
                    `👤 <b>Name:</b> ${data.squadName || data.playerName}\n` +
                    `💰 <b>Fee:</b> ${data.fee} Ks\n` +
                    `💳 <b>K-Pay Phone:</b> <code>${data.kpayPhone}</code>\n` +
                    `🆔 <b>Reg ID:</b> <code>${docId}</code>\n\n` +
                    `<i>Admin, ကျေးဇူးပြု၍ စစ်ဆေးပြီး အောက်ပါခလုတ်များဖြင့် ဆုံးဖြတ်ပေးပါ။</i>`;

    // ၃။ Refund GP သို့ ပို့ပါ (Inline Buttons များဖြင့်)
    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: process.env.REFUND_GROUP_ID, // သီးသန့် Refund GP ID
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✅ Approve Refund', callback_data: `approveRefund_${docId}` },
                    { text: '❌ Reject Refund', callback_data: `rejectRefund_${docId}` }
                ]
            ]
        }
    });
}