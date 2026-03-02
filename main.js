const { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem } = require('electron');
const path = require('path');
const fs = require('fs');

// ── Config persistence ──────────────────────────────────────────
const configPath = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch {
    // corrupted config — return defaults
  }
  return {};
}

function saveConfig(data) {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
}

ipcMain.handle('config:load', () => loadConfig());
ipcMain.handle('config:save', (_event, data) => saveConfig(data));
ipcMain.handle('config:path', () => configPath);

// ── File picker handlers ────────────────────────────────────────
ipcMain.handle('dialog:pickImage', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Attach Image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (canceled || filePaths.length === 0) return [];
  return filePaths.map((fp) => ({
    path: fp,
    name: path.basename(fp),
    base64: fs.readFileSync(fp).toString('base64'),
  }));
});

ipcMain.handle('dialog:pickFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Attach File',
    properties: ['openFile', 'multiSelections'],
  });
  if (canceled || filePaths.length === 0) return [];
  return filePaths.map((fp) => {
    let content;
    try {
      content = fs.readFileSync(fp, 'utf-8');
    } catch {
      content = '[Binary file — cannot display as text]';
    }
    return { path: fp, name: path.basename(fp), content };
  });
});

// ── Chat history persistence ────────────────────────────────────
const crypto = require('crypto');
const historyDir = path.join(__dirname, 'chat_history');
if (!fs.existsSync(historyDir)) {
  fs.mkdirSync(historyDir, { recursive: true });
}

const HISTORY_FILE = path.join(historyDir, 'current.json');
const HISTORY_FILE_ENC = path.join(historyDir, 'current.enc');

function encryptData(plaintext, passphrase) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: salt(16) + iv(12) + authTag(16) + ciphertext
  return Buffer.concat([salt, iv, authTag, encrypted]);
}

function decryptData(buffer, passphrase) {
  const salt = buffer.subarray(0, 16);
  const iv = buffer.subarray(16, 28);
  const authTag = buffer.subarray(28, 44);
  const ciphertext = buffer.subarray(44);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf-8');
}

