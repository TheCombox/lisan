/*
 * Lisan — Discord mesaj çevirmeni (Vencord eklentisi)
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Bu dosya ana (main) süreçte çalışır. Ağ istekleri buradan yapılır ki
 * tarayıcı tarafındaki CORS kısıtlamalarına takılmasın.
 */

import { IpcMainInvokeEvent } from "electron";

const TIMEOUT_MS = 15_000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Google'ın iki farklı uç noktası. Biri sınırlarsa diğeri denenir. */
export type GoogleVariant = "gtx" | "compact";

export interface NativeResponse {
    /** HTTP durum kodu; ağ/timeout hatalarında -1 */
    status: number;
    /** Sağlayıcının ham yanıt gövdesi */
    body: string;
    /** Ağ katmanı hatası varsa açıklaması */
    error?: string;
    /** Sunucu "Retry-After" başlığı gönderdiyse saniye cinsinden değeri */
    retryAfter?: number;
}

async function request(url: string, headers: Record<string, string>, body?: string): Promise<NativeResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch(url, {
            method: body == null ? "GET" : "POST",
            headers: {
                "User-Agent": USER_AGENT,
                ...headers
            },
            body,
            signal: controller.signal
        });

        const retryAfterRaw = Number(res.headers.get("retry-after"));

        return {
            status: res.status,
            body: await res.text(),
            retryAfter: Number.isFinite(retryAfterRaw) && retryAfterRaw > 0 ? retryAfterRaw : undefined
        };
    } catch (e) {
        return { status: -1, body: "", error: e instanceof Error ? e.message : String(e) };
    } finally {
        clearTimeout(timer);
    }
}

export function googleTranslate(
    _: IpcMainInvokeEvent,
    variant: GoogleVariant,
    text: string,
    source: string,
    target: string
): Promise<NativeResponse> {
    if (variant === "compact") {
        // Daha hafif ve hızlı; gtx sınırlandığında yedek olarak kullanılır
        const url = "https://clients5.google.com/translate_a/t?" + new URLSearchParams({
            client: "dict-chrome-ex",
            sl: source || "auto",
            tl: target,
            q: text
        }).toString();

        return request(url, {});
    }

    const url = "https://translate.googleapis.com/translate_a/single?" + new URLSearchParams({
        client: "gtx",
        sl: source || "auto",
        tl: target,
        dt: "t",
        q: text
    }).toString();

    return request(url, {});
}

export function deeplTranslate(
    _: IpcMainInvokeEvent,
    pro: boolean,
    apiKey: string,
    text: string,
    source: string,
    target: string
): Promise<NativeResponse> {
    const url = pro
        ? "https://api.deepl.com/v2/translate"
        : "https://api-free.deepl.com/v2/translate";

    const payload: Record<string, unknown> = { text: [text], target_lang: target };
    if (source) payload.source_lang = source;

    return request(url, {
        "Content-Type": "application/json",
        "Authorization": `DeepL-Auth-Key ${apiKey}`
    }, JSON.stringify(payload));
}
