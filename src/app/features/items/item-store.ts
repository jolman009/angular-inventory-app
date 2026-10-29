import { Injectable, computed, inject, signal } from '@angular/core';
import { Supabase } from '../../core/supabase';
import { Item, ItemStatus, MediaType, NewItem } from './item.model';

@Injectable({ providedIn: 'root' })
export class ItemStore {
  private db = inject(Supabase).client;

  // ---- state (the source of truth) ----
  readonly items = signal<Item[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ---- selection state (what the user is looking at) ----
  readonly typeFilter = signal<MediaType | 'all'>('all');
  readonly statusFilter = signal<ItemStatus | 'all'>('all');
  readonly search = signal('');
  readonly selectedId = signal<string | null>(null);

  // ---- derived state: recalculates automatically when inputs change ----
  readonly filtered = computed(() => {
    const type = this.typeFilter();
    const status = this.statusFilter();
    const q = this.search().trim().toLowerCase();

    return this.items().filter(
      i =>
        (type === 'all' || i.type === type) &&
        (status === 'all' || i.status === status) &&
        (!q || `${i.title} ${Object.values(i.details).join(' ')}`.toLowerCase().includes(q)),
    );
  });

  readonly selected = computed(
    () => this.items().find(i => i.id === this.selectedId()) ?? null,
  );

  readonly countsByStatus = computed(() => {
    const counts: Partial<Record<ItemStatus, number>> = {};
    for (const i of this.items()) counts[i.status] = (counts[i.status] ?? 0) + 1;
    return counts;
  });

  readonly totalSpent = computed(() =>
    this.items().reduce((sum, i) => sum + (i.purchase_price ?? 0), 0),
  );

  // ---- actions ----
  async load() {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.db
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) this.error.set(error.message);
    else this.items.set(data as Item[]);

    this.loading.set(false);
  }

  async add(item: NewItem) {
    this.error.set(null);
    const { data, error } = await this.db.from('items').insert(item).select().single();

    if (error) {
      this.error.set(error.message);
      return;
    }
    this.items.update(list => [data as Item, ...list]);
  }

    async update(id: string, changes: Partial<NewItem>) {
    this.error.set(null);
    const { data, error } = await this.db
      .from('items')
      .update(changes)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.error.set(error.message);
      return;
    }
    this.items.update(list => list.map(i => (i.id === id ? (data as Item) : i)));
  }

  async setStatus(id: string, status: ItemStatus) {
    const previous = this.items();
    // update the screen immediately...
    this.items.update(list => list.map(i => (i.id === id ? { ...i, status } : i)));

    // ...then save; undo if the save fails
    const { error } = await this.db.from('items').update({ status }).eq('id', id);
    if (error) {
      this.items.set(previous);
      this.error.set(error.message);
    }
  }

  async remove(id: string) {
    const { error } = await this.db.from('items').delete().eq('id', id);
    if (error) {
      this.error.set(error.message);
      return;
    }
    this.items.update(list => list.filter(i => i.id !== id));
    if (this.selectedId() === id) this.selectedId.set(null);
  }
}
