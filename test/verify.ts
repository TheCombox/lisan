/*
 * Lisan — core verification tests
 *
 * Runs the real parsers (parse.ts, languages.ts) against the live Google Translate
 * API. No Discord or Vencord runtime required.
 *
 * Run it from your Vencord checkout:
 *   pnpm exec tsx "src/userplugins/lisan/test/verify.ts"
 */

import { deeplToGoogle, detectedLanguageLabel, googleToDeepl, languageLabel } from "../languages.ts";
import { parseDeeplResponse, parseGoogleCompactResponse, parseGoogleResponse } from "../parse.ts";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = "") {
    if (ok) {
        passed++;
        console.log(`  [ok]    ${name}`);
    } else {
        failed++;
        console.log(`  [FAIL]  ${name}${detail ? "  -> " + detail : ""}`);
    }
}

function throws(fn: () => unknown): boolean {
    try {
        fn();
        return false;
    } catch {
        return true;
    }
}

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Same request native.ts makes
function googleRequest(text: string, source: string, target: string) {
    const url = "https://translate.googleapis.com/translate_a/single?" + new URLSearchParams({
        client: "gtx",
        sl: source || "auto",
        tl: target,
        dt: "t",
        q: text
    }).toString();

    return fetch(url, { headers: { "User-Agent": USER_AGENT } })
        .then(async res => ({ status: res.status, body: await res.text() }));
}

// Same request native.ts makes for the fallback endpoint
function compactRequest(text: string, source: string, target: string) {
    const url = "https://clients5.google.com/translate_a/t?" + new URLSearchParams({
        client: "dict-chrome-ex",
        sl: source || "auto",
        tl: target,
        q: text
    }).toString();

    return fetch(url, { headers: { "User-Agent": USER_AGENT } })
        .then(async res => ({ status: res.status, body: await res.text() }));
}

