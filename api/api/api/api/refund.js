// api/refund.js
const admin = require('firebase-admin');

// Firebase initialization ကို စစ်ဆေးပါ
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

export default async function handler(req, res) {
    // POST method မဟုတ်ရင် ပိတ်ပါ
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { regId } = req.body;
        if (!regId) return res.status(400).json({ message: 'Missing regId' });

        // Firestore ထဲက status ကို ပြင်ပါ
        await db.collection("registrations").doc(regId).update({ status: "refund" });
        
        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}