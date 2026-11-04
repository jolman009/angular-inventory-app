import { QuickCapture } from '../quick-capture/quick-capture';
import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Supabase } from '../../../core/supabase';
import { ItemForm } from '../item-form/item-form';
import { ItemStore } from '../item-store';
import {
  DETAIL_FIELDS,
  ITEM_STATUSES,
  Item,
  ItemStatus,
  MEDIA_TYPES,
  MediaType,
  SORT_OPTIONS,
  SortKey,
} from '../item.model';
import { CsvImport } from '../csv-import/csv-import';
import { downloadCsv, itemsToCsv } from '../csv';
@Component({
  selector: 'app-item-list',
  imports: [ItemForm, CsvImport, QuickCapture, CurrencyPipe],
  templateUrl: './item-list.html',
  styleUrl: './item-list.scss',
})
export class ItemList implements OnInit {
  protected supabase = inject(Supabase);
  protected store = inject(ItemStore);
  private router = inject(Router);

  protected readonly types = MEDIA_TYPES;
  protected readonly statuses = ITEM_STATUSES;

  // Form visibility: open for "add" or while an item is being edited
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

  ngOnInit() {
    this.store.load();
  }

  startEdit(id: string) {
    this.editingId.set(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

   closeForm() {
    this.adding.set(false);
    this.editingId.set(null);
    this.reviewing.set(false);
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

exportCsv() {                                              // ← new, with the other methods
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`my-collection-${today}.csv`, itemsToCsv(this.store.committed()));
    }

  onDelete(item: Item) {
    if (confirm(`Delete "${item.title}"? This can't be undone.`)) {
      this.store.remove(item.id);
    }
  }

  detailSummary(item: Item): string {
    return DETAIL_FIELDS[item.type]
      .map(f => item.details[f.key])
      .filter(v => v !== undefined && v !== '')
      .join(' · ');
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
