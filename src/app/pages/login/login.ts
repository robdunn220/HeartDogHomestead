import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { AuthStore } from '../../core/auth.store';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  styleUrl: './auth-form.css',
})
export class Login {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Where the guard wanted to send them before they were bounced here. */
  private readonly redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/account';

  protected async submit(): Promise<void> {
    if (this.submitting()) return;

    this.submitting.set(true);
    this.error.set(null);

    try {
      await this.auth.login(this.email().trim(), this.password());
      await this.router.navigateByUrl(this.redirect);
    } catch (error) {
      this.error.set((error as Error).message);
      this.submitting.set(false);
    }
  }
}
