import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forgot-password.html',
  styleUrl: '../login/auth-form.css',
})
export class ForgotPassword {
  private readonly api = inject(ApiService);

  protected readonly email = signal('');
  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly canSubmit = computed(() => !this.submitting() && this.email().includes('@'));

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;

    this.submitting.set(true);
    this.error.set(null);

    try {
      // The endpoint always succeeds, whether or not the address is registered.
      await firstValueFrom(this.api.forgotPassword(this.email().trim().toLowerCase()));
      this.sent.set(true);
    } catch {
      this.error.set('We could not send the reset email just now. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }
}
