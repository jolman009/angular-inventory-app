import { TestBed } from '@angular/core/testing';

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
    expect(service.pricedCount()).toBe(3);
    expect(service.totalSpent()).toBe(190);
    // Griffey uses 185 medianPrice, Ichiro falls back to 40, Abbey Road uses 50 -> 275
    expect(service.totalEstimatedValue()).toBe(275);
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
});
