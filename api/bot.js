const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Group ID နှစ်ခုကို သီးခြားခွဲသတ်မှတ်ခြင်း
const ADMIN_GROUP_ID = process.env.ADMIN_GROUP_ID;         // Result Group အတွက်
const REG_GROUP_ID = process.env.REGISTRATION_GROUP_ID;    // Registration Group အသစ်အတွက်

const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];

function isAdmin(userId) {
    return adminIds.includes(userId.toString());
}

// --- Keyboards ---
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

// --- Admin Panel Command ---
bot.command('admin', (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    ctx.reply("🛠 <b>AURA HUB Admin Panel</b>\nလုပ်ဆောင်ချက်ကို ရွေးချယ်ပါ:", {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📋 Registration Pending', callback_data: 'view_reg_list' },
                 { text: '🏆 Result Management', callback_data: 'view_result_list' }]
            ]
        }
    });
});

// --- Registration Logic ---
bot.action(/regConfirm_(.+)/, async (ctx) => {
    // .trim() ကို ထည့်လိုက်ပါ
    const regId = ctx.match[1].trim(); 
    
    try {
        const docRef = db.collection("registrations").doc(regId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            console.log("Not found ID:", regId); // Logs မှာ ID ကို စစ်ကြည့်လို့ရအောင်
            return ctx.answerCbQuery("❌ Data မရှိပါ (ID မကိုက်ညီ)");
        }
        
        await docRef.update({ status: "confirm" });
        await ctx.editMessageText("✅ Registration အတည်ပြုပြီးပါပြီ။");
        ctx.answerCbQuery("Confirmed!");
    } catch (err) {
        console.error(err);
        ctx.answerCbQuery("Error ဖြစ်နေပါတယ်");
    }
});

bot.action(/regReject_(.+)/, async (ctx) => {
    const regId = ctx.match[1];
    await db.collection("registrations").doc(regId).update({ status: "rejected" });
    await ctx.editMessageText("❌ Registration ပယ်ချလိုက်ပါပြီ။");
    ctx.answerCbQuery("Rejected!");
});

// 1. Start Command (ပြင်ဆင်ပြီး)
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();
    if (isAdmin(userId)) return ctx.reply("👋 Admin Panel သို့ ကြိုဆိုပါသည်။ /admin ဟု ရိုက်၍ Menu ခေါ်ပါ။");
    
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
        const renderPlayers = (players) => players.map(p => `👤 ${p.name}`).join('\n');
        
        // ဒီနေရာမှာ သင်ရေးချင်တဲ့ စာသားကို ထည့်ပါ
        const instructionNote = "💡 *အနိုင်ရရှိသည့် အသင်းက Result Screenshot ကို ပို့ပေးပါ၊ ကျေးဇူးတင်ပါသည်။*";
        
        const msg = `<b>🔍 MATCH DETAILS</b>\n\n` +
                    `💰 <b>Fee:</b> ${matchData.fee || 0}\n` +
                    `━━━━━━━━━━━━━━\n` +
                    `<b>🏆 TEAM A: ${matchData.teamA}</b>\n📞 Ph: ${dataA.kpayPhone}\n${renderPlayers(dataA.players)}\n\n` +
                    `<b>🏆 TEAM B: ${matchData.teamB}</b>\n📞 Ph: ${dataB.kpayPhone}\n${renderPlayers(dataB.players)}\n` +
                    `━━━━━━━━━━━━━━\n` +
                    `🎲 <b>First Pick:</b> ${matchData.firstPickWinner}\n\n` +
                    instructionNote; // First Pick အောက်မှာ ပေါ်လာပါမယ်
        
        ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (e) { 
        console.error(e); 
        ctx.reply("❌ စနစ်အမှားအယွင်းရှိပါသည်။"); 
    }
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
    
    // Result Group အတွက် အရင် ID ကိုပဲ သုံးသည်
    await bot.telegram.sendPhoto(ADMIN_GROUP_ID, photoId, {
        caption: "📸 *ရလဒ် Screenshot*",
        parse_mode: 'Markdown',
        reply_markup: getAdminKeyboard(docRef.id, null)
    });
    ctx.reply("✅ ပုံတင်ပြပြီးပါပြီ။ Admin စစ်ဆေးနေပါသည်၊ ခဏစောင့်ပေးပါ။");
});

