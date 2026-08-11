import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page section center missing">
      <p class="eyebrow">404</p>
      <h1>This row is empty</h1>
      <p class="lede">
        Nothing is planted at that address. It may have been moved, or the link may have a typo in
        it.
      </p>
      <div class="actions">
        <a class="btn btn-lg" routerLink="/shop">Browse the catalog</a>
        <a class="btn btn-lg btn-secondary" routerLink="/">Back to the home page</a>
      </div>
    </div>
  `,
  styles: `
    .missing {
      max-width: 560px;
      padding-block: clamp(3rem, 10vw, 6rem);
    }

    .lede {
      margin-inline: auto;
      margin-bottom: 2rem;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.75rem;
    }
  `,
})
export class NotFound {}
