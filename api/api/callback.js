export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { callback_query } = req.body;
    if (!callback_query) return res.status(200).send('OK');

    const data = callback_query.data; 
    
    // အရေးကြီး: ပထမဆုံး _ ကိုပဲ ခွဲမယ်၊ ကျန်တာကို ID အဖြစ် ယူမယ်
    const firstIndex = data.indexOf('_');
    const action = data.substring(0, firstIndex);
    const regId = data.substring(firstIndex + 1).trim(); // .trim() ထည့်ပေးလိုက်ပါ
    
    const chatId = callback_query.message.chat.id;
    const messageId = callback_query.message.message_id;

    // Firebase Document ကို စစ်ဆေးခြင်း
    const docRef = db.collection('registrations').doc(regId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.error("Firebase Document Not Found for ID:", regId);
      return res.status(404).json({ error: "Data not found" });
    }

    // Firebase ထဲမှာ Status Update လုပ်ခြင်း
    const status = action === 'confirm' ? 'approved' : 'rejected';
    await docRef.update({ status: status });

    // Telegram မှာ Edit လုပ်ခြင်း
    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
      chat_id: chatId,
      message_id: messageId,
      text: callback_query.message.text + `\n\n✅ *Status: ${status.toUpperCase()}*`,
      parse_mode: 'Markdown'
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Callback Error:", error);
    return res.status(500).json({ error: error.message });
  }
}