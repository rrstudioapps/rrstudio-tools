// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 rrstudio — rrstudio tools
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CopyButton } from '../../shared/copy-button';
import { saveBytes } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { IoPanel } from '../../shared/io-panel';
import { PrivacyNote } from '../../shared/privacy-note';
import { SendTo } from '../../shared/send-to';
import { ShareLink, applyShare, snapshotShare } from '../../shared/share-link';
import type { ShareData } from '../../shared/share-state';
import { DockerWarning, generateCompose, parseDockerRun } from './docker';
import { DOCKER_DICTIONARIES } from './docker-run-to-compose.i18n';
import { SHARE_SCHEMA } from './docker-run-to-compose.share';
import { ToolHandoff } from '../../shared/tool-handoff';

/** Esempio: un database con volume e una web app con rete esterna. */
export const SAMPLE_DOCKER = `docker run -d --name db --restart unless-stopped \\
  -e POSTGRES_PASSWORD=change-me -v pgdata:/var/lib/postgresql/data \\
  --health-cmd 'pg_isready -U postgres' --health-interval 10s postgres:16

docker run -d --name web -p 8080:80 --read-only --cap-drop ALL \\
  --security-opt no-new-privileges -m 128m --network proxy nginx:alpine`;

@Component({
  selector: 'app-docker-run-to-compose',
  imports: [CopyButton, Icon, IoPanel, PrivacyNote, SendTo, ShareLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './docker-run-to-compose.page.html',
  styleUrl: './docker-run-to-compose.page.scss',
})
export class DockerRunToComposePage {
  protected readonly i18n = inject(I18nService);

  protected readonly command = signal('');

  private readonly parsed = computed(() => (this.command().trim() === '' ? null : parseDockerRun(this.command())));
  protected readonly error = computed(() => {
    const p = this.parsed();
    return p && !p.ok ? this.i18n.t('docker.err.' + p.error) : '';
  });
  protected readonly yaml = computed(() => {
    const p = this.parsed();
    return p?.ok ? generateCompose(p.result, { externalNetworkComment: this.i18n.t('docker.comment.network') }) : '';
  });
  protected readonly warnings = computed(() => {
    const p = this.parsed();
    return p?.ok ? p.result.warnings.map((w) => this.text(w)) : [];
  });
  protected readonly serviceCount = computed(() => {
    const p = this.parsed();
    return p?.ok ? p.result.services.length : 0;
  });

  private text(w: DockerWarning): string {
    const msg = this.i18n.t('docker.warn.' + w.code, { p: w.param ?? '' });
    return w.service ? `${w.service}: ${msg}` : msg;
  }

  protected loadSample(): void {
    this.command.set(SAMPLE_DOCKER);
  }
  protected clearAll(): void {
    this.command.set('');
  }
  protected download(): void {
    const y = this.yaml();
    if (y) saveBytes(new TextEncoder().encode(y), 'docker-compose.yml', 'text/yaml');
  }

  protected readonly shareSchema = SHARE_SCHEMA;
  private readonly shared = { command: this.command };
  protected readonly shareState = (): ShareData => snapshotShare(this.shared);
  protected restoreShared(data: ShareData): void {
    applyShare(data, this.shared);
  }

  constructor() {
    this.i18n.register(DOCKER_DICTIONARIES);
    const rx = inject(ToolHandoff).take('docker-run-to-compose');
    if (rx?.text !== undefined) this.command.set(rx.text);
  }
}
