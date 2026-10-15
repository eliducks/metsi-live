// Netlify Function: GET /api/creator
// Reads published rows from your Notion database. The secret token stays here, on the server.
// Env vars to set in Netlify: NOTION_TOKEN, NOTION_DB_ID (scope must include Functions)

export default async () => {
  const headers = {
    'Content-Type': 'application/json',
    // Cache for 5 minutes so visitors never hit Notion's rate limit
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Netlify-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
  };
  try {
    const r = await fetch(`https://api.notion.com/v1/databases/${Netlify.env.get('NOTION_DB_ID')}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Netlify.env.get('NOTION_TOKEN')}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { property: 'Published', checkbox: { equals: true } },
        sorts: [{ property: 'Date', direction: 'descending' }],
        page_size: 6,
      }),
    });
    if (!r.ok) throw new Error(`notion ${r.status}`);
    const data = await r.json();
    const text = (arr) => (arr || []).map((t) => t.plain_text).join('');
    const posts = data.results.map((p) => ({
      title: text(p.properties.Title?.title),
      date: p.properties.Date?.date?.start || null,
      message: text(p.properties.Message?.rich_text),
    }));
    return new Response(JSON.stringify({ posts }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ posts: [] }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
};

// Makes the function available at /api/creator, so index.html works unchanged
export const config = { path: '/api/creator' };
