import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { AuthStore } from '../../core/auth.store';

const MIN_PASSWORD_LENGTH = 8;

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.html',
  styleUrl: '../login/auth-form.css',
})
export class Register {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly minLength = MIN_PASSWORD_LENGTH;

  protected readonly passwordTooShort = computed(
    () => this.password().length > 0 && this.password().length < MIN_PASSWORD_LENGTH,
  );

  protected readonly canSubmit = computed(
    () =>
      !this.submitting() &&
      this.name().trim().length > 0 &&
      this.email().includes('@') &&
      this.password().length >= MIN_PASSWORD_LENGTH,
  );

  private readonly redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/account';

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;

    this.submitting.set(true);
    this.error.set(null);

    try {
      await this.auth.register(this.name().trim(), this.email().trim(), this.password());
      await this.router.navigateByUrl(this.redirect);
    } catch (error) {
      this.error.set((error as Error).message);
      this.submitting.set(false);
    }
  }
}
