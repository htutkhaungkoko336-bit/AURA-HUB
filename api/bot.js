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

        const leaderADoc = await db.collection("registrations").doc(matchData.teamA_LeaderId).get();
        const leaderBDoc = await db.collection("registrations").doc(matchData.teamB_LeaderId).get();

        const leaderA = leaderADoc.exists ? leaderADoc.data() : { players: [] };
        const leaderB = leaderBDoc.exists ? leaderBDoc.data() : { players: [] };

        // Leader (ပထမဆုံးလူ) ရဲ့ အချက်အလက်
        const pA_Leader = leaderA.players && leaderA.players[0] ? leaderA.players[0] : { name: "N/A", id: "N/A" };
        const pB_Leader = leaderB.players && leaderB.players[0] ? leaderB.players[0] : { name: "N/A", id: "N/A" };

        // Leader ကို ချန်ပြီး ကျန်တဲ့ Player တွေကိုပဲ ပြမယ့် function
        const renderPlayers = (players) => {
            if (players.length <= 1) return "<i>(နောက်ထပ် Players မရှိပါ)</i>";
            return players.slice(1).map(p => `👤 ${p.name}`).join('\n');
        };

        const customMessage = `
<b>✅ MATCH INFORMATION</b>

━━━━━━━━━━━━━━
<b>🏆 TEAM A: ${matchData.teamA}</b>
👤 Leader: ${pA_Leader.name} (ID: ${pA_Leader.id})
📞 K-Pay Ph: ${leaderA.kpayPhone || "N/A"}

<b>👥 Players:</b>
${renderPlayers(leaderA.players || [])}
━━━━━━━━━━━━━━

              <b>🔥 V S 🔥</b>

━━━━━━━━━━━━━━
<b>🏆 TEAM B: ${matchData.teamB}</b>
👤 Leader: ${pB_Leader.name} (ID: ${pB_Leader.id})
📞 K-Pay Ph: ${leaderB.kpayPhone || "N/A"}

<b>👥 Players:</b>
${renderPlayers(leaderB.players || [])}
━━━━━━━━━━━━━━

🎲 First Pick Team: ${matchData.firstPickWinner}

---
👉 <i>ပွဲစဆော့ပြီးလျှင် အနိုင်ရသော SS ကို တင်ပေးပါ။</i>
`;

        ctx.reply(customMessage, { parse_mode: 'HTML' });
    } catch (e) {
        console.error("Error fetching data:", e);
        ctx.reply("❌ စနစ်အမှားအယွင်းရှိပါသည်။");
    }
});
// 2. Photo Handling (Firebase Session ကို သုံးထားသည်)
bot.on('photo', async (ctx) => {
    const sessionDoc = await db.collection("sessions").doc(ctx.from.id.toString()).get();
    const session = sessionDoc.exists ? sessionDoc.data() : { waitingForReceipt: false };

    if (isAdmin(ctx.from.id) && session.waitingForReceipt) {
        const photoId = ctx.message.photo.pop().file_id;
        
        // အခု session.targetChatId က User ID ဖြစ်နေပြီမို့ User ဆီရောက်မယ်
        await ctx.telegram.sendPhoto(session.targetChatId, photoId, {
            caption: "💰 ငွေလွှဲပြေစာ ရောက်ရှိပါပြီ။\n\n🏆 ပွဲစဉ်ပြီးဆုံးသွားပါပြီ။ AURA HUB အား အားပေးမှုအတွက် ကျေးဇူးတင်ပါသည်။"
        });
        
        await db.collection("sessions").doc(ctx.from.id.toString()).delete();
        return;
    }

    if (isAdmin(ctx.from.id)) return;
    
    // User က ပုံပို့ရင် userId ကို အမြဲသိမ်းထားမယ်
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
});// 3. Admin Actions (Confirm/Reject)
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

    // ၁။ User ဆီကို Reject ဖြစ်ကြောင်းနဲ့ Screenshot ပြန်တင်ဖို့ စာပို့မယ်
    try {
        // Markdown အစား HTML ကိုသုံးပြီး <b> နဲ့ <i> tags တွေကို သုံးပါ
        await ctx.telegram.sendMessage(userId, "❌ <b>ဝမ်းနည်းပါသည်။</b> သင်တင်လိုက်သော Screenshot မှာ စစ်ဆေးမှု မအောင်မြင်ပါ။ ကျေးဇူးပြု၍ ပွဲစဉ်ရလဒ် အမှန် (SS) ကို ပြန်လည်တင်ပြပေးပါ။", { parse_mode: 'HTML' });
    } catch (e) {
        console.error("Failed to send rejection msg to user:", e);
        // Error တက်ရင်လည်း သိရအောင် console မှာကြည့်ပါ
    }

    // ၂။ Admin ရဲ့ Message ကို ပြင်ပေးမယ်
    await ctx.answerCbQuery("ပယ်ချပြီးပါပြီ");
    await ctx.editMessageCaption("❌ ဤရလဒ်မှာ မမှန်ကန်ပါ။ (User ထံသို့ ပြန်လည်တင်ပြရန် အကြောင်းကြားပြီးပါပြီ)");
});
module.exports = async (req, res) => {
    try { await bot.handleUpdate(req.body); res.status(200).send('OK'); }
    catch (err) { console.error(err); res.status(500).send('Internal Server Error'); }
}; 