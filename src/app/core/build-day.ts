// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { isPlatformServer } from '@angular/common';
import { Injectable, PLATFORM_ID, TransferState, inject, makeStateKey } from '@angular/core';
import { isoDay, latestChangelogDay } from './changelog.logic';

const KEY = makeStateKey<string>('buildDay');

/**
 * Giorno (AAAA-MM-GG) della build. Lo fissa il prerender e il browser lo rilegge dallo stato trasferito:
 * il client non usa il proprio orologio, quindi il badge «Nuovo» non crea differenze in idratazione.
 * Senza stato (pagina non prerenderizzata) ripiega sul giorno dell'ultima versione del changelog.
 */
@Injectable({ providedIn: 'root' })
export class BuildDay {
  readonly day: string;

  constructor() {
    const state = inject(TransferState);
    if (isPlatformServer(inject(PLATFORM_ID))) {
      this.day = isoDay(Date.now());
      state.set(KEY, this.day);
    } else {
      this.day = state.get(KEY, latestChangelogDay());
    }
  }
}
