# Lisan

A translation plugin for the **Discord desktop app**, built as a [Vencord](https://github.com/Vendicated/Vencord) userplugin.

Translates messages with **Google Translate** (free, no API key) or **DeepL** (API key required), and can auto-translate incoming messages per channel.

> Not affiliated with, or endorsed by, Vencord or Discord.
>
> Türkçe doküman: [README.tr.md](README.tr.md)

---

## Features

**Manual translation**
- A button in the message hover toolbar.
- A right-click item: *"Lisan ile çevir"*.
- The result appears under the message, italic, with the detected source language and a *gizle* (hide) link.

**Per-channel auto-translate**
- A button in the message box toggles auto-translate for the channel you are in. When on, it turns green.
- Incoming messages in that channel are translated as they arrive.
- Your own messages, and messages already in the target language, are skipped.
- All channels can be reset at once from the plugin settings.

**Engine handling**
- Google endpoints need no key at all; DeepL needs one.
- Results are cached (500 entries) and identical in-flight requests are coalesced.
- At most two requests run at a time, with a minimum gap between them.

---

## Requirements

- **Discord desktop app.** Use the normal download from [discord.com/download](https://discord.com/download);
  the Microsoft Store build is not supported by the Vencord installer.
- [Node.js](https://nodejs.org/en/download) **22 or newer**
- [Git](https://git-scm.com/download/win)

The install script checks all three and stops with an explanation if one is missing or too old.
pnpm is installed automatically when it is missing. If an old pnpm (below 11) is already installed,
it is upgraded, because those releases cannot read Vencord's lockfile.

The install scripts are PowerShell, so the setup currently runs on **Windows**. The plugin itself
is not Windows-specific.

---

## Install

The plugin is compiled into Vencord, so it is not a drop-in file. The script does the whole setup:

1. clones Vencord next to this repository,
2. copies the plugin into `src/userplugins/lisan`,
3. installs dependencies and builds,
4. downloads the Vencord installer and patches Discord.

**Close Discord first** (including the tray icon).

### Easiest: double-click

1. [Download](https://github.com/TheCombox/lisan/archive/refs/heads/main.zip) or clone this repository.
2. Double-click **`install.cmd`**.
3. Answer `y` when it asks whether to patch Discord.

A ZIP download works fine: the script clones Vencord itself, so a `.git` folder is not needed.

### Or from a terminal

```powershell
git clone https://github.com/TheCombox/lisan.git
cd lisan
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
```

Then open Discord → **Settings → Vencord → Plugins → Lisan** and enable it.

Useful flags:

| Flag | Effect |
|---|---|
| `-VencordDir <path>` | Reuse an existing Vencord checkout instead of cloning one |
| `-SkipDependencies` | Skip `pnpm install` (faster after the first run) |
| `-NoConfirm` | Do not ask before patching Discord |

Vencord is installed as a **dev install**, so it loads from this checkout: after a rebuild you only
need to restart Discord, not reinstall.

> **Keep this folder.** The dev install makes Discord load its patcher from here. Moving or
> deleting the folder afterwards stops Discord from starting; move it back, or run `install.cmd`
> again from the new location. If a Discord update removes Lisan, run `install.cmd` again.

---

## Usage

### Settings

*Settings → Vencord → Plugins → Lisan → gear icon*

| Setting | Meaning |
|---|---|
| **Çeviri motoru** | Engine: Google (default), DeepL, or DeepL Pro. |
| **DeepL API anahtarı** | Your DeepL key. If it is empty or the quota is used up, Lisan silently falls back to Google. |
| **Hedef dil** | Target language. Defaults to **Türkçe (tr)**. |
| **Kaynak dil** | Source language. Defaults to auto-detect. |
| **Otomatik çeviri genel anahtarı** | Master switch for auto-translate. Turning it off keeps your per-channel choices but stops translating. |
| **Otomatik çeviriyi N kanalda kapat** | Clears auto-translate on every channel. |

The in-app labels are currently Turkish; see [Limitations](#limitations).

### What auto-translate covers

Auto-translate translates messages that arrive **after** you enable it for a channel. Earlier history is not translated automatically — otherwise opening a long channel would fire hundreds of requests at once. To translate an older message, hover it and use the Lisan button.

---

## Rate limits (Google 429)

Google's free endpoint occasionally answers `429`. Lisan handles it in three layers:

1. **Retries** the endpoint twice with increasing delay, honouring a `Retry-After` header when the server sends one.
2. **Falls back to a second endpoint.** If `translate.googleapis.com` is throttled, the request goes to `clients5.google.com` instead. Both produce identical translations (covered by the tests); the fallback is noticeably faster.
3. **Pauses auto-translate** for 60 seconds if both fail, showing a single warning. Manual translation (button / right-click) is not affected by the pause.

The permanent fix is DeepL: add a key and switch the engine, and this limit no longer applies.

To measure the endpoints yourself:

```bash
node test/rate-limit-probe.mjs
```

---

## Development

```powershell
# re-copy, typecheck and rebuild after editing the sources
powershell -ExecutionPolicy Bypass -File scripts/update.ps1
```

Run the core tests against the live Google API. No Discord needed: the test file imports the parsers directly, and the only thing it borrows from Vencord is `tsx`. Adjust the path to wherever you cloned this repository.

```bash
cd Vencord
pnpm exec tsx "../lisan/test/verify.ts"
```

Last run: **47 passed, 0 failed.** They cover multi-line segment joining, language detection, target/source changes, malformed responses, Google↔DeepL code mapping, labels, and that the fallback endpoint returns the same output as the primary one.

### Layout

| Path | What it is |
|---|---|
| `index.tsx` | Plugin definition: hover button, context menu, accessory |
| `translate.ts` | Translation core: provider choice, cache, pacing, retries, cooldown |
| `native.ts` | Network calls in the Electron **main** process (avoids CORS) |
| `parse.ts` | Pure response parsing, so it can be tested without Discord |
| `languages.ts` | Language codes and conversions |
| `settings.tsx` | Settings UI and definitions |
| `state.ts` | Per-channel auto-translate state |
| `TranslationAccessory.tsx` | The translated text under a message |
| `AutoTranslateButton.tsx` | The message-box toggle |
| `LisanIcon.tsx` | The plugin icon |
| `styles.css` | Styles |
| `test/verify.ts` | Core tests, runnable without Discord |
| `test/rate-limit-probe.mjs` | Probes how the Google endpoints throttle |
| `install.cmd`, `update.cmd` | Double-click wrappers for the two scripts below |
| `scripts/install.ps1`, `scripts/update.ps1` | Setup and development-loop scripts |

Only the `.ts`, `.tsx` and `.css` files are copied into the Vencord checkout, so the plugin folder stays clean.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `git : The term 'git' is not recognized` | Git is missing or not on PATH. Install it from [git-scm.com](https://git-scm.com/download/win) and open a new terminal. |
| `Node.js v… is too old; Vencord needs 22 or newer` | Install the current LTS from [nodejs.org](https://nodejs.org/en/download). |
| `pnpm install failed` or a lockfile error | Delete the `Vencord` folder and run `install.cmd` again. The script upgrades pnpm versions below 11, which cannot read Vencord's lockfile. |
| `fatal: detected dubious ownership in repository` | Windows says the checkout belongs to another user (usually after copying the folder from another PC). The build no longer calls git for its version stamp, but cloning still does. Either delete the `Vencord` folder and reinstall, or run `git config --global --add safe.directory "<path to Vencord>"`. |
| `The Vencord installer failed` | Close Discord completely, including the tray icon, and make sure it is the normal desktop app (not the Microsoft Store build), then retry. |
| Discord will not start after moving the folder | The dev install points at the folder. Move it back, or run `install.cmd` again from the new location. |
| Lisan disappeared after a Discord update | Discord installs into a new `app-*` folder. Run `install.cmd` again. |
| The build fails right after a Vencord change | Delete the `Vencord` folder and run `install.cmd` again to get a fresh checkout. |

---

## Limitations

- **The in-app labels are Turkish.** The engine, language names and tooltips are Turkish strings. The plugin works regardless of your Discord language, but non-Turkish speakers will be reading Turkish labels. Translations for other languages are welcome.
- **Vencord ships its own `Translate` plugin.** Enabling both shows two translation buttons on every message. Turn one of them off.
- **Client mods are not officially supported by Discord.** Vencord injects code into the client. Behaviour that Discord actually polices — self-bots, automation of your account — is not touched here, but this is not risk-free.
- **DeepL quota.** The free tier is limited to 500,000 characters per month; when it runs out Lisan falls back to Google.

---

## License

**GPL-3.0-or-later.** See [LICENSE](LICENSE).

This plugin is a derivative work of Vencord, which is GPL-3.0-or-later: `languages.ts` and the shape of the language tables are adapted from Vencord's `translate` plugin, and the plugin is distributed as part of a Vencord build.

`languages.ts` — Copyright (c) 2023 Vendicated and contributors, GPL-3.0-or-later.
