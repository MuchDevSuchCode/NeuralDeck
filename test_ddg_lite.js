const { fetch } = require('undici');

async function main() {
    const query = 'RTX 5090 release date';
    const url = 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(query);
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html',
            'Accept-Language': 'en-US,en;q=0.9',
        },
    });
    const html = await res.text();

    const results = [];
    const linkRegex = /<a[^>]+class='result-link'[^>]*>([\s\S]*?)<\/a>/gi;
    const hrefRegex = /href="([^"]*)"/i;
    const snippetRegex = /<td[^>]+class='result-snippet'[^>]*>([\s\S]*?)<\/td>/gi;

    const links = [];
    let m;
    while ((m = linkRegex.exec(html)) !== null) {
        const hrefMatch = m[0].match(hrefRegex);
        const title = m[1].replace(/<[^>]+>/g, '').trim();
        let link = '';
        if (hrefMatch) {
            const rawHref = hrefMatch[1];
            const uddgMatch = rawHref.match(/[?&]uddg=([^&]+)/);
            if (uddgMatch) {
                link = decodeURIComponent(uddgMatch[1]);
            } else if (rawHref.startsWith('//')) {
                link = 'https:' + rawHref;
            } else {
                link = rawHref;
            }
        }
        links.push({ title, link });
    }

    const snippets = [];
    while ((m = snippetRegex.exec(html)) !== null) {
        snippets.push(m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim());
    }

    for (let i = 0; i < Math.min(links.length, 5); i++) {
        results.push({
            title: links[i].title,
            link: links[i].link,
            snippet: snippets[i] || '',
        });
    }
    console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
