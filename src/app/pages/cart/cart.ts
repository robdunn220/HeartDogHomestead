import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';
import { CartStore } from '../../core/cart.store';
import { ConfigStore } from '../../core/config.store';
import { formatMoney } from '../../core/models';

@Component({
  selector: 'app-cart',
  imports: [RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cart.html',
  styleUrl: './cart.css',
})
export class Cart {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly cart = inject(CartStore);
  protected readonly auth = inject(AuthStore);
  protected readonly configStore = inject(ConfigStore);

  protected readonly email = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Set when Stripe sends the customer back without paying. */
  protected readonly canceled = signal(this.route.snapshot.queryParamMap.get('canceled') === '1');

  protected readonly quote = this.cart.quote;

  /** How much more to spend before shipping is free, or 0 once it is. */
  protected readonly freeShippingGap = computed(() => {
    const quote = this.quote();
    if (!quote) return 0;
    return Math.max(0, this.configStore.config().freeShippingThresholdCents - quote.subtotalCents);
  });

  protected readonly effectiveEmail = computed(
    () => this.auth.user()?.email ?? this.email().trim(),
  );

  protected readonly canCheckout = computed(
    () =>
      !this.cart.isEmpty() &&
      this.quote() !== null &&
      !this.cart.quoting() &&
      this.cart.quoteError() === null &&
      this.effectiveEmail().includes('@') &&
      !this.submitting(),
  );

  protected money(cents: number): string {
    return formatMoney(cents);
  }

  protected setQuantity(slug: string, event: Event): void {
    this.cart.setQuantity(slug, Number((event.target as HTMLInputElement).value));
  }

  protected async checkout(): Promise<void> {
    if (!this.canCheckout()) return;

    this.submitting.set(true);
    this.error.set(null);
    this.canceled.set(false);

    try {
      const response = await firstValueFrom(
        this.api.createCheckoutSession(this.cart.lines(), this.effectiveEmail()),
      );

      // Keep the cart until the order actually completes — the success page
      // clears it. If the customer cancels on Stripe and comes back, their
      // cart is still here.

      // Stripe's hosted page lives on another origin, so this is a full
      // navigation rather than a router hop.
      window.location.assign(response.url);
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'We could not start checkout. Please try again.'));
      this.submitting.set(false);
    }
  }
}
