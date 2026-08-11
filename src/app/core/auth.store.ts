/**
 * Signed-in user state.
 *
 * The session itself is an httpOnly cookie the browser cannot read, so this
 * store asks the server who it is talking to and caches the answer.
 */

import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { ApiService, apiErrorMessage } from './api.service';
import type { User } from './models';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(ApiService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly userSignal = signal<User | null>(null);
  readonly user = this.userSignal.asReadonly();

  /** False until the first /me call settles, so guards do not act too early. */
  private readonly resolvedSignal = signal(false);
  readonly resolved = this.resolvedSignal.asReadonly();

  readonly isSignedIn = computed(() => this.userSignal() !== null);

  private inFlight: Promise<User | null> | null = null;

  /** Resolves the current user once and reuses the result afterwards. */
  async load(): Promise<User | null> {
    if (this.resolvedSignal()) return this.userSignal();

    // Cookies are not available during server rendering, so treat SSR as
    // signed out and let the browser resolve the real answer after hydration.
    if (!this.isBrowser) return null;

    this.inFlight ??= firstValueFrom(this.api.me())
      .then(({ user }) => {
        this.userSignal.set(user);
        return user;
      })
      .catch(() => {
        this.userSignal.set(null);
        return null;
      })
      .finally(() => {
        this.resolvedSignal.set(true);
        this.inFlight = null;
      });

    return this.inFlight;
  }

  async login(email: string, password: string): Promise<void> {
    try {
      const { user } = await firstValueFrom(this.api.login({ email, password }));
      this.userSignal.set(user);
      this.resolvedSignal.set(true);
    } catch (error) {
      throw new Error(apiErrorMessage(error, 'We could not sign you in.'));
    }
  }

  async register(name: string, email: string, password: string): Promise<void> {
    try {
      const { user } = await firstValueFrom(this.api.register({ name, email, password }));
      this.userSignal.set(user);
      this.resolvedSignal.set(true);
    } catch (error) {
      throw new Error(apiErrorMessage(error, 'We could not create your account.'));
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.logout());
    } finally {
      // Clear locally even if the request failed; the cookie may already be gone.
      this.userSignal.set(null);
      this.resolvedSignal.set(true);
    }
  }
}
