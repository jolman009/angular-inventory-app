import { Injectable, computed, inject, signal } from '@angular/core';
import { Supabase } from '../../core/supabase';
import { Item, ItemStatus, MediaType, NewItem, SortKey } from './item.model';

const BUCKET = 'item-images';

@Injectable({ providedIn: 'root' })
export class ItemStore {
  private supabase = inject(Supabase);
  private db = this.supabase.client;

  // ---- state (the source of truth) ----
  readonly items = signal<Item[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  // image path -> temporary signed URL we can put in an <img>
  readonly imageUrls = signal<Record<string, string>>({});

  // ---- selection state (what the user is looking at) ----
  readonly typeFilter = signal<MediaType | 'all'>('all');
  readonly statusFilter = signal<ItemStatus | 'all'>('all');
  readonly search = signal('');
  readonly selectedId = signal<string | null>(null);
  readonly sortBy = signal<SortKey>('newest');

  // ---- derived state ----
   readonly filtered = computed(() => {
    const type = this.typeFilter();
    const status = this.statusFilter();
    const q = this.search().trim().toLowerCase();

    const matches = this.items().filter(
      i =>
        (type === 'all' || i.type === type) &&
        (status === 'all' || i.status === status) &&
        (!q || `${i.title} ${Object.values(i.details).join(' ')}`.toLowerCase().includes(q)),
    );

    return this.sortItems(matches, this.sortBy());
  });

  private sortItems(list: Item[], key: SortKey): Item[] {
    const sorted = [...list]; // copy, so we never reorder the source array

    const year = (i: Item) => (typeof i.details['year'] === 'number' ? (i.details['year'] as number) : null);
    const price = (i: Item) => i.purchase_price;

    // Numeric sort where items with no value always land at the bottom
    const byNumber =
      (get: (i: Item) => number | null, direction: 1 | -1) => (a: Item, b: Item) => {
        const x = get(a);
        const y = get(b);
        if (x === null && y === null) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return (x - y) * direction;
      };

    switch (key) {
      case 'oldest':
        return sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
      case 'title':
        return sorted.sort((a, b) =>
          a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }),
        );
      case 'price_high':
        return sorted.sort(byNumber(price, -1));
      case 'price_low':
        return sorted.sort(byNumber(price, 1));
      case 'year_new':
        return sorted.sort(byNumber(year, -1));
      case 'year_old':
        return sorted.sort(byNumber(year, 1));
      default: // 'newest'
        return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
  }

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

  // ---- item actions ----
  async load() {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.db
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) this.error.set(error.message);
    else {
      this.items.set(data as Item[]);
      await this.signImages();
    }

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
    await this.signImages();
  }

  async update(id: string, changes: Partial<NewItem>) {
    this.error.set(null);
    const oldPath = this.items().find(i => i.id === id)?.image_path ?? null;

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

    // If the photo was replaced or removed, delete the old file
    if ('image_path' in changes && oldPath && oldPath !== changes.image_path) {
      await this.deleteFile(oldPath);
    }
    await this.signImages();
  }

  async setStatus(id: string, status: ItemStatus) {
    const previous = this.items();
    this.items.update(list => list.map(i => (i.id === id ? { ...i, status } : i)));

    const { error } = await this.db.from('items').update({ status }).eq('id', id);
    if (error) {
      this.items.set(previous);
      this.error.set(error.message);
    }
  }

  async remove(id: string) {
    const path = this.items().find(i => i.id === id)?.image_path;

    const { error } = await this.db.from('items').delete().eq('id', id);
    if (error) {
      this.error.set(error.message);
      return;
    }
    this.items.update(list => list.filter(i => i.id !== id));
    if (this.selectedId() === id) this.selectedId.set(null);
    if (path) await this.deleteFile(path);
  }

  // ---- image actions ----
  /** Uploads a (already resized) image and returns its path, or null on failure. */
  async uploadImage(blob: Blob): Promise<string | null> {
    const { data } = await this.db.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) {
      this.error.set('You must be signed in to upload photos.');
      return null;
    }

    const path = `${uid}/${crypto.randomUUID()}.jpg`;
    const { error } = await this.db.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg' });

    if (error) {
      this.error.set(error.message);
      return null;
    }
    return path;
  }

  async deleteFile(path: string) {
    await this.db.storage.from(BUCKET).remove([path]);
  }

  /** Fetches temporary links for any images we don't have a link for yet. */
  private async signImages() {
    const known = this.imageUrls();
    const paths = this.items()
      .map(i => i.image_path)
      .filter((p): p is string => !!p && !known[p]);
    if (!paths.length) return;

    const { data, error } = await this.db.storage.from(BUCKET).createSignedUrls(paths, 3600);
    if (error || !data) return;

    const next = { ...known };
    for (const row of data) {
      if (row.path && row.signedUrl) next[row.path] = row.signedUrl;
    }
    this.imageUrls.set(next);
  }
}
