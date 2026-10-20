/*
 * Lisan — Discord mesaj çevirmeni (Vencord eklentisi)
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Kanal bazlı otomatik çeviri durumu. Ayarlar deposuna doğrudan erişir;
 * böylece settings.tsx ile arasında döngüsel içe aktarma oluşmaz.
 */

import { Settings } from "@api/Settings";

const PLUGIN_NAME = "Lisan";

/** Kanal kimliği -> otomatik çevirinin açıldığı an (epoch ms) */
export type AutoChannels = Record<string, number>;

function store(): Record<string, any> {
    return Settings.plugins[PLUGIN_NAME] as Record<string, any>;
}

export function getAutoChannels(): AutoChannels {
    return (store()?.autoChannels as AutoChannels) ?? {};
}

export function isAutoEnabled(channelId: string): boolean {
    return getAutoChannels()[channelId] != null;
}

/** Kanalda otomatik çevirinin açıldığı an. Kapalıysa undefined. */
export function autoEnabledAt(channelId: string): number | undefined {
    return getAutoChannels()[channelId];
}

export function autoChannelCount(): number {
    return Object.keys(getAutoChannels()).length;
}

function commit(next: AutoChannels) {
    const s = store();
    s.autoChannels = next;
    // Düğmelerin yeniden çizilmesini sağlayan sürüm sayacı
    s.autoRev = (s.autoRev ?? 0) + 1;
}

export function setAuto(channelId: string, enabled: boolean) {
    const next = { ...getAutoChannels() };

    if (enabled) next[channelId] = Date.now();
    else delete next[channelId];

    commit(next);
}

export function toggleAuto(channelId: string): boolean {
    const enabled = !isAutoEnabled(channelId);
    setAuto(channelId, enabled);
    return enabled;
}

/** Tüm kanallarda otomatik çeviriyi kapatır ve kapatılan kanal sayısını döner. */
export function disableAllAuto(): number {
    const count = autoChannelCount();
    commit({});
    return count;
}
