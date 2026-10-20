/*
 * Lisan — Google Çeviri hız sınırı tarayıcısı
 *
 * 429'un hangi durumda tetiklendigini olcmek icin. Kalici bir teshis aracidir.
 *   node test/hiz-limiti-tara.mjs
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function gtx(text) {
    return "https://translate.googleapis.com/translate_a/single?" + new URLSearchParams({
        client: "gtx", sl: "auto", tl: "tr", dt: "t", q: text
    }).toString();
}

async function tek(url, ua = UA) {
    const t0 = Date.now();
    try {
        const res = await fetch(url, ua ? { headers: { "User-Agent": ua } } : undefined);
        await res.text();
        return { kod: res.status, ms: Date.now() - t0 };
    } catch (e) {
        return { kod: "ERR:" + e.message.slice(0, 30), ms: Date.now() - t0 };
    }
}

function ozet(ad, sonuclar) {
    const kodlar = sonuclar.map(r => r.kod);
    const sayim = {};
    for (const k of kodlar) sayim[k] = (sayim[k] ?? 0) + 1;
    const enUzun = Math.max(...sonuclar.map(r => r.ms));
    const toplam = sonuclar.reduce((a, r) => a + r.ms, 0);
    console.log(`  ${ad}`);
    console.log(`    kodlar: ${JSON.stringify(sayim)}`);
    console.log(`    toplam sure: ${toplam} ms, en yavas istek: ${enUzun} ms`);
    return sayim;
}

console.log("\n=== 1) 10 paralel istek (es zamanli) ===");
{
    const sonuclar = await Promise.all(
        Array.from({ length: 10 }, (_, i) => tek(gtx(`parallel test ${i} unique text alpha`)))
    );
    ozet("10 es zamanli", sonuclar);
}

console.log("\n=== 2) 40 ardisik istek, beklemesiz ===");
{
    const sonuclar = [];
    for (let i = 0; i < 40; i++) {
        sonuclar.push(await tek(gtx(`sequential no delay ${i} beta gamma`)));
    }
    ozet("40 ardisik", sonuclar);
}

console.log("\n=== 3) Cok uzun tek metin (~1900 karakter) ===");
{
    const uzun = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} about testing translation limits.`).join(" ");
    console.log(`    metin uzunlugu: ${uzun.length}`);
    const r = await tek(gtx(uzun));
    console.log(`    kod: ${r.kod}, sure: ${r.ms} ms`);
}

console.log("\n=== 4) 10 paralel, User-Agent YOK ===");
{
    const sonuclar = await Promise.all(
        Array.from({ length: 10 }, (_, i) => tek(gtx(`no user agent test ${i} delta`), null))
    );
    ozet("10 es zamanli (UA yok)", sonuclar);
}

console.log("\n=== 5) 30 paralel istek (asiri yuk) ===");
{
    const sonuclar = await Promise.all(
        Array.from({ length: 30 }, (_, i) => tek(gtx(`heavy load test ${i} epsilon zeta`)))
    );
    ozet("30 es zamanli", sonuclar);
}

console.log("\n=== 6) clients5.google.com yedegi, 30 paralel ===");
{
    const sonuclar = await Promise.all(
        Array.from({ length: 30 }, (_, i) => tek(
            "https://clients5.google.com/translate_a/t?" + new URLSearchParams({
                client: "dict-chrome-ex", sl: "auto", tl: "tr", q: `fallback host test ${i} eta theta`
            }).toString()
        ))
    );
    ozet("clients5 30 es zamanli", sonuclar);
}
