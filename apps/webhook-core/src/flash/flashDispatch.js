// GitHub repository_dispatch → Pro Agent (GitHub Actions)
// Flash CF ไม่รัน Pro เอง — isolation จริง: OPENROUTER_API_KEY_PRO ไม่แตะ Flash เลย
const GH_API  = 'https://api.github.com';
const GH_REPO = 'peachtukta1014/chinchaflow';

async function dispatchToProAgent(ghPat, payload) {
  const r = await fetch(`${GH_API}/repos/${GH_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `token ${ghPat}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'CF-AI',
    },
    body: JSON.stringify({
      event_type: 'ai-code-action',
      client_payload: payload,
    }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`GitHub dispatch failed: ${r.status} ${txt.slice(0, 200)}`);
  }
}

module.exports = { dispatchToProAgent };
