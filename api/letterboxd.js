export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  try {
    const rssRes = await fetch('https://letterboxd.com/StudioHibari/rss/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; portfolio-bot/1.0)' },
    });

    if (!rssRes.ok) throw new Error(`RSS fetch failed: ${rssRes.status}`);

    const xml = await rssRes.text();

    // Extract <item> blocks
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const films = [];
    let match;

    while ((match = itemRegex.exec(xml)) !== null && films.length < 4) {
      const block = match[1];

      // Skip diary entries that aren't film watches
      if (!/<letterboxd:filmTitle/i.test(block) && !/<title>/i.test(block)) continue;

      // Title — prefer <letterboxd:filmTitle>, fallback to parsing <title>
      let title = '';
      const filmTitleMatch = block.match(/<letterboxd:filmTitle><!\[CDATA\[([^\]]+)\]\]><\/letterboxd:filmTitle>/)
                          || block.match(/<letterboxd:filmTitle>([^<]+)<\/letterboxd:filmTitle>/);
      if (filmTitleMatch) {
        title = filmTitleMatch[1].trim();
      } else {
        const rawTitle = (block.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/) ||
                          block.match(/<title>([^<]+)<\/title>/))?.[1] ?? '';
        // Strip rating suffix "Film Name, YEAR - ★★½"
        title = rawTitle.replace(/,\s*\d{4}.*$/, '').trim();
      }

      // Year
      const yearMatch = block.match(/<letterboxd:filmYear>(\d{4})<\/letterboxd:filmYear>/)
                     || block.match(/<title>[^,]+,\s*(\d{4})/);
      const year = yearMatch ? yearMatch[1] : '';

      // Rating (numeric → stars)
      const ratingMatch = block.match(/<letterboxd:memberRating>([\d.]+)<\/letterboxd:memberRating>/);
      let rating = '';
      if (ratingMatch) {
        const n    = parseFloat(ratingMatch[1]);
        const full = Math.floor(n);
        const half = (n % 1) >= 0.5;
        rating = '★'.repeat(full) + (half ? '½' : '');
      }

      // Poster — img src inside <description> CDATA
      const descMatch = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)
                     || block.match(/<description>([\s\S]*?)<\/description>/);
      const desc    = descMatch ? descMatch[1] : '';
      const imgMatch = desc.match(/<img[^>]+src="([^"]+)"/);
      const poster   = imgMatch ? imgMatch[1] : '';

      // URL
      const urlMatch = block.match(/<link><!\[CDATA\[([^\]]+)\]\]><\/link>/)
                    || block.match(/<link>([^<]+)<\/link>/);
      const url = urlMatch ? urlMatch[1].trim() : '';

      if (title) films.push({ title, year, rating, poster, url });
    }

    res.status(200).json({ films });
  } catch (err) {
    res.status(500).json({ error: err.message, films: [] });
  }
}
