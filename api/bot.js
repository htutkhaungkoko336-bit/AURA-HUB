const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const ADMIN_GROUP_ID = process.env.ADMIN_GROUP_ID;
const REG_GROUP_ID = process.env.REGISTRATION_GROUP_ID;

const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => id.trim()) : [];

function isAdmin(userId) {
    return adminIds.includes(userId.toString());
}

// --- Keyboards ---
const getAdminKeyboard = (docId, selectedWinner) => ({
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
});

const getRejectKeyboard = (docId) => ({
    inline_keyboard: [
        [{ text: '⚠️ Fee မလုံလောက်', callback_data: `rj_fee_${docId}` }],
        [{ text: '⚠️ Name / ID မမှန်', callback_data: `rj_identity_${docId}` }],
        [{ text: '⚠️ K-Pay အချက်အလက်မှား', callback_data: `rj_payment_${docId}` }],
        [{ text: '🚫 ညစ်ညမ်းပုံ', callback_data: `rj_logo_${docId}` }]
    ]
});

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
    await db.collection("registrations").doc(ctx.match[1].trim()).update({ status: "confirm" });
    await ctx.editMessageText("✅ Registration အတည်ပြုပြီးပါပြီ။");
    ctx.answerCbQuery("Confirmed!");
});

// ၁။ Registration အတွက် Reject အကြောင်းအရင်းရွေးခိုင်းခြင်း
bot.action(/regReject_(.+)/, async (ctx) => {
    const docId = ctx.match[1];
    // getRejectKeyboard က pending_photos အတွက် ရေးထားတာမို့ 
    // registration အတွက်လည်း အဆင်ပြေအောင် ဒီအတိုင်း သုံးလို့ရပါတယ်
    await ctx.editMessageReplyMarkup(getRejectKeyboard(docId));
    ctx.answerCbQuery("အကြောင်းအရင်း ရွေးပေးပါ");
});
// Result အတွက် Reject ခလုတ် အလုပ်လုပ်စေရန်
// အကြောင်းအရင်း ရွေးခိုင်းသည့် Keyboard မလိုတော့ဘဲ တိုက်ရိုက် Reject ချခြင်း
bot.action(/reject_(.+)/, async (ctx) => {
    const docId = ctx.match[1];
    
    // Database မှ data ရယူခြင်း (pending_photos ကို အရင်ရှာပါ)
    let docRef = db.collection("pending_photos").doc(docId);
    let doc = await docRef.get();
    
    if (!doc.exists) {
        docRef = db.collection("registrations").doc(docId);
        doc = await docRef.get();
    }

    if (!doc.exists) return ctx.answerCbQuery("❌ Data မရှိပါ။");
    
    try {
        // Status ကို rejected ပြောင်းမယ်
        await docRef.update({ 
            status: "rejected" 
        });        
        
        const data = doc.data();
        if(data.userId) {
            // User ဆီ ပို့မည့် စာ
            const msg = `❌ သင်တင်လိုက်သော Result Screenshot မမှန်ကန်ပါ။\n🔄 ကျေးဇူးပြု၍ မှန်ကန်သော ပုံအသစ်ကို ပြန်လည်တင်ပေးပါ။`;
            await ctx.telegram.sendMessage(data.userId, msg, { parse_mode: 'HTML' });
        }
        
        // Admin Group ထဲက စာကို ပြင်မယ် (View Match Info ခလုတ်တစ်ခုတည်းနဲ့)
        await ctx.editMessageCaption("❌ ပွဲရလဒ်ကို ပယ်ချထားပါသည်။", {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔍 View Match Info', callback_data: `view_${docId}` }]
                ]
            }
        });
        
        ctx.answerCbQuery("ပယ်ချလိုက်ပါပြီ");
    } catch (err) {
        console.error(err);
        ctx.answerCbQuery("❌ Error ဖြစ်နေသည်။");
    }
});
bot.action(/rj_(.+)_(.+)/, async (ctx) => {
    const reason = ctx.match[1];
    const docId = ctx.match[2];
    
    const reasonMap = { 
        'fee': 'Fee ကြေး မလုံလောက်ပါ', 
        'identity': 'Name သို့မဟုတ် ID မမှန်ကန်ပါ', 
        'payment': 'K-Pay အချက်အလက် မှားယွင်းနေပါသည်', 
        'logo': 'တင်ထားသောပုံမှာ ညစ်ညမ်းနေပါသည်' 
    };

    // အရေးကြီး: pending_photos ကို အရင်ရှာပါ
    let docRef = db.collection("pending_photos").doc(docId);
    let doc = await docRef.get();
    
    // မရှိမှ Registration ကို ရှာပါ
    if (!doc.exists) {
        docRef = db.collection("registrations").doc(docId);
        doc = await docRef.get();
    }

    if (!doc.exists) return ctx.answerCbQuery("❌ Data မရှိပါ။");
    
    try {
        // Status ကို rejected ပြောင်းမယ်
        await docRef.update({ 
            status: "rejected", 
            rejectReason: reason 
        });        
        
        const data = doc.data();
        if(data.userId) {
            const msg = `❌ သင်၏ တင်ပြချက်ကို ပယ်ချလိုက်ပါပြီ။\n\n📝 အကြောင်းရင်း: <b>${reasonMap[reason]}</b>\n🔄 ကျေးဇူးပြု၍ ပြန်လည်ပြင်ဆင်ပါ။`;
            await ctx.telegram.sendMessage(data.userId, msg, { parse_mode: 'HTML' });
        }
        
        // Admin Group ထဲက စာကို ပြင်မယ်
        await ctx.editMessageText(`✅ ${reasonMap[reason]} ကြောင့် Reject လုပ်လိုက်ပါပြီ။`);
    } catch (err) {
        console.error(err);
        await ctx.editMessageText(`❌ Reject လုပ်ရာတွင် အမှားအယွင်းရှိပါသည်။`);
    }
    ctx.answerCbQuery("Reject လုပ်ပြီးပါပြီ");
});
// --- Start, Photo, Selection, View, Confirm ---
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
        // matchTimestamp ကို 12-hour format ဖြစ်အောင် ပြောင်းခြင်း
        const matchTime = matchData.matchTimestamp 
            ? matchData.matchTimestamp.toDate().toLocaleString('en-US', { 
                timeZone: 'Asia/Yangon',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true 
            }) 
            : "N/A";
                const [leaderADoc, leaderBDoc] = await Promise.all([
            db.collection("registrations").doc(matchData.teamA_LeaderId).get(),
            db.collection("registrations").doc(matchData.teamB_LeaderId).get()
        ]);
        const dataA = leaderADoc.data() || { players: [], kpayPhone: "မရှိပါ" };
        const dataB = leaderBDoc.data() || { players: [], kpayPhone: "မရှိပါ" };
        const renderPlayers = (players) => players.map(p => `👤 ${p.name}`).join('\n');
        
        const msg = `<b>🔍 MATCH DETAILS</b>\n\n🕒 <b>Time:</b> ${matchTime}\n💰 <b>Fee:</b> ${matchData.fee || 0}\n━━━━━━━━━━━━━━\n<b>🏆 TEAM A: ${matchData.teamA}</b>\n📞 Ph: ${dataA.kpayPhone}\n${renderPlayers(dataA.players)}\n\n<b>🏆 TEAM B: ${matchData.teamB}</b>\n📞 Ph: ${dataB.kpayPhone}\n${renderPlayers(dataB.players)}\n━━━━━━━━━━━━━━\n🎲 <b>First Pick:</b> ${matchData.firstPickWinner || 'N/A'}\n\n💡 *အနိုင်ရရှိသည့် အသင်းက Result Screenshot ကို ပို့ပေးပါ၊ ကျေးဇူးတင်ပါသည်။*`;
        ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (e) { ctx.reply("❌ စနစ်အမှားအယွင်းရှိပါသည်။"); }
});

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
    const docRef = await db.collection("pending_photos").add({ photoId, userId: ctx.from.id, matchId: matchId, timestamp: new Date(), selectedWinner: null });
    
    await bot.telegram.sendPhoto(ADMIN_GROUP_ID, photoId, {
        caption: "📸 *ရလဒ် Screenshot*",
        parse_mode: 'Markdown',
        reply_markup: getAdminKeyboard(docRef.id, null)
    });
    ctx.reply("✅ ပုံတင်ပြပြီးပါပြီ။ Admin စစ်ဆေးနေပါသည်၊ ခဏစောင့်ပေးပါ။");
});

