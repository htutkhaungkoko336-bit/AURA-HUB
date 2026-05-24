const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');

// Firebase Initialization
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

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

// 2. Photo Handling (Firebase Session ကို သုံးထားသည်)
bot.on('photo', async (ctx) => {
    const sessionDoc = await db.collection("sessions").doc(ctx.from.id.toString()).get();
    const session = sessionDoc.exists ? sessionDoc.data() : { waitingForReceipt: false };

    // Admin က Confirm ပြီးနောက် ငွေလွှဲပြေစာ ပို့ခြင်း
    if (isAdmin(ctx.from.id) && session.waitingForReceipt) {
        const photoId = ctx.message.photo.pop().file_id;
        
        // ဒီမှာ session.targetChatId က အပေါ်က User ID ဖြစ်နေတဲ့အတွက် User ဆီပဲ ရောက်သွားမယ်
        await ctx.telegram.sendPhoto(session.targetChatId, photoId, {
            caption: "💰 ငွေလွှဲပြေစာ ရောက်ရှိပါပြီ။\n\n🏆 ပွဲစဉ်ပြီးဆုံးသွားပါပြီ။ AURA HUB အား အားပေးမှုအတွက် ကျေးဇူးတင်ပါသည်။"
        });
        
        await db.collection("sessions").doc(ctx.from.id.toString()).delete();
        return;
    }

    if (isAdmin(ctx.from.id)) return;
    
    // User က ပုံပို့ရင် Firebase ထဲကို userId နဲ့တကွ သိမ်းပေးထားမယ်
    const photoId = ctx.message.photo.pop().file_id;
    const docRef = await db.collection("pending_photos").add({ 
        photoId, 
        userId: ctx.from.id, 
        timestamp: new Date() 
    });
    
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

// 3. Admin Actions (Confirm/Reject)
bot.action(/confirm_(.+)/, async (ctx) => {
    const docId = ctx.match[1]; // Pending Photo ရဲ့ Document ID
    
    // Firebase ကနေ ပုံတင်ထားတဲ့လူရဲ့ ID ကို အရင်သွားရှာမယ်
    const doc = await db.collection("pending_photos").doc(docId).get();
    
    if (!doc.exists) {
        return ctx.answerCbQuery("❌ Error: အချက်အလက် ရှာမတွေ့ပါ။");
    }

    const userId = doc.data().userId; // Firebase ကနေ User ID ကို အလိုလိုဆွဲထုတ်မယ်

    await ctx.answerCbQuery("ပြေစာပို့ရန် စောင့်ဆိုင်းနေပါသည်...");
    await ctx.editMessageCaption("✅ အတည်ပြုသည်။ ကျေးဇူးပြု၍ ငွေလွှဲပြေစာ (SS) ကို ပို့ပေးပါ။");
    
    // User ရဲ့ ID ကို targetChatId အဖြစ် Session ထဲ သိမ်းလိုက်မယ်
    await db.collection("sessions").doc(ctx.from.id.toString()).set({ 
        waitingForReceipt: true, 
        targetChatId: userId 
    });
});
bot.action(/reject_.+/, async (ctx) => {
    await ctx.answerCbQuery("ပယ်ချပြီးပါပြီ");
    await ctx.editMessageCaption("❌ ဤရလဒ်မှာ မမှန်ကန်ပါ။");
});

module.exports = async (req, res) => {
    try { await bot.handleUpdate(req.body); res.status(200).send('OK'); }
    catch (err) { console.error(err); res.status(500).send('Internal Server Error'); }
};