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
});
