/** Catalog tile: packet art, name, blurb, price, and an add-to-cart button. */

import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CartStore } from '../core/cart.store';
import { formatMoney, type Product } from '../core/models';
import { PacketArt } from './packet-art';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, PacketArt],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="product-card card">
      <a class="art-link" [routerLink]="['/shop', product().slug]" tabindex="-1" aria-hidden="true">
        <app-packet-art
          class="art"
          [motif]="product().motif"
          [accent]="product().accent"
          [name]="product().name"
        />
        @if (product().featured) {
          <span class="ribbon">Grower's pick</span>
        }
        @if (soldOut()) {
          <span class="ribbon ribbon-out">Sold out</span>
        }
      </a>

      <div class="body">
        <p class="category">{{ product().category }}</p>
        <h3 class="name">
          <a [routerLink]="['/shop', product().slug]">{{ product().name }}</a>
        </h3>
        <p class="blurb small muted">{{ product().blurb }}</p>

        <div class="foot">
          <span class="price money">{{ price() }}</span>
          <span class="seed-count small muted">{{ product().seedCount }}</span>
        </div>

        <button class="btn btn-sm add" type="button" [disabled]="soldOut()" (click)="add()">
          @if (soldOut()) {
            Sold out
          } @else if (justAdded()) {
            Added ✓
          } @else {
            Add to cart
          }
        </button>
      </div>
    </article>
  `,
  styles: `
    .product-card {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      height: 100%;
      transition:
        transform 0.16s ease,
        box-shadow 0.2s ease;
    }

    .product-card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow);
    }

    .art-link {
      position: relative;
      display: block;
      aspect-ratio: 4 / 3;
      background: var(--paper-sunk);
      border-bottom: 1px solid var(--rule);
    }

    .art {
      width: 100%;
      height: 100%;
    }

    .ribbon {
      position: absolute;
      top: 0.7rem;
      left: 0.7rem;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      background: var(--gold);
      color: #3a2c06;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .ribbon-out {
      top: auto;
      bottom: 0.7rem;
      background: var(--ink);
      color: var(--paper);
    }

    .body {
      display: flex;
      flex-direction: column;
      flex: 1;
      padding: 1rem 1.1rem 1.1rem;
    }

    .category {
      margin: 0 0 0.3rem;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--terracotta);
    }

    .name {
      font-size: 1.08rem;
      margin: 0 0 0.4rem;
    }

    .name a {
      color: var(--ink);
      text-decoration: none;
    }

    .name a:hover {
      color: var(--green);
    }

    .blurb {
      margin: 0 0 0.9rem;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .foot {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
      margin-top: auto;
      padding-top: 0.4rem;
    }

    .price {
      font-family: var(--font-serif);
      font-size: 1.3rem;
      font-weight: 600;
    }

    .add {
      margin-top: 0.85rem;
      width: 100%;
    }
  `,
})
export class ProductCard {
  private readonly cart = inject(CartStore);

  readonly product = input.required<Product>();

  protected readonly justAdded = signal(false);
  protected readonly price = computed(() => formatMoney(this.product().priceCents));
  protected readonly soldOut = computed(() => this.product().stock <= 0);

  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  protected add(): void {
    this.cart.add(this.product().slug, 1);
    this.justAdded.set(true);

    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.justAdded.set(false), 1600);
  }
}
