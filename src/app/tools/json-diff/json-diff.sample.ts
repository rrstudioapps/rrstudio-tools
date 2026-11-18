// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio Tools

/** Esempio del pulsante «Carica esempio»: dati inventati, con modifiche, un tipo cambiato e utenti riordinati. */
export const SAMPLE_A = `{
  "name": "rr-shop",
  "version": "1.4.0",
  "port": "8080",
  "tags": ["web", "shop"],
  "owner": { "name": "Anna", "email": "anna@example.com" },
  "limits": { "rate": 100, "burst": 1.5 },
  "users": [
    { "id": 1, "name": "Anna", "role": "admin" },
    { "id": 2, "name": "Luca", "role": "editor" },
    { "id": 3, "name": "Sara", "role": "viewer" }
  ],
  "legacy": true
}
`;

export const SAMPLE_B = `{
  "name": "rr-shop",
  "port": 8080,
  "version": "1.5.0",
  "tags": ["web", "shop", "new"],
  "owner": { "name": "Anna", "email": "anna@example.org" },
  "limits": { "rate": 100, "burst": 1.5 },
  "users": [
    { "id": 3, "name": "Sara", "role": "viewer" },
    { "id": 1, "name": "Anna", "role": "admin" },
    { "id": 2, "name": "Luca", "role": "viewer" },
    { "id": 4, "name": "Marco", "role": "editor" }
  ],
  "meta": { "updated": "2026-11-18" }
}
`;
