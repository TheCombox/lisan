/*
 * Lisan — Discord mesaj çevirmeni (Vencord eklentisi)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { OptionType } from "@utils/types";
import { showToast } from "@webpack/common";

import { COMMON_LANGUAGES } from "./languages";
import { autoChannelCount, disableAllAuto } from "./state";

export const settings = definePluginSettings({
    service: {
        type: OptionType.SELECT,
        description: "Çeviri motoru",
        options: [
            { label: "Google Çeviri — ücretsiz, anahtar gerekmez", value: "google", default: true },
            { label: "DeepL — API anahtarı gerekir", value: "deepl" },
            { label: "DeepL Pro — API anahtarı gerekir", value: "deeplPro" }
        ] as const
    },
    deeplApiKey: {
        type: OptionType.STRING,
        description: "DeepL API anahtarın. Anahtar boşsa Lisan Google Çeviri'ye düşer.",
        default: ""
    },
    targetLanguage: {
        type: OptionType.SELECT,
        description: "Çevirilerin hedef dili",
        options: COMMON_LANGUAGES.map(l => ({
            label: l.label,
            value: l.value,
            default: l.value === "tr"
        }))
    },
    sourceLanguage: {
        type: OptionType.SELECT,
        description: "Kaynak dil",
        options: [
            { label: "Otomatik algıla", value: "auto", default: true },
            ...COMMON_LANGUAGES.map(l => ({ label: l.label, value: l.value }))
        ]
    },
    autoTranslateIncoming: {
        type: OptionType.BOOLEAN,
        description: "Otomatik çeviri için genel ana anahtar. Kapatırsan kanal bazlı ayarlar korunur ama çeviri yapılmaz.",
        default: true
    },
    manageAutoChannels: {
        type: OptionType.COMPONENT,
        component: () => {
            const count = autoChannelCount();

            return (
                <Button
                    onClick={() => {
                        if (count === 0) {
                            showToast({ text: "Lisan: otomatik çeviri açık kanal yok." });
                            return;
                        }
                        const disabled = disableAllAuto();
                        showToast({ text: `Lisan: ${disabled} kanalda otomatik çeviri kapatıldı.`, variant: "success" });
                    }}
                >
                    {count === 0
                        ? "Otomatik çeviri açık kanal yok"
                        : `Otomatik çeviriyi ${count} kanalda kapat`}
                </Button>
            );
        }
    },
    autoChannels: {
        type: OptionType.CUSTOM,
        default: {} as Record<string, number>
    },
    autoRev: {
        type: OptionType.NUMBER,
        description: "Yalnızca arayüzü tazelemek için kullanılan iç sayaç.",
        default: 0,
        hidden: true
    }
});
