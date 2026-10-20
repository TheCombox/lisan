/*
 * Lisan — Discord mesaj çevirmeni (Vencord eklentisi)
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Çeviri çekirdeği: sağlayıcı seçimi, önbellek, istek hızı sınırlama,
 * 429/5xx için yeniden deneme + yedek uç nokta ve hata durumunda Google'a düşme.
 */

import { Logger } from "@utils/Logger";
import { onlyOnce } from "@utils/onlyOnce";
import { PluginNative } from "@utils/types";
import { showToast, Toasts } from "@webpack/common";

import { googleToDeepl } from "./languages";
import { parseDeeplResponse, parseGoogleCompactResponse, parseGoogleResponse, TranslationValue } from "./parse";
import { settings } from "./settings";

const logger = new Logger("Lisan");

const Native = VencordNative.pluginHelpers.Lisan as PluginNative<typeof import("./native")>;

export type { TranslationValue };

export interface TranslateOptions {
    /** true ise hata bildirimi gösterilmez (otomatik çeviri için) */
    silent?: boolean;
}

const CACHE_LIMIT = 500;

/** Aynı anda uçabilecek en fazla istek. Google'ı yormamak için düşük tutuluyor. */
const MAX_CONCURRENT = 2;
/** İki isteğin başlangıcı arasındaki en kısa süre. */
const MIN_GAP_MS = 200;
/** Tek bir uç noktada 429/5xx alınca kaç kez denenecek. */
const MAX_ATTEMPTS = 2;
const BASE_BACKOFF_MS = 700;
const MAX_BACKOFF_MS = 10_000;
/** Art arda sınırlama görünce otomatik çevirinin duraklatılma süresi. */
const COOLDOWN_MS = 60_000;

/** Sırayla denenen Google uç noktaları. İlki sınırlarsa ikincisine geçilir. */
const GOOGLE_ENDPOINTS: Array<{ variant: "gtx" | "compact"; ad: string; }> = [
    { variant: "gtx", ad: "translate.googleapis.com" },
    { variant: "compact", ad: "clients5.google.com" }
];

const cache = new Map<string, TranslationValue>();
const inFlight = new Map<string, Promise<TranslationValue>>();

let active = 0;
const beklemeSirasi: Array<() => void> = [];
let sonBaslangic = 0;

let cooldownUntil = 0;
let cooldownUyarildi = false;

function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function hataMetni(e: unknown) {
    return e instanceof Error ? e.message : String(e);
}

function sinirlandiMi(status: number) {
    return status === 429 || status === 503 || status === 502;
}

/** Yeniden denemeden önce ne kadar bekleneceği. */
function beklemeSuresi(retryAfter: number | undefined, attempt: number) {
    if (retryAfter) return Math.min(retryAfter * 1000, MAX_BACKOFF_MS);
    const artan = BASE_BACKOFF_MS * 2 ** (attempt - 1);
    return Math.min(artan + Math.random() * 250, MAX_BACKOFF_MS);
}

async function slotAl() {
    if (active < MAX_CONCURRENT) {
        active++;
    } else {
        await new Promise<void>(resolve => beklemeSirasi.push(resolve));
    }

    // Kendi isteklerimizi de aralıklı gönderiyoruz
    const bekle = sonBaslangic + MIN_GAP_MS - Date.now();
    if (bekle > 0) await sleep(bekle);
    sonBaslangic = Date.now();
}

function slotBirak() {
    const next = beklemeSirasi.shift();
    // Slot doğrudan sıradakine devredilir, sayaç değişmez
    if (next) next();
    else active--;
}

function cooldownKalan() {
    return Math.max(0, cooldownUntil - Date.now());
}

function cooldownBaslat() {
    cooldownUntil = Date.now() + COOLDOWN_MS;

    if (!cooldownUyarildi) {
        cooldownUyarildi = true;
        showToast(
            "Google Çeviri istekleri sınırladı. Otomatik çeviri bir süre duraklatıldı.",
            Toasts.Type.FAILURE
        );
        setTimeout(() => { cooldownUyarildi = false; }, COOLDOWN_MS + 500);
    }
}

export function clearCache() {
    cache.clear();
    inFlight.clear();
}

export function cacheSize(): number {
    return cache.size;
}

const warnMissingDeeplKey = onlyOnce(
    () => showToast("DeepL API anahtarı girilmemiş. Google Çeviri kullanılıyor.", Toasts.Type.FAILURE)
);

const warnDeeplQuota = onlyOnce(
    () => showToast("DeepL kotası doldu. Google Çeviri kullanılıyor.", Toasts.Type.FAILURE)
);

