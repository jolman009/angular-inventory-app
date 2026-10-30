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
} from '../item.model';

@Component({
  selector: 'app-item-list',
  imports: [ItemForm, CurrencyPipe],
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

  async signOut() {
    await this.supabase.client.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
