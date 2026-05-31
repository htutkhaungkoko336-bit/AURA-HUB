const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Admin ID အများကြီးအစား Group ID တစ်ခုတည်းကိုပဲသုံးပါ
const ADMIN_GROUP_ID = process.env.ADMIN_GROUP_ID; 

// Admin ဖြစ်မဖြစ် စစ်ဆေးခြင်း (Group ထဲက Message ဖြစ်ရင်လည်း ရအောင်)
function isAdmin(userId) {
    // အကယ်၍ Bot ကို Group Admin ပေးထားရင် ctx.from.id က Admin ဖြစ်မဖြစ် စစ်ပါ
    // ဒါပေမဲ့ လွယ်အောင် Group ထဲက Message မှန်သမျှကို Admin လုပ်ဆောင်ချက်လို့ သတ်မှတ်လို့ရပါတယ်
    return true; // လိုအပ်ရင် ဒီနေရာမှာ Admin User IDs တွေကို ပြန်ထည့်လို့ရပါတယ်
}


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

        // အရေးကြီး: Leader ID အဖြစ် players[0].id ကို ယူခြင်း
        const leaderAId = dataA.players && dataA.players[0] ? dataA.players[0].id : "မရှိပါ";
        const leaderBId = dataB.players && dataB.players[0] ? dataB.players[0].id : "မရှိပါ";

        const renderPlayers = (players) => players.map(p => `👤 ${p.name}`).join('\n');

        const footer = `━━━━━━━━━━━━━━
📢 <b>AURA HUB Official</b>
💬 မေးမြန်းလိုသည်များရှိပါက Admin ထံ ဆက်သွယ်ပါ။
⚡️ စည်းကမ်းချက်များကို လိုက်နာပေးကြပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။`;

        const msg = `<b>🔍 MATCH DETAILS</b>

💰 <b>Fee:</b> ${matchData.fee || 0}
━━━━━━━━━━━━━━
<b>🏆 TEAM A: ${matchData.teamA}</b>
👤 Leader: ${dataA.players[0].name} (ID: <code>${leaderAId}</code>)
📞 Ph: ${dataA.kpayPhone}
${renderPlayers(dataA.players)}

<b>🏆 TEAM B: ${matchData.teamB}</b>
👤 Leader: ${dataB.players[0].name} (ID: <code>${leaderBId}</code>)
📞 Ph: ${dataB.kpayPhone}
${renderPlayers(dataB.players)}
━━━━━━━━━━━━━━
🎲 <b>First Pick:</b> ${matchData.firstPickWinner}

${footer}`;

        ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (e) { 
        console.error(e);
        ctx.reply("❌ စနစ်အမှားအယွင်းရှိပါသည်။"); 
    }
});
bot.on('photo', async (ctx) => {
    // Admin Group ထဲမှာ Bot က ပြေစာပို့တဲ့ အပိုင်း
    if (ctx.chat.id.toString() === ADMIN_GROUP_ID) {
        const sessionDoc = await db.collection("sessions").doc(ctx.from.id.toString()).get();
        if (sessionDoc.exists && sessionDoc.data().waitingForReceipt) {
            const photoId = ctx.message.photo.pop().file_id;
            await ctx.telegram.sendPhoto(sessionDoc.data().targetChatId, photoId, {
                caption: "💰 ငွေလွှဲပြေစာ ရောက်ရှိပါပြီ။\n\n🏆 ပွဲစဉ်ပြီးဆုံးသွားပါပြီ။ AURA HUB အား အားပေးမှုအတွက် ကျေးဇူးတင်ပါသည်။"
            });
            await db.collection("sessions").doc(ctx.from.id.toString()).delete();
            return;
        }
        return;
    }

    // User photo logic (Admin Group တစ်ခုတည်းကိုပဲ ပို့မယ်)
    const sessionDoc = await db.collection("sessions").doc(ctx.from.id.toString()).get();
    const session = sessionDoc.exists ? sessionDoc.data() : {};
    const matchId = session.currentMatchId;
    if (!matchId) return ctx.reply("❌ ပွဲစဉ် ID မတွေ့ရှိပါ။");

    const photoId = ctx.message.photo.pop().file_id;
    const docRef = await db.collection("pending_photos").add({ 
        photoId, userId: ctx.from.id, matchId: matchId, timestamp: new Date() 
    });
    
    // Admin Group တစ်ခုတည်းကိုပဲ ပို့ခြင်း (Loop မလိုတော့ပါ)
    await bot.telegram.sendPhoto(ADMIN_GROUP_ID, photoId, {
        caption: "📸 *ရလဒ် Screenshot*",
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔍 View Match Info', callback_data: `view_${docRef.id}` }],
                [{ text: '✅ Confirm', callback_data: `confirm_${docRef.id}` }, { text: '❌ Reject', callback_data: `reject_${docRef.id}` }]
            ]
        }
    });
    ctx.reply("✅ ပုံတင်ပြပြီးပါပြီ။ Admin စစ်ဆေးနေပါသည်၊ ခဏစောင့်ပေးပါ။");
});
// 3. View Match Info (Toggle Logic with Full Data - FIXED)
bot.action(/view_(.+)/, async (ctx) => {
    const docId = ctx.match[1];
    const message = ctx.callbackQuery.message;
    
    // Photo Message များအတွက် caption ကို စစ်ဆေးပါ
    const caption = message.caption || "";
    const isInfoVisible = caption.includes("🔍 MATCH DETAILS");

    if (isInfoVisible) {
        // အချက်အလက်တွေ ပေါ်နေရင် ဖျောက်မယ် (ခလုတ်ပဲ ချန်ထားမယ်)
        await ctx.editMessageCaption("📸 *ရလဒ် Screenshot*", {
            parse_mode: 'Markdown',
            reply_markup: message.reply_markup
        });
    } else {
        // အချက်အလက်တွေ ပေါ်လာအောင် လုပ်မယ်
        const doc = await db.collection("pending_photos").doc(docId).get();
        if (!doc.exists) return ctx.answerCbQuery("❌ အချက်အလက်မရှိပါ။");
        
        const { matchId } = doc.data();
        const matchDoc = await db.collection("matches").doc(matchId).get();
        if (!matchDoc.exists) return ctx.answerCbQuery("❌ ပွဲစဉ်အချက်အလက် ရှာမတွေ့ပါ။");
        
        const matchData = matchDoc.data();
        
        let displayTime = "မသတ်မှတ်ရသေးပါ";
        if (matchData.matchTimestamp && typeof matchData.matchTimestamp.toDate === 'function') {
            displayTime = matchData.matchTimestamp.toDate().toLocaleString('my-MM', {
                timeZone: 'Asia/Yangon',
                hour12: false
            });
        }

        const [leaderA, leaderB] = await Promise.all([
            db.collection("registrations").doc(matchData.teamA_LeaderId).get(),
            db.collection("registrations").doc(matchData.teamB_LeaderId).get()
        ]);

        const dataA = leaderA.data();
        const dataB = leaderB.data();
        
        const leaderAId = dataA.players && dataA.players[0] ? dataA.players[0].id : "မရှိပါ";
        const leaderBId = dataB.players && dataB.players[0] ? dataB.players[0].id : "မရှိပါ";

        const kpayA = dataA.kpayPhone || "မပါရှိပါ";
        const kpayB = dataB.kpayPhone || "မပါရှိပါ";

        // သင်လိုချင်တဲ့ Data အပြည့်အစုံ (အထက်ပါအတိုင်းအတိအကျ)
        const info = `<b>🔍 MATCH DETAILS</b>
🕒 Time: ${displayTime}
💰 Fee: ${matchData.fee || 0}
━━━━━━━━━━━━━━
<b>🏆 TEAM A: ${matchData.teamA}</b>
👤 Leader: ${dataA.players[0].name} (ID: <code>${leaderAId}</code>)
📞 K-Pay: <code>${kpayA}</code>
${dataA.players.map(p => `👤 ${p.name}`).join('\n')}

<b>🏆 TEAM B: ${matchData.teamB}</b>
👤 Leader: ${dataB.players[0].name} (ID: <code>${leaderBId}</code>)
📞 K-Pay: <code>${kpayB}</code>
${dataB.players.map(p => `👤 ${p.name}`).join('\n')}
━━━━━━━━━━━━━━
🎲 First Pick: ${matchData.firstPickWinner}`;
        
        // Photo Message ဖြစ်တဲ့အတွက် editMessageCaption ကိုသုံးပေးရပါမယ်
        await ctx.editMessageCaption(info, {
            parse_mode: 'HTML',
            reply_markup: message.reply_markup
        });
    }
    ctx.answerCbQuery();
});