async function googleTranslate(text: string, source: string, target: string): Promise<TranslationValue> {
    const sorunlar: string[] = [];

    for (const endpoint of GOOGLE_ENDPOINTS) {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            const res = await Native.googleTranslate(endpoint.variant, text, source, target);

            if (res.status === 200) {
                try {
                    return endpoint.variant === "compact"
                        ? parseGoogleCompactResponse(res.body, source)
                        : parseGoogleResponse(res.body, source);
                } catch (e) {
                    sorunlar.push(`${endpoint.ad}: ${hataMetni(e)}`);
                    break;
                }
            }

            if (res.status === -1) {
                sorunlar.push(`${endpoint.ad}: ağ hatası (${res.error ?? "bilinmiyor"})`);
                break;
            }

            sorunlar.push(`${endpoint.ad}: HTTP ${res.status}`);

            if (sinirlandiMi(res.status) && attempt < MAX_ATTEMPTS) {
                await sleep(beklemeSuresi(res.retryAfter, attempt));
                continue;
            }

            // Bu uç nokta tükendi, sıradakine geç
            break;
        }
    }

    logger.error("Google Çeviri başarısız:", sorunlar.join(" | "));
    cooldownBaslat();

    throw new Error(
        "Google Çeviri şu an istekleri sınırlıyor (429). "
        + "Birkaç saniye sonra tekrar dene. Kalıcı çözüm için Lisan ayarlarından DeepL anahtarı girebilirsin."
    );
}

async function deeplTranslate(pro: boolean, text: string, source: string, target: string): Promise<TranslationValue> {
    const apiKey = String(settings.store.deeplApiKey ?? "").trim();
    if (!apiKey) {
        warnMissingDeeplKey();
        return googleTranslate(text, source, target);
    }

    const targetLang = googleToDeepl(target).toUpperCase();
    const sourceLang = source === "auto" ? "" : googleToDeepl(source).toUpperCase();

    const res = await Native.deeplTranslate(pro, apiKey, text, sourceLang, targetLang);

    if (res.status === -1) throw new Error(`DeepL'e bağlanılamadı: ${res.error ?? "bilinmeyen hata"}`);
    if (res.status === 403) throw new Error("DeepL API anahtarı geçersiz ya da yanlış sürüm seçili (Free/Pro).");
    if (res.status === 456 || res.status === 429) {
        warnDeeplQuota();
        return googleTranslate(text, source, target);
    }
    if (res.status === 503) throw new Error("DeepL şu an istekleri sınırlıyor. Birazdan tekrar dene.");
    if (res.status !== 200) throw new Error(`DeepL hatası (${res.status}): ${res.body.slice(0, 200)}`);

    return parseDeeplResponse(res.body, source);
}

async function run(text: string, source: string, target: string, silent: boolean): Promise<TranslationValue> {
    // Otomatik çeviri, sınırlama sürerken hiç istek atmasın
    if (silent) {
        const kalan = cooldownKalan();
        if (kalan > 0) throw new Error("Google Çeviri geçici olarak duraklatıldı.");
    }

    await slotAl();
    try {
        const service = settings.store.service;

        if (service === "deepl" || service === "deeplPro") {
            return await deeplTranslate(service === "deeplPro", text, source, target);
        }

        return await googleTranslate(text, source, target);
    } finally {
        slotBirak();
    }
}

/**
 * Metni hedef dile çevirir. Sonuçlar önbelleğe alınır ve aynı metin için
 * yapılan eşzamanlı istekler tekilleştirilir.
 */
export function translate(text: string, opts: TranslateOptions = {}): Promise<TranslationValue> {
    const target = String(settings.store.targetLanguage ?? "tr");
    const source = String(settings.store.sourceLanguage ?? "auto");
    const key = `${settings.store.service}|${source}|${target}|${text}`;

    const cached = cache.get(key);
    if (cached) return Promise.resolve(cached);

    const pending = inFlight.get(key);
    if (pending) return pending;

    const promise = run(text, source, target, opts.silent === true)
        .then(value => {
            if (cache.size >= CACHE_LIMIT) {
                const oldest = cache.keys().next().value;
                if (oldest !== undefined) cache.delete(oldest);
            }
            cache.set(key, value);
            return value;
        })
        .catch((e: unknown) => {
            logger.error("Çeviri başarısız:", e);
            // Otomatik modda sessiz kal; kullanıcıya yalnızca elle çeviride bildir
            if (!opts.silent && !(e instanceof Error && e.message === "Google Çeviri geçici olarak duraklatıldı.")) {
                showToast(hataMetni(e), Toasts.Type.FAILURE);
            }
            throw e;
        })
        .finally(() => {
            inFlight.delete(key);
        });

    inFlight.set(key, promise);
    return promise;
}
