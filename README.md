# Neural Deck

A sleek Electron desktop client for [Ollama](https://ollama.com) with a Linux terminal–inspired UI.

![Electron](https://img.shields.io/badge/Electron-34-47848F?logo=electron&logoColor=white)
![Node](https://img.shields.io/badge/Node-18+-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

<p>
  <img src="screenshot1.png" alt="Neural Deck" width="600" />
  <img src="screenshot2.png" alt="Neural Deck Chat" width="600" />
  <img src="screenshot3.png" alt="Neural Deck Settings" width="600" />
  <img src="screenshot4.png" alt="Neural Deck Hack Sim" width="600" />
  <img src="screenshot5.png" alt="Neural Deck Hack Output" width="600" />
</p>

## Features

- **Streaming chat** — real-time token streaming with stop/cancel support
- **AI tool calling** — Gemini-style tool use; the model can query weather, time, IP info, and web search using free APIs — no API keys needed
- **Model capability icons** — 👁 vision, 🔧 tool-calling — icons in the model dropdown so you know what each model supports
- **Vision model support** — attach images and use vision-capable models for image analysis
- **Image & file attachments** — attach images (base64 for vision models) or text files to your prompts; attached files display as chips in the chat history
- **Emoji picker** — built-in emoji panel with 8 categorized tabs and search
- **Hack simulation** — built-in slash commands that play animated terminal-style hacking sequences
- **System prompt modes** — Default (Sojourner persona), None, or Custom with your own prompt
- **Persistent chat history** — choose between in-memory or disk-based history storage
- **Encrypted history** — optional AES-256-GCM encryption for disk-stored conversations
- **Performance stats** — tokens/sec and token count displayed on every response
- **Configurable parameters** — temperature, max tokens, context length, chunk size
- **Agent naming** — customize the assistant's display name (default: Sojourner)
- **Auto-persistence** — all settings saved automatically to a local config file
- **Terminal aesthetic** — custom icon, monospace font, green accent, scanline overlay, dark theme

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Ollama](https://ollama.com) running locally (or on a reachable server)

## Quick Start

```bash
# Clone / copy the project
git clone <git@github.com:MuchDevSuchCode/NeuralLink.git> neural-deck
cd neural-deck

# Install dependencies
npm install

# Launch
npm start
```

The app will auto-connect to `http://localhost:11434` and fetch available models on startup.

## Usage

1. **Connect** — enter your Ollama server URL in the top bar and click the refresh button
2. **Select a model** — pick from the dropdown (👁 = vision, 🔧 = tool-calling)
3. **Chat** — type a message and press Enter or click Send
4. **Ask real-world questions** — models with 🔧 can fetch live weather, time, IP info, and web search results
5. **Attach files** — use the 📷 (image) or 📎 (file) buttons next to the input
6. **Emoji** — click the 😊 smiley button to open the emoji picker; click any emoji to insert it at your cursor
7. **Hack sim** — type a `/` command to run a simulated hacking sequence (see below)
8. **Tune parameters** — open the settings sidebar with the gear icon

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line in input |
| `Escape` | Close emoji picker / encryption key modal |

## AI Tool Calling

Models with the 🔧 icon support **Ollama's native tool-calling API**. When you ask a real-world question, the model decides on its own whether to call a tool — just like Gemini or ChatGPT.

### Available Tools

| Tool | API Source | Description |
|------|-----------|-------------|
| `get_weather` | [Open-Meteo](https://open-meteo.com) | Current conditions + 3-day forecast for any city |
| `get_time` | [WorldTimeAPI](https://worldtimeapi.org) | Current local time in any city/timezone |
| `get_ip_info` | [ip-api.com](http://ip-api.com) | IP geolocation lookup (defaults to your IP) |
| `web_search` | [DuckDuckGo](https://duckduckgo.com) | Quick factual web lookup |

All APIs are **free and require no API keys**.

### How It Works

1. You ask a question like *"What's the weather in Dallas?"*
2. The model returns a `tool_calls` request for `get_weather`
3. A pulsing `🔧 Calling get_weather…` indicator appears
4. Neural Deck fetches real data from the API
5. The result goes back to the model, which writes a natural-language response
6. The response meta line shows `🔧 1 tool call(s)` when tools were used

> **Note:** Models without tool support (no 🔧 icon) work normally — tool definitions are only sent to capable models. Tool support is auto-detected via Ollama's `/api/show` endpoint.

## Hack Simulation

Type slash commands in the chat input to trigger animated, Shadowrun-themed hacking sequences. These bypass the LLM entirely — no model selection required.

| Command | Description |
|---------|-------------|
| `/hack <target>` | Multi-phase corporate host breach — recon, ICE bypass, data extraction, cleanup |
| `/scan [target]` | Network reconnaissance — port scanning, service enumeration, host fingerprinting |
| `/trace <ip>` | Trace a Matrix datatrail hop-by-hop to a physical location |
| `/decrypt <file>` | Cryptanalysis and brute-force decryption of an encrypted payload |
| `/nuke <target>` | Data bombardment attack — multi-wave assault, ICE collapse, host destruction |
| `/help` | List all available commands |

All arguments are optional — random Shadowrun-themed targets are generated when omitted. Every run is randomized with different megacorps, ICE types, ports, files, and locations.

**Animation features:**
- Character-by-character typing effects
- Animated progress bars (`[████░░░░░░] 42%`)
- Scrolling hex dumps
- Spinning braille-character indicators
- Color-coded status lines (`[OK]` / `[WARN]` / `[FAIL]`)
- Blinking alert text for critical events

## System Prompt

The system prompt mode is selectable from the Settings sidebar:

| Mode | Behavior |
|------|----------|
| **Default** | Uses the built-in Sojourner persona — a sovereign Digital Intelligence from the Sixth World |
| **None** | No system prompt is sent; the model runs with its base behavior |
| **Custom** | Reveals a textarea where you can write your own system prompt |

## Chat History

Neural Deck supports two history storage modes, configurable in the Settings sidebar under **History**:

### Memory (default)

Chat history lives only in the current session. Closing the app loses all conversation data.

### Disk

Chat history is written to `chat_history/current.json` in the app directory after every message. On restart, your conversation is automatically restored.

### Encrypted Disk

When the **Encrypt History** toggle is enabled (only visible in Disk mode), chat history is encrypted with **AES-256-GCM** before being saved to `chat_history/current.enc`.

- **Key derivation** — your passphrase is run through `scryptSync` with a random 16-byte salt to derive a 256-bit key
- **Encryption** — each save generates a fresh 12-byte IV; the file format is `salt(16) + iv(12) + authTag(16) + ciphertext`
- **Key prompt** — a modal overlay prompts for your passphrase when encryption is first used and again on each app restart. The passphrase is held only in memory and never written to disk
- **Wrong passphrase** — GCM's authentication tag detects incorrect keys and shows an error toast

> **Note:** The `chat_history/` directory is listed in `.gitignore` to prevent accidental commits of conversation data.

## Project Structure

```
neural-deck/
├── main.js            # Electron main process (window, IPC, file dialogs, crypto, web APIs)
├── preload.js         # Bridge between main & renderer (Ollama API, tool detection, history IPC)
├── renderer.js        # Frontend logic (chat, tool calling, markdown, attachments, emoji, history)
├── hack-commands.js   # Simulated hacking command engine & animations
├── index.html         # App layout & structure
├── styles.css         # Terminal-themed styling
├── ndlogo.png         # App logo (welcome screen)
├── ndicon.png         # App icon (top bar)
├── .gitignore         # Excludes node_modules/ and chat_history/
├── chat_history/      # Auto-created; stores persisted conversations
└── package.json
```

## Configuration

Settings are auto-saved to `<userData>/config.json` and restored on launch:

| Setting | Default | Description |
|---------|---------|-------------|
| Server URL | `http://localhost:11434` | Ollama API endpoint |
| Temperature | `0.7` | Sampling temperature (0 = precise, 2 = creative) |
| Max Tokens | `2048` | Maximum tokens to generate |
| Context Length | `4096` | Context window size (`num_ctx`) |
| Chunk Size | `512` | Prompt batch size (`num_batch`) |
| Stream | `true` | Stream tokens in real-time |
| Agent Name | `Sojourner` | Display name for the AI |
| Prompt Mode | `default` | `default`, `none`, or `custom` |
| System Prompt | *(empty)* | Custom system message (used when Prompt Mode is `custom`) |
| History Mode | `memory` | `memory` or `disk` |
| Encrypt History | `false` | Enable AES-256-GCM encryption for disk history |

## API

The client communicates with Ollama via its REST API:

- `GET /api/tags` — list models (with vision detection via `details.families`)
- `POST /api/show` — detect tool-calling support (checks model template for tool tokens)
- `POST /api/chat` — chat completion (streaming or non-streaming, with optional tool calling)

It also queries these free external APIs for tool-call results:

- [Open-Meteo](https://open-meteo.com) — weather and geocoding
- [WorldTimeAPI](https://worldtimeapi.org) — timezone and current time
- [ip-api.com](http://ip-api.com) — IP geolocation
- [DuckDuckGo Instant Answer](https://api.duckduckgo.com) — web search

## Security

- Encryption uses **AES-256-GCM** — an authenticated encryption scheme that provides both confidentiality and integrity
- Key derivation uses **scrypt** (`N=16384, r=8, p=1`) with a unique random salt per save
- The passphrase is **never persisted** — it's held only in a JavaScript variable for the duration of the session
- The encryption key modal is **separate from the chat** — passphrase input is never added to chat history or sent to the model
- Web tool API calls are made from the **main process** — no direct network access from the renderer

## License

MIT
