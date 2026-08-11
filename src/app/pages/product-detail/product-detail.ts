import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { switchMap } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { CartStore } from '../../core/cart.store';
import { formatMoney, type Product } from '../../core/models';
import { PacketArt } from '../../shared/packet-art';
import { ProductCard } from '../../shared/product-card';

@Component({
  selector: 'app-product-detail',
  imports: [PacketArt, ProductCard, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css',
})
export class ProductDetail {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly cart = inject(CartStore);

  protected readonly product = signal<Product | null>(null);
  protected readonly related = signal<Product[]>([]);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly quantity = signal(1);
  protected readonly added = signal(false);

  protected readonly price = computed(() => {
    const product = this.product();
    return product ? formatMoney(product.priceCents) : '';
  });

  protected readonly soldOut = computed(() => (this.product()?.stock ?? 0) <= 0);

  protected readonly inCart = computed(() => {
    const product = this.product();
    return product ? this.cart.quantityOf(product.slug) : 0;
  });

  /** The growing details table, skipping any field the variety leaves blank. */
  protected readonly facts = computed(() => {
    const product = this.product();
    if (!product) return [];

    return [
      { label: 'Seeds per packet', value: product.seedCount },
      { label: 'Days to maturity', value: product.daysToMaturity },
      { label: 'Sun', value: product.sun },
      { label: 'Spacing', value: product.spacing },
      { label: 'Planting depth', value: product.plantingDepth },
      { label: 'Mature size', value: product.height },
      { label: 'Botanical name', value: product.botanicalName },
    ].filter((fact) => fact.value);
  });

  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.route.paramMap
      .pipe(switchMap((params) => this.api.product(String(params.get('slug')))))
      .subscribe({
        next: ({ product }) => {
          this.product.set(product);
          this.quantity.set(1);
          this.notFound.set(false);
          this.loading.set(false);
          this.title.setTitle(`${product.name} — Heart Dog Homestead`);
          this.loadRelated(product);
        },
        error: () => {
          this.notFound.set(true);
          this.loading.set(false);
          this.title.setTitle('Variety not found — Heart Dog Homestead');
        },
      });
  }

  protected setQuantity(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.quantity.set(Math.min(99, Math.max(1, Math.floor(value) || 1)));
  }

  protected step(delta: number): void {
    this.quantity.update((q) => Math.min(99, Math.max(1, q + delta)));
  }

  protected addToCart(): void {
    const product = this.product();
    if (!product || this.soldOut()) return;

    this.cart.add(product.slug, this.quantity());
    this.added.set(true);

    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.added.set(false), 2200);
  }

  private loadRelated(product: Product): void {
    this.api.products({ category: product.category }).subscribe({
      next: ({ products }) =>
        this.related.set(products.filter((p) => p.slug !== product.slug).slice(0, 4)),
      error: () => this.related.set([]),
    });
  }
}
