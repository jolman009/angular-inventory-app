import { CurrencyPipe, DecimalPipe, Location, NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { BRAND } from '../../../core/brand';
import { Supabase } from '../../../core/supabase';
import { HasUnsavedChanges } from '../../../core/unsaved-changes-guard';
import { CsvImport } from '../csv-import/csv-import';
import { downloadCsv, itemsToCsv } from '../csv';
import { ItemForm } from '../item-form/item-form';
import { ItemStore } from '../item-store';
import { Icon } from '../../../shared/icon';
import {
  CardValuation,
  DETAIL_FIELDS,
  ITEM_STATUSES,
  Item,
  ItemStatus,
  MEDIA_TYPE_LABELS,
  MEDIA_TYPES,
  MEDIA_TYPE_SINGULAR,
  MediaType,
  SORT_OPTIONS,
  STATUS_LABELS,
  SortKey,
  getCardValuation,
} from '../item.model';
import { QuickCapture } from '../quick-capture/quick-capture';
import {
  CollectionUrlState,
  hasDrawer,
  paramsKey,
  paramsToState,
  stateToParams,
} from './collection-url';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_KEY = 'vaulted-theme';

@Component({
  selector: 'app-item-list',
  imports: [ItemForm, CsvImport, QuickCapture, CurrencyPipe, DecimalPipe, NgOptimizedImage, RouterLink, Icon],
  templateUrl: './item-list.html',
  styleUrls: ['./item-list.scss', './item-list-items.scss', './item-list-panels.scss', './item-list-drawer.scss', './item-list-mobile.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()',
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class ItemList implements OnInit, HasUnsavedChanges {
  protected supabase = inject(Supabase);
  protected store = inject(ItemStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private injector = inject(Injector);

  // Elements we move keyboard focus to
  private readonly drawerTitle = viewChild<ElementRef<HTMLElement>>('drawerTitle');
  private readonly pageHeading = viewChild<ElementRef<HTMLElement>>('pageHeading');
  private readonly popup = viewChild<ElementRef<HTMLElement>>('popup');
  private readonly itemForm = viewChild(ItemForm);

  protected readonly brand = BRAND;
  protected readonly types = MEDIA_TYPES;
  protected readonly statuses = ITEM_STATUSES;
  protected readonly typeLabels = MEDIA_TYPE_LABELS;
  protected readonly typeNames = MEDIA_TYPE_SINGULAR;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly detailFields = DETAIL_FIELDS;

  // Form, drawer & mobile popup visibility
  protected readonly adding = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingItem = computed(
    () => this.store.items().find(i => i.id === this.editingId()) ?? null,
  );
  protected readonly formOpen = computed(() => this.adding() || this.editingItem() !== null);
  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly importOpen = signal(false);
  protected readonly captureOpen = signal(false);
  protected readonly pricingOpen = signal(false);
  protected readonly reviewing = signal(false);
  protected readonly activePopup = signal<'data' | 'profile' | null>(null);
  protected readonly theme = signal<ThemeMode>('system');

  // eBay valuation state for existing cards
  protected readonly refreshingCardId = signal<string | null>(null);
  protected readonly refreshNotice = signal<string | null>(null);

  protected readonly inspectingItem = computed(() => {
    if (this.formOpen() || this.importOpen() || this.captureOpen() || this.pricingOpen()) {
      return null;
    }
    return this.store.selected();
  });

  protected readonly drawerOpen = computed(
    () =>
      this.formOpen() ||
      this.importOpen() ||
      this.captureOpen() ||
      this.pricingOpen() ||
      this.inspectingItem() !== null,
  );

  /** True on tablet/phone widths, where the drawer covers the page instead of sitting beside it. */
  protected readonly isCompact = signal(false);

  /** Identifies what the drawer shows, so focus moves whenever it opens or switches content. */
  private readonly drawerKey = computed(() => {
    if (this.formOpen()) return `form:${this.editingId() ?? 'new'}`;
    if (this.captureOpen()) return 'capture';
    if (this.importOpen()) return 'import';
    if (this.pricingOpen()) return 'plans';
    const item = this.inspectingItem();
    return item ? `item:${item.id}` : null;
  });

  private previousDrawerKey: string | null = null;
  // The control that opened the drawer or a pop-up, so focus can go back to it on close
  private drawerReturnFocus: HTMLElement | null = null;
  private popupReturnFocus: HTMLElement | null = null;

  // ---- address bar sync ----
  // The address bar mirrors the drawer and filters (see collection-url.ts).
  // Opening the drawer adds a history entry, so the phone's Back button closes it.
  /** The params currently in the address bar, as text. */
  private urlKey = '';
  /** Whether the address bar currently has the drawer open. */
  private urlOpen = false;
  /** True when the history entry before this one is this page with the drawer closed. */
  private drawerPushed = false;
  /** Set while we step back in history to close the drawer. */
  private closingViaBack = false;

  /** The page's state as the address bar should show it. */
  private readonly urlState = computed<CollectionUrlState>(() => {
    const base = {
      q: this.store.search().trim(),
      type: this.store.typeFilter(),
      status: this.store.statusFilter(),
      sort: this.store.sortBy(),
    };
    const editing = this.editingId();
    if (this.adding()) return { ...base, panel: 'add', item: null };
    if (editing) return { ...base, panel: this.reviewing() ? 'review' : 'edit', item: editing };
    if (this.captureOpen()) return { ...base, panel: 'capture', item: null };
    if (this.importOpen()) return { ...base, panel: 'import', item: null };
    if (this.pricingOpen()) return { ...base, panel: 'plans', item: null };
    return { ...base, panel: null, item: this.store.selectedId() };
  });

  constructor() {
    // Restore the view from the address bar (a reload or a shared link)...
    const initial = this.route.snapshot.queryParams;
    this.urlKey = paramsKey(initial);
    this.urlOpen = hasDrawer(paramsToState(initial));
    this.applyUrlState(paramsToState(initial), true);

    // ...follow it when it changes (Back, Forward)...
    this.route.queryParams
      .pipe(takeUntilDestroyed())
      .subscribe(params => this.onUrlChange(params));

    // ...and keep it up to date as the user opens panels and filters.
    effect(() => {
      const state = this.urlState();
      untracked(() => this.writeUrl(state));
    });

    try {
      const query = window.matchMedia('(max-width: 980px)');
      this.isCompact.set(query.matches);
      query.addEventListener('change', e => this.isCompact.set(e.matches));
    } catch {
      // matchMedia is missing in some test environments; keep the desktop layout
    }

    // Move focus into the drawer when it opens or changes, and back out when it closes.
    effect(() => {
      const key = this.drawerKey();
      const previous = this.previousDrawerKey;
      this.previousDrawerKey = key;
      if (key === previous) return;

      afterNextRender(
        () => {
          if (key) {
            this.drawerTitle()?.nativeElement.focus();
            return;
          }
          const target = this.drawerReturnFocus;
          this.drawerReturnFocus = null;
          if (target?.isConnected) target.focus();
          else this.pageHeading()?.nativeElement.focus();
        },
        { injector: this.injector },
      );
    });
  }

  /** Pushes the page state into the address bar. */
  private writeUrl(state: CollectionUrlState) {
    const params = stateToParams(state);
    const key = paramsKey(params);
    if (key === this.urlKey) return;

    const wasOpen = this.urlOpen;
    const isOpen = hasDrawer(state);

    if (wasOpen && !isOpen && this.drawerPushed) {
      // Step back to the entry we came from instead of adding another one,
      // so the next Back press leaves the page as expected.
      this.drawerPushed = false;
      this.closingViaBack = true;
      this.location.back();
      return;
    }

    const push = !wasOpen && isOpen;
    if (push) this.drawerPushed = true;
    this.urlKey = key;
    this.urlOpen = isOpen;
    this.router.navigate([], { relativeTo: this.route, queryParams: params, replaceUrl: !push });
  }

  /** The address bar changed: Back, Forward, or our own update. */
  private onUrlChange(params: Params) {
    const key = paramsKey(params);
    if (key === this.urlKey && !this.closingViaBack) return; // our own update
    this.urlKey = key;
    let next = paramsToState(params);
    this.urlOpen = hasDrawer(next);
    if (this.closingViaBack) {
      // We stepped back only to close the drawer. Keep the filters the user has now,
      // not the older ones saved in that history entry.
      this.closingViaBack = false;
      const now = this.urlState();
      next = { ...next, q: now.q, type: now.type, status: now.status, sort: now.sort };
    } else if (this.formOpen() && this.itemForm()?.hasUnsavedChanges()) {
      const now = this.urlState();
      const leavingForm = next.panel !== now.panel || next.item !== now.item;
      if (leavingForm && !confirm('Discard your unsaved changes?')) {
        // Stay: put the form's entry back into history.
        const keep = stateToParams(now);
        this.urlKey = paramsKey(keep);
        this.urlOpen = true;
        this.drawerPushed = true;
        this.router.navigate([], { relativeTo: this.route, queryParams: keep });
        return;
      }
    }

    this.drawerPushed = hasDrawer(next);
    this.applyUrlState(next, false);
    // If we kept newer filters above, make the address bar show them.
    this.writeUrl(this.urlState());
  }

  /** Sets filters and the drawer to match a URL state. */
  private applyUrlState(s: CollectionUrlState, initial: boolean) {
    this.store.search.set(s.q);
    this.store.typeFilter.set(s.type);
    this.store.statusFilter.set(s.status);
    this.store.sortBy.set(s.sort);

    const now = this.urlState();
    if (!initial && now.panel === s.panel && now.item === s.item) return;

    this.adding.set(s.panel === 'add');
    this.editingId.set(s.panel === 'edit' || s.panel === 'review' ? s.item : null);
    this.reviewing.set(s.panel === 'review');
    this.captureOpen.set(s.panel === 'capture');
    this.importOpen.set(s.panel === 'import');
    this.pricingOpen.set(s.panel === 'plans');
    if (s.panel === null) this.store.selectedId.set(s.item);
    if (s.panel === null && s.item === null) this.refreshNotice.set(null);
  }

  /** True when the item form holds edits that haven't been saved. */
  private hasUnsavedForm(): boolean {
    return this.formOpen() && !!this.itemForm()?.hasUnsavedChanges();
  }

  /** Used by the route guard before leaving this page. */
  canLeave(): boolean {
    return !this.hasUnsavedForm() || confirm('Discard your unsaved changes?');
  }

  /** Closing or reloading the tab with unsaved edits: let the browser ask first. */
  onBeforeUnload(e: BeforeUnloadEvent) {
    if (this.hasUnsavedForm()) e.preventDefault();
  }

  /** Remembers the focused control before the drawer opens, so closing it can return there. */
  private rememberDrawerTrigger() {
    if (this.drawerKey() === null) {
      // Opened from a pop-up: return to the bottom-nav button, since the pop-up will be gone
      const active = this.activePopup() ? this.popupReturnFocus : document.activeElement;
      this.drawerReturnFocus = active instanceof HTMLElement && active !== document.body ? active : null;
    }
  }

  ngOnInit() {
    this.initTheme();
    this.store.load();
  }

  private initTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') {
        this.setTheme(saved);
      }
    } catch {
      // ignore storage errors in restricted environments
    }
  }

  setTheme(mode: ThemeMode) {
    this.theme.set(mode);
    const root = document.documentElement;
    if (mode === 'system') {
      root.removeAttribute('data-theme');
      try {
        localStorage.removeItem(THEME_KEY);
      } catch {
        // ignore
      }
    } else {
      root.setAttribute('data-theme', mode);
      try {
        localStorage.setItem(THEME_KEY, mode);
      } catch {
        // ignore
      }
    }
  }

  togglePopup(menu: 'data' | 'profile') {
    if (this.activePopup() === menu) {
      this.closePopup(true);
      return;
    }
    this.popupReturnFocus ??= document.activeElement as HTMLElement | null;
    this.activePopup.set(menu);
    // Put focus on the first control in the pop-up so keyboard users land inside it
    afterNextRender(
      () => this.popup()?.nativeElement.querySelector<HTMLElement>('button:not([disabled])')?.focus(),
      { injector: this.injector },
    );
  }

  /** Closes the pop-up. Pass true to send focus back to the button that opened it. */
  closePopup(restoreFocus = false) {
    if (!this.activePopup()) return;
    this.activePopup.set(null);
    const target = this.popupReturnFocus;
    this.popupReturnFocus = null;
    if (restoreFocus && target?.isConnected) target.focus();
  }

  /** Escape closes the top-most layer: a pop-up first, then the drawer. */
  onEscape() {
    if (this.activePopup()) {
      this.closePopup(true);
      return;
    }
    if (this.drawerOpen()) this.requestCloseDrawer();
  }

  /** Closes the drawer, first asking before throwing away unsaved form edits. */
  requestCloseDrawer() {
    if (this.hasUnsavedForm() && !confirm('Discard your unsaved changes?')) return;
    this.closeDrawer();
  }

  openInspector(id: string) {
    this.rememberDrawerTrigger();
    this.store.selectedId.set(id);
  }

  goHome() {
    this.closePopup();
    this.closeDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openAdd() {
    this.rememberDrawerTrigger();
    this.closePopup();
    this.importOpen.set(false);
    this.captureOpen.set(false);
    this.pricingOpen.set(false);
    this.reviewing.set(false);
    this.editingId.set(null);
    this.adding.set(true);
  }

  openCapture() {
    this.rememberDrawerTrigger();
    this.closePopup();
    this.adding.set(false);
    this.editingId.set(null);
    this.importOpen.set(false);
    this.pricingOpen.set(false);
    this.captureOpen.set(true);
  }

  openImport() {
    this.rememberDrawerTrigger();
    this.closePopup();
    this.adding.set(false);
    this.editingId.set(null);
    this.captureOpen.set(false);
    this.pricingOpen.set(false);
    this.importOpen.set(true);
  }

  openPricing() {
    this.rememberDrawerTrigger();
    this.closePopup();
    this.adding.set(false);
    this.editingId.set(null);
    this.captureOpen.set(false);
    this.importOpen.set(false);
    this.pricingOpen.set(true);
  }

  startEdit(id: string) {
    this.rememberDrawerTrigger();
    this.closePopup();
    this.importOpen.set(false);
    this.captureOpen.set(false);
    this.pricingOpen.set(false);
    this.adding.set(false);
    this.editingId.set(id);
  }

  closeForm() {
    this.adding.set(false);
    this.editingId.set(null);
    this.reviewing.set(false);
  }

  closeDrawer() {
    this.closeForm();
    this.importOpen.set(false);
    this.captureOpen.set(false);
    this.pricingOpen.set(false);
    this.refreshNotice.set(null);
    this.store.selectedId.set(null);
  }

  startReview() {
    this.rememberDrawerTrigger();
    const first = this.store.drafts()[0];
    if (!first) return;

    this.closePopup();
    this.captureOpen.set(false);
    this.importOpen.set(false);
    this.pricingOpen.set(false);
    this.adding.set(false);
    this.reviewing.set(true);
    this.startEdit(first.id);
  }

  /** The form saved an item. In review mode, move on to the next draft. */
  onSaved() {
    if (this.reviewing()) {
      const next = this.store.drafts()[0];
      if (next) {
        this.startEdit(next.id);
        return;
      }
    }
    this.closeForm();
  }

  exportCsv() {
    this.closePopup();
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`my-collection-${today}.csv`, itemsToCsv(this.store.committed()));
  }

  onDelete(item: Item) {
    if (confirm(`Delete "${item.title}"? This can't be undone.`)) {
      this.store.remove(item.id);
    }
  }

  cardValuation(item: Item): CardValuation | null {
    return getCardValuation(item.details);
  }

  gainLoss(item: Item): { diff: number; percent: number } | null {
    const val = this.cardValuation(item);
    const paid = item.purchase_price;
    if (!val || paid === null || paid <= 0) return null;
    const diff = val.medianPrice - paid;
    const percent = (diff / paid) * 100;
    return { diff, percent };
  }

  async refreshSingleCard(item: Item) {
    this.refreshingCardId.set(item.id);
    this.refreshNotice.set(null);
    const { valuation, notice } = await this.store.refreshCardEstimate(item);
    if (!valuation) {
      this.refreshNotice.set(notice ?? 'Could not find matching eBay listings.');
    }
    this.refreshingCardId.set(null);
  }

  async refreshMissingCards() {
    this.closePopup();
    await this.store.refreshAllCardEstimates(true);
  }

  detailSummary(item: Item): string {
    return DETAIL_FIELDS[item.type]
      .map(f => item.details[f.key])
      .filter(v => v !== undefined && v !== '')
      .join(' · ');
  }

  detailEntries(item: Item): { label: string; value: string }[] {
    return DETAIL_FIELDS[item.type]
      .map(f => ({
        label: f.label,
        value: String(item.details[f.key] ?? '').trim(),
      }))
      .filter(entry => entry.value.length > 0);
  }

  typePercent(type: MediaType): number {
    const total = this.store.committed().length;
    if (!total) return 0;
    return Math.round(((this.store.countsByType()[type] ?? 0) / total) * 100);
  }

  statusPercent(status: ItemStatus): number {
    const total = this.store.committed().length;
    if (!total) return 0;
    return Math.round(((this.store.countsByStatus()[status] ?? 0) / total) * 100);
  }

  onSearch(e: Event) {
    this.store.search.set((e.target as HTMLInputElement).value);
  }

  onTypeFilter(e: Event) {
    this.store.typeFilter.set((e.target as HTMLSelectElement).value as MediaType | 'all');
  }

  onStatusFilter(e: Event) {
    this.store.statusFilter.set((e.target as HTMLSelectElement).value as ItemStatus | 'all');
  }

  onStatusChange(id: string, e: Event) {
    this.store.setStatus(id, (e.target as HTMLSelectElement).value as ItemStatus);
  }

  onSort(e: Event) {
    this.store.sortBy.set((e.target as HTMLSelectElement).value as SortKey);
  }

  async signOut() {
    this.closePopup();
    await this.supabase.client.auth.signOut();
    await this.router.navigateByUrl('/');
  }

  async deleteAccount() {
    this.closePopup();
    const confirmed = confirm(
      'Permanently delete your account along with all stored collection items and uploaded photos? This action cannot be undone.',
    );
    if (!confirmed) return;

    const deleted = await this.store.deleteAccountAndData();
    if (!deleted) {
      // The reason is in the error banner at the top of the page; make sure it is in view.
      this.closeDrawer();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      localStorage.removeItem(THEME_KEY);
    } catch {
      // ignore
    }
    await this.supabase.client.auth.signOut();
    await this.router.navigateByUrl('/');
  }
}
