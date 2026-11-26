import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'plus'
  | 'camera'
  | 'tag'
  | 'upload'
  | 'download'
  | 'grid'
  | 'list'
  | 'card'
  | 'book'
  | 'game'
  | 'vinyl'
  | 'stack'
  | 'coins'
  | 'pie'
  | 'sparkle'
  | 'search'
  | 'trash'
  | 'edit'
  | 'close'
  | 'user'
  | 'logout'
  | 'external';

/**
 * A small decorative line icon (24x24 grid, drawn with the current text colour).
 * Always aria-hidden: the control it sits in must carry its own text or aria-label.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'icon', 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 24 24" [attr.width]="size()" [attr.height]="size()" focusable="false">
      @switch (name()) {
        @case ('plus') { <path d="M12 5v14M5 12h14" /> }
        @case ('camera') {
          <path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
          <circle cx="12" cy="13" r="3.5" />
        }
        @case ('tag') {
          <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
          <circle cx="8" cy="8" r="1.5" />
        }
        @case ('upload') { <path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /> }
        @case ('download') { <path d="M12 4v12m0 0-5-5m5 5 5-5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /> }
        @case ('grid') {
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        }
        @case ('list') { <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /> }
        @case ('card') {
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M8 15h8M8 18h5" />
          <rect x="8" y="6" width="8" height="6" rx="1" />
        }
        @case ('book') { <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zm0 15A1.5 1.5 0 0 0 6.5 21H19v-3" /> }
        @case ('game') {
          <path d="M7 7h10a4 4 0 0 1 4 4v3a3 3 0 0 1-5.4 1.8L14.5 14h-5l-1.1 1.8A3 3 0 0 1 3 14v-3a4 4 0 0 1 4-4z" />
          <path d="M8 10v3M6.5 11.5h3M15.5 11h.01M17.5 12.5h.01" />
        }
        @case ('vinyl') {
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 12h.01" />
        }
        @case ('stack') { <path d="m12 3 9 5-9 5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5" /> }
        @case ('coins') {
          <ellipse cx="9" cy="7" rx="6" ry="3" />
          <path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" />
          <path d="M9 18c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.6-2.4-2.9-5.5-3" />
        }
        @case ('pie') { <path d="M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z" /> }
        @case ('sparkle') { <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /> }
        @case ('search') { <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /> }
        @case ('trash') { <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" /> }
        @case ('edit') { <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4" /> }
        @case ('close') { <path d="M6 6l12 12M18 6 6 18" /> }
        @case ('user') { <circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" /> }
        @case ('logout') { <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 8l-4 4 4 4M6 12h10" /> }
        @case ('external') { <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /> }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }
    svg {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
}
