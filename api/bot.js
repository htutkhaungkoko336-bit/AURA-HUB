const { Telegraf, Markup, session } = require('telegraf');
const LocalSession = require('telegraf-session-local'); // <--- ဒါလေး သေချာထည့်ပါ
const admin = require('firebase-admin');
// Firebase Initialization
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// Bot Initialization
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
bot.use((new LocalSession({ database: 'session.json' })).middleware()); // Session ထည့်သွင်းခြင်း

const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];
function isAdmin(userId) {
    return adminIds.includes(userId.toString());
}

// 1. Start Command
bot.start(async (ctx) => {
    if (isAdmin(ctx.from.id)) return ctx.reply("👋 Admin Panel သို့ ကြိုဆိုပါသည်။");
    const matchId = ctx.startPayload;
    if (!matchId) return ctx.reply("🔥 AURA HUB Matchmaking Bot သို့ ကြိုဆိုပါသည်။");

    try {
        const matchDoc = await db.collection("matches").doc(matchId).get();
        if (!matchDoc.exists) return ctx.reply("❌ ပွဲစဉ်အချက်အလက် ရှာမတွေ့ပါ။");
        const matchData = matchDoc.data();

        const leaderADoc = await db.collection("registrations").doc(matchData.teamA_LeaderId).get();
        const leaderBDoc = await db.collection("registrations").doc(matchData.teamB_LeaderId).get();

        const leaderA = leaderADoc.exists ? leaderADoc.data() : {};
        const leaderB = leaderBDoc.exists ? leaderBDoc.data() : {};

        const pA = (leaderA.players || [])[0] || { name: "N/A", id: "N/A" };
        const pB = (leaderB.players || [])[0] || { name: "N/A", id: "N/A" };

        const customMessage = `✅ *Match Information*\n\n🏆 Team A: ${matchData.teamA}\n👤 Name: ${pA.name}\n🆔 ID: ${pA.id}\n📞 Ph: ${leaderA.kpayPhone || "N/A"}\n\nVS\n\n🏆 Team B: ${matchData.teamB}\n👤 Name: ${pB.name}\n🆔 ID: ${pB.id}\n📞 Ph: ${leaderB.kpayPhone || "N/A"}\n\n🎲 First Pick: ${matchData.firstPickWinner}\n\n--- \n👉 _ပွဲစဆော့ပြီးလျှင် အနိုင်ရသော SS ကို တင်ပေးပါ။_`;
        ctx.reply(customMessage, { parse_mode: 'Markdown' });
    } catch (e) {
        ctx.reply("❌ စနစ်အမှားအယွင်းရှိပါသည်။");
    }
});

// 2. Photo Handling
bot.on('photo', async (ctx) => {
    // Admin က Confirm ပြီးနောက် ငွေလွှဲပြေစာ ပို့ခြင်း
    if (isAdmin(ctx.from.id) && ctx.session.waitingForReceipt) {
        const photoId = ctx.message.photo.pop().file_id;
        await ctx.telegram.sendPhoto(ctx.session.targetChatId, photoId, {
            caption: "💰 ငွေလွှဲပြေစာ ရောက်ရှိပါပြီ။\n\n🏆 ပွဲစဉ်ပြီးဆုံးသွားပါပြီ။ AURA HUB အား အားပေးမှုအတွက် ကျေးဇူးတင်ပါသည်။ Bot ထွက်ခွာသွားပါမည်။"
        });
        await ctx.telegram.leaveChat(ctx.session.targetChatId);
        ctx.session.waitingForReceipt = false;
        return;
    }

    if (isAdmin(ctx.from.id)) return;
    const photoId = ctx.message.photo.pop().file_id;
    const docRef = await db.collection("pending_photos").add({ photoId, userId: ctx.from.id, timestamp: new Date() });
    
    for (const adminId of adminIds) {
        await bot.telegram.sendPhoto(adminId, photoId, {
            caption: "📸 *ရလဒ် Screenshot*",
            reply_markup: Markup.inlineKeyboard([
                Markup.button.callback('✅ Confirm', `confirm_${docRef.id}`),
                Markup.button.callback('❌ Reject', `reject_${docRef.id}`)
            ]).reply_markup
        });
    }
    ctx.reply("✅ ပုံတင်ပြပြီးပါပြီ။ Admin စစ်ဆေးနေပါသည်၊ ခဏစောင့်ပေးပါ။");
});

// 3. Admin Actions
bot.action(/confirm_.+/, async (ctx) => {
    await ctx.answerCbQuery("ပြေစာပို့ရန် စောင့်ဆိုင်းနေပါသည်...");
    await ctx.editMessageCaption("✅ အတည်ပြုသည်။ ကျေးဇူးပြု၍ ငွေလွှဲပြေစာ (SS) ကို ပို့ပေးပါ။");
    ctx.session.waitingForReceipt = true;
    ctx.session.targetChatId = ctx.chat.id; // Confirm နှိပ်တဲ့ Group ID ကို သိမ်းထားမယ်
});

bot.action(/reject_.+/, async (ctx) => {
    await ctx.answerCbQuery("ပယ်ချပြီးပါပြီ");
    await ctx.editMessageCaption("❌ ဤရလဒ်မှာ မမှန်ကန်ပါ။");
});

module.exports = async (req, res) => {
    try { await bot.handleUpdate(req.body); res.status(200).send('OK'); }
    catch (err) { console.error(err); res.status(500).send('Internal Server Error'); }
};