bot.action(/select(A|B)_(.+)/, async (ctx) => {
    const winner = ctx.match[1] === 'A' ? 'teamA' : 'teamB';
    const docId = ctx.match[2];
    await db.collection("pending_photos").doc(docId).update({ selectedWinner: winner });
    await ctx.editMessageReplyMarkup(getAdminKeyboard(docId, winner));
    ctx.answerCbQuery(`${winner === 'teamA' ? 'Team A' : 'Team B'} ကို ရွေးချယ်ပြီးပါပြီ`);
});

bot.action(/view_(.+)/, async (ctx) => {
    const docId = ctx.match[1];
    const message = ctx.callbackQuery.message;
    const isInfoVisible = (message.caption || "").includes("🔍 MATCH DETAILS");

    if (isInfoVisible) {
        // အကယ်၍ အချက်အလက်တွေ ပြထားပြီးသားဆိုရင် Screenshot ပြန်ပြမယ်
        await ctx.editMessageCaption("📸 *ရလဒ် Screenshot*", { 
            parse_mode: 'Markdown', 
            reply_markup: message.reply_markup 
        });
    } else {
        // အချက်အလက် မပြရသေးရင် Database ကနေ Data လှမ်းယူမယ်
        const doc = await db.collection("pending_photos").doc(docId).get();
        if (!doc.exists) return ctx.answerCbQuery("❌ အချက်အလက်မရှိပါ။");
        const data = doc.data();
        
        const matchDoc = await db.collection("matches").doc(data.matchId).get();
        const matchData = matchDoc.data();
        
        // သင် Database မှာတွေ့တဲ့အတိုင်း matchTimestamp ကို သုံးပေးပါ
        const matchTime = matchData.matchTimestamp 
            ? matchData.matchTimestamp.toDate().toLocaleString('en-US', { 
                timeZone: 'Asia/Yangon',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true 
            }) 
            : "N/A";

        const [leaderA, leaderB] = await Promise.all([
            db.collection("registrations").doc(matchData.teamA_LeaderId).get(),
            db.collection("registrations").doc(matchData.teamB_LeaderId).get()
        ]);
        
        const dataA = leaderA.data() || { players: [], kpayPhone: 'မပါရှိပါ' };
        const dataB = leaderB.data() || { players: [], kpayPhone: 'မပါရှိပါ' };
        
        const info = `<b>🔍 MATCH DETAILS</b>\n🕒 <b>Time:</b> ${matchTime}\n💰 <b>Fee:</b> ${matchData.fee || 0}\n━━━━━━━━━━━━━━\n<b>🏆 TEAM A: ${matchData.teamA}</b>\n📞 K-Pay: <code>${dataA.kpayPhone || 'မပါရှိပါ'}</code>\n${(dataA.players || []).map(p => `👤 ${p.name}`).join('\n')}\n\n<b>🏆 TEAM B: ${matchData.teamB}</b>\n📞 K-Pay: <code>${dataB.kpayPhone || 'မပါရှိပါ'}</code>\n${(dataB.players || []).map(p => `👤 ${p.name}`).join('\n')}\n━━━━━━━━━━━━━━\n🎲 <b>First Pick:</b> ${matchData.firstPickWinner || 'N/A'}`;
        
        // ဒီနေရာမှာပဲ edit လုပ်ပါ
        await ctx.editMessageCaption(info, { parse_mode: 'HTML', reply_markup: message.reply_markup });
    }
    ctx.answerCbQuery();
});

