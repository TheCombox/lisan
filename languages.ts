/*
 * Lisan — Discord mesaj çevirmeni (Vencord eklentisi)
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Dil tabloları Vencord'un "translate" eklentisinden uyarlanmıştır.
 * Copyright (c) 2023 Vendicated and contributors (GPL-3.0-or-later).
 */

export const GoogleLanguages = {
    "auto": "Algılanan dil",
    "af": "Afrikaanca",
    "sq": "Arnavutça",
    "am": "Amharca",
    "ar": "Arapça",
    "hy": "Ermenice",
    "az": "Azerbaycan Türkçesi",
    "eu": "Baskça",
    "be": "Belarusça",
    "bn": "Bengalce",
    "bs": "Boşnakça",
    "bg": "Bulgarca",
    "ca": "Katalanca",
    "ceb": "Cebuano",
    "zh-CN": "Çince (Basitleştirilmiş)",
    "zh-TW": "Çince (Geleneksel)",
    "co": "Korsikaca",
    "hr": "Hırvatça",
    "cs": "Çekçe",
    "da": "Danca",
    "nl": "Felemenkçe",
    "en": "İngilizce",
    "eo": "Esperanto",
    "et": "Estonca",
    "tl": "Filipince",
    "fi": "Fince",
    "fr": "Fransızca",
    "gl": "Galiçyaca",
    "ka": "Gürcüce",
    "de": "Almanca",
    "el": "Yunanca",
    "gu": "Gucaratça",
    "ht": "Haiti Kreyolu",
    "ha": "Hausaca",
    "haw": "Hawaiice",
    "iw": "İbranice",
    "hi": "Hintçe",
    "hmn": "Hmongca",
    "hu": "Macarca",
    "is": "İzlandaca",
    "ig": "İgboca",
    "id": "Endonezce",
    "ga": "İrlandaca",
    "it": "İtalyanca",
    "ja": "Japonca",
    "jw": "Cavaca",
    "kn": "Kannadaca",
    "kk": "Kazakça",
    "km": "Kmerce",
    "rw": "Kinyarvandaca",
    "ko": "Korece",
    "ku": "Kürtçe (Kurmanci)",
    "ckb": "Kürtçe (Sorani)",
    "ky": "Kırgızca",
    "lo": "Laoca",
    "la": "Latince",
    "lv": "Letonca",
    "lt": "Litvanca",
    "lb": "Lüksemburgca",
    "mk": "Makedonca",
    "mg": "Malgaşça",
    "ms": "Malayca",
    "ml": "Malayalamca",
    "mt": "Maltaca",
    "mi": "Maorice",
    "mr": "Marathice",
    "mn": "Moğolca",
    "my": "Birmanca",
    "ne": "Nepalce",
    "no": "Norveççe",
    "ps": "Peştuca",
    "fa": "Farsça",
    "pl": "Lehçe",
    "pt": "Portekizce",
    "pa": "Pencapça",
    "ro": "Romence",
    "ru": "Rusça",
    "sm": "Samoaca",
    "sr": "Sırpça",
    "st": "Sesotho",
    "sn": "Şonaca",
    "sd": "Sindhice",
    "si": "Sinhala",
    "sk": "Slovakça",
    "sl": "Slovence",
    "so": "Somalice",
    "es": "İspanyolca",
    "su": "Sundaca",
    "sw": "Svahili",
    "sv": "İsveççe",
    "tg": "Tacikçe",
    "ta": "Tamilce",
    "tt": "Tatarca",
    "te": "Teluguca",
    "th": "Tayca",
    "tr": "Türkçe",
    "tk": "Türkmence",
    "uk": "Ukraynaca",
    "ur": "Urduca",
    "ug": "Uygurca",
    "uz": "Özbekçe",
    "vi": "Vietnamca",
    "cy": "Galce",
    "xh": "Xhosaca",
    "yi": "Yidiş",
    "yo": "Yorubaca",
    "zu": "Zuluca"
} as const;

export function languageLabel(code: string): string {
    return (GoogleLanguages as Record<string, string>)[code] ?? code;
}

/** Ayarlarda sunulan ortak diller. Değerler Google kod uzayındadır. */
export const COMMON_LANGUAGES = [
    { value: "tr", label: "Türkçe" },
    { value: "en", label: "İngilizce" },
    { value: "de", label: "Almanca" },
    { value: "fr", label: "Fransızca" },
    { value: "es", label: "İspanyolca" },
    { value: "it", label: "İtalyanca" },
    { value: "ru", label: "Rusça" },
    { value: "ar", label: "Arapça" },
    { value: "fa", label: "Farsça" },
    { value: "az", label: "Azerbaycan Türkçesi" },
    { value: "ja", label: "Japonca" },
    { value: "ko", label: "Korece" },
    { value: "zh-CN", label: "Çince (Basitleştirilmiş)" },
    { value: "pt", label: "Portekizce" },
    { value: "nl", label: "Felemenkçe" },
    { value: "pl", label: "Lehçe" },
    { value: "uk", label: "Ukraynaca" },
    { value: "el", label: "Yunanca" },
    { value: "sv", label: "İsveççe" },
    { value: "no", label: "Norveççe" },
    { value: "da", label: "Danca" },
    { value: "fi", label: "Fince" },
    { value: "cs", label: "Çekçe" },
    { value: "ro", label: "Romence" },
    { value: "hu", label: "Macarca" },
    { value: "bg", label: "Bulgarca" },
    { value: "iw", label: "İbranice" },
    { value: "hi", label: "Hintçe" },
    { value: "id", label: "Endonezce" },
    { value: "vi", label: "Vietnamca" },
    { value: "th", label: "Tayca" }
] as const;

/** Google dil kodunu DeepL koduna çevirir. DeepL'de "algıla" karşılığı boş dizedir. */
export function googleToDeepl(code: string): string {
    switch (code) {
        case "auto": return "";
        case "en": return "en-us";
        case "zh-CN": return "zh-hans";
        case "zh-TW": return "zh-hant";
        case "no": return "no";
        case "iw": return "he";
        case "pt": return "pt-br";
        default: return code;
    }
}

/** DeepL dil kodunu Google koduna çevirir. */
export function deeplToGoogle(code: string): string {
    switch (code) {
        case "": return "auto";
        case "en-us":
        case "en-gb":
            return "en";
        case "zh-hans": return "zh-CN";
        case "zh-hant": return "zh-TW";
        case "nb": return "no";
        case "he": return "iw";
        case "pt-br":
        case "pt-pt":
            return "pt";
        default: return code;
    }
}

/** Sağlayıcının döndürdüğü ham dil kodunu okunabilir bir ad çevirir. */
export function detectedLanguageLabel(provider: "google" | "deepl", raw: string): string {
    if (!raw) return "bilinmeyen";

    const asGoogle = provider === "deepl"
        ? deeplToGoogle(raw.toLowerCase())
        : raw;

    const key = Object.keys(GoogleLanguages).find(k => k.toLowerCase() === asGoogle.toLowerCase());
    return key ? languageLabel(key) : asGoogle;
}
