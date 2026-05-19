const axios = require('axios');

// ส่ง LINE Notify
async function sendLineNotify(message, token) {
  await axios.post(
    'https://notify-api.line.me/api/notify',
    new URLSearchParams({ message }),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );
}

module.exports = { sendLineNotify };
