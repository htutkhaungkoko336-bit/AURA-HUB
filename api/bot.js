const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const ADMIN_GROUP_ID = process.env.ADMIN_GROUP_ID; 
const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];

function isAdmin(userId) {
    return adminIds.includes(userId.toString());
}

// Admin Keyboard အသစ် (Ticket System)
const getAdminKeyboard = (docId, selectedWinner) => {
    return {
        inline_keyboard: [
            [
                { text: selectedWinner === 'teamA' ? '✅ Team A (Win)' : '⬜ Team A', callback_data: `selectA_${docId}` },
                { text: selectedWinner === 'teamB' ? '✅ Team B (Win)' : '⬜ Team B', callback_data: `selectB_${docId}` }
            ],
            [
                { text: '✅ Confirm', callback_data: `confirm_${docId}` },
                { text: '❌ Reject', callback_data: `reject_${docId}` }
            ],
            [{ text: '🔍 View Match Info', callback_data: `view_${docId}` }]
        ]
    };
};

// 1. Start Command
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();
    if (isAdmin(userId)) return ctx.reply("👋 Admin Panel သို့ ကြိုဆိုပါသည်။");
    const matchId = ctx.startPayload;
    if (!matchId) return ctx.reply("🔥 AURA HUB Matchmaking Bot သို့ ကြိုဆိုပါသည်။");
    await db.collection("sessions").doc(userId).set({ currentMatchId: matchId }, { merge: true });
    try {
        const matchDoc = await db.collection("matches").doc(matchId).get();
        if (!matchDoc.exists) return ctx.reply("❌ ပွဲစဉ်အချက်အလက် ရှာမတွေ့ပါ။");
        const matchData = matchDoc.data();
        const [leaderADoc, leaderBDoc] = await Promise.all([
            db.collection("registrations").doc(matchData.teamA_LeaderId).get(),
            db.collection("registrations").doc(matchData.teamB_LeaderId).get()
        ]);
        const dataA = leaderADoc.data() || { players: [], kpayPhone: "မရှိပါ" };
        const dataB = leaderBDoc.data() || { players: [], kpayPhone: "မရှိပါ" };
        const leaderAId = dataA.players && dataA.players[0] ? dataA.players[0].id : "မရှိပါ";
        const leaderBId = dataB.players && dataB.players[0] ? dataB.players[0].id : "မရှိပါ";
        const renderPlayers = (players) => players.map(p => `👤 ${p.name}`).join('\n');
        const msg = `<b>🔍 MATCH DETAILS</b>\n\n💰 <b>Fee:</b> ${matchData.fee || 0}\n━━━━━━━━━━━━━━\n<b>🏆 TEAM A: ${matchData.teamA}</b>\n👤 Leader: ${dataA.players[0].name} (ID: <code>${leaderAId}</code>)\n📞 Ph: ${dataA.kpayPhone}\n${renderPlayers(dataA.players)}\n\n<b>🏆 TEAM B: ${matchData.teamB}</b>\n👤 Leader: ${dataB.players[0].name} (ID: <code>${leaderBId}</code>)\n📞 Ph: ${dataB.kpayPhone}\n${renderPlayers(dataB.players)}\n━━━━━━━━━━━━━━\n🎲 <b>First Pick:</b> ${matchData.firstPickWinner}\n\n━━━━━━━━━━━━━━\n📢 <b>AURA HUB Official</b>`;
        ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (e) { console.error(e); ctx.reply("❌ စနစ်အမှားအယွင်းရှိပါသည်။"); }
});

// 2. Photo Handler
bot.on('photo', async (ctx) => {
    if (ctx.chat.id.toString() === ADMIN_GROUP_ID && ctx.message.reply_to_message) {
        const sessionSnapshot = await db.collection("sessions").where("adminMessageId", "==", ctx.message.reply_to_message.message_id).get();
        if (!sessionSnapshot.empty) {
            const doc = sessionSnapshot.docs[0];
            const sessionData = doc.data();
            const photoId = ctx.message.photo.pop().file_id;
            await ctx.telegram.sendPhoto(sessionData.targetChatId, photoId, { caption: "💰 ငွေလွှဲပြေစာ ရောက်ရှိပါပြီ။\n\n🏆 ပွဲစဉ်ပြီးဆုံးသွားပါပြီ။" });
            await doc.ref.delete();
            return;
        }
    }
    const sessionDoc = await db.collection("sessions").doc(ctx.from.id.toString()).get();
    const matchId = sessionDoc.exists ? sessionDoc.data().currentMatchId : null;
    if (!matchId) return ctx.reply("❌ ပွဲစဉ် ID မတွေ့ရှိပါ။");

    const photoId = ctx.message.photo.pop().file_id;
    const docRef = await db.collection("pending_photos").add({ 
        photoId, userId: ctx.from.id, matchId: matchId, timestamp: new Date(), selectedWinner: null 
    });
    
    await bot.telegram.sendPhoto(ADMIN_GROUP_ID, photoId, {
        caption: "📸 *ရလဒ် Screenshot*",
        parse_mode: 'Markdown',
        reply_markup: getAdminKeyboard(docRef.id, null)
    });
    ctx.reply("✅ ပုံတင်ပြပြီးပါပြီ။ Admin စစ်ဆေးနေပါသည်၊ ခဏစောင့်ပေးပါ။");
});

