export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is not configured on the deployment.' });
  try {
    const body = req.body || {};
    const action = body.action || 'create';
    const base = 'https://api.openai.com/v1/videos';
    const headers = { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` };
    if (action === 'status') {
      const r = await fetch(`${base}/${encodeURIComponent(body.id)}`, { headers });
      return res.status(r.status).json(await r.json());
    }
    if (action === 'download') {
      const r = await fetch(`${base}/${encodeURIComponent(body.id)}/content`, { headers });
      if (!r.ok) return res.status(r.status).json(await r.json().catch(() => ({ error: 'Download failed' })));
      const type = r.headers.get('content-type') || 'video/mp4';
      res.setHeader('Content-Type', type);
      res.setHeader('Content-Disposition', 'attachment; filename="cadence-ai-video.mp4"');
      return res.status(200).send(Buffer.from(await r.arrayBuffer()));
    }
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return res.status(400).json({ error: 'A video prompt is required.' });
    const payload = {
      model: body.model === 'sora-2-pro' ? 'sora-2-pro' : 'sora-2',
      prompt,
      seconds: ['4','8','12'].includes(String(body.seconds)) ? String(body.seconds) : '8',
      size: ['720x1280','1280x720','1024x1792','1792x1024'].includes(body.size) ? body.size : '1280x720'
    };
    const r = await fetch(base, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return res.status(r.status).json(await r.json());
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Video generation request failed.' });
  }
}