ipcMain.handle('history:save', (_event, messages, encrypt, passphrase) => {
  try {
    const json = JSON.stringify(messages, null, 2);
    if (encrypt && passphrase) {
      const encrypted = encryptData(json, passphrase);
      fs.writeFileSync(HISTORY_FILE_ENC, encrypted);
      // Remove unencrypted file if it exists
      if (fs.existsSync(HISTORY_FILE)) fs.unlinkSync(HISTORY_FILE);
    } else {
      fs.writeFileSync(HISTORY_FILE, json, 'utf-8');
      // Remove encrypted file if it exists
      if (fs.existsSync(HISTORY_FILE_ENC)) fs.unlinkSync(HISTORY_FILE_ENC);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('history:load', (_event, encrypt, passphrase) => {
  try {
    if (encrypt && passphrase) {
      if (!fs.existsSync(HISTORY_FILE_ENC)) return { success: true, messages: [] };
      const buffer = fs.readFileSync(HISTORY_FILE_ENC);
      const json = decryptData(buffer, passphrase);
      return { success: true, messages: JSON.parse(json) };
    } else {
      if (!fs.existsSync(HISTORY_FILE)) return { success: true, messages: [] };
      const json = fs.readFileSync(HISTORY_FILE, 'utf-8');
      return { success: true, messages: JSON.parse(json) };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('history:clear', () => {
  try {
    if (fs.existsSync(HISTORY_FILE)) fs.unlinkSync(HISTORY_FILE);
    if (fs.existsSync(HISTORY_FILE_ENC)) fs.unlinkSync(HISTORY_FILE_ENC);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── Web API handlers (free, no API keys) ────────────────────────
const { net } = require('electron');

async function fetchJSON(url) {
  const res = await net.fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Weather via Open-Meteo (geocode + forecast)
ipcMain.handle('web:weather', async (_event, city) => {
  try {
    // Geocode the city
    const geo = await fetchJSON(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`
    );
    if (!geo.results || geo.results.length === 0) {
      return { success: false, error: `City not found: ${city}` };
    }
    const { latitude, longitude, name, country, timezone } = geo.results[0];

    // Fetch current weather + 3-day forecast
    const weather = await fetchJSON(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${encodeURIComponent(timezone)}&forecast_days=3`
    );

    return {
      success: true,
      data: {
        location: `${name}, ${country}`,
        timezone,
        current: weather.current,
        current_units: weather.current_units,
        daily: weather.daily,
        daily_units: weather.daily_units,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Time via WorldTimeAPI
ipcMain.handle('web:time', async (_event, location) => {
  try {
    // First geocode to get timezone
    const geo = await fetchJSON(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en`
    );
    if (!geo.results || geo.results.length === 0) {
      return { success: false, error: `Location not found: ${location}` };
    }
    const { name, country, timezone } = geo.results[0];

    const timeData = await fetchJSON(
      `https://worldtimeapi.org/api/timezone/${encodeURIComponent(timezone)}`
    );

    return {
      success: true,
      data: {
        location: `${name}, ${country}`,
        timezone,
        datetime: timeData.datetime,
        utc_offset: timeData.utc_offset,
        day_of_week: timeData.day_of_week,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IP geolocation via ip-api.com
ipcMain.handle('web:ip', async (_event, address) => {
  try {
    const url = address
      ? `http://ip-api.com/json/${encodeURIComponent(address)}?fields=status,message,country,regionName,city,zip,lat,lon,timezone,isp,org,as,query`
      : `http://ip-api.com/json/?fields=status,message,country,regionName,city,zip,lat,lon,timezone,isp,org,as,query`;

    const data = await fetchJSON(url);
    if (data.status === 'fail') {
      return { success: false, error: data.message || 'IP lookup failed' };
    }
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Web search via DuckDuckGo Lite (HTML scraping — no API key needed)
ipcMain.handle('web:search', async (_event, query) => {
  try {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    const res = await net.fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) {
      console.error(`DDG Lite search failed: HTTP ${res.status}`);
      throw new Error(`HTTP ${res.status}`);
    }
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

    if (results.length === 0) {
      console.error(`DDG Lite search: no results found for query "${query}". HTML snippet:`, html.substring(0, 500));
      return { success: true, data: { query, message: `No results found for "${query}".`, results: [] } };
    }
    return { success: true, data: { query, results } };
  } catch (err) {
    console.error('DDG Lite Search Exception:', err);
    return { success: false, error: err.message };
  }
});

// NIST NVD CVE Search
ipcMain.handle('web:cve', async (_event, query) => {
  try {
    const data = await fetchJSON(
      `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(query)}&resultsPerPage=5`
    );

    if (!data.vulnerabilities || data.vulnerabilities.length === 0) {
      return { success: true, data: { message: "No CVEs found for that query." } };
    }

    const cves = data.vulnerabilities.map(v => {
      const cve = v.cve;
      const desc = cve.descriptions?.find(d => d.lang === 'en')?.value || 'No description available';
      let cvss = 'N/A';
      if (cve.metrics?.cvssMetricV31?.length > 0) {
        cvss = cve.metrics.cvssMetricV31[0].cvssData.baseScore + ' (' + cve.metrics.cvssMetricV31[0].cvssData.baseSeverity + ')';
      } else if (cve.metrics?.cvssMetricV30?.length > 0) {
        cvss = cve.metrics.cvssMetricV30[0].cvssData.baseScore + ' (' + cve.metrics.cvssMetricV30[0].cvssData.baseSeverity + ')';
      } else if (cve.metrics?.cvssMetricV2?.length > 0) {
        cvss = cve.metrics.cvssMetricV2[0].cvssData.baseScore + ' (' + cve.metrics.cvssMetricV2[0].baseSeverity + ')';
      }

      return {
        id: cve.id,
        published: cve.published,
        cvss_score: cvss,
        description: desc
      };
    });

    return { success: true, data: cves };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// URL Fetch — grab and strip HTML to plain text
ipcMain.handle('web:url_fetch', async (_event, url) => {
  try {
    const res = await net.fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    // Strip HTML tags, decode entities, collapse whitespace
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
    // Limit to 4000 chars to avoid overloading context
    return { success: true, data: { url, content: text.slice(0, 4000) } };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// News headlines via DuckDuckGo
ipcMain.handle('web:news', async (_event, topic) => {
  try {
    const data = await fetchJSON(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(topic)}&format=json&no_html=1&skip_disambig=1`
    );
    const results = [];
    if (data.AbstractText) results.push({ title: data.Heading, text: data.AbstractText, url: data.AbstractURL });
    for (const t of (data.RelatedTopics || []).slice(0, 8)) {
      if (t.Text) results.push({ text: t.Text, url: t.FirstURL || '' });
    }
    if (results.length === 0) return { success: true, data: { message: `No news results found for "${topic}".` } };
    return { success: true, data: { topic, results } };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Crypto price via CoinGecko (free, no key)
ipcMain.handle('web:crypto', async (_event, coin) => {
  try {
    const id = coin.toLowerCase().replace(/\s+/g, '-');
    const data = await fetchJSON(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`
    );
    return {
      success: true,
      data: {
        name: data.name,
        symbol: data.symbol?.toUpperCase(),
        price_usd: data.market_data?.current_price?.usd,
        market_cap_usd: data.market_data?.market_cap?.usd,
        change_24h_pct: data.market_data?.price_change_percentage_24h,
        high_24h: data.market_data?.high_24h?.usd,
        low_24h: data.market_data?.low_24h?.usd,
        total_volume: data.market_data?.total_volume?.usd,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Stock quote via Yahoo Finance (no key)
ipcMain.handle('web:stock', async (_event, symbol) => {
  try {
    const data = await fetchJSON(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol.toUpperCase())}?interval=1d&range=1d`
    );
    const result = data.chart?.result?.[0];
    if (!result) return { success: false, error: `No data found for ${symbol}` };
    const meta = result.meta;
    return {
      success: true,
      data: {
        symbol: meta.symbol,
        currency: meta.currency,
        price: meta.regularMarketPrice,
        previous_close: meta.previousClose,
        change: (meta.regularMarketPrice - meta.previousClose).toFixed(2),
        change_pct: (((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100).toFixed(2) + '%',
        day_high: meta.regularMarketDayHigh,
        day_low: meta.regularMarketDayLow,
        volume: meta.regularMarketVolume,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Dictionary definition via Free Dictionary API
ipcMain.handle('web:define', async (_event, word) => {
  try {
    const data = await fetchJSON(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    if (!Array.isArray(data) || data.length === 0) return { success: false, error: `No definition found for "${word}"` };
    const entry = data[0];
    const meanings = (entry.meanings || []).slice(0, 3).map(m => ({
      partOfSpeech: m.partOfSpeech,
      definitions: (m.definitions || []).slice(0, 2).map(d => ({
        definition: d.definition,
        example: d.example || null,
      })),
    }));
    return {
      success: true,
      data: {
        word: entry.word,
        phonetic: entry.phonetic || null,
        meanings,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// DNS lookup via Google DNS-over-HTTPS
ipcMain.handle('web:dns', async (_event, domain, recordType) => {
  try {
    const type = (recordType || 'A').toUpperCase();
    const data = await fetchJSON(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`
    );
    return {
      success: true,
      data: {
        domain,
        type,
        status: data.Status,
        answers: (data.Answer || []).map(a => ({
          name: a.name,
          type: a.type,
          TTL: a.TTL,
          data: a.data,
        })),
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Safe math calculator
ipcMain.handle('web:calc', async (_event, expression) => {
  try {
    // Only allow safe math characters
    const sanitized = expression.replace(/[^0-9+\-*/.()%^ \t,eE]/g, '');
    if (!sanitized.trim()) return { success: false, error: 'Empty or invalid expression' };
    // Replace ^ with ** for exponentiation
    const jsExpr = sanitized.replace(/\^/g, '**');
    const result = Function('"use strict"; return (' + jsExpr + ')')();
    if (typeof result !== 'number' || !isFinite(result)) {
      return { success: false, error: 'Expression did not evaluate to a finite number' };
    }
    return { success: true, data: { expression, result } };
  } catch (err) {
    return { success: false, error: `Calculation error: ${err.message}` };
  }
});

// ── Model search (ollama.com) ─────────────────────────────────
ipcMain.handle('web:search_models', async (_event, query, sort, categories) => {
  try {
    let url = 'https://ollama.com/search';
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (sort) params.append('s', sort);
    if (categories && Array.isArray(categories)) {
      categories.forEach(c => params.append('c', c));
    }

    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const res = await net.fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Parse model cards from HTML using regex
    const models = [];
    // Match each model link block: /library/modelname
    const cardRegex = /<a[^>]*href="\/library\/([^"]+)"[^>]*>[\s\S]*?<\/a>/gi;
    let match;
    while ((match = cardRegex.exec(html)) !== null && models.length < 20) {
      const cardHtml = match[0];
      const name = match[1];

      // Extract description — look for the paragraph after the heading
      const descMatch = cardHtml.match(/<p[^>]*class="[^"]*max-w[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
        || cardHtml.match(/<span[^>]*class="[^"]*line-clamp[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      const description = descMatch
        ? descMatch[1].replace(/<[^>]+>/g, '').trim()
        : '';

      // Extract pull count
      const pullMatch = cardHtml.match(/([\d.]+[KMB]?)\s*Pulls/i);
      const pulls = pullMatch ? pullMatch[1] : '';

      // Extract size tags (1b, 3b, 7b, etc.)
      const sizes = [];
      const sizeRegex = /(\d+\.?\d*[bB])\b/g;
      let sizeMatch;
      while ((sizeMatch = sizeRegex.exec(cardHtml)) !== null) {
        const s = sizeMatch[1].toLowerCase();
        if (!sizes.includes(s)) sizes.push(s);
      }

      // Detect capabilities
      const hasTools = /tools/i.test(cardHtml);
      const hasVision = /vision/i.test(cardHtml);
      const hasReasoning = /thinking/i.test(cardHtml);

      if (name && !models.find(m => m.name === name)) {
        models.push({ name, description, pulls, sizes, tools: hasTools, vision: hasVision, reasoning: hasReasoning });
      }
    }

    return { success: true, data: models };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('web:model_tags', async (_event, modelName) => {
  try {
    const res = await net.fetch(`https://ollama.com/library/${encodeURIComponent(modelName)}/tags`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const tags = [];
    // Split HTML into blocks by tag card using the 'group px-4 py-3' separator
    const blocks = html.split('group px-4 py-3');
    const seen = new Set();

    // First element is the header, skip it
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];

      // Find the tag name from the desktop link (e.g. href="/library/llama3.2:1b")
      const tagMatch = block.match(/href="\/library\/[^:]+:([^"]+)"/i);
      if (!tagMatch) continue;
      const tag = tagMatch[1];

      if (seen.has(tag)) continue;
      seen.add(tag);

      // Find size (e.g. 1.3GB or 893MB)
      const sizeMatch = block.match(/([\d.]+\s*[KMGT]B)/i);
      const size = sizeMatch ? sizeMatch[1].replace(/\s/g, '') : '';

      // Find context window (e.g. 128K)
      const ctxMatch = block.match(/([\d.]+K)\s*(?:context)?/i);
      const context = ctxMatch ? ctxMatch[1] : '';

      tags.push({ tag, size, context });
    }

    return { success: true, data: tags };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── SSH handler ───────────────────────────────────────────────
const { exec } = require('child_process');

ipcMain.handle('ssh:connect', async (_event, host, username, privateKeyPath) => {
  return new Promise((resolve) => {
    let keyArg = '';
    if (privateKeyPath) {
      let keyPath = privateKeyPath;
      if (keyPath.startsWith('~')) {
        keyPath = path.join(require('os').homedir(), keyPath.slice(1));
      }
      keyArg = `-i "${keyPath}"`;
    }

    // Run a simple command over SSH to validate connection and fetch basic banner/OS info
    // -o BatchMode=yes prevents password prompts from hanging the process
    // -o StrictHostKeyChecking=no auto-accepts new host keys
    const cmd = `ssh -v -o BatchMode=yes -o StrictHostKeyChecking=no ${keyArg} ${username}@${host} "cat /etc/os-release || uname -a"`;

    exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
      // The -v flag prints banner info to stderr. We can extract it or just return both.
      const output = (stdout + '\n' + stderr).trim();

      if (error) {
        // Did we actually connect but the command failed, or did connection fail?
        if (error.code === 255) {
          resolve({ success: false, error: 'SSH Connection Failed (Code 255):\n' + stderr });
        } else {
          resolve({ success: true, banner: 'Connected with errors:\n' + output });
        }
      } else {
        // Success
        resolve({ success: true, banner: output });
      }
    });
  });
});

ipcMain.handle('ssh:run', async (_event, host, username, privateKeyPath, remoteCmd) => {
  return new Promise((resolve) => {
    let keyArg = '';
    if (privateKeyPath) {
      let keyPath = privateKeyPath;
      if (keyPath.startsWith('~')) {
        keyPath = path.join(require('os').homedir(), keyPath.slice(1));
      }
      keyArg = `-i "${keyPath}"`;
    }

    const escapedCmd = remoteCmd.replace(/"/g, '\\"');
    const cmd = `ssh -o BatchMode=yes -o StrictHostKeyChecking=no ${keyArg} ${username}@${host} "${escapedCmd}"`;

    exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
      const output = (stdout + '\n' + stderr).trim();
      if (error) {
        resolve({ success: false, error: output || error.message });
      } else {
        resolve({ success: true, output });
      }
    });
  });
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0c0c0c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');

  // Add native right-click context menu
  win.webContents.on('context-menu', (event, params) => {
    const menu = new Menu();

    // Text editing properties
    if (params.isEditable) {
      menu.append(new MenuItem({ role: 'undo' }));
      menu.append(new MenuItem({ role: 'redo' }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ role: 'cut' }));
      menu.append(new MenuItem({ role: 'copy' }));
      menu.append(new MenuItem({ role: 'paste' }));
    } else if (params.selectionText && params.selectionText.trim().length > 0) {
      // Just copy if it's highlighted text in a read-only area
      menu.append(new MenuItem({ role: 'copy' }));
    }

    // Add dictionary suggestions if available
    if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
      if (menu.items.length > 0) menu.append(new MenuItem({ type: 'separator' }));
      for (const suggestion of params.dictionarySuggestions) {
        menu.append(new MenuItem({
          label: suggestion,
          click: () => win.webContents.replaceMisspelling(suggestion)
        }));
      }
    }

    // Always allow select all
    if (menu.items.length > 0) menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({ role: 'selectAll' }));

    menu.popup();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