// Confirm Action တွင် Error Handling ထပ်မံထည့်သွင်းထားသည်
bot.action(/confirm_(.+)/, async (ctx) => {
    const docId = ctx.match[1];
    const doc = await db.collection("pending_photos").doc(docId).get();
    
    if (!doc.exists) return ctx.answerCbQuery("❌ Data မရှိပါ။");
    const data = doc.data();
    if (!data.selectedWinner) return ctx.answerCbQuery("⚠️ အနိုင်ရသော အသင်းကို အရင် Tick ခြစ်ပေးပါ!");

    try {
        const matchDoc = await db.collection("matches").doc(data.matchId).get();
        const matchData = matchDoc.data();
        const winnerKey = data.selectedWinner;
        const loserKey = winnerKey === 'teamA' ? 'teamB' : 'teamA';

        const batch = db.batch();
        batch.update(db.collection("matches").doc(data.matchId), { matchStatus: "finished", status: "finished", winner: winnerKey });
        batch.update(db.collection("registrations").doc(matchData[`${winnerKey}_LeaderId`]), { matchStatus: "finished", winStatus: "win" });
        batch.update(db.collection("registrations").doc(matchData[`${loserKey}_LeaderId`]), { matchStatus: "finished", winStatus: "lose" });
        batch.set(db.collection("results").doc(), { 
            matchId: data.matchId, 
            teamA: matchData.teamA, 
            teamB: matchData.teamB, 
            winner: winnerKey, 
            fee: matchData.fee || 0, 
            timestamp: admin.firestore.FieldValue.serverTimestamp() 
        });
        
        await batch.commit();

        const sentMessage = await ctx.editMessageCaption("✅ ပွဲစဉ်ရလဒ် အတည်ပြုပြီးပါပြီ။\n💰 ကျေးဇူးပြု၍ ငွေလွှဲပြေစာ (SS) ကို ဤ Message ကို Reply ပြန်ပြီး ပို့ပေးပါ။", { 
            reply_markup: { inline_keyboard: [[{ text: '🔍 View Info', callback_data: `view_${docId}` }]] } 
        });
        
        await db.collection("sessions").doc(docId).set({ 
            waitingForReceipt: true, 
            targetChatId: data.userId, 
            adminMessageId: sentMessage.message_id, 
            matchId: data.matchId 
        });
        
        await ctx.telegram.sendMessage(data.userId, "🎉 ဂုဏ်ယူပါသည်။ အနိုင်ရရှိကြောင်း အတည်ပြုပြီးပါပြီ။ ငွေလွှဲပြေစာ (SS) ပို့ပေးပါ။");
        ctx.answerCbQuery("အောင်မြင်ပါသည်။");
    } catch (err) {
        console.error("Batch Commit Error:", err);
        ctx.answerCbQuery("❌ Error: အတည်ပြု၍ မရပါ။");
    }
});
// --- Refund Confirm ---
bot.action(/confirm_refund_(.+)/, async (ctx) => {
    const docId = ctx.match[1];
    await db.collection("registrations").doc(docId).update({ status: "refunded" });
    await ctx.editMessageText(`✅ Doc ID: <code>${docId}</code> အတွက် Refund အတည်ပြုပြီးပါပြီ။`, { parse_mode: 'HTML' });
    ctx.answerCbQuery("Refund အတည်ပြုပြီးပါပြီ");
});

