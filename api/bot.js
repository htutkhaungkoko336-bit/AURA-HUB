const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];

function isAdmin(userId) { return adminIds.includes(userId.toString()); }

// 1. Start Command - Match ID သိမ်းရန်
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();
    if (isAdmin(userId)) return ctx.reply("👋 Admin Panel သို့ ကြိုဆိုပါသည်။");

    const matchId = ctx.startPayload;
    if (!matchId) return ctx.reply("🔥 AURA HUB Matchmaking Bot သို့ ကြိုဆိုပါသည်။");

    // Session ထဲတွင် matchId ခဏသိမ်းထားခြင်း
    await db.collection("sessions").doc(userId).set({ currentMatchId: matchId }, { merge: true });

    // ပွဲစဉ်အချက်အလက်ပြသခြင်း (မူလအတိုင်း)
    try {
        const matchDoc = await db.collection("matches").doc(matchId).get();
        if (!matchDoc.exists) return ctx.reply("❌ ပွဲစဉ်အချက်အလက် ရှာမတွေ့ပါ။");
        const matchData = matchDoc.data();
        const leaderADoc = await db.collection("registrations").doc(matchData.teamA_LeaderId).get();
        const leaderBDoc = await db.collection("registrations").doc(matchData.teamB_LeaderId).get();
        const leaderA = leaderADoc.data() || { players: [] };
        const leaderB = leaderBDoc.data() || { players: [] };
        const renderPlayers = (players) => players.length <= 1 ? "<i>(နောက်ထပ် Players မရှိပါ)</i>" : players.slice(1).map(p => `👤 ${p.name}`).join('\n');

        const msg = `<b>✅ MATCH INFORMATION</b>\n\n<b>🏆 TEAM A: ${matchData.teamA}</b>\n👤 Leader: ${leaderA.players[0].name}\n📞 K-Pay: ${leaderA.kpayPhone}\n\n<b>👥 Players:</b>\n${renderPlayers(leaderA.players)}\n\n<b>🔥 V S 🔥</b>\n\n<b>🏆 TEAM B: ${matchData.teamB}</b>\n👤 Leader: ${leaderB.players[0].name}\n📞 K-Pay: ${leaderB.kpayPhone}\n\n<b>👥 Players:</b>\n${renderPlayers(leaderB.players)}\n\n🎲 First Pick: ${matchData.firstPickWinner}`;
        ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (e) { ctx.reply("❌ စနစ်အမှားအယွင်းရှိပါသည်။"); }
});

// 2. Photo Handling (အခု ဒီအပိုင်းကို အစားထိုးပါ)
bot.on('photo', async (ctx) => {
    // Admin receipt logic အပိုင်း
    const sessionDoc = await db.collection("sessions").doc(ctx.from.id.toString()).get();
    const session = sessionDoc.exists ? sessionDoc.data() : { waitingForReceipt: false };

    if (isAdmin(ctx.from.id) && session.waitingForReceipt) {
        const photoId = ctx.message.photo.pop().file_id;
        await ctx.telegram.sendPhoto(session.targetChatId, photoId, {
            caption: "💰 ငွေလွှဲပြေစာ ရောက်ရှိပါပြီ။\n\n🏆 ပွဲစဉ်ပြီးဆုံးသွားပါပြီ။ AURA HUB အား အားပေးမှုအတွက် ကျေးဇူးတင်ပါသည်။"
        });
        await db.collection("sessions").doc(ctx.from.id.toString()).delete();
        return;
    }

    if (isAdmin(ctx.from.id)) return;
    
    // User ပုံတင်ခြင်း logic
    const sessionDocUser = await db.collection("sessions").doc(ctx.from.id.toString()).get();
    const matchId = sessionDocUser.exists ? sessionDocUser.data().currentMatchId : null;
    
    if (!matchId) return ctx.reply("❌ ပွဲစဉ် ID မတွေ့ရှိပါ။ ကျေးဇူးပြု၍ Link မှတစ်ဆင့် ပြန်ဝင်ပေးပါ။");

    const photoId = ctx.message.photo.pop().file_id;
    const docRef = await db.collection("pending_photos").add({ 
        photoId, 
        userId: ctx.from.id, 
        matchId, 
        timestamp: new Date() 
    });
    
    // Admin ဆီသို့ Button များပါသော ပုံပို့ခြင်း
    for (const adminId of adminIds) {
        await bot.telegram.sendPhoto(adminId, photoId, {
            caption: "📸 *ရလဒ် Screenshot*",
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔍 View Match Info', callback_data: `view_${docRef.id}` }],
                    [
                        { text: '✅ Confirm', callback_data: `confirm_${docRef.id}` },
                        { text: '❌ Reject', callback_data: `reject_${docRef.id}` }
                    ]
                ]
            }
        });
    }
    ctx.reply("✅ ပုံတင်ပြပြီးပါပြီ။ Admin စစ်ဆေးနေပါသည်၊ ခဏစောင့်ပေးပါ။");
});
// 3. View Match Info Logic
bot.action(/view_(.+)/, async (ctx) => {
    const docId = ctx.match[1];
    const doc = await db.collection("pending_photos").doc(docId).get();
    if (!doc.exists) return ctx.answerCbQuery("❌ အချက်အလက်မရှိပါ။");
    
    const { matchId } = doc.data();
    const matchDoc = await db.collection("matches").doc(matchId).get();
    const matchData = matchDoc.data();
    
    const [leaderA, leaderB] = await Promise.all([
        db.collection("registrations").doc(matchData.teamA_LeaderId).get(),
        db.collection("registrations").doc(matchData.teamB_LeaderId).get()
    ]);

    const dataA = leaderA.data(), dataB = leaderB.data();
    const info = `
<b>🔍 MATCH DETAILS</b>
🕒 Time: ${matchData.matchTimestamp}
━━━━━━━━━━━━━━
<b>TEAM A: ${matchData.teamA} (Ph: ${dataA.kpayPhone})</b>
${dataA.players.map(p => `👤 ${p.name}`).join('\n')}

<b>TEAM B: ${matchData.teamB} (Ph: ${dataB.kpayPhone})</b>
${dataB.players.map(p => `👤 ${p.name}`).join('\n')}
━━━━━━━━━━━━━━
🎲 First Pick: ${matchData.firstPickWinner}
`;
    ctx.reply(info, { parse_mode: 'HTML' });
    ctx.answerCbQuery();
});


