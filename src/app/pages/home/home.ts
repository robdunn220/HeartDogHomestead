import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';

import { ApiService } from '../../core/api.service';
import { ConfigStore } from '../../core/config.store';
import type { Product } from '../../core/models';
import { ProductCard } from '../../shared/product-card';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly api = inject(ApiService);
  protected readonly configStore = inject(ConfigStore);

  protected readonly featured = signal<Product[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    this.api.products().subscribe({
      next: ({ products }) => {
        // Lead with the grower's picks, then fill the row out to six.
        const picks = products.filter((p) => p.featured);
        const rest = products.filter((p) => !p.featured);
        this.featured.set([...picks, ...rest].slice(0, 6));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
