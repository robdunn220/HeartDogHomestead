/**
 * Botanical illustration for a seed packet, drawn as inline SVG.
 *
 * Every variety carries a `motif` and an `accent` color in the catalog, which
 * together give each packet its own artwork without shipping a single image
 * file — nothing to load, nothing to go missing, and it scales cleanly.
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-packet-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="art"
      [attr.viewBox]="'0 0 200 200'"
      [style.--accent]="accent()"
      role="img"
      [attr.aria-label]="label()"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient [attr.id]="gradientId()" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.20" />
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.06" />
        </linearGradient>
      </defs>

      <rect width="200" height="200" [attr.fill]="'url(#' + gradientId() + ')'" />

      <!-- Ruled paper lines, a nod to old catalog plates -->
      <g stroke="var(--accent)" stroke-opacity="0.10" stroke-width="1">
        @for (y of rules; track y) {
          <line x1="0" [attr.y1]="y" x2="200" [attr.y2]="y" />
        }
      </g>

      <g
        fill="none"
        stroke="var(--accent)"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        @switch (motif()) {
          @case ('tomato') {
            <circle cx="100" cy="112" r="42" fill="var(--accent)" fill-opacity="0.35" />
            <path d="M100 70v-14" />
            <path
              d="M100 70c-10-6-20-4-26-12 12-4 20 0 26 6 6-6 14-10 26-6-6 8-16 6-26 12Z"
              fill="var(--accent)"
              fill-opacity="0.55"
            />
            <path d="M78 96c-6 8-6 20 0 28" stroke-opacity="0.5" />
          }
          @case ('bean') {
            <path
              d="M64 148c-16-30-6-70 26-92 30-20 46-8 42 10-4 20-30 22-42 44-10 18-8 32-6 40Z"
              fill="var(--accent)"
              fill-opacity="0.3"
            />
            <path d="M64 148c10-40 40-52 62-74" />
            <ellipse
              cx="118"
              cy="86"
              rx="9"
              ry="14"
              transform="rotate(-35 118 86)"
              fill="var(--accent)"
              fill-opacity="0.55"
            />
          }
          @case ('squash') {
            <path
              d="M72 132c0-28 12-46 28-46s28 18 28 46-12 34-28 34-28-6-28-34Z"
              fill="var(--accent)"
              fill-opacity="0.35"
            />
            <path d="M100 86V60c0-8 8-14 16-14" />
            <path d="M86 116c0 20 2 32 6 42M114 116c0 20-2 32-6 42" stroke-opacity="0.5" />
          }
          @case ('melon') {
            <circle cx="100" cy="108" r="48" fill="var(--accent)" fill-opacity="0.35" />
            <path d="M100 60c-18 14-18 82 0 96M100 60c18 14 18 82 0 96" stroke-opacity="0.45" />
            <circle cx="80" cy="92" r="4" fill="var(--accent)" stroke="none" />
            <circle cx="118" cy="122" r="5" fill="var(--accent)" stroke="none" />
            <circle cx="112" cy="84" r="3" fill="var(--accent)" stroke="none" />
          }
          @case ('root') {
            <path
              d="M100 62c22 0 34 16 34 34 0 26-20 44-34 58-14-14-34-32-34-58 0-18 12-34 34-34Z"
              fill="var(--accent)"
              fill-opacity="0.35"
            />
            <path d="M100 62V38M100 44c-10-6-18-4-24-10M100 44c10-6 18-4 24-10" />
            <path d="M100 110v34" stroke-opacity="0.5" />
          }
          @case ('leaf') {
            <path
              d="M100 158c0-52 18-84 48-96-4 52-22 82-48 96Z"
              fill="var(--accent)"
              fill-opacity="0.35"
            />
            <path
              d="M100 158c0-52-18-84-48-96 4 52 22 82 48 96Z"
              fill="var(--accent)"
              fill-opacity="0.2"
            />
            <path d="M100 158V78" />
          }
          @case ('pepper') {
            <path
              d="M84 72c0 22 4 40 16 54 12-14 16-32 16-54-4 6-10 8-16 8s-12-2-16-8Z"
              fill="var(--accent)"
              fill-opacity="0.35"
              transform="translate(0 22)"
            />
            <path d="M100 94V74c0-10 8-16 18-16" />
            <path d="M92 76h16" />
          }
          @case ('corn') {
            <ellipse cx="100" cy="108" rx="24" ry="52" fill="var(--accent)" fill-opacity="0.35" />
            <path d="M100 56v104M84 72v72M116 72v72" stroke-opacity="0.45" />
            <path d="M76 96c-16 6-24 22-22 42 18-2 30-14 34-30" />
            <path d="M124 96c16 6 24 22 22 42-18-2-30-14-34-30" />
          }
          @case ('flower') {
            <circle cx="100" cy="94" r="16" fill="var(--accent)" fill-opacity="0.6" />
            @for (angle of petals; track angle) {
              <ellipse
                cx="100"
                cy="60"
                rx="11"
                ry="24"
                [attr.transform]="'rotate(' + angle + ' 100 94)'"
                fill="var(--accent)"
                fill-opacity="0.3"
              />
            }
            <path d="M100 110v52" />
            <path
              d="M100 134c-14-2-22-10-24-22 14 0 22 8 24 22Z"
              fill="var(--accent)"
              fill-opacity="0.3"
            />
          }
          @case ('herb') {
            <path d="M100 166V58" />
            @for (offset of sprigs; track offset) {
              <path
                [attr.d]="'M100 ' + offset + 'c-16-4-26-14-28-28 16 2 26 12 28 28Z'"
                fill="var(--accent)"
                fill-opacity="0.3"
              />
              <path
                [attr.d]="'M100 ' + offset + 'c16-4 26-14 28-28-16 2-26 12-28 28Z'"
                fill="var(--accent)"
                fill-opacity="0.3"
              />
            }
          }
          @default {
            <rect
              x="58"
              y="52"
              width="84"
              height="106"
              rx="6"
              fill="var(--accent)"
              fill-opacity="0.28"
            />
            <path d="M58 76h84" />
            <circle cx="100" cy="116" r="20" fill="var(--accent)" fill-opacity="0.4" />
            <path d="M100 96v40M80 116h40" stroke-opacity="0.5" />
          }
        }
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: block;
      overflow: hidden;
    }

    .art {
      width: 100%;
      height: 100%;
      display: block;
    }
  `,
})
export class PacketArt {
  readonly motif = input<string>('packet');
  readonly accent = input<string>('#4a7c59');
  readonly name = input<string>('');

  protected readonly rules = [24, 48, 72, 96, 120, 144, 168, 192];
  protected readonly petals = [0, 45, 90, 135, 180, 225, 270, 315];
  protected readonly sprigs = [78, 106, 134];

  /** Unique per instance so multiple packets on a page do not share a gradient. */
  protected readonly gradientId = computed(
    () => `packet-grad-${this.motif()}-${Math.abs(hash(this.accent() + this.name()))}`,
  );

  protected readonly label = computed(() =>
    this.name() ? `Illustration of ${this.name()}` : 'Seed packet illustration',
  );
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return h;
}
