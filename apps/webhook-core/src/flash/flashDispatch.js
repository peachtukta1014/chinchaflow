// GitHub repository_dispatch → Pro Agent (GitHub Actions)
// Flash CF ไม่รัน Pro เอง — isolation จริง: OPENROUTER_API_KEY_PRO ไม่แตะ Flash เลย
const GH_API  = 'https://api.github.com';
const GH_REPO = 'peachtukta1014/chinchaflow';
const PAYLOAD_LIMIT = 9800; // GitHub client_payload limit ~10KB — เผื่อ margin 200 bytes

async function _doDispatch(ghPat, body) {
  const r = await fetch(`${GH_API}/repos/${GH_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `token ${ghPat}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'CF-AI',
    },
    body,
  });
  return r;
}

async function dispatchToProAgent(ghPat, payload) {
  const body = JSON.stringify({ event_type: 'ai-code-action', client_payload: payload });

  // Item #2: ตรวจ size ก่อน dispatch — ป้องกัน GitHub ปฏิเสธ payload เงียบๆ
  if (body.length > PAYLOAD_LIMIT) {
    throw new Error(
      `Payload เกิน limit: ${body.length} bytes (max ${PAYLOAD_LIMIT}) — ย่อ Task Brief ก่อน dispatch`
    );
  }

  // Item #4: retry 1 ครั้งเมื่อ dispatch ล้มเหลว (non-204)
  let r = await _doDispatch(ghPat, body);
  if (!r.ok) {
    await new Promise(res => setTimeout(res, 2000));
    r = await _doDispatch(ghPat, body);
  }
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`GitHub dispatch failed: ${r.status} ${txt.slice(0, 200)}`);
  }
}

module.exports = { dispatchToProAgent };