// --- View Detail (Registration အတွက်ပါ) ---
bot.action(/view_reg_(.+)/, async (ctx) => {
    const docId = ctx.match[1];
    const doc = await db.collection("registrations").doc(docId).get();
    if (!doc.exists) return ctx.answerCbQuery("❌ Data မရှိပါ။");
    
    const d = doc.data();
    const players = d.players ? d.players.map(p => `👤 ${p.name} (ID: ${p.id})`).join('\n') : "N/A";
    
    const info = `<b>📋 REGISTRATION DETAIL</b>\n\n` +
                 `🏆 Squad: ${d.squadName || 'Solo'}\n` +
                 `🎮 Mode: ${d.mode}\n` +
                 `💰 Fee: ${d.fee} Ks\n` +
                 `📞 K-Pay: ${d.kpayPhone}\n` +
                 `👤 Players:\n${players}`;
    
    ctx.reply(info, { parse_mode: 'HTML' });
    ctx.answerCbQuery();
});
// --- Export ---
module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') return res.status(200).end();

    // /api/notify endpoint ကို handle လုပ်ခြင်း
    if (req.url.includes('/api/notify')) {
        try {
            const { regId, isRefund, documentId, data } = req.body;
            
            // ၁။ Refund Request ဆိုလျှင်
            if (isRefund) {
                const doc = await db.collection("registrations").doc(documentId).get();
                if (!doc.exists) return res.status(404).json({ success: false, error: "Reg not found" });
                const d = doc.data();

                const msg = `⚠️ <b>REFUND REQUEST</b>\n\n🆔 <b>Doc ID:</b> <code>${documentId}</code>\n👤 <b>Squad:</b> ${d.squadName || d.playerName || 'Solo'}\n📞 <b>K-Pay:</b> ${d.kpayPhone}\n💰 <b>Amount:</b> ${d.fee} Ks`;
                
                await bot.telegram.sendMessage("-1003928964996", msg, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '✅ Confirm Refund', callback_data: `confirm_refund_${documentId}` },
                            { text: '🔍 View Detail', callback_data: `view_reg_${documentId}` }
                        ]]
                    }
                });
                return res.status(200).json({ success: true, type: 'refund' });
            }

            // ၂။ ပုံမှန် Registration Request ဆိုလျှင်
            if (regId && data) {
                let playersList = data.mode === "5vs5" && data.players 
                    ? data.players.map(p => `👤 ${p.name}`).join('\n') 
                    : `👤 ${data.playerName || 'Solo'}`;
                    
                const msg = `🚨 <b>New Registration Request</b>\n\n🎮 Mode: ${data.mode}\n🏆 Squad: ${data.squadName || 'Solo'}\n📞 K-Pay: ${data.kpayPhone}\n💰 Fee: ${data.fee}\n👥 Players:\n${playersList}`;
                
                await bot.telegram.sendMessage(REG_GROUP_ID, msg, {
                    parse_mode: 'HTML',
                    reply_markup: { 
                        inline_keyboard: [[
                            { text: '✅ Confirm', callback_data: `regConfirm_${regId}` }, 
                            { text: '❌ Reject', callback_data: `regReject_${regId}` }
                        ]] 
                    }
                });
                return res.status(200).json({ success: true, type: 'registration' });
            }

            return res.status(400).json({ success: false, error: "Invalid payload" });
        } catch (err) { 
            console.error("Notify API Error:", err);
            return res.status(500).json({ success: false, error: err.message }); 
        }
    }

    // Bot Updates များကို Handle လုပ်ခြင်း
    try { 
        await bot.handleUpdate(req.body); 
        return res.status(200).send('OK'); 
    } catch (err) { 
        console.error("Bot Handle Error:", err);
        return res.status(500).send('Error'); 
    }
};