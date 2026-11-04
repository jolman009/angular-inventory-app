import { FunctionsHttpError } from '@supabase/supabase-js';
import { blobToBase64 } from '../../core/blob';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Supabase } from '../../core/supabase';
import {
  CardPriceQuery,
  CardValuation,
  Item,
  ItemStatus,
  MediaType,
  NewItem,
  ScanSuggestion,
  SortKey,
  getCardValuation,
} from './item.model';

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
  readonly viewMode = signal<'grid' | 'list'>('grid');

  // Drafts are photos waiting for details. Everything else is the real collection.
  readonly committed = computed(() => this.items().filter(i => !i.draft));
  readonly drafts = computed(() =>
    this.items()
      .filter(i => i.draft)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)), // oldest first = order shot
  );

  // ---- derived state ----
   readonly filtered = computed(() => {
    const type = this.typeFilter();
    const status = this.statusFilter();
    const q = this.search().trim().toLowerCase();

    const matches = this.committed().filter(
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
    const estValue = (i: Item) => getCardValuation(i.details)?.medianPrice ?? i.purchase_price;

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
      case 'value_high':
        return sorted.sort(byNumber(estValue, -1));
      case 'value_low':
        return sorted.sort(byNumber(estValue, 1));
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
    for (const i of this.committed()) counts[i.status] = (counts[i.status] ?? 0) + 1;
    return counts;
  });

  readonly countsByType = computed(() => {
    const counts: Partial<Record<MediaType, number>> = {};
    for (const i of this.committed()) counts[i.type] = (counts[i.type] ?? 0) + 1;
    return counts;
  });

  readonly totalSpent = computed(() =>
    this.committed().reduce((sum, i) => sum + (i.purchase_price ?? 0), 0),
  );

  readonly totalEstimatedValue = computed(() =>
    this.committed().reduce(
      (sum, i) => sum + (getCardValuation(i.details)?.medianPrice ?? i.purchase_price ?? 0),
      0,
    ),
  );

  readonly valuedCardsCount = computed(
    () => this.committed().filter(i => i.type === 'card' && getCardValuation(i.details) !== null).length,
  );

  readonly unvaluedCards = computed(() =>
    this.committed().filter(i => i.type === 'card' && getCardValuation(i.details) === null),
  );

  readonly pricingProgress = signal<{ current: number; total: number } | null>(null);

  readonly pricedCount = computed(
    () => this.committed().filter(i => (i.purchase_price ?? 0) > 0).length,
  );

  readonly averageSpent = computed(() => {
    const count = this.pricedCount();
    return count > 0 ? this.totalSpent() / count : 0;
  });

  readonly activeFilterCount = computed(
    () =>
      (this.typeFilter() !== 'all' ? 1 : 0) +
      (this.statusFilter() !== 'all' ? 1 : 0) +
      (this.search().trim() ? 1 : 0),
  );

  resetFilters() {
    this.typeFilter.set('all');
    this.statusFilter.set('all');
    this.search.set('');
  }

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

      /** Quick capture: uploads one photo and saves it as a draft item. Returns true on success. */
  async addDraft(type: MediaType, photo: Blob, suggestion?: ScanSuggestion | null): Promise<boolean> {
    const path = await this.uploadImage(photo);
    if (!path) return false;

    await this.add({
      type,
      title: suggestion?.title || `Untitled ${type}`,
      status: 'owned',
      condition: null,
      purchase_price: null,
      notes: null,
      details: suggestion?.details ?? {},
      draft: true,
      image_path: path,
    });

    if (this.error()) {
      await this.deleteFile(path); // don't leave an orphan photo behind
      return false;
    }
    return true;
  }

  /** Asks the scan function for suggested fields. Never throws; scanning is a best-effort extra. */
  async scanPhoto(
    type: MediaType,
    photo: Blob,
  ): Promise<{ suggestion: ScanSuggestion | null; notice: string | null }> {
    try {
      const image = await blobToBase64(photo);
      const { data, error } = await this.db.functions.invoke('scan-item', {
        body: { image, mimeType: 'image/jpeg', type },
      });

      if (error) {
        let notice = 'Suggestions are unavailable right now.';
        if (error instanceof FunctionsHttpError) {
          try {
            notice = (await error.context.json()).error ?? notice;
          } catch {
            // keep the generic message
          }
        }
        return { suggestion: null, notice };
      }

      const suggestion = data as ScanSuggestion;
      const found = !!suggestion?.title || Object.keys(suggestion?.details ?? {}).length > 0;
      return { suggestion: found ? suggestion : null, notice: found ? null : 'Nothing readable found.' };
    } catch (e) {
      console.warn('Scan failed', e);
      return { suggestion: null, notice: 'Suggestions are unavailable right now.' };
    }
  }

  /** Queries the ebay-price edge function for a card's median Browse API value. */
  async estimateCardPrice(
    query: CardPriceQuery,
  ): Promise<{ valuation: CardValuation | null; notice: string | null }> {
    try {
      const { data, error } = await this.db.functions.invoke('ebay-price', {
        body: query,
      });

      if (error) {
        let notice = 'eBay price estimate is unavailable right now.';
        if (error instanceof FunctionsHttpError) {
          try {
            notice = (await error.context.json()).error ?? notice;
          } catch {
            // keep default notice
          }
        }
        return { valuation: null, notice };
      }

      const res = data as { valuation?: CardValuation | null; notice?: string | null };
      return {
        valuation: res?.valuation ?? null,
        notice: res?.notice ?? (res?.valuation ? null : 'No matching eBay listings found.'),
      };
    } catch (e) {
      console.warn('eBay price estimate failed', e);
      return { valuation: null, notice: 'eBay price estimate is unavailable right now.' };
    }
  }

  /** Fetches and persists the eBay median valuation for a saved card item. */
  async refreshCardEstimate(
    item: Item,
  ): Promise<{ valuation: CardValuation | null; notice: string | null }> {
    const query: CardPriceQuery = {
      title: item.title,
      year: item.details['year'] as string | number | undefined,
      set: item.details['set'] as string | undefined,
      card_number: item.details['card_number'] as string | undefined,
      grade: (item.details['grade'] as string | undefined) || item.condition,
      sport: item.details['sport'] as string | undefined,
    };

    const { valuation, notice } = await this.estimateCardPrice(query);
    if (valuation) {
      await this.update(item.id, {
        details: { ...item.details, valuation },
      });
    }
    return { valuation, notice };
  }

  /** Batch-updates eBay price estimates for existing cards in the collection. */
  async refreshAllCardEstimates(onlyMissing = true): Promise<{ updated: number; total: number }> {
    const targets = onlyMissing
      ? this.unvaluedCards()
      : this.committed().filter(i => i.type === 'card');

    if (!targets.length) return { updated: 0, total: 0 };

    let updated = 0;
    this.pricingProgress.set({ current: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      this.pricingProgress.set({ current: i + 1, total: targets.length });
      const { valuation } = await this.refreshCardEstimate(targets[i]);
      if (valuation) updated++;
    }

    this.pricingProgress.set(null);
    return { updated, total: targets.length };
  }

  /** Saves many items at once, in chunks of 100. Returns how many were saved. */
  async addMany(rows: NewItem[]): Promise<number> {
    this.error.set(null);
    let added = 0;

    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { data, error } = await this.db.from('items').insert(chunk).select();

      if (error) {
        this.error.set(`Saved ${added} of ${rows.length} rows, then stopped: ${error.message}`);
        break;
      }
      this.items.update(list => [...(data as Item[]), ...list]);
      added += chunk.length;
    }
    return added;
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
