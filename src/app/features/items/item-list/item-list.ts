import { CurrencyPipe, DecimalPipe, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BRAND } from '../../../core/brand';
import { Supabase } from '../../../core/supabase';
import { CsvImport } from '../csv-import/csv-import';
import { downloadCsv, itemsToCsv } from '../csv';
import { ItemForm } from '../item-form/item-form';
import { ItemStore } from '../item-store';
import {
  CardValuation,
  DETAIL_FIELDS,
  ITEM_STATUSES,
  Item,
  ItemStatus,
  MEDIA_TYPE_LABELS,
  MEDIA_TYPES,
  MediaType,
  SORT_OPTIONS,
  STATUS_LABELS,
  SortKey,
  getCardValuation,
} from '../item.model';
import { QuickCapture } from '../quick-capture/quick-capture';

@Component({
  selector: 'app-item-list',
  imports: [ItemForm, CsvImport, QuickCapture, CurrencyPipe, DecimalPipe, NgOptimizedImage, RouterLink],
  templateUrl: './item-list.html',
  styleUrl: './item-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemList implements OnInit {
  protected supabase = inject(Supabase);
  protected store = inject(ItemStore);
  private router = inject(Router);

  protected readonly brand = BRAND;
  protected readonly types = MEDIA_TYPES;
  protected readonly statuses = ITEM_STATUSES;
  protected readonly typeLabels = MEDIA_TYPE_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly detailFields = DETAIL_FIELDS;

  // Form & drawer visibility
  protected readonly adding = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingItem = computed(
    () => this.store.items().find(i => i.id === this.editingId()) ?? null,
  );
  protected readonly formOpen = computed(() => this.adding() || this.editingItem() !== null);
  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly importOpen = signal(false);
  protected readonly captureOpen = signal(false);
  protected readonly reviewing = signal(false);

  // eBay valuation state for existing cards
  protected readonly refreshingCardId = signal<string | null>(null);
  protected readonly refreshNotice = signal<string | null>(null);

  protected readonly inspectingItem = computed(() => {
    if (this.formOpen() || this.importOpen() || this.captureOpen()) return null;
    return this.store.selected();
  });

  protected readonly drawerOpen = computed(
    () =>
      this.formOpen() ||
      this.importOpen() ||
      this.captureOpen() ||
      this.inspectingItem() !== null,
  );

  ngOnInit() {
    this.store.load();
  }

  openAdd() {
    this.importOpen.set(false);
    this.captureOpen.set(false);
    this.reviewing.set(false);
    this.editingId.set(null);
    this.adding.set(true);
  }

  openCapture() {
    this.adding.set(false);
    this.editingId.set(null);
    this.importOpen.set(false);
    this.captureOpen.set(true);
  }

  openImport() {
    this.adding.set(false);
    this.editingId.set(null);
    this.captureOpen.set(false);
    this.importOpen.set(true);
  }

  startEdit(id: string) {
    this.importOpen.set(false);
    this.captureOpen.set(false);
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
    this.refreshNotice.set(null);
    this.store.selectedId.set(null);
  }

  startReview() {
    const first = this.store.drafts()[0];
    if (!first) return;

    this.captureOpen.set(false);
    this.importOpen.set(false);
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
    await this.supabase.client.auth.signOut();
    await this.router.navigateByUrl('/');
  }
}
