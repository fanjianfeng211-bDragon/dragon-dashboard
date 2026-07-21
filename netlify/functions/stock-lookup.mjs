export default async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (!code) return new Response(JSON.stringify({ error: 'Missing code' }), { status: 400 });

  try {
    const prefix = code.startsWith('6') ? 'sh' : 'sz';
    const resp = await fetch(`https://hq.sinajs.cn/list=${prefix}${code}`, {
      headers: { Referer: 'https://finance.sina.com.cn' },
      signal: AbortSignal.timeout(5000)
    });
    const text = await resp.text();
    return new Response(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const config = { path: '/api/stock-lookup' };
