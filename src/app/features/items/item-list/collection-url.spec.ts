import { CollectionUrlState, hasDrawer, paramsKey, paramsToState, stateToParams } from './collection-url';

const base: CollectionUrlState = {
  panel: null,
  item: null,
  q: '',
  type: 'all',
  status: 'all',
  sort: 'newest',
};

describe('collection-url', () => {
  it('leaves defaults out of the address bar', () => {
    expect(stateToParams(base)).toEqual({});
  });

  it('round-trips every panel and filter', () => {
    const states: CollectionUrlState[] = [
      { ...base, panel: 'add' },
      { ...base, panel: 'edit', item: 'abc' },
      { ...base, panel: 'review', item: 'abc' },
      { ...base, panel: 'capture' },
      { ...base, panel: 'import' },
      { ...base, panel: 'plans' },
      { ...base, item: 'abc' },
      { ...base, q: 'griffey', type: 'card', status: 'for_sale', sort: 'value_high' },
    ];
    for (const s of states) {
      expect(paramsToState(stateToParams(s))).toEqual(s);
    }
  });

  it('ignores unknown or incomplete values', () => {
    expect(paramsToState({ panel: 'evil', type: 'spaceship', status: 'x', sort: 'random' })).toEqual(base);
    // editing without an item id can't work, so it opens nothing
    expect(paramsToState({ panel: 'edit' }).panel).toBeNull();
  });

  it('knows when the drawer is open', () => {
    expect(hasDrawer(base)).toBe(false);
    expect(hasDrawer({ ...base, item: 'abc' })).toBe(true);
    expect(hasDrawer({ ...base, panel: 'import' })).toBe(true);
  });

  it('compares params regardless of order', () => {
    expect(paramsKey({ a: '1', b: '2' })).toBe(paramsKey({ b: '2', a: '1' }));
  });
});
