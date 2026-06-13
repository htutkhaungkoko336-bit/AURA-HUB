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
        const { documentId, isRefund, data } = req.body;
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const REG_GROUP_ID = process.env.REGISTRATION_GROUP_ID;
        const REFUND_GROUP_ID = "-1003928964996";

        // --- Refund Flow ---
        if (isRefund) {
            const doc = await db.collection("registrations").doc(documentId).get();
            if (!doc.exists) return res.status(404).json({ error: "Registration not found" });
            const d = doc.data();

            const msg = `⚠️ <b>REFUND REQUEST</b>\n\n🆔 <b>Doc ID:</b> <code>${documentId}</code>\n👤 <b>Squad:</b> ${d.squadName || 'Solo'}\n📞 <b>K-Pay:</b> ${d.kpayPhone}\n💰 <b>Amount:</b> ${d.fee} Ks`;

            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: REFUND_GROUP_ID,
                text: msg,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Confirm Refund', callback_data: `confirm_refund_${documentId}` },
                        { text: '🔍 View Detail', callback_data: `view_reg_${documentId}` }
                    ]]
                }
            });
            return res.status(200).json({ success: true, type: 'refund' });
        }
        // --- ၂။ NORMAL REGISTRATION (ပုံမှန်စာရင်းသွင်းခြင်း) ---
        const resubTag = data.isResubmission ? "⚠️ *[Re-submission]*\n" : "";
        const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Yangon', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

        let playerDetails = data.mode === "5vs5" 
            ? data.players.map((p, i) => `${i+1}. ${p.name} (ID: ${p.id})`).join('\n')
            : `Player: ${data.playerName}\nID: ${data.mlbbId}`;

        const logoSection = data.squadLogo ? `\n🖼️ [View Squad Logo](${data.squadLogo})` : "";
        const message = `${resubTag}🔔 *New Registration Received!*\n\n` +
                        `🕒 *Time:* ${timestamp}\n` +
                        `🎮 *Mode:* ${data.mode}\n` +
                        `💰 *Fee:* ${data.fee} Ks\n\n` +
                        `👤 *Identity:*\n${data.squadName ? `Squad: ${data.squadName}\n${playerDetails}` : playerDetails}\n` +
                        logoSection + `\n\n` + 
                        `💳 *Payment Info:*\nName: ${data.kpayName}\nPhone: ${data.kpayPhone}\n\n` +
                        `🖼️ [View Payment Proof](${data.paymentURL})\n` +
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

        return res.status(200).json({ success: true, type: 'registration' });
    } catch (error) {
        console.error("Error in notify API:", error);
        return res.status(500).json({ error: error.message });
    }
}