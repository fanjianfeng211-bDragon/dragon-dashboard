// Netlify Function: stock-api
// Proxies Sina Finance API (HTTP) → returns JSON (HTTPS)
// Cache: 5s in-memory (same as client poll interval)
//
// Usage: GET /.netlify/functions/stock-api?codes=sh600961,sz000636,sh000001

const SINA_URL = 'http://hq.sinajs.cn/list=';

// Simple in-memory cache
let cache = { data: null, ts: 0 };
const CACHE_MS = 5000;

export default async function handler(req) {
  const url = new URL(req.url);
  const codesParam = url.searchParams.get('codes') || '';

  if (!codesParam) {
    return new Response(JSON.stringify({ error: 'Missing ?codes= param' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check cache
  const now = Date.now();
  const cacheKey = codesParam;
  if (cache.data && cache.key === cacheKey && (now - cache.ts) < CACHE_MS) {
    return new Response(JSON.stringify(cache.data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const resp = await fetch(SINA_URL + codesParam, {
      headers: { 'Referer': 'https://finance.sina.com.cn' },
      signal: AbortSignal.timeout(8000)
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `Upstream error: ${resp.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Sina returns GBK encoded text
    const buffer = await resp.arrayBuffer();
    const decoder = new TextDecoder('gbk');
    const text = decoder.decode(buffer);

    // Parse var hq_str_xxx="..."; lines
    const results = [];
    const regex = /var\s+hq_str_(\w+)="([^"]*)"/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const code = match[1];
      const fields = match[2].split(',');

      if (fields.length < 32) continue;

      const name = fields[0];
      const open = parseFloat(fields[1]) || 0;
      const prevClose = parseFloat(fields[2]) || 0;
      const price = parseFloat(fields[3]) || prevClose;
      const high = parseFloat(fields[4]) || 0;
      const low = parseFloat(fields[5]) || 0;
      const volume = parseFloat(fields[8]) || 0;
      const amount = parseFloat(fields[9]) || 0;
      const date = fields[30] || '';
      const time = fields[31] || '';

      const change = price - prevClose;
      const changePct = prevClose > 0 ? (change / prevClose * 100) : 0;

      results.push({
        code,
        name,
        open,
        prevClose,
        price,
        high,
        low,
        volume,
        amount,
        change: Math.round(change * 100) / 100,
        changePct: Math.round(changePct * 100) / 100,
        time: date + ' ' + time
      });
    }

    const output = {
      ts: now,
      count: results.length,
      data: results
    };

    // Update cache
    cache = { key: cacheKey, data: output, ts: now };

    return new Response(JSON.stringify(output), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=5'
      }
    });

  } catch (err) {
    console.error('stock-api error:', err);
    return new Response(JSON.stringify({ error: 'Fetch failed: ' + err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
