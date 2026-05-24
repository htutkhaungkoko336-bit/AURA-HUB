const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');

// Firebase Initialization
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore(); // <--- ဒါလေး ထည့်ပေးပါ!

// Telegram Bot Initialization
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];

function isAdmin(userId) {
    return adminIds.includes(userId.toString());
}

// 1. Start Command
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();
    if (isAdmin(userId)) return ctx.reply("👋 Admin Panel သို့ ကြိုဆိုပါသည်။");

    const matchId = ctx.startPayload;
    if (!matchId) return ctx.reply("🔥 AURA HUB Matchmaking Bot သို့ ကြိုဆိုပါသည်။");

    try {
        const matchDoc = await db.collection("matches").doc(matchId).get();
        if (!matchDoc.exists) return ctx.reply("❌ ပွဲစဉ်အချက်အလက် ရှာမတွေ့ပါ။");

        const data = matchDoc.data();
        
        // ဒီနေရာမှာ မင်းစိတ်ကြိုက် စာသားတွေကို ပြင်ရေးပါ
        const customMessage = `
✅ *Match Information*

🏆 Team A: ${data.teamA}
👤 Squad Leader: ${data.leaderA_Info}

VS

🏆 Team B: ${data.teamB}
👤 Squad Leader: ${data.leaderB_Info}

🎲 First Pick Team: ${data.firstPickWinner}

---
💡 *မှတ်ချက်:* ${data.note || "ပွဲစဆော့ပြီးလျှင် အနိုင်ရသော SS ကို တင်ပေးပါ။"}
📞 အကူအညီလိုပါက Admin ကို ဆက်သွယ်ပါ။
`;

        ctx.reply(customMessage, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error(e);
        ctx.reply("❌ စနစ်အမှားအယွင်းရှိပါသည်။");
    }
});

bot.on('photo', async (ctx) => {
    if (isAdmin(ctx.from.id)) return;

    const photoId = ctx.message.photo.pop().file_id;
    
    // ပုံကို Firestore မှာ သိမ်းပြီး Document ID ရယူမယ်
    const docRef = await db.collection("pending_photos").add({
        photoId: photoId,
        userId: ctx.from.id,
        timestamp: new Date()
    });
    
    const docId = docRef.id; // ဒါက ၆၄ လုံးထက် အများကြီး ပိုတိုတယ်

    for (const adminId of adminIds) {
        await bot.telegram.sendPhoto(adminId, photoId, {
            caption: "📸 *ရလဒ် Screenshot အသစ် ရောက်ရှိသည်*",
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([
                Markup.button.callback('✅ Confirm', `confirm_${docId}`),
                Markup.button.callback('❌ Reject', `reject_${docId}`)
            ]).reply_markup
        });
    }
    ctx.reply("✅ ပုံတင်ပြပြီးပါပြီ။ Admin စစ်ဆေးနေပါသည်၊ ခဏစောင့်ပေးပါ။");
});

// 3. Admin Actions
bot.action(/confirm_.+/, async (ctx) => {
    const docId = ctx.callbackQuery.data.split('_')[1];
    // လိုအပ်ရင် docId ကို သုံးပြီး Firestore ကနေ photoId ပြန်ထုတ်နိုင်တယ်
    await ctx.answerCbQuery("အတည်ပြုပြီးပါပြီ");
    await ctx.editMessageCaption("✅ ဤရလဒ်ကို အတည်ပြုပြီးပါပြီ။");
});

bot.action(/reject_.+/, async (ctx) => {
    await ctx.answerCbQuery("ပယ်ချပြီးပါပြီ");
    await ctx.editMessageCaption("❌ ဤရလဒ်မှာ မမှန်ကန်ပါ။");
});
// Vercel Serverless Function Export
module.exports = async (req, res) => {
    try {
        await bot.handleUpdate(req.body); 
        res.status(200).send('OK');
    } catch (err) {
        console.error(err);
        if (!res.headersSent) {
            res.status(500).send('Internal Server Error');
        }
    }
};