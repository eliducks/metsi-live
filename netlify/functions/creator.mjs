// Netlify Function: GET /api/creator
// Reads published rows from your Notion database. The secret token stays here, on the server.
// Env vars to set in Netlify (scope must include Functions): NOTION_TOKEN, NOTION_DB_ID

const NOTION = 'https://api.notion.com/v1';
const QUERY = JSON.stringify({
  filter: { property: 'Published', checkbox: { equals: true } },
  sorts: [{ property: 'Date', direction: 'descending' }],
  page_size: 6,
});

async function call(url, version, method, body) {
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${Netlify.env.get('NOTION_TOKEN')}`,
      'Notion-Version': version,
      'Content-Type': 'application/json',
    },
    body,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.message || `notion ${r.status}`), { status: r.status, code: j.code });
  return j;
}

// Tries the classic way first, then Notion's newer "data source" way
async function query(id) {
  try {
    return await call(`${NOTION}/databases/${id}/query`, '2022-06-28', 'POST', QUERY);
  } catch (first) {
    try {
      const db = await call(`${NOTION}/databases/${id}`, '2025-09-03', 'GET');
      const ds = db.data_sources?.[0]?.id;
      if (!ds) throw first;
      return await call(`${NOTION}/data_sources/${ds}/query`, '2025-09-03', 'POST', QUERY);
    } catch (e) {
      throw first;
    }
  }
}

export default async () => {
  try {
    const data = await query(Netlify.env.get('NOTION_DB_ID'));
    const text = (arr) => (arr || []).map((t) => t.plain_text).join('');
    const posts = data.results.map((p) => ({
      title: text(p.properties.Title?.title),
      date: p.properties.Date?.date?.start || null,
      message: text(p.properties.Message?.rich_text),
    }));
    return new Response(JSON.stringify({ posts }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Cache for 5 minutes so visitors never hit Notion's rate limit
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (e) {
    // "debug" shows why it failed (never includes your key). Safe to leave in.
    return new Response(
      JSON.stringify({ posts: [], debug: { status: e.status || null, code: e.code || null, message: e.message } }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  }
};

export const config = { path: '/api/creator' };
