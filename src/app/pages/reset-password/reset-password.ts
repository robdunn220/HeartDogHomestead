import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ApiService, apiErrorMessage } from '../../core/api.service';

const MIN_PASSWORD_LENGTH = 8;

@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reset-password.html',
  styleUrl: '../login/auth-form.css',
})
export class ResetPassword {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  protected readonly password = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal(false);

  protected readonly minLength = MIN_PASSWORD_LENGTH;
  protected readonly hasToken = this.token.length > 0;

  protected readonly passwordTooShort = computed(
    () => this.password().length > 0 && this.password().length < MIN_PASSWORD_LENGTH,
  );

  protected readonly canSubmit = computed(
    () => !this.submitting() && this.hasToken && this.password().length >= MIN_PASSWORD_LENGTH,
  );

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;

    this.submitting.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(this.api.resetPassword(this.token, this.password()));
      this.done.set(true);
      // Sessions were cleared server-side, so send them to sign in fresh.
      await this.router.navigate(['/login'], { queryParams: { reset: 1 } });
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'We could not reset your password.'));
      this.submitting.set(false);
    }
  }
}