async function main() {
    console.log("\n=== 1) live Google: long, multi-line text (en -> tr) ===");

    const longText = [
        "Hello world. This is a test of the Lisan translation plugin.",
        "It should handle multiple lines and longer messages correctly.",
        "Third sentence follows here."
    ].join("\n");

    const r1 = await googleRequest(longText, "auto", "tr");
    check("HTTP 200", r1.status === 200, `status ${r1.status}`);

    const v1 = parseGoogleResponse(r1.body, "auto");
    check("translation differs from the source", v1.text.trim() !== longText.trim());
    check("multi-line preserved (segments joined in order)", v1.text.includes("\n"), JSON.stringify(v1.text.slice(0, 120)));
    check("all sentences translated (plausible length)", v1.text.length > 60, `length ${v1.text.length}`);
    check("detected source code is en", v1.sourceCode === "en", v1.sourceCode);
    check("detected source label resolved", v1.sourceLanguage === "İngilizce", v1.sourceLanguage);

    console.log("\n=== 2) live Google: language detection (de -> tr) ===");

    const r2 = await googleRequest("Guten Tag, wie geht es dir heute?", "auto", "tr");
    const v2 = parseGoogleResponse(r2.body, "auto");
    check("German detected", v2.sourceCode === "de", v2.sourceCode);
    check("label resolved", v2.sourceLanguage === "Almanca", v2.sourceLanguage);
    check("translation produced", v2.text.trim().length > 0, v2.text);

    console.log("\n=== 3) live Google: different target (tr -> en) ===");

    const r3 = await googleRequest("Bu eklenti mesajlari cevirir.", "auto", "en");
    const v3 = parseGoogleResponse(r3.body, "auto");
    check("translated to English", /translat|converts|messages/i.test(v3.text), v3.text);

    console.log("\n=== 4) live Google: pinned source language (fr -> tr) ===");

    const r4 = await googleRequest("Bonjour, comment allez-vous?", "fr", "tr");
    const v4 = parseGoogleResponse(r4.body, "fr");
    check("translated from French", v4.text.trim().length > 0, v4.text);

    console.log("\n=== 5) malformed responses must throw ===");

    check("empty body", throws(() => parseGoogleResponse("", "auto")));
    check("invalid JSON", throws(() => parseGoogleResponse('{"a":1}', "auto")));
    check("empty translation", throws(() => parseGoogleResponse('[[["","x"]]]', "auto")));
    check("DeepL with no translations", throws(() => parseDeeplResponse('{"translations":[]}', "")));
    check("DeepL with broken JSON", throws(() => parseDeeplResponse("nope", "")));
    check("compact with empty array", throws(() => parseGoogleCompactResponse("[]", "auto")));
    check("compact with broken JSON", throws(() => parseGoogleCompactResponse("x", "auto")));

    console.log("\n=== 6) DeepL parsing (real response shape; a key is needed for live calls) ===");

    const deeplBody = JSON.stringify({
        translations: [{ detected_source_language: "EN", text: "Merhaba dünya, bu bir test." }]
    });
    const dv = parseDeeplResponse(deeplBody, "");
    check("text extracted", dv.text === "Merhaba dünya, bu bir test.", dv.text);
    check("EN -> en mapping", dv.sourceCode === "en", dv.sourceCode);
    check("label resolved", dv.sourceLanguage === "İngilizce", dv.sourceLanguage);
    check("unknown code falls back to itself",
        parseDeeplResponse(JSON.stringify({ translations: [{ detected_source_language: "ZH", text: "test" }] }), "").sourceCode === "zh");

    console.log("\n=== 7) language code mapping ===");

    check("googleToDeepl en -> en-us", googleToDeepl("en") === "en-us");
    check("googleToDeepl zh-CN -> zh-hans", googleToDeepl("zh-CN") === "zh-hans");
    check("googleToDeepl zh-TW -> zh-hant", googleToDeepl("zh-TW") === "zh-hant");
    check("googleToDeepl iw -> he", googleToDeepl("iw") === "he");
    check("googleToDeepl pt -> pt-br", googleToDeepl("pt") === "pt-br");
    check("googleToDeepl auto -> empty", googleToDeepl("auto") === "");
    check("googleToDeepl tr unchanged", googleToDeepl("tr") === "tr");

    check("deeplToGoogle en-us -> en", deeplToGoogle("en-us") === "en");
    check("deeplToGoogle en-gb -> en", deeplToGoogle("en-gb") === "en");
    check("deeplToGoogle pt-pt -> pt", deeplToGoogle("pt-pt") === "pt");
    check("deeplToGoogle nb -> no", deeplToGoogle("nb") === "no");
    check("deeplToGoogle he -> iw", deeplToGoogle("he") === "iw");
    check("deeplToGoogle zh-hans -> zh-CN", deeplToGoogle("zh-hans") === "zh-CN");

    console.log("\n=== 8) labels ===");

    check("languageLabel tr", languageLabel("tr") === "Türkçe");
    check("unknown label falls back to the code", languageLabel("xx") === "xx");
    check("detectedLanguageLabel deepl EN", detectedLanguageLabel("deepl", "EN") === "İngilizce");
    check("detectedLanguageLabel google zh-CN", detectedLanguageLabel("google", "zh-CN") === "Çince (Basitleştirilmiş)");
    check("empty detected code", detectedLanguageLabel("google", "") === "bilinmeyen");

    console.log("\n=== 9) live fallback endpoint (clients5.google.com) ===");

    const r5 = await compactRequest(longText, "auto", "tr");
    check("HTTP 200", r5.status === 200, `status ${r5.status}`);

    const v5 = parseGoogleCompactResponse(r5.body, "auto");
    check("multi-line preserved", v5.text.includes("\n"), JSON.stringify(v5.text.slice(0, 100)));
    check("detected source code is en", v5.sourceCode === "en", v5.sourceCode);
    check("label resolved", v5.sourceLanguage === "İngilizce", v5.sourceLanguage);
    check("same output as the primary endpoint", v5.text.trim() === v1.text.trim(),
        `primary="${v1.text.slice(0, 45)}" fallback="${v5.text.slice(0, 45)}"`);

    check("compact split form joined", parseGoogleCompactResponse('[["bir","en"],["iki","en"]]', "auto").text === "biriki");
    check("compact single form", parseGoogleCompactResponse('[["merhaba","en"]]', "auto").text === "merhaba");

    console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===\n`);
    if (failed > 0) process.exitCode = 1;
}

main().catch(e => {
    console.error("\nCould not run the tests:", e);
    process.exitCode = 1;
});
