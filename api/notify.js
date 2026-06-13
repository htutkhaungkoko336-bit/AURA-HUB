const axios = require('axios');
const admin = require('firebase-admin');

// Firebase Initialization
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
}
const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    try {
        const { regId, data, isRefund } = req.body;
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const REG_GROUP_ID = process.env.REGISTRATION_GROUP_ID;
        const REFUND_GROUP_ID = process.env.REFUND_GROUP_ID;

        // ၁။ REFUND REQUEST (Registration Data ကို DB ကနေ ပြန်ဆွဲထုတ်မယ်)
        if (isRefund) {
            const doc = await db.collection("registrations").doc(regId).get();
            if (!doc.exists) throw new Error("Registration not found");
            const regData = doc.data();

            const msg = `⚠️ <b>REFUND REQUEST</b>\n\n` +
                        `🆔 <b>Reg ID:</b> ${regId}\n` +
                        `👤 <b>Squad:</b> ${regData.squadName || regData.playerName}\n` +
                        `📞 <b>K-Pay:</b> ${regData.kpayPhone}\n` +
                        `💰 <b>Amount:</b> ${regData.fee} Ks\n\n` +
                        `<i>Admin ငွေပြန်လွှဲပြီးမှ Confirm ပေးပါ။</i>`;

            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: REFUND_GROUP_ID,
                text: msg,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{ text: '✅ Confirm Refund', callback_data: `confirm_refund_${regId}` }]]
                }
            });
        } 
        // ၂။ NORMAL REGISTRATION REQUEST
        else {
            const resubTag = data.isResubmission ? "⚠️ *[Re-submission]*\n" : "";
            const playerDetails = data.mode === "5vs5" 
                ? data.players.map((p, i) => `${i+1}. ${p.name} (ID: ${p.id})`).join('\n')
                : `Player: ${data.playerName}\nID: ${data.mlbbId}`;
            
            const message = `${resubTag}🔔 *New Registration Received!*\n\n` +
                            `🎮 *Mode:* ${data.mode}\n💰 *Fee:* ${data.fee} Ks\n\n` +
                            `👤 *Identity:*\n${data.squadName ? `Squad: ${data.squadName}\n${playerDetails}` : playerDetails}\n\n` +
                            `💳 *Payment:* ${data.kpayName} (${data.kpayPhone})\n` +
                            `🆔 *Reg ID:* ${regId}`;

            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: REG_GROUP_ID,
                text: message,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Confirm', callback_data: `regConfirm_${regId}` },
                        { text: '❌ Reject', callback_data: `regReject_${regId}` }
                    ]]
                }
            });
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}