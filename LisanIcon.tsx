/*
 * Lisan — Discord mesaj çevirmeni (Vencord eklentisi)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IconComponent } from "@utils/types";
import { classes } from "@utils/misc";

/**
 * Lisan'ın kendi simgesi: konuşma baloncuğu içinde "A" ve bir Uzak Doğu
 * karakteri — çeviri fikrini doğrudan anlatır.
 */
export const LisanIcon: IconComponent = ({ height = 20, width = 20, className }) => (
    <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        height={height}
        width={width}
        className={classes("lisan-icon", className)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <rect x="2.6" y="4.2" width="18.8" height="13.6" rx="3.4" />
        <path d="M7.4 17.8v3.4l3.1-3.4" />
        <path d="M6.5 13.9 8.35 9.4l1.85 4.5" />
        <path d="M7.06 12.55h2.58" />
        <path d="M13.85 9.5h4.9" />
        <path d="M16.3 9.5v4.5" />
        <path d="M13.85 13.95h4.9" />
    </svg>
);