// 3. Selection Action
bot.action(/select(A|B)_(.+)/, async (ctx) => {
    const winner = ctx.match[1] === 'A' ? 'teamA' : 'teamB';
    const docId = ctx.match[2];
    await db.collection("pending_photos").doc(docId).update({ selectedWinner: winner });
    await ctx.editMessageReplyMarkup(getAdminKeyboard(docId, winner));
    ctx.answerCbQuery(`${winner === 'teamA' ? 'Team A' : 'Team B'} ကို ရွေးချယ်ပြီးပါပြီ`);
});

// 4. View Match Info
bot.action(/view_(.+)/, async (ctx) => {
    const docId = ctx.match[1];
    const message = ctx.callbackQuery.message;
    const isInfoVisible = (message.caption || "").includes("🔍 MATCH DETAILS");
    
    if (isInfoVisible) {
        await ctx.editMessageCaption("📸 *ရလဒ် Screenshot*", { 
            parse_mode: 'Markdown', 
            reply_markup: message.reply_markup 
        });
    } else {
        const doc = await db.collection("pending_photos").doc(docId).get();
        if (!doc.exists) return ctx.answerCbQuery("❌ အချက်အလက်မရှိပါ။");
        
        const data = doc.data();
        const matchId = data.matchId;
        const timestamp = data.timestamp; // Firestore Timestamp
        
        const matchDoc = await db.collection("matches").doc(matchId).get();
        const matchData = matchDoc.data();
        
        const [leaderA, leaderB] = await Promise.all([
            db.collection("registrations").doc(matchData.teamA_LeaderId).get(),
            db.collection("registrations").doc(matchData.teamB_LeaderId).get()
        ]);
        const dataA = leaderA.data(); const dataB = leaderB.data();
        
        // အချိန်မှန်စေရန် ပြင်ဆင်ခြင်း (Firestore timestamp.seconds ကို အသုံးပြုပါ)
        const timeStr = timestamp ? new Date(timestamp.seconds * 1000).toLocaleString('en-US', { 
            timeZone: 'Asia/Yangon',
            year: 'numeric', month: 'short', day: 'numeric', 
            hour: '2-digit', minute: '2-digit', hour12: true 
        }) : "N/A";

        const adminNote = "📝 အာညော်ငှာဆရော";

        const info = `<b>🔍 MATCH DETAILS</b>\n🕒 <b>Time:</b> ${timeStr}\n💰 <b>Fee:</b> ${matchData.fee || 0}\n━━━━━━━━━━━━━━\n<b>🏆 TEAM A: ${matchData.teamA}</b>\n📞 K-Pay: <code>${dataA.kpayPhone || 'မပါရှိပါ'}</code>\n${dataA.players.map(p => `👤 ${p.name}`).join('\n')}\n\n<b>🏆 TEAM B: ${matchData.teamB}</b>\n📞 K-Pay: <code>${dataB.kpayPhone || 'မပါရှိပါ'}</code>\n${dataB.players.map(p => `👤 ${p.name}`).join('\n')}\n\n━━━━━━━━━━━━━━\n${adminNote}`;
        
        await ctx.editMessageCaption(info, { 
            parse_mode: 'HTML', 
            reply_markup: message.reply_markup 
        });
    }
    ctx.answerCbQuery();
});
// 5. Confirm Action
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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.url === '/api/notify' || (req.path && req.path === '/api/notify')) {
        try {
            const { regId, data } = req.body;
            let playersList = "";
            if (data.mode === "5vs5" && data.players) {
                playersList = data.players.map(p => `👤 ${p.name}`).join('\n');
            } else {
                playersList = `👤 ${data.playerName || 'Solo'}`;
            }

            const msg = `🚨 <b>New Registration Request</b>\n\n` +
                        `🎮 Mode: ${data.mode}\n` +
                        `🏆 Squad: ${data.squadName || 'Solo'}\n` +
                        `📞 K-Pay: ${data.kpayPhone}\n` +
                        `💰 Fee: ${data.fee}\n` +
                        `👥 Players:\n${playersList}`;

            // Registration အသစ်အတွက် REG_GROUP_ID ကိုသုံးသည်
            await bot.telegram.sendMessage(REG_GROUP_ID, msg, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Confirm', callback_data: `regConfirm_${regId}` },
                        { text: '❌ Reject', callback_data: `regReject_${regId}` }
                    ]]
                }
            });
            return res.status(200).json({ success: true, message: 'Notification Sent' });
        } catch (err) {
            console.error("Notify Error:", err);
            return res.status(500).json({ success: false, error: err.message });
        }
    }

    try { 
        await bot.handleUpdate(req.body); 
        return res.status(200).send('OK'); 
    } catch (err) { 
        console.error("Bot Update Error:", err); 
        return res.status(500).send('Internal Server Error'); 
    }
};