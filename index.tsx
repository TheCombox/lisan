/*
 * Lisan — Discord mesaj çevirmeni (Vencord eklentisi)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import definePlugin from "@utils/types";
import { Message } from "@vencord/discord-types";
import { ChannelStore, Menu, showToast } from "@webpack/common";

import { AutoTranslateChatBarButton } from "./AutoTranslateButton";
import { LisanIcon } from "./LisanIcon";
import { settings } from "./settings";
import { getMessageContent, showTranslation, TranslationAccessory } from "./TranslationAccessory";
import { translate } from "./translate";

async function translateMessage(message: Message, silent = false) {
    const content = getMessageContent(message);
    if (!content.trim()) return;

    try {
        const value = await translate(content, { silent });

        // Kaynak metinle birebir aynıysa mesaj zaten hedef dilde
        if (value.text.trim() === content.trim()) {
            if (!silent) showToast({ text: "Bu mesaj zaten hedef dilde görünüyor." });
            return;
        }

        showTranslation(message.id, value);
    } catch {
        // Hata translate() içinde bildirildi
    }
}

const messageContextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    const message = props?.message as Message | undefined;
    if (!message || !getMessageContent(message).trim()) return;

    const group = findGroupChildrenByChildId("copy-text", children);
    if (!group) return;

    const index = group.findIndex(c => c?.props?.id === "copy-text");
    if (index === -1) return;

    group.splice(index + 1, 0, (
        <Menu.MenuItem
            id="lisan-translate-message"
            label="Lisan ile çevir"
            icon={LisanIcon}
            leadingAccessory={{ type: "icon", icon: LisanIcon }}
            action={() => void translateMessage(message)}
        />
    ));
};

export default definePlugin({
    name: "Lisan",
    description: "Mesajları Google Çeviri veya DeepL ile çevirir, seçtiğin kanallarda gelen mesajları otomatik çevirir.",
    tags: ["Chat", "Utility"],
    authors: [{ name: "TheCombox", id: 0n }],
    searchTerms: ["translate", "translation", "çeviri", "lisan", "deepl", "google"],
    settings,

    contextMenus: {
        message: messageContextMenuPatch
    },

    chatBarButton: {
        icon: LisanIcon,
        render: AutoTranslateChatBarButton
    },

    messagePopoverButton: {
        icon: LisanIcon,
        render(message: Message) {
            if (!getMessageContent(message).trim()) return null;

            return {
                label: "Lisan ile çevir",
                icon: LisanIcon,
                message,
                channel: ChannelStore.getChannel(message.channel_id),
                onClick: () => void translateMessage(message)
            };
        }
    },

    renderMessageAccessory: props => <TranslationAccessory message={props.message} />
});
