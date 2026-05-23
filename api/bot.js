const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');

// Firebase Initialization
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const bot = new Telegraf(process.env.BOT_TOKEN);
const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];

// Admin ဟုတ်မဟုတ် စစ်ဆေးခြင်း
function isAdmin(userId) {
    return adminIds.includes(userId.toString());
}

// 1. Start Command & Deep Linking
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();
    if (isAdmin(userId)) return ctx.reply("👋 Admin Panel သို့ ကြိုဆိုပါသည်။");

    const matchId = ctx.startPayload;
    if (!matchId) return ctx.reply("🔥 AURA HUB Matchmaking Bot သို့ ကြိုဆိုပါသည်။");

    try {
        const matchDoc = await db.collection("matches").doc(matchId).get();
        if (!matchDoc.exists) return ctx.reply("❌ ပွဲစဉ်အချက်အလက် ရှာမတွေ့ပါ။");

        const data = matchDoc.data();
        ctx.reply(`✅ *ပွဲစဉ်အချက်အလက်*\n\n` +
                  `🏆 Team A: ${data.teamA.name}\n` +
                  `🏆 Team B: ${data.teamB.name}\n` +
                  `🎲 First Pick: ${data.firstPick}\n\n` +
                  `👉 အချက်အလက်များအတိုင်း ပွဲစဆော့ပြီးလျှင် အနိုင်ရသော SS ကို တင်ပေးပါ။`);
    } catch (e) {
        ctx.reply("❌ စနစ်အမှားအယွင်းရှိပါသည်။");
    }
});

// 2. Screenshot Submission (User)
bot.on('photo', async (ctx) => {
    if (isAdmin(ctx.from.id)) return;

    const photoId = ctx.message.photo.pop().file_id;
    
    // Admin 2 ယောက်လုံးကို ပို့ပေးခြင်း
    for (const adminId of adminIds) {
        await bot.telegram.sendPhoto(adminId, photoId, {
            caption: "📸 *ရလဒ် Screenshot အသစ် ရောက်ရှိသည်*",
            reply_markup: Markup.inlineKeyboard([
                Markup.button.callback('✅ Confirm', `confirm_${photoId}`),
                Markup.button.callback('❌ Reject', `reject_${photoId}`)
            ]).reply_markup
        });
    }
    ctx.reply("✅ ပုံတင်ပြပြီးပါပြီ။ Admin စစ်ဆေးနေပါသည်၊ ခဏစောင့်ပေးပါ။");
});

// 3. Admin Decision Handling
bot.action(/confirm_.+/, async (ctx) => {
    ctx.answerCbQuery("အတည်ပြုပြီးပါပြီ");
    ctx.editMessageCaption("✅ ဤရလဒ်ကို အတည်ပြုပြီးပါပြီ။");
    // ငွေလွှဲ SS ပို့ရန် Logic ကို ဒီနေရာတွင် ထည့်ပါ
});

bot.action(/reject_.+/, async (ctx) => {
    ctx.answerCbQuery("ပယ်ချပြီးပါပြီ");
    ctx.editMessageCaption("❌ ဤရလဒ်မှာ မမှန်ကန်ပါ။");
});

bot.launch();