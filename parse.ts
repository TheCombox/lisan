/*
 * Lisan — Discord mesaj çevirmeni (Vencord eklentisi)
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Sağlayıcı yanıtlarını çeviri değerine dönüştüren saf katman.
 * Discord'a ya da Vencord'a bağımlı değildir; bu yüzden Discord dışında da
 * gerçek API yanıtlarıyla test edilebilir.
 */

import { deeplToGoogle, detectedLanguageLabel } from "./languages";

export interface TranslationValue {
    /** Çevrilmiş metin */
    text: string;
    /** Kaynak dilin kod uzayındaki hali (Google kodları) */
    sourceCode: string;
    /** Kaynak dilin okunabilir adı */
    sourceLanguage: string;
}

/** Google'ın translate_a/single yanıtını ayrıştırır. */
export function parseGoogleResponse(body: string, fallbackSource: string): TranslationValue {
    let parsed: any;
    try {
        parsed = JSON.parse(body);
    } catch {
        throw new Error("Google Çeviri yanıtı okunamadı.");
    }

    const segments = parsed?.[0];
    if (!Array.isArray(segments)) throw new Error("Google Çeviri beklenmeyen bir yanıt döndürdü.");

    // Uzun metinler birden fazla parçaya bölünür; hepsi birleştirilir
    const text: string = segments
        .map((segment: any[]) => segment?.[0] ?? "")
        .join("");

    if (!text.trim()) throw new Error("Çeviri boş döndü.");

    const detected: string = typeof parsed?.[2] === "string" ? parsed[2] : fallbackSource;

    return {
        text,
        sourceCode: detected,
        sourceLanguage: detectedLanguageLabel("google", detected)
    };
}

function extractCompact(value: any): { text: string; detected?: string; } | null {
    if (typeof value === "string") return { text: value };
    if (!Array.isArray(value)) return null;

    // [metin, dil] biçimi
    if (typeof value[0] === "string") {
        return { text: value[0], detected: typeof value[1] === "string" ? value[1] : undefined };
    }

    // Parçalı biçim: [[metin, dil], [metin, dil], ...]
    const parcalar: string[] = [];
    let detected: string | undefined;

    for (const item of value) {
        const inner = extractCompact(item);
        if (!inner) continue;
        parcalar.push(inner.text);
        detected ??= inner.detected;
    }

    return parcalar.length ? { text: parcalar.join(""), detected } : null;
}

/** Google'ın hafif (clients5) yanıtını ayrıştırır. Biçim: [["çeviri","en"]] */
export function parseGoogleCompactResponse(body: string, fallbackSource: string): TranslationValue {
    let parsed: any;
    try {
        parsed = JSON.parse(body);
    } catch {
        throw new Error("Google Çeviri yanıtı okunamadı.");
    }

    const sonuc = extractCompact(parsed);
    if (!sonuc || !sonuc.text.trim()) throw new Error("Çeviri boş döndü.");

    const detected = sonuc.detected || fallbackSource;

    return {
        text: sonuc.text,
        sourceCode: detected,
        sourceLanguage: detectedLanguageLabel("google", detected)
    };
}

/** DeepL'in /v2/translate yanıtını ayrıştırır. */
export function parseDeeplResponse(body: string, fallbackSource: string): TranslationValue {
    let parsed: any;
    try {
        parsed = JSON.parse(body);
    } catch {
        throw new Error("DeepL yanıtı okunamadı.");
    }

    const first = parsed?.translations?.[0];
    if (!first?.text) throw new Error("DeepL boş bir çeviri döndürdü.");

    const detectedRaw = String(first.detected_source_language ?? "").toLowerCase();

    return {
        text: first.text,
        sourceCode: detectedRaw ? deeplToGoogle(detectedRaw) : fallbackSource,
        sourceLanguage: detectedLanguageLabel("deepl", detectedRaw)
    };
}
