/*
 * Lisan — Discord mesaj çevirmeni (Vencord eklentisi)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Message } from "@vencord/discord-types";
import { Parser, UserStore, useEffect, useState } from "@webpack/common";

import { LisanIcon } from "./LisanIcon";
import { TranslationValue } from "./parse";
import { settings } from "./settings";
import { autoEnabledAt } from "./state";
import { translate } from "./translate";

const setters = new Map<string, (value: TranslationValue) => void>();

/** Elle çevrilen bir sonucu, o mesajın altındaki göstergede açar. */
export function showTranslation(messageId: string, value: TranslationValue) {
    setters.get(messageId)?.(value);
}

/** Bir mesajın çevrilebilir metnini döner. */
export function getMessageContent(message: Message): string {
    return message.content
        || message.messageSnapshots?.[0]?.message.content
        || "";
}

export function TranslationAccessory({ message }: { message: Message; }) {
    const [value, setValue] = useState<TranslationValue>();

    useEffect(() => {
        setters.set(message.id, setValue);
        return () => void setters.delete(message.id);
    }, [message.id]);

    useEffect(() => {
        if ((message as any).vencordEmbeddedBy) return;
        // Genel ana anahtar kapalıysa hiçbir şey yapma
        if (!settings.store.autoTranslateIncoming) return;
        // Kanalda otomatik çeviri açık değilse hiçbir şey yapma
        const enabledAt = autoEnabledAt(message.channel_id);
        if (enabledAt == null) return;
        // Otomatik çeviri açılmadan önceki mesajları kapsamıyoruz
        if (!message.timestamp || message.timestamp.getTime() < enabledAt) return;
        // Kendi mesajlarımızı çevirmeye gerek yok
        if (message.author?.id != null && message.author.id === UserStore.getCurrentUser()?.id) return;

        const content = getMessageContent(message);
        if (!content.trim()) return;

        let cancelled = false;

        translate(content, { silent: true })
            .then(result => {
                if (cancelled) return;
                // Mesaj zaten hedef dildeyse göstergede tekrar etme
                if (result.text.trim() === content.trim()) return;
                setValue(result);
            })
            .catch(() => { /* otomatik modda sessizce yut */ });

        return () => { cancelled = true; };
    }, [message.id]);

    if (!value) return null;

    return (
        <span className="lisan-accessory">
            <LisanIcon width={16} height={16} className="lisan-accessory-icon" />
            <span className="lisan-accessory-text">{Parser.parse(value.text)}</span>
            <span className="lisan-accessory-meta">
                ({value.sourceLanguage})
                <button
                    type="button"
                    className="lisan-accessory-dismiss"
                    onClick={() => setValue(undefined)}
                >
                    gizle
                </button>
            </span>
        </span>
    );
}
