import { TestBed } from '@angular/core/testing';

import { Supabase } from '../../core/supabase';
import { ItemStore } from './item-store';

describe('ItemStore', () => {
  let service: ItemStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ItemStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should compute countsByType, averageSpent, eBay valuations, and resetFilters', () => {
    service.items.set([
      {
        id: '1',
        type: 'card',
        title: 'Ken Griffey Jr.',
        status: 'owned',
        condition: 'Near mint',
        purchase_price: 100,
        notes: null,
        details: {
          year: 1989,
          valuation: {
            medianPrice: 185,
            lowPrice: 150,
            highPrice: 210,
            sampleSize: 20,
            query: '1989 Upper Deck Ken Griffey Jr #1',
            ebaySearchUrl: 'https://www.ebay.com',
            updatedAt: '2026-11-04T00:00:00Z',
          },
        },
        image_path: null,
        draft: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: '2',
        type: 'card',
        title: 'Ichiro Suzuki',
        status: 'owned',
        condition: 'Mint',
        purchase_price: 40,
        notes: null,
        details: { year: 2001 },
        image_path: null,
        draft: false,
        created_at: '2026-01-02T00:00:00Z',
      },
      {
        id: '3',
        type: 'vinyl',
        title: 'Abbey Road',
        status: 'wishlist',
        condition: null,
        purchase_price: 50,
        notes: null,
        details: { year: 1969 },
        image_path: null,
        draft: false,
        created_at: '2026-01-03T00:00:00Z',
      },
    ]);

    expect(service.countsByType()).toEqual({ card: 2, vinyl: 1 });
    // Abbey Road is on the wishlist, so it is not part of what the user holds or paid for
    expect(service.pricedCount()).toBe(2);
    expect(service.totalSpent()).toBe(140);
    // Griffey uses 185 medianPrice, Ichiro falls back to 40 -> 225
    expect(service.totalEstimatedValue()).toBe(225);
    expect(service.valuedCardsCount()).toBe(1);
    expect(service.unvaluedCards().length).toBe(1);

    service.sortBy.set('value_high');
    expect(service.filtered().map(i => i.id)).toEqual(['1', '3', '2']);

    service.typeFilter.set('card');
    service.search.set('griffey');
    expect(service.activeFilterCount()).toBe(2);

    service.resetFilters();
    expect(service.activeFilterCount()).toBe(0);
    expect(service.typeFilter()).toBe('all');
  });

  it('should leave wishlist and sold items out of value and spend totals', () => {
    const base = {
      condition: null,
      notes: null,
      image_path: null,
      draft: false,
      created_at: '2026-01-01T00:00:00Z',
    };
    service.items.set([
      {
        ...base,
        id: 'a',
        type: 'card',
        title: 'Ken Griffey Jr.',
        status: 'owned',
        purchase_price: 100,
        details: {
          valuation: {
            medianPrice: 185,
            lowPrice: 150,
            highPrice: 210,
            sampleSize: 20,
            query: 'q',
            ebaySearchUrl: 'https://www.ebay.com',
            updatedAt: '2026-11-01',
          },
        },
      },
      { ...base, id: 'b', type: 'book', title: 'Dune', status: 'wishlist', purchase_price: 300, details: {} },
      { ...base, id: 'c', type: 'vinyl', title: 'Abbey Road', status: 'sold', purchase_price: 20, details: {} },
      { ...base, id: 'd', type: 'game', title: 'Super Metroid', status: 'lent', purchase_price: 60, details: {} },
    ]);

    expect(service.totalEstimatedValue()).toBe(245);
    expect(service.totalSpent()).toBe(160);
    expect(service.averageSpent()).toBe(80);
  });

  it('should not match search text against the saved eBay valuation', () => {
    service.items.set([
      {
        id: 'a',
        type: 'card',
        title: 'Ken Griffey Jr.',
        status: 'owned',
        condition: null,
        purchase_price: null,
        notes: null,
        details: {
          set: 'Upper Deck',
          valuation: {
            medianPrice: 185,
            lowPrice: 150,
            highPrice: 210,
            sampleSize: 20,
            query: 'q',
            ebaySearchUrl: 'https://www.ebay.com',
            updatedAt: '2026-11-01',
          },
        },
        image_path: null,
        draft: false,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);

    service.search.set('object');
    expect(service.filtered().length).toBe(0);
    service.search.set('upper deck');
    expect(service.filtered().length).toBe(1);
  });

  it('should clear local collection state when deleteAccountAndData succeeds on empty store', async () => {
    const client = TestBed.inject(Supabase).client;
    vi.spyOn(client, 'rpc').mockResolvedValue({ data: null, error: null } as never);
    service.items.set([]);
    service.selectedId.set('1');
    const result = await service.deleteAccountAndData();
    expect(result).toBe(true);
    expect(service.items()).toEqual([]);
    expect(service.selectedId()).toBeNull();
  });

  it('should report failure and keep the user signed in when delete_user fails', async () => {
    const client = TestBed.inject(Supabase).client;
    vi.spyOn(client, 'rpc').mockResolvedValue({
      data: null,
      error: { message: 'function delete_user() does not exist' },
    } as never);
    const deleteRows = vi.spyOn(client, 'from');
    service.items.set([
      {
        id: 'keep-me',
        type: 'book',
        title: 'Dune',
        status: 'owned',
        condition: null,
        purchase_price: null,
        notes: null,
        details: {},
        image_path: null,
        draft: false,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const result = await service.deleteAccountAndData();

    expect(result).toBe(false);
    // Items are only deleted by the server function, so a failed call leaves them in place
    expect(deleteRows).not.toHaveBeenCalled();
    expect(service.items().map(i => i.id)).toEqual(['keep-me']);
    expect(service.error()).toContain("couldn't delete your account");
  });
});
