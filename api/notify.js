const axios = require('axios');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { regId, data, action } = req.body;
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        
        // Group IDs များ
        const REG_GROUP_ID = process.env.REGISTRATION_GROUP_ID;
        const REFUND_GROUP_ID = process.env.REFUND_GROUP_ID;
        const ADMIN_GROUP_ID = process.env.ADMIN_GROUP_ID;

        // --- ၁။ QUIT / REFUND ACTION ---
        if (action === 'quit') {
            let playerDetails = data.mode === "5vs5" 
                ? data.players.map((p, i) => `${i+1}. ${p.name}`).join('\n')
                : `${data.playerName}`;

            const quitMsg = `🚫 <b>PLAYER QUIT & REQUEST REFUND</b>\n\n` +
                            `🕒 <b>Time:</b> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Yangon' })}\n` +
                            `🎮 <b>Mode:</b> ${data.mode}\n` +
                            `💰 <b>Fee:</b> ${data.fee} Ks\n\n` +
                            `👤 <b>Team:</b> ${data.squadName || 'Solo'}\n` +
                            `👥 <b>Players:</b>\n${playerDetails}\n\n` +
                            `💳 <b>Refund Info:</b>\n` +
                            `Name: ${data.kpayName}\n` +
                            `Ph: <code>${data.kpayPhone}</code>\n\n` +
                            `🆔 <b>Reg ID:</b> <code>${regId}</code>\n\n` +
                            `<i>ကျေးဇူးပြု၍ Refund စစ်ဆေးပြီး အတည်ပြုပေးပါ။</i>`;
            
            const quitKeyboard = {
                inline_keyboard: [[
                    { text: '✅ Refund ပြုလုပ်ပြီးပြီ', callback_data: `confirmQuit_${regId}` }
                ]]
            };

            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: REFUND_GROUP_ID, 
                text: quitMsg,
                parse_mode: 'HTML',
                reply_markup: quitKeyboard
            });
            return res.status(200).json({ success: true, message: 'Refund group notified' });
        }

        // --- ၂။ NEW REGISTRATION ACTION ---
        const resubTag = data.isResubmission ? "⚠️ *[Re-submission]*\n" : "";
        const timestamp = new Date().toLocaleString('en-US', { 
            timeZone: 'Asia/Yangon',
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true 
        });

        let playerDetails = data.mode === "5vs5" 
            ? data.players.map((p, i) => `${i+1}. ${p.name} (ID: ${p.id})`).join('\n')
            : `Player: ${data.playerName}\nID: ${data.mlbbId}`;

        const logoSection = data.squadLogo ? `\n🖼️ [View Squad Logo](${data.squadLogo})` : "";

        // Payment Proof ကို အပေါ်မှာထားလိုက်ခြင်းဖြင့် Telegram က ပုံအဖြစ် Preview ပြပေးပါမယ်
        const regMessage = `${resubTag}🔔 *New Registration Received!*\n\n` +
                            `🕒 *Time:* ${timestamp}\n` +
                            `🎮 *Mode:* ${data.mode}\n` +
                            `💰 *Fee:* ${data.fee} Ks\n\n` +
                            `👤 *Identity:*\n${data.squadName ? `Squad: ${data.squadName}\n${playerDetails}` : playerDetails}\n` +
                            (data.heroName ? `🦸‍♂️ *Hero Name:* ${data.heroName}\n` : "") +
                            `💳 *Payment Info:*\nName: ${data.kpayName}\nPhone: ${data.kpayPhone}\n\n` +
                            `🖼️ [View Payment Proof](${data.paymentURL})\n` + 
                            logoSection + `\n\n` +
                            `🆔 *Reg ID:* ${regId}`;

        const regKeyboard = [[
            { text: '✅ Confirm', callback_data: `regConfirm_${regId}` },
            { text: '❌ Reject', callback_data: `regReject_${regId}` }
        ]];

        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: REG_GROUP_ID,
            text: regMessage,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: regKeyboard }
        });

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Error in notify API:", error);
        return res.status(500).json({ error: error.message });
    }
}