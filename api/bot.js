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
        const matchData = matchDoc.data();

        // Registration collection ထဲက Data ယူမယ်
        const leaderADoc = await db.collection("registrations").doc(matchData.teamA_LeaderId).get();
        const leaderBDoc = await db.collection("registrations").doc(matchData.teamB_LeaderId).get();

        const leaderA = leaderADoc.exists ? leaderADoc.data() : {};
        const leaderB = leaderBDoc.exists ? leaderBDoc.data() : {};

        // အရေးကြီးဆုံးအပိုင်း: Array ထဲက data ကို ဆွဲထုတ်ခြင်း
        // မင်းရဲ့ db screenshot မှာ players က array ဖြစ်ပြီး index 0 ထဲမှာ id နဲ့ name ရှိတယ်
        const playersA = leaderA.players || [];
        const playersB = leaderB.players || [];
        
        const pA = playersA[0] || { name: "N/A", id: "N/A" };
        const pB = playersB[0] || { name: "N/A", id: "N/A" };

        const customMessage = `
✅ *Match Information*

🏆 Team A: ${matchData.teamA}
👤 Player Name: ${pA.name}
🆔 ID No: ${pA.id}
📞 K-Pay Ph: ${leaderA.kpayPhone || "N/A"}

VS

🏆 Team B: ${matchData.teamB}
👤 Player Name: ${pB.name}
🆔 ID No: ${pB.id}
📞 K-Pay Ph: ${leaderB.kpayPhone || "N/A"}

🎲 First Pick Team: ${matchData.firstPickWinner}

---
👉 _ပွဲစဆော့ပြီးလျှင် အနိုင်ရသော SS ကို တင်ပေးပါ။_
`;

        ctx.reply(customMessage, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error("Error fetching data:", e);
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
        const matchData = matchDoc.data();

        // Registration collection ထဲက Data ယူမယ်
        const leaderADoc = await db.collection("registrations").doc(matchData.teamA_LeaderId).get();
        const leaderBDoc = await db.collection("registrations").doc(matchData.teamB_LeaderId).get();

        const leaderA = leaderADoc.exists ? leaderADoc.data() : {};
        const leaderB = leaderBDoc.exists ? leaderBDoc.data() : {};

        // အရေးကြီးဆုံးအပိုင်း: Array ထဲက data ကို ဆွဲထုတ်ခြင်း
        // မင်းရဲ့ db screenshot မှာ players က array ဖြစ်ပြီး index 0 ထဲမှာ id နဲ့ name ရှိတယ်
        const playersA = leaderA.players || [];
        const playersB = leaderB.players || [];
        
        const pA = playersA[0] || { name: "N/A", id: "N/A" };
        const pB = playersB[0] || { name: "N/A", id: "N/A" };

        const customMessage = `
✅ *Match Information*

🏆 Team A: ${matchData.teamA}
👤 Player Name: ${pA.name}
🆔 ID No: ${pA.id}
📞 K-Pay Ph: ${leaderA.kpayPhone || "N/A"}

VS

🏆 Team B: ${matchData.teamB}
👤 Player Name: ${pB.name}
🆔 ID No: ${pB.id}
📞 K-Pay Ph: ${leaderB.kpayPhone || "N/A"}

🎲 First Pick Team: ${matchData.firstPickWinner}

---
👉 _ပွဲစဆော့ပြီးလျှင် အနိုင်ရသော SS ကို တင်ပေးပါ။_
`;

        ctx.reply(customMessage, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error("Error fetching data:", e);
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

// 3. Admin Actions (Confirm လုပ်ရင် Bot ထွက်သွားမည့် Logic)
bot.action(/confirm_.+/, async (ctx) => {
    const docId = ctx.callbackQuery.data.split('_')[1];
    
    // ၁။ Admin အား အကြောင်းကြားခြင်း
    await ctx.answerCbQuery("အတည်ပြုပြီးပါပြီ။ Bot ထွက်ခွာသွားပါမည်။");
    await ctx.editMessageCaption("✅ ဤရလဒ်ကို အတည်ပြုပြီးပါပြီ။ ပွဲစဉ်ပြီးဆုံးသွားပါပြီ။");

    // ၂။ Group ထဲမှ Bot ထွက်သွားခြင်း
    // ဒါက Group Chat ထဲမှာဆိုရင် အဆင်ပြေသွားပါပြီ
    try {
        await ctx.reply("🏆 ပွဲစဉ်ပြီးဆုံးပါပြီ။ AURA HUB အား အားပေးမှုအတွက် ကျေးဇူးတင်ပါသည်။ Bot ထွက်ခွာသွားပါမည်။");
        await ctx.telegram.leaveChat(ctx.chat.id);
    } catch (err) {
        console.error("Bot could not leave chat:", err);
    }
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