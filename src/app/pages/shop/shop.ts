import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { ApiService } from '../../core/api.service';
import type { Product } from '../../core/models';
import { ProductCard } from '../../shared/product-card';

@Component({
  selector: 'app-shop',
  imports: [ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shop.html',
  styleUrl: './shop.css',
})
export class Shop {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly allProducts = signal<Product[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  /** Category comes from the URL so the filter survives a refresh or a shared link. */
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly category = computed(() => this.queryParams().get('category') ?? 'All');
  protected readonly search = signal('');

  protected readonly categories = computed(() => {
    const counts = new Map<string, number>();
    for (const product of this.allProducts()) {
      counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    }
    return [
      { name: 'All', count: this.allProducts().length },
      ...[...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ];
  });

  protected readonly visible = computed(() => {
    const category = this.category();
    const term = this.search().trim().toLowerCase();

    return this.allProducts().filter((product) => {
      if (category !== 'All' && product.category !== category) return false;
      if (!term) return true;
      return (
        product.name.toLowerCase().includes(term) ||
        product.blurb.toLowerCase().includes(term) ||
        product.botanicalName.toLowerCase().includes(term)
      );
    });
  });

  constructor() {
    // Fetched once, then filtered in the browser — the catalog is small enough
    // that a round trip per keystroke would be the slower option.
    this.api.products().subscribe({
      next: ({ products }) => {
        this.allProducts.set(products);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('We could not load the catalog. Please refresh and try again.');
        this.loading.set(false);
      },
    });
  }

  protected selectCategory(name: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: name === 'All' ? null : name },
      queryParamsHandling: 'merge',
    });
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.selectCategory('All');
  }
}
