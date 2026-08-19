import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';
import { CartStore } from '../../core/cart.store';
import { formatMoney, type Order } from '../../core/models';

@Component({
  selector: 'app-checkout-success',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkout-success.html',
  styleUrl: './checkout-success.css',
})
export class CheckoutSuccess {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly cart = inject(CartStore);

  protected readonly auth = inject(AuthStore);

  protected readonly order = signal<Order | null>(null);
  protected readonly loading = signal(true);
  protected readonly reference = signal('');
  protected readonly simulated = signal(false);

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const reference = params.get('ref') ?? '';
    const sessionId = params.get('session_id') ?? '';

    this.reference.set(reference);
    this.simulated.set(params.get('simulated') === '1');

    // Stripe only redirects here on a completed payment, so the cart has truly
    // become an order now — this is the single place a real checkout clears it.
    this.cart.clear();

    void this.resolve(reference, sessionId);
  }

  protected money(cents: number): string {
    return formatMoney(cents);
  }

  private async resolve(reference: string, sessionId: string): Promise<void> {
    if (!reference) {
      this.loading.set(false);
      return;
    }

    // Ask Stripe directly before reading the order, so the page is correct even
    // if the webhook has not landed yet.
    if (sessionId) {
      try {
        await firstValueFrom(this.api.confirmCheckout(sessionId));
      } catch {
        // Non-fatal: the webhook remains the authoritative path.
      }
    }

    try {
      const { order } = await firstValueFrom(this.api.order(reference));
      this.order.set(order);
    } catch {
      this.order.set(null);
    } finally {
      this.loading.set(false);
    }
  }
}
