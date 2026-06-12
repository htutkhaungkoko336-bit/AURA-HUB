import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

export default async function handler(req, res) {
  // Method စစ်ဆေးခြင်း
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { type, regId, data, leaderName } = req.body;

    // ၁။ Registration Notification
    if (type === 'registration') {
      const REGISTRATION_GROUP_ID = process.env.REGISTRATION_GROUP_ID;
      const resubTag = data.isResubmission ? "⚠️ *[Re-submission]*\n" : "";
      
      const timestamp = new Date().toLocaleString('en-US', { 
          timeZone: 'Asia/Yangon', year: 'numeric', month: 'short', day: 'numeric', 
          hour: '2-digit', minute: '2-digit', hour12: true 
      });

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
                      `🆔 *Reg ID:* ${regId}`;

      await bot.telegram.sendMessage(REGISTRATION_GROUP_ID, message, {
          parse_mode: 'Markdown',
          reply_markup: {
              inline_keyboard: [[
                  { text: '✅ Confirm', callback_data: `regConfirm_${regId}` },
                  { text: '❌ Reject', callback_data: `regReject_${regId}` }
              ]]
          }
      });
      return res.status(200).json({ success: true });
    }

    // ၂။ Cancellation Request Notification
    if (type === 'cancel_request') {
      const REFUND_GROUP_ID = process.env.REFUND_GROUP_ID || "-1003928964996";
      
      if (!regId) return res.status(400).json({ message: "regId is missing" });

      const msg = `⚠️ ပွဲဖျက်ရန် တောင်းဆိုမှု (Reg ID): ${regId}\nTeam Leader: ${leaderName}`;
      
      await bot.telegram.sendMessage(REFUND_GROUP_ID, msg, {
          reply_markup: {
              inline_keyboard: [[
                  { text: '✅ Approve Refund', callback_data: `approve_refund_${regId}` }
              ]]
          }
      });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ message: 'Invalid request type' });

  } catch (error) {
    console.error("Error in notify API:", error);
    return res.status(500).json({ error: error.message });
  }
}