// 4. Admin Actions (Confirm/Reject)
bot.action(/confirm_(.+)/, async (ctx) => {
    const docId = ctx.match[1];
    const doc = await db.collection("pending_photos").doc(docId).get();
    if (!doc.exists) return ctx.answerCbQuery("❌ အချက်အလက် ရှာမတွေ့ပါ။");
    
    const userId = doc.data().userId;
    await ctx.answerCbQuery("ပြေစာပို့ရန် စောင့်ဆိုင်းနေပါသည်...");
    
    // ခလုတ်အသစ်ပြန်ဆောက်: View Match Info ကိုပဲ ချန်ထားမယ်
    const newKeyboard = {
        inline_keyboard: [
            [{ text: '🔍 View Match Info', callback_data: `view_${docId}` }]
        ]
    };

    await ctx.editMessageCaption("✅ အတည်ပြုသည်။ ကျေးဇူးပြု၍ ငွေလွှဲပြေစာ (SS) ကို ပို့ပေးပါ။", { 
        reply_markup: newKeyboard 
    });
    
    await db.collection("sessions").doc(ctx.from.id.toString()).set({ waitingForReceipt: true, targetChatId: userId });
});

bot.action(/reject_(.+)/, async (ctx) => {
    const docId = ctx.match[1];
    const doc = await db.collection("pending_photos").doc(docId).get();
    if (!doc.exists) return ctx.answerCbQuery("❌ အချက်အလက် ရှာမတွေ့ပါ။");
    
    const userId = doc.data().userId;
    try {
        await ctx.telegram.sendMessage(userId, "❌ *ဝမ်းနည်းပါသည်။* သင်တင်လိုက်သော Screenshot မှာ စစ်ဆေးမှု မအောင်မြင်ပါ။ ကျေးဇူးပြု၍ ပွဲစဉ်ရလဒ် အမှန် (SS) ကို Bot ထဲသို့ ပြန်လည်တင်ပြပေးပါ။", { parse_mode: 'Markdown' });
    } catch (e) { console.error(e); }
    
    await ctx.answerCbQuery("ပယ်ချပြီးပါပြီ");
    // Reject လုပ်လိုက်ရင် ခလုတ်အကုန်ဖျောက်လိုက်မယ်
    await ctx.editMessageCaption("❌ ဤရလဒ်မှာ မမှန်ကန်ပါ။ (User ထံသို့ ပုံအသစ်တင်ရန် အကြောင်းကြားပြီးပါပြီ)", {
        reply_markup: { inline_keyboard: [] }
    });
});

module.exports = async (req, res) => {
    try { await bot.handleUpdate(req.body); res.status(200).send('OK'); }
    catch (err) { console.error(err); res.status(500).send('Internal Server Error'); }
};