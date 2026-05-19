const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// LINE Webhook endpoint
exports.lineWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const events = req.body.events || [];

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text;
      const userId = event.source.userId;

      // บันทึกข้อความลง Firestore
      await db.collection('line_messages').add({
        userId,
        text,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  return res.status(200).json({ status: 'ok' });
});
