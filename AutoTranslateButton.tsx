/*
 * Lisan — Discord mesaj çevirmeni (Vencord eklentisi)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";

import { LisanIcon } from "./LisanIcon";
import { settings } from "./settings";
import { isAutoEnabled, toggleAuto } from "./state";

/**
 * Mesaj kutusundaki düğme: bulunduğun kanalda otomatik çeviriyi açar/kapatır.
 */
export const AutoTranslateChatBarButton: ChatBarButtonFactory = ({ channel }) => {
    // Sayaç yalnızca düğmenin yeniden çizilmesini tetiklemek için dinleniyor
    settings.use(["autoRev"]);

    if (!channel) return null;

    const enabled = isAutoEnabled(channel.id);

    return (
        <ChatBarButton
            tooltip={enabled
                ? "Lisan: bu kanalda otomatik çeviri AÇIK — kapatmak için tıkla"
                : "Lisan: bu kanalda gelen mesajları otomatik çevir"}
            onClick={() => toggleAuto(channel.id)}
        >
            <LisanIcon className={enabled ? "lisan-chat-button lisan-chat-button--active" : "lisan-chat-button"} />
        </ChatBarButton>
    );
};