// 3. Admin Actions (Confirm/Reject)
bot.action(/confirm_(.+)/, async (ctx) => {
    const docId = ctx.match[1]; // Regex ကနေ doc ID ကို ယူမယ်
    const doc = await db.collection("pending_photos").doc(docId).get();
    
    if (!doc.exists) return ctx.answerCbQuery("❌ အချက်အလက် ရှာမတွေ့ပါ။");
    
    const userId = doc.data().userId; // ပုံတင်ထားတဲ့ User ရဲ့ ID ကို ယူမယ်

    await ctx.answerCbQuery("ပြေစာပို့ရန် စောင့်ဆိုင်းနေပါသည်...");
    await ctx.editMessageCaption("✅ အတည်ပြုသည်။ ကျေးဇူးပြု၍ ငွေလွှဲပြေစာ (SS) ကို ပို့ပေးပါ။");
    
    // session ထဲမှာ Admin ရဲ့ ID နဲ့ User ရဲ့ ID ကို တွဲမှတ်ထားမယ်
    await db.collection("sessions").doc(ctx.from.id.toString()).set({ 
        waitingForReceipt: true, 
        targetChatId: userId // <--- ဒီနေရာမှာ User ID ဖြစ်သွားပြီ
    });
});

bot.action(/reject_(.+)/, async (ctx) => {
    const docId = ctx.match[1];
    const doc = await db.collection("pending_photos").doc(docId).get();
    
    if (!doc.exists) return ctx.answerCbQuery("❌ အချက်အလက် ရှာမတွေ့ပါ။");
    
    const userId = doc.data().userId; 

    // User ဆီကို Reject ဖြစ်ကြောင်းနဲ့ ပုံအသစ်ပြန်တင်ဖို့ စာပို့မယ်
    try {
        await ctx.telegram.sendMessage(userId, "❌ *ဝမ်းနည်းပါသည်။* သင်တင်လိုက်သော Screenshot မှာ စစ်ဆေးမှု မအောင်မြင်ပါ။ ကျေးဇူးပြု၍ ပွဲစဉ်ရလဒ် အမှန် (SS) ကို Bot ထဲသို့ ပြန်လည်တင်ပြပေးပါ။", { parse_mode: 'Markdown' });
    } catch (e) {
        console.error("Failed to send rejection msg:", e);
    }

    await ctx.answerCbQuery("ပယ်ချပြီးပါပြီ");
    await ctx.editMessageCaption("❌ ဤရလဒ်မှာ မမှန်ကန်ပါ။ (User ထံသို့ ပုံအသစ်တင်ရန် အကြောင်းကြားပြီးပါပြီ)");
});
module.exports = async (req, res) => {
    try { await bot.handleUpdate(req.body); res.status(200).send('OK'); }
    catch (err) { console.error(err); res.status(500).send('Internal Server Error'); }
}; 