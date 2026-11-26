import { Params } from '@angular/router';
import {
  ITEM_STATUSES,
  ItemStatus,
  MEDIA_TYPES,
  MediaType,
  SORT_OPTIONS,
  SortKey,
} from '../item.model';

/** What the drawer shows. `null` with an item id means the item inspector. */
export type Panel = 'add' | 'edit' | 'review' | 'capture' | 'import' | 'plans' | null;

/**
 * Everything on the collection page worth keeping in the address bar, so that
 * Back closes the drawer and a reload or shared link restores the same view.
 */
export interface CollectionUrlState {
  panel: Panel;
  item: string | null;
  q: string;
  type: MediaType | 'all';
  status: ItemStatus | 'all';
  sort: SortKey;
}

const PANELS: Exclude<Panel, null>[] = ['add', 'edit', 'review', 'capture', 'import', 'plans'];
const SORTS = SORT_OPTIONS.map(o => o.value);

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Reads the address bar. Unknown or broken values fall back to the defaults. */
export function paramsToState(params: Params): CollectionUrlState {
  const raw = params['panel'];
  let panel: Panel = typeof raw === 'string' && (PANELS as string[]).includes(raw) ? (raw as Panel) : null;
  const item = typeof params['item'] === 'string' && params['item'] ? params['item'] : null;
  // Editing needs to know which item
  if ((panel === 'edit' || panel === 'review') && !item) panel = null;

  return {
    panel,
    item,
    q: typeof params['q'] === 'string' ? params['q'] : '',
    type: pick(params['type'], MEDIA_TYPES, 'all' as MediaType | 'all'),
    status: pick(params['status'], ITEM_STATUSES, 'all' as ItemStatus | 'all'),
    sort: pick(params['sort'], SORTS, 'newest'),
  };
}

/** Writes the address bar. Default values are left out to keep links short. */
export function stateToParams(s: CollectionUrlState): Params {
  const params: Params = {};
  if (s.panel) params['panel'] = s.panel;
  if (s.item && s.panel !== 'add' && s.panel !== 'capture' && s.panel !== 'import' && s.panel !== 'plans') {
    params['item'] = s.item;
  }
  if (s.q) params['q'] = s.q;
  if (s.type !== 'all') params['type'] = s.type;
  if (s.status !== 'all') params['status'] = s.status;
  if (s.sort !== 'newest') params['sort'] = s.sort;
  return params;
}

/** True when this state has the drawer open (any panel, or an item in the inspector). */
export function hasDrawer(s: CollectionUrlState): boolean {
  return s.panel !== null || s.item !== null;
}

/** A stable text form of the params, for comparing two URLs. */
export function paramsKey(params: Params): string {
  return Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
}
