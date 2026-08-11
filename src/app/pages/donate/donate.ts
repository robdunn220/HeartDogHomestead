import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ConfigStore } from '../../core/config.store';

@Component({
  selector: 'app-donate',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './donate.html',
  styleUrl: './donate.css',
})
export class Donate {
  private readonly configStore = inject(ConfigStore);

  protected readonly charity = computed(() => this.configStore.config().charity);

  /** Bare host name, so the link text reads as a place rather than a URL. */
  protected readonly displayHost = computed(() => {
    try {
      return new URL(this.charity().siteUrl).host.replace(/^www\./, '');
    } catch {
      return this.charity().siteUrl;
    }
  });
}
