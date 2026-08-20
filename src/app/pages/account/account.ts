import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';
import { formatMoney, type Order } from '../../core/models';

const MIN_PASSWORD_LENGTH = 8;

@Component({
  selector: 'app-account',
  imports: [RouterLink, DatePipe, FormsModule],
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

  // Order-history search — filtered client-side, since a customer's own orders
  // are already loaded in full (reference, items, dates, totals).
  protected readonly orderSearch = signal('');

  protected readonly filteredOrders = computed(() => {
    const term = this.orderSearch().trim().toLowerCase();
    const orders = this.orders();
    if (!term) return orders;
    return orders.filter((order) => this.orderHaystack(order).includes(term));
  });

  // Profile form. Seeded from the user the guard has already resolved.
  protected readonly name = signal(this.auth.user()?.name ?? '');
  protected readonly email = signal(this.auth.user()?.email ?? '');
  protected readonly profileSaving = signal(false);
  protected readonly profileError = signal<string | null>(null);
  protected readonly profileSaved = signal(false);

  protected readonly profileChanged = computed(
    () =>
      this.name().trim() !== (this.auth.user()?.name ?? '') ||
      this.email().trim().toLowerCase() !== (this.auth.user()?.email ?? ''),
  );

  protected readonly canSaveProfile = computed(
    () =>
      !this.profileSaving() &&
      this.profileChanged() &&
      this.name().trim().length > 0 &&
      this.email().includes('@'),
  );

  // Change-password form.
  protected readonly currentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly passwordSaving = signal(false);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly passwordSaved = signal(false);

  protected readonly minLength = MIN_PASSWORD_LENGTH;

  protected readonly newPasswordTooShort = computed(
    () => this.newPassword().length > 0 && this.newPassword().length < MIN_PASSWORD_LENGTH,
  );

  protected readonly canChangePassword = computed(
    () =>
      !this.passwordSaving() &&
      this.currentPassword().length > 0 &&
      this.newPassword().length >= MIN_PASSWORD_LENGTH,
  );

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

  /**
   * One lowercased string per order to match the search box against: order
   * number, product names, status, total, and a few spellings of the date
   * (ISO, "August 18, 2026", "Aug 18, 2026", "8/18/2026").
   */
  private orderHaystack(order: Order): string {
    const created = new Date(order.createdAt);
    const dates = [
      order.createdAt.slice(0, 10),
      created.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      created.toLocaleDateString('en-US'),
    ];
    return [
      order.reference,
      order.status,
      formatMoney(order.totalCents),
      ...order.items.map((item) => item.name),
      ...dates,
    ]
      .join(' ')
      .toLowerCase();
  }

  protected async saveProfile(): Promise<void> {
    if (!this.canSaveProfile()) return;

    this.profileSaving.set(true);
    this.profileError.set(null);
    this.profileSaved.set(false);

    try {
      await this.auth.updateProfile(this.name().trim(), this.email().trim());
      this.profileSaved.set(true);
    } catch (error) {
      this.profileError.set((error as Error).message);
    } finally {
      this.profileSaving.set(false);
    }
  }

  protected async changePassword(): Promise<void> {
    if (!this.canChangePassword()) return;

    this.passwordSaving.set(true);
    this.passwordError.set(null);
    this.passwordSaved.set(false);

    try {
      await this.auth.changePassword(this.currentPassword(), this.newPassword());
      this.passwordSaved.set(true);
      this.currentPassword.set('');
      this.newPassword.set('');
    } catch (error) {
      this.passwordError.set((error as Error).message);
    } finally {
      this.passwordSaving.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/']);
  }
}
