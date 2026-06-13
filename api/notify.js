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
        // documentId ကို လက်ခံရယူခြင်း
        const { documentId, data, isRefund } = req.body;
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const REG_GROUP_ID = process.env.REGISTRATION_GROUP_ID;
        const REFUND_GROUP_ID = process.env.REFUND_GROUP_ID;

        if (isRefund) {
            // Document ID ကိုသုံးပြီး Data ကို ပြန်ဖတ်ခြင်း
            const doc = await db.collection("registrations").doc(documentId).get();
            if (!doc.exists) throw new Error("Document not found");
            const regData = doc.data();

            const msg = `⚠️ <b>REFUND REQUEST</b>\n\n` +
                        `🆔 <b>Doc ID:</b> ${documentId}\n` +
                        `👤 <b>Squad:</b> ${regData.squadName || regData.playerName}\n` +
                        `📞 <b>K-Pay:</b> ${regData.kpayPhone}\n` +
                        `💰 <b>Amount:</b> ${regData.fee} Ks\n\n` +
                        `Admin ငွေလွှဲပြီးမှ Confirm ပေးပါ။`;

            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: REFUND_GROUP_ID,
                text: msg,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{ text: '✅ Confirm Refund', callback_data: `confirm_refund_${documentId}` }]]
                }
            });
        } else {
            // ပုံမှန် Registration (documentId ကိုပဲ သုံးမယ်)
            const message = `🔔 *New Registration Received!*\n\n` +
                            `🎮 *Mode:* ${data.mode}\n💰 *Fee:* ${data.fee} Ks\n\n` +
                            `🆔 *Doc ID:* ${documentId}`;

            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: REG_GROUP_ID,
                text: message,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Confirm', callback_data: `regConfirm_${documentId}` },
                        { text: '❌ Reject', callback_data: `regReject_${documentId}` }
                    ]]
                }
            });
        }
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}