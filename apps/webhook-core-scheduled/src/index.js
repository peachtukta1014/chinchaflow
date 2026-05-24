const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { todayBKK, dispatchTeaSummary, getTeaLineConfig } = require('./teaDailySummary');

admin.initializeApp();
const dbTea = getFirestore();

exports.teaDailyScheduledSummary = functions
  .region('asia-southeast1')
  .pubsub.schedule('0 22 * * *')
  .timeZone('Asia/Bangkok')
  .onRun(async () => {
    const config = await getTeaLineConfig(dbTea);
    if (config.autoSummaryEnabled === false) return null;

    const hourNow = parseInt(
      new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Bangkok' }),
      10,
    );
    const targetHour = typeof config.autoSummaryHour === 'number' ? config.autoSummaryHour : 22;
    if (hourNow !== targetHour) return null;

    const token = process.env.LINE_TEA_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      console.warn('LINE_TEA_CHANNEL_ACCESS_TOKEN not set');
      return null;
    }

    const dateKey = todayBKK();
    const { targetCount } = await dispatchTeaSummary(dbTea, dateKey, token);
    if (targetCount === 0) {
      console.warn('teaDailyScheduledSummary: no notifyGroupId / notifyUserIds in config/teaLine');
    }
    return null;
  });
