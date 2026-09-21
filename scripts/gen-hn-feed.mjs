// Generates output/hn-top.xml — an RSS 2.0 feed of the current Hacker News top 10 stories.
// Runs as a GitHub Actions step before `yarn build` so generateList() picks it up
// for the index page. No dependencies, no auth: uses the public HN Firebase API.
import fs from 'node:fs'

const TOP_N = 10
const HN_API = 'https://hacker-news.firebaseio.com/v0'
const OUT = 'output/hn-top.xml'

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function get(path) {
  const res = await fetch(HN_API + path)
  if (!res.ok) throw new Error(`HN API ${res.status} on ${path}`)
  return res.json()
}

async function main() {
  const ids = await get('/topstories.json')
  const stories = []
  for (const id of ids.slice(0, TOP_N)) {
    try {
      const item = await get(`/item/${id}.json`)
      if (!item || item.deleted || item.dead) continue
      stories.push(item)
    } catch (err) {
      console.error(`skipping ${id}: ${err.message}`)
    }
  }

  const itemsXml = stories
    .map((s) => {
      const link = s.url || `https://news.ycombinator.com/item?id=${s.id}`
      const hnLink = `https://news.ycombinator.com/item?id=${s.id}`
      const pubDate = new Date((s.time || 0) * 1000).toUTCString()
      const desc =
        `${escapeXml(s.title)}\n\n` +
        `by ${escapeXml(s.by || 'unknown')} — score ${s.score ?? 0}, ` +
        `${s.descendants ?? 0} comments. ` +
        `Discussion: ${hnLink}` +
        (s.url ? `\nLink: ${s.url}` : '')
      return (
        `    <item>\n` +
        `      <title>${escapeXml(s.title)}</title>\n` +
        `      <link>${escapeXml(link)}</link>\n` +
        `      <guid isPermaLink="false">hn-${s.id}</guid>\n` +
        `      <description>${escapeXml(desc)}</description>\n` +
        `      <pubDate>${pubDate}</pubDate>\n` +
        `      <source url="https://news.ycombinator.com">Hacker News</source>\n` +
        `    </item>`
      )
    })
    .join('\n')

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0">\n` +
    `  <channel>\n` +
    `    <title>hn-top</title>\n` +
    `    <description>Hacker News top 10 stories (hourly snapshot)</description>\n` +
    `    <link>https://news.ycombinator.com</link>\n` +
    `    <generator>flint-digest/hn-feed</generator>\n` +
    `    <language>en</language>\n` +
    itemsXml +
    `\n  </channel>\n` +
    `</rss>\n`

  fs.mkdirSync('output', { recursive: true })
  fs.writeFileSync(OUT, xml)
  console.log(`Generated ${OUT} with ${stories.length} stories`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