// 3. Selection Action (Tick ခြစ်ခြင်း)
bot.action(/select(A|B)_(.+)/, async (ctx) => {
    const winner = ctx.match[1] === 'A' ? 'teamA' : 'teamB';
    const docId = ctx.match[2];
    await db.collection("pending_photos").doc(docId).update({ selectedWinner: winner });
    await ctx.editMessageReplyMarkup(getAdminKeyboard(docId, winner));
    ctx.answerCbQuery(`${winner === 'teamA' ? 'Team A' : 'Team B'} ကို ရွေးချယ်ပြီးပါပြီ`);
});

// 4. View Match Info (Original)
bot.action(/view_(.+)/, async (ctx) => {
    const docId = ctx.match[1];
    const message = ctx.callbackQuery.message;
    const isInfoVisible = (message.caption || "").includes("🔍 MATCH DETAILS");
    if (isInfoVisible) {
        await ctx.editMessageCaption("📸 *ရလဒ် Screenshot*", { parse_mode: 'Markdown', reply_markup: message.reply_markup });
    } else {
        const doc = await db.collection("pending_photos").doc(docId).get();
        if (!doc.exists) return ctx.answerCbQuery("❌ အချက်အလက်မရှိပါ။");
        const { matchId } = doc.data();
        const matchDoc = await db.collection("matches").doc(matchId).get();
        const matchData = matchDoc.data();
        const [leaderA, leaderB] = await Promise.all([
            db.collection("registrations").doc(matchData.teamA_LeaderId).get(),
            db.collection("registrations").doc(matchData.teamB_LeaderId).get()
        ]);
        const dataA = leaderA.data(); const dataB = leaderB.data();
        const info = `<b>🔍 MATCH DETAILS</b>\n💰 Fee: ${matchData.fee || 0}\n━━━━━━━━━━━━━━\n<b>🏆 TEAM A: ${matchData.teamA}</b>\n📞 K-Pay: <code>${dataA.kpayPhone || 'မပါရှိပါ'}</code>\n${dataA.players.map(p => `👤 ${p.name}`).join('\n')}\n\n<b>🏆 TEAM B: ${matchData.teamB}</b>\n📞 K-Pay: <code>${dataB.kpayPhone || 'မပါရှိပါ'}</code>\n${dataB.players.map(p => `👤 ${p.name}`).join('\n')}`;
        await ctx.editMessageCaption(info, { parse_mode: 'HTML', reply_markup: message.reply_markup });
    }
    ctx.answerCbQuery();
});

// 5. Confirm Action (Updated)
bot.action(/confirm_(.+)/, async (ctx) => {
    const docId = ctx.match[1];
    const doc = await db.collection("pending_photos").doc(docId).get();
    if (!doc.exists) return ctx.answerCbQuery("❌ Data မရှိပါ။");
    const data = doc.data();
    if (!data.selectedWinner) return ctx.answerCbQuery("⚠️ အနိုင်ရသော အသင်းကို အရင် Tick ခြစ်ပေးပါ!");

    const matchDoc = await db.collection("matches").doc(data.matchId).get();
    const matchData = matchDoc.data();
    const winnerKey = data.selectedWinner;
    const loserKey = winnerKey === 'teamA' ? 'teamB' : 'teamA';

    const batch = db.batch();
    batch.update(db.collection("matches").doc(data.matchId), { matchStatus: "finished", status: "finished", winner: winnerKey });
    batch.update(db.collection("registrations").doc(matchData[`${winnerKey}_LeaderId`]), { matchStatus: "finished", winStatus: "win" });
    batch.update(db.collection("registrations").doc(matchData[`${loserKey}_LeaderId`]), { matchStatus: "finished", winStatus: "lose" });
    batch.set(db.collection("results").doc(), { matchId: data.matchId, teamA: matchData.teamA, teamB: matchData.teamB, winner: winnerKey, fee: matchData.fee || 0, timestamp: admin.firestore.FieldValue.serverTimestamp() });
    
    await batch.commit();
    const sentMessage = await ctx.editMessageCaption("✅ ပွဲစဉ်ရလဒ် အတည်ပြုပြီးပါပြီ။\n💰 ကျေးဇူးပြု၍ ငွေလွှဲပြေစာ (SS) ကို ဤ Message ကို Reply ပြန်ပြီး ပို့ပေးပါ။", { 
        reply_markup: { inline_keyboard: [[{ text: '🔍 View Info', callback_data: `view_${docId}` }]] } 
    });
    
    await db.collection("sessions").doc(docId).set({ waitingForReceipt: true, targetChatId: data.userId, adminMessageId: sentMessage.message_id, matchId: data.matchId });
    await ctx.telegram.sendMessage(data.userId, "🎉 ဂုဏ်ယူပါသည်။ အနိုင်ရရှိကြောင်း အတည်ပြုပြီးပါပြီ။ ငွေလွှဲပြေစာ (SS) ပို့ပေးပါ။");
    ctx.answerCbQuery("အောင်မြင်ပါသည်။");
});

// 6. Reject Action
bot.action(/reject_(.+)/, async (ctx) => {
    const doc = await db.collection("pending_photos").doc(ctx.match[1]).get();
    if (doc.exists) await ctx.telegram.sendMessage(doc.data().userId, "❌ ရလဒ်စစ်ဆေးမှု မအောင်မြင်ပါ။ ပုံအသစ်ပြန်တင်ပေးပါ။");
    await ctx.editMessageCaption("❌ ပယ်ချပြီးပါပြီ။", { reply_markup: { inline_keyboard: [] } });
    ctx.answerCbQuery("ပယ်ချပြီးပါပြီ");
});

module.exports = async (req, res) => {
    try { await bot.handleUpdate(req.body); res.status(200).send('OK'); }
    catch (err) { console.error(err); res.status(500).send('Internal Server Error'); }
};