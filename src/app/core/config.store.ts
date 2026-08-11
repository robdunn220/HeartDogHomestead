/** Site settings served from /api/config: shipping rates, charity, payment mode. */

import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import type { SiteConfig } from './models';

const FALLBACK: SiteConfig = {
  paymentsEnabled: false,
  currency: 'usd',
  shippingCents: 495,
  freeShippingThresholdCents: 3500,
  charity: {
    name: 'Your Local Dog Rescue',
    tagline: 'Second chances for dogs waiting on their people.',
    donateUrl: 'https://example.org/donate',
    siteUrl: 'https://example.org',
    ein: '',
  },
};

@Injectable({ providedIn: 'root' })
export class ConfigStore {
  private readonly api = inject(ApiService);

  private readonly configSignal = signal<SiteConfig>(FALLBACK);
  readonly config = this.configSignal.asReadonly();

  private inFlight: Promise<SiteConfig> | null = null;
  private loaded = false;

  async load(): Promise<SiteConfig> {
    if (this.loaded) return this.configSignal();

    this.inFlight ??= firstValueFrom(this.api.config())
      .then((config) => {
        this.configSignal.set(config);
        this.loaded = true;
        return config;
      })
      .catch(() => FALLBACK)
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }
}
