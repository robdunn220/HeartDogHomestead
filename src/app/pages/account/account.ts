import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';

import { ApiService } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';
import { formatMoney, type Order } from '../../core/models';

@Component({
  selector: 'app-account',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account.html',
  styleUrl: './account.css',
})
export class Account {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly auth = inject(AuthStore);

  protected readonly orders = signal<Order[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.api.orders().subscribe({
      next: ({ orders }) => {
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('We could not load your orders just now.');
        this.loading.set(false);
      },
    });
  }

  protected money(cents: number): string {
    return formatMoney(cents);
  }

  protected itemCount(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  protected async signOut(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/']);
  }
}
