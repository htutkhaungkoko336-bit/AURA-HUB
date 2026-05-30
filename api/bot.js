const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];
const photoTimers = {}; // ပုံစုရန် Timer များသိမ်းထားရန်

function isAdmin(userId) { return adminIds.includes(userId.toString()); }

// 1. Start Command
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();
    if (isAdmin(userId)) return ctx.reply("👋 Admin Panel သို့ ကြိုဆိုပါသည်။");
    const matchId = ctx.startPayload;
    if (!matchId) return ctx.reply("🔥 AURA HUB Matchmaking Bot သို့ ကြိုဆိုပါသည်။");
    await db.collection("sessions").doc(userId).set({ currentMatchId: matchId }, { merge: true });
    
    // ပွဲစဉ်အချက်အလက်ပြသခြင်း (မူလအတိုင်း)
    try {
        const matchDoc = await db.collection("matches").doc(matchId).get();
        if (!matchDoc.exists) return ctx.reply("❌ ပွဲစဉ်အချက်အလက် ရှာမတွေ့ပါ။");
        const matchData = matchDoc.data();
        const [leaderA, leaderB] = await Promise.all([
            db.collection("registrations").doc(matchData.teamA_LeaderId).get(),
            db.collection("registrations").doc(matchData.teamB_LeaderId).get()
        ]);
        const dA = leaderA.data(), dB = leaderB.data();
        const msg = `<b>🔍 MATCH DETAILS</b>\n💰 <b>Fee:</b> ${matchData.fee || 0}\n━━━━━━━━━━━━━━\n<b>🏆 TEAM A: ${matchData.teamA}</b>\n👤 Leader: ${dA.players[0].name}\n📞 Ph: ${dA.kpayPhone}\n\n<b>🏆 TEAM B: ${matchData.teamB}</b>\n👤 Leader: ${dB.players[0].name}\n📞 Ph: ${dB.kpayPhone}\n━━━━━━━━━━━━━━\n🎲 <b>First Pick:</b> ${matchData.firstPickWinner}`;
        ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (e) { ctx.reply("❌ စနစ်အမှားအယွင်းရှိပါသည်။"); }
});

// 2. Photo Handling (5 Seconds Batching)
bot.on('photo', async (ctx) => {
    const userId = ctx.from.id.toString();
    const sessionDoc = await db.collection("sessions").doc(userId).get();
    const session = sessionDoc.exists ? sessionDoc.data() : { waitingForReceipt: false };

    if (isAdmin(userId) && session.waitingForReceipt) {
        const photoId = ctx.message.photo.pop().file_id;
        await ctx.telegram.sendPhoto(session.targetChatId, photoId, { caption: "💰 ငွေလွှဲပြေစာ ရောက်ရှိပါပြီ။" });
        await db.collection("sessions").doc(userId).delete();
        return;
    }
    if (isAdmin(userId)) return;

    const matchId = session.currentMatchId;
    if (!matchId) return ctx.reply("❌ ပွဲစဉ် ID မတွေ့ရှိပါ။");

    const photoId = ctx.message.photo.pop().file_id;
    await db.collection("temp_photos").add({ userId, matchId, photoId, timestamp: new Date() });

    if (photoTimers[userId]) clearTimeout(photoTimers[userId]);

    photoTimers[userId] = setTimeout(async () => {
        const snapshot = await db.collection("temp_photos").where("userId", "==", userId).where("matchId", "==", matchId).get();
        const photos = snapshot.docs.map(doc => ({ type: 'photo', media: doc.data().photoId }));
        
        for (const adminId of adminIds) {
            const mediaGroup = await bot.telegram.sendMediaGroup(adminId, photos);
            await bot.telegram.sendMessage(adminId, "📸 *ရလဒ် Screenshot အစုအဝေး*", {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔍 View Match Info', callback_data: `view_${matchId}_${userId}` }],
                        [{ text: '✅ Confirm', callback_data: `confirm_${userId}` }, { text: '❌ Reject', callback_data: `reject_${userId}` }]
                    ]
                }
            });
        }
        snapshot.docs.forEach(doc => doc.ref.delete());
        delete photoTimers[userId];
    }, 5000);

    ctx.reply("✅ ပုံလက်ခံရရှိပါပြီ။ Admin ထံပို့ရန် ခဏစောင့်ပေးပါ...");
});

// 3. View Match Info (Updated for Album Logic)
bot.action(/view_(.+)/, async (ctx) => {
    const [matchId, userId] = ctx.match[1].split('_');
    const matchDoc = await db.collection("matches").doc(matchId).get();
    const matchData = matchDoc.data();
    const [leaderA, leaderB] = await Promise.all([
        db.collection("registrations").doc(matchData.teamA_LeaderId).get(),
        db.collection("registrations").doc(matchData.teamB_LeaderId).get()
    ]);
    const info = `<b>🔍 MATCH DETAILS</b>\n💰 <b>Fee:</b> ${matchData.fee || 0}\n━━━━━━━━━━━━━━\n<b>🏆 TEAM A: ${matchData.teamA}</b>\n👤 Leader: ${leaderA.data().players[0].name}\n📞 K-Pay: <code>${leaderA.data().kpayPhone}</code>\n\n<b>🏆 TEAM B: ${matchData.teamB}</b>\n👤 Leader: ${leaderB.data().players[0].name}\n📞 K-Pay: <code>${leaderB.data().kpayPhone}</code>`;
    ctx.reply(info, { parse_mode: 'HTML' });
    ctx.answerCbQuery();
});

// 4. Admin Actions
bot.action(/confirm_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    await ctx.editMessageCaption("✅ အတည်ပြုသည်။ ငွေလွှဲပြေစာ ပို့ပေးပါ။");
    await db.collection("sessions").doc(userId).set({ waitingForReceipt: true, targetChatId: userId }, { merge: true });
    ctx.answerCbQuery();
});

bot.action(/reject_(.+)/, async (ctx) => {
    await ctx.editMessageCaption("❌ ပယ်ချပြီးပါပြီ။");
    ctx.answerCbQuery();
});

module.exports = async (req, res) => {
    try { await bot.handleUpdate(req.body); res.status(200).send('OK'); }
    catch (err) { console.error(err); res.status(500).send('Internal Server Error'); }
};