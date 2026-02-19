// ── Hack Commands — Simulated terminal hacking sequences ────────
// Intercepts slash commands and plays animated output in the chat.

(function () {
    'use strict';

    // ── Random helpers ──────────────────────────────────────────
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const hex = (len) => Array.from({ length: len }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(' ');
    const randIP = () => `${rand(10, 255)}.${rand(0, 255)}.${rand(0, 255)}.${rand(1, 254)}`;
    const randPort = () => pick([21, 22, 23, 25, 53, 80, 443, 445, 1433, 3306, 3389, 5432, 5900, 6667, 8080, 8443, 9090, 27017]);
    const randMAC = () => Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(':');
    const randHash = (len = 64) => Array.from({ length: len }, () => '0123456789abcdef'[rand(0, 15)]).join('');

    const corps = ['NeoNET', 'Aztechnology', 'Renraku', 'Shiawase', 'Saeder-Krupp', 'Ares Macrotechnology', 'Mitsuhama', 'Evo Corp', 'Horizon Group', 'Wuxing Inc'];
    const iceTypes = ['Tar Baby', 'Killer', 'Probe', 'Scramble', 'Blaster', 'Track', 'Sparky', 'Black IC', 'Psychotropic IC', 'Databomb'];
    const services = ['SSH-2.0-MatrixOS', 'HTTP/1.1 HostNode', 'SMTP GridMail', 'FTP DataVault', 'RDP NeuroLink', 'MySQL PaydataDB', 'LDAP CorpAuth', 'VNC DeckView'];
    const files = ['personnel.db.enc', 'paydata_Q4.arc', 'project_ARES.dat', 'blackops_dossier.gpg', 'financials_2075.xls.enc', 'bioweapon_schematics.dwg', 'AI_research_notes.md.enc'];
    const locations = ['Seattle, UCAS', 'Neo-Tokyo, Japan', 'Berlin, AGS', 'Hong Kong FEZ', 'Lagos, Nigeria', 'São Paulo, Amazonia', 'London, UK', 'Denver, FTZ', 'Bogotá, Aztlan', 'Singapore'];
    const spinChars = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

    // ── Animation primitives ────────────────────────────────────
    function sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    function createHackBlock(container) {
        const block = document.createElement('div');
        block.className = 'hack-output';
        container.innerHTML = '';
        container.appendChild(block);
        return block;
    }

    async function typeLine(block, text, cls = '', charDelay = 18) {
        const line = document.createElement('div');
        line.className = 'hack-line' + (cls ? ' ' + cls : '');
        block.appendChild(line);
        for (let i = 0; i < text.length; i++) {
            line.textContent += text[i];
            block.parentElement?.scrollIntoView({ block: 'end', behavior: 'smooth' });
            if (charDelay > 0) await sleep(charDelay);
        }
        return line;
    }

    async function printLine(block, text, cls = '') {
        const line = document.createElement('div');
        line.className = 'hack-line' + (cls ? ' ' + cls : '');
        line.textContent = text;
        block.appendChild(line);
        block.parentElement?.scrollIntoView({ block: 'end', behavior: 'smooth' });
        await sleep(60);
        return line;
    }

    async function statusLine(block, text, status = 'ok', delay = 300) {
        const tag = status === 'ok' ? '[  OK  ]' : status === 'fail' ? '[ FAIL ]' : '[ WARN ]';
        const cls = 'hack-' + status;
        await sleep(delay);
        return printLine(block, `${tag} ${text}`, cls);
    }

    async function progressBar(block, label, duration = 2000, steps = 30) {
        const line = document.createElement('div');
        line.className = 'hack-line hack-progress-line';
        block.appendChild(line);
        const stepTime = duration / steps;
        for (let i = 0; i <= steps; i++) {
            const pct = Math.round((i / steps) * 100);
            const filled = Math.round((i / steps) * 20);
            const empty = 20 - filled;
            line.textContent = `${label} [${'█'.repeat(filled)}${'░'.repeat(empty)}] ${pct}%`;
            block.parentElement?.scrollIntoView({ block: 'end', behavior: 'smooth' });
            await sleep(stepTime);
        }
        return line;
    }

    async function hexDump(block, lines = 6, delay = 80) {
        for (let i = 0; i < lines; i++) {
            const addr = (i * 16).toString(16).padStart(8, '0');
            await printLine(block, `0x${addr}  ${hex(16)}`, 'hack-hex');
            await sleep(delay);
        }
    }

    async function spinner(block, text, duration = 1500) {
        const line = document.createElement('div');
        line.className = 'hack-line hack-spinner';
        block.appendChild(line);
        const start = Date.now();
        let i = 0;
        while (Date.now() - start < duration) {
            line.textContent = `${spinChars[i % spinChars.length]} ${text}`;
            block.parentElement?.scrollIntoView({ block: 'end', behavior: 'smooth' });
            i++;
            await sleep(80);
        }
        line.remove();
    }

    // ── AI Integration ──────────────────────────────────────────
    let aiGenerator = null;

    async function genText(prompt, fallback) {
        if (!aiGenerator) return fallback;
        try {
            const txt = await aiGenerator(prompt);
            return txt.replace(/["']/g, '').trim() || fallback;
        } catch (e) {
            console.error('AI Gen failed:', e);
            return fallback;
        }
    }

    // ── Command handlers ────────────────────────────────────────

    async function cmdHack(block, args) {
        let target = args;
        if (!target) {
            target = await genText('Generate a cool, menacing cyberpunk corporation name (e.g. Arasaka, BioTechnica). Output ONLY the name.', pick(corps));
            target += ' ' + pick(['Regional Host', 'Datacenter', 'Black Site', 'Orbital Station']);
        }
        const ip = randIP();

        await typeLine(block, `> Initializing deck interface...`, 'hack-dim');
        await sleep(400);
        await typeLine(block, `> Target: ${target}`, 'hack-accent');
        await typeLine(block, `> Resolved host: ${ip}`, 'hack-dim');
        await sleep(300);

        await printLine(block, '');
        await typeLine(block, '── PHASE 1: RECONNAISSANCE ──', 'hack-header');
        await spinner(block, 'Mapping host architecture...', 1200);
        await statusLine(block, 'Host architecture mapped — Rating ' + rand(6, 15));

        const firewall = await genText('Generate a fictional cybersecurity firewall name (e.g. Black-Ice v9, Aegis-7). Output ONLY the name.', pick(corps) + ' v' + rand(3, 9));
        await statusLine(block, `Firewall detected: ${firewall}`);
        await statusLine(block, `ICE layers identified: ${rand(3, 6)}`, 'warn');

        await printLine(block, '');
        await typeLine(block, '── PHASE 2: ICE BYPASS ──', 'hack-header');
        const iceCount = rand(2, 4);
        for (let i = 0; i < iceCount; i++) {
            const iceName = await genText('Generate a scary cyberpunk ICE program name (e.g. Soulkiller, Brain-Fry, Neuro-Whip). Output ONLY the name.', pick(iceTypes));
            await spinner(block, `Engaging ${iceName}...`, rand(800, 1500));

            if (Math.random() > 0.7) {
                await statusLine(block, `${iceName} active — deploying countermeasures`, 'warn', 200);
                await progressBar(block, 'Countermeasure', rand(1000, 2000));
                await statusLine(block, `${iceName} neutralized`);
            } else {
                await statusLine(block, `${iceName} bypassed`);
            }
        }

        await printLine(block, '');
        await typeLine(block, '── PHASE 3: DATA EXTRACTION ──', 'hack-header');
        await progressBar(block, 'Breaching datastore', rand(1500, 3000));
        await statusLine(block, 'Datastore access granted');
        await sleep(200);

        const fileCount = rand(2, 3);
        const fileContext = args ? `related to ${args}` : 'Top Secret corporate data';
        for (let i = 0; i < fileCount; i++) {
            const fname = await genText(`Generate a secret cyberpunk filename ${fileContext}. No spaces, use underscores. Ends in .enc, .dat, or .log. Output ONLY the filename.`, pick(files));
            await printLine(block, `  → ${fname}  [${rand(12, 890)}KB]`, 'hack-accent');
            await sleep(150);
        }

        await printLine(block, '');
        await progressBar(block, 'Exfiltrating paydata', rand(1500, 2500));
        await statusLine(block, `${fileCount} file(s) secured to deck local storage`);

        await printLine(block, '');
        await typeLine(block, '── PHASE 4: CLEANUP ──', 'hack-header');
        await spinner(block, 'Erasing datatrail...', 1000);
        await statusLine(block, 'Access logs purged');
        await statusLine(block, 'Datatrail obfuscated — rerouted through ' + rand(3, 7) + ' proxies');

        await printLine(block, '');
        await typeLine(block, `✓ Hack complete. ${target} compromised.`, 'hack-success');
        await typeLine(block, `  Total elapsed: ${rand(4, 18)}.${rand(10, 99)}s realtime`, 'hack-dim');
    }

    async function cmdScan(block, args) {
        let target = args;
        if (!target) {
            target = randIP();
        }

        await typeLine(block, `> Initiating grid scan: ${target}`, 'hack-accent');
        await sleep(300);

        await printLine(block, '');
        await typeLine(block, '── NETWORK RECONNAISSANCE ──', 'hack-header');
        await spinner(block, 'Scanning ports...', 2000);

        const portCount = rand(4, 8);
        await printLine(block, '');
        await printLine(block, 'PORT      STATE    SERVICE              VERSION', 'hack-dim');
        await printLine(block, '────────  ───────  ───────────────────  ──────────', 'hack-dim');
        for (let i = 0; i < portCount; i++) {
            const port = randPort();
            const state = Math.random() > 0.2 ? 'open' : 'filtered';
            const svc = pick(services);
            const stateCls = state === 'open' ? 'hack-ok' : 'hack-warn';
            await printLine(block, `${String(port).padEnd(10)}${state.padEnd(9)}${svc.padEnd(21)}v${rand(1, 5)}.${rand(0, 9)}`, stateCls);
            await sleep(120);
        }

        await printLine(block, '');
        await typeLine(block, '── HOST FINGERPRINT ──', 'hack-header');
        await sleep(200);

        const osName = await genText('Generate a cyberpunk OS name (e.g. MatrixOS v4). Output ONLY the name.', 'MatrixOS ' + rand(5, 12));
        await printLine(block, `  OS:    ${osName}`, 'hack-dim');
        await printLine(block, `  MAC:   ${randMAC()}`, 'hack-dim');

        const owner = await genText('Generate a cyberpunk corp name. Output ONLY the name.', pick(corps));
        await printLine(block, `  Owner: ${owner}`, 'hack-dim');
        await printLine(block, `  ICE:   ${pick(iceTypes)} detected on perimeter`, 'hack-warn');

        await printLine(block, '');
        await statusLine(block, `Scan complete — ${portCount} services identified on ${target}`);
    }

    async function cmdTrace(block, args) {
        // ... (keep existing implementation, mostly visual) ...
        const target = args || randIP();
        const hops = rand(6, 12);

        await typeLine(block, `> Tracing datatrail: ${target}`, 'hack-accent');
        await sleep(400);

        await printLine(block, '');
        await typeLine(block, '── MATRIX ROUTE TRACE ──', 'hack-header');
        await printLine(block, '');
        await printLine(block, 'HOP  LATENCY    NODE IP           GRID', 'hack-dim');
        await printLine(block, '───  ─────────  ────────────────  ──────────────────', 'hack-dim');

        for (let i = 1; i <= hops; i++) {
            await sleep(rand(150, 400));
            const lat = i === hops ? rand(1, 5) : rand(5 * i, 30 * i);
            const nodeIP = i === hops ? target : randIP();
            const grid = pick([...corps.map(c => c + ' Grid'), 'Public Grid', 'Shadownet', 'TOR-Matrix', 'Dark Fiber']);
            const cls = i === hops ? 'hack-accent' : '';
            await printLine(block, `${String(i).padEnd(5)}${(lat + 'ms').padEnd(11)}${nodeIP.padEnd(18)}${grid}`, cls);
        }

        await printLine(block, '');
        await spinner(block, 'Resolving physical location...', 1500);

        const loc = pick(locations);
        await statusLine(block, `Datatrail resolved — ${hops} hops`);
        await printLine(block, '');
        await typeLine(block, `  ◉ Physical location: ${loc}`, 'hack-accent');
        await typeLine(block, `  ◉ Registered to: ${pick(corps)}`, 'hack-dim');
        await typeLine(block, `  ◉ Confidence: ${rand(72, 99)}%`, 'hack-dim');
    }

    async function cmdDecrypt(block, args) {
        // ... (keep existing implementation) ...
        const file = args || pick(files);

        await typeLine(block, `> Loading encrypted payload: ${file}`, 'hack-accent');
        await sleep(300);

        await printLine(block, '');
        await typeLine(block, '── CRYPTANALYSIS ──', 'hack-header');
        await sleep(200);
        await printLine(block, `  Cipher:    AES-256-GCM (${pick(corps)} variant)`, 'hack-dim');
        await printLine(block, `  Key size:  256-bit`, 'hack-dim');
        await printLine(block, `  Entropy:   ${(Math.random() * 2 + 6).toFixed(4)} bits/byte`, 'hack-dim');

        await printLine(block, '');
        await typeLine(block, '── ENCRYPTED DATA SAMPLE ──', 'hack-header');
        await hexDump(block, 4, 60);

        await printLine(block, '');
        await typeLine(block, '── BRUTE-FORCE ATTACK ──', 'hack-header');
        await sleep(200);

        const methods = ['Dictionary attack', 'Rainbow table lookup', 'Known-plaintext analysis', 'Side-channel extraction'];
        for (const method of methods) {
            await spinner(block, `${method}...`, rand(800, 1500));
            if (method === pick(methods)) {
                await statusLine(block, `${method} — partial key recovered`, 'warn');
            } else {
                await statusLine(block, `${method} — failed`, 'fail', 100);
            }
        }

        await printLine(block, '');
        await typeLine(block, '── KEY RECONSTRUCTION ──', 'hack-header');
        await progressBar(block, 'Reconstructing key', rand(2000, 3500));
        await printLine(block, `  Key: ${randHash(64)}`, 'hack-hex');
        await statusLine(block, 'Decryption key validated');

        await printLine(block, '');
        await progressBar(block, 'Decrypting payload', rand(1000, 2000));
        await statusLine(block, `${file} decrypted — ${rand(50, 4096)}KB recovered`);
        await printLine(block, '');

        const secret = await genText('Generate a short, mysterious cyberpunk secret revealed from a decrypted file (e.g. "Project Orion launch codes: 88-22-AA"). Output ONLY the secret.', 'Project Titan blueprints recovered.');
        await typeLine(block, `> DECRYPTED CONTENT: ${secret}`, 'hack-accent');

        await typeLine(block, `✓ Payload secured. Check your local deck storage.`, 'hack-success');
    }

    async function cmdNuke(block, args) {
        // ... (keep existing implementation) ...
        const target = args || pick(corps) + ' Primary Host';
        const ip = randIP();

        await typeLine(block, `> Target acquired: ${target}`, 'hack-accent');
        await typeLine(block, `> Resolved: ${ip}`, 'hack-dim');
        await sleep(300);

        await printLine(block, '');
        await typeLine(block, '██ WARNING: DATA BOMBARDMENT INITIATED ██', 'hack-warn hack-blink');
        await sleep(500);

        await printLine(block, '');
        await typeLine(block, '── PHASE 1: PAYLOAD ASSEMBLY ──', 'hack-header');
        await progressBar(block, 'Compiling attack vectors', 1500);
        const vectors = rand(128, 512);
        await statusLine(block, `${vectors} attack vectors loaded`);

        await printLine(block, '');
        await typeLine(block, '── PHASE 2: BOMBARDMENT ──', 'hack-header');
        const waves = rand(3, 5);
        for (let i = 1; i <= waves; i++) {
            await progressBar(block, `Wave ${i}/${waves}`, rand(800, 1500), 20);
            const dmg = rand(15, 30);
            await printLine(block, `  → ${dmg}% host integrity lost — ${rand(50, 300)} nodes affected`, 'hack-fail');
            await sleep(200);
        }

        await printLine(block, '');
        await typeLine(block, '── PHASE 3: ICE COLLAPSE ──', 'hack-header');
        await statusLine(block, 'All ICE layers neutralized');

        await printLine(block, '');
        await spinner(block, 'Destabilizing core...', 1200);
        await printLine(block, `  ██  HOST INTEGRITY: 0%         ██`, 'hack-fail hack-blink');
        await sleep(500);

        await printLine(block, '');
        await typeLine(block, `✓ ${target} — DESTROYED.`, 'hack-success');
    }

    async function cmdHelp(block) {
        // ... (existing)
        await typeLine(block, '── AVAILABLE COMMANDS ──', 'hack-header');
        await printLine(block, '');
        const cmds = [
            ['/hack <target>', 'Breach a corporate host — multi-phase ICE bypass'],
            ['/scan [target]', 'Network recon — port scanning and fingerprinting'],
            ['/trace <ip>', 'Trace a Matrix datatrail to physical location'],
            ['/decrypt <file>', 'Brute-force decrypt an encrypted payload'],
            ['/nuke <target>', 'Data bombardment attack — destroy a host'],
            ['/help', 'Display this command listing'],
        ];
        for (const [cmd, desc] of cmds) {
            await printLine(block, `  ${cmd.padEnd(20)} ${desc}`, 'hack-accent');
            await sleep(60);
        }
    }

    // ── Command registry ────────────────────────────────────────
    const COMMANDS = {
        hack: cmdHack,
        scan: cmdScan,
        trace: cmdTrace,
        decrypt: cmdDecrypt,
        nuke: cmdNuke,
        help: cmdHelp,
    };

    // ── Public API ──────────────────────────────────────────────
    window.hackCommands = {
        setAIGenerator(fn) {
            aiGenerator = fn;
        },

        async run(cmdName, args, bubbleEl) {
            const handler = COMMANDS[cmdName];
            if (!handler) return;

            // Create a new visual block in the bubble
            const block = createHackBlock(bubbleEl);
            await handler(block, args);
        },

        async tryRun(text, bubbleEl) {
            const match = text.match(/^\/(\w+)\s*(.*)?$/);
            if (!match) return false;
            const cmd = match[1].toLowerCase();
            const args = (match[2] || '').trim();
            const handler = COMMANDS[cmd];
            if (!handler) return false;

            const block = createHackBlock(bubbleEl);
            await handler(block, args);
            return true;
        },

        isCommand(text) {
            const match = text.match(/^\/(\w+)/);
            return match && COMMANDS[match[1].toLowerCase()] !== undefined;
        },
    };
})();
