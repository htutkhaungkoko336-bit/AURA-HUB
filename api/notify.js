const axios = require('axios');
const admin = require('firebase-admin');

// Firebase Initialization
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    try {
        const { action, regId, documentId, data } = req.body;
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const REG_GROUP_ID = process.env.REGISTRATION_GROUP_ID;

        // ၁။ Registration အသစ်ဝင်လာလျှင်
        if (action === 'register') {
            const playerDetails = data.mode === "5vs5" 
                ? data.players.map((p, i) => `${i+1}. ${p.name} (ID: ${p.id})`).join('\n')
                : `Player: ${data.playerName}\nID: ${data.mlbbId}`;
            
            const message = `🔔 <b>New Registration Received!</b>\n\n` +
                            `🆔 <b>Reg ID:</b> <code>${regId}</code>\n` +
                            `🎮 <b>Mode:</b> ${data.mode}\n` +
                            `💰 <b>Fee:</b> ${data.fee} Ks\n\n` +
                            `👤 <b>Identity:</b>\n${data.squadName ? `Squad: ${data.squadName}\n` : ""}${playerDetails}\n\n` +
                            `💳 <b>Payment:</b> ${data.kpayName} (${data.kpayPhone})\n` +
                            `🖼️ <a href="${data.paymentURL}">View Payment Proof</a>`;

            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: REG_GROUP_ID,
                text: message,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Confirm', callback_data: `regConfirm_${regId}` },
                        { text: '❌ Reject', callback_data: `regReject_${regId}` }
                    ]]
                }
            });
            return res.status(200).json({ success: true });
        }

        // ၂။ Refund/Quit တောင်းဆိုလာလျှင်
        if (action === 'refund_request') {
            const msg = `⚠️ <b>NEW QUIT REQUEST</b>\n\n🆔 <b>Reg ID:</b> <code>${documentId}</code>\n\n` +
                        `<i>Admin: ငွေပြန်အမ်းရန်အတွက် Data ကို အောက်ပါခလုတ်ဖြင့် စစ်ဆေးပါ။</i>`;
            
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: REG_GROUP_ID,
                text: msg,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Confirm Refund', callback_data: `confirm_refund_${documentId}` },
                        { text: '🔍 View Full Data', callback_data: `view_reg_${documentId}` }
                    ]]
                }
            });
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ success: false, error: "Invalid action" });
    } catch (error) {
        console.error("Error in notify API:", error);
        return res.status(500).json({ error: error.message });
    }
}