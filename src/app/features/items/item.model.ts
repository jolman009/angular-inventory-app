export type MediaType = 'card' | 'book' | 'game' | 'vinyl';
export type ItemStatus = 'owned' | 'wishlist' | 'for_sale' | 'sold' | 'lent';

export const MEDIA_TYPES: MediaType[] = ['card', 'book', 'game', 'vinyl'];
export const ITEM_STATUSES: ItemStatus[] = ['owned', 'wishlist', 'for_sale', 'sold', 'lent'];

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  card: 'Cards',
  book: 'Books',
  game: 'Games',
  vinyl: 'Records',
};

export const STATUS_LABELS: Record<ItemStatus, string> = {
  owned: 'Owned',
  wishlist: 'Wishlist',
  for_sale: 'For sale',
  sold: 'Sold',
  lent: 'Lent out',
};

export interface Item {
  id: string;
  type: MediaType;
  title: string;
  status: ItemStatus;
  condition: string | null;
  purchase_price: number | null;
  notes: string | null;
  details: Record<string, unknown>;
  image_path: string | null;
  draft: boolean;
  created_at: string;
}

export type NewItem = Omit<Item, 'id' | 'created_at' | 'image_path' | 'draft'> & {
  image_path?: string | null;
  draft?: boolean;
};
export interface DetailField {
  key: string;
  label: string;
  kind: 'text' | 'number' | 'select';
  placeholder?: string;
  options?: string[];
}

export const DETAIL_FIELDS: Record<MediaType, DetailField[]> = {
    card: [
    { key: 'team', label: 'Team', kind: 'text', placeholder: 'e.g. Seattle Mariners' },
    {
      key: 'sport',
      label: 'Sport',
      kind: 'select',
      options: ['Baseball', 'Basketball', 'Football', 'Other'],
    },
    { key: 'year', label: 'Year', kind: 'number', placeholder: '1989' },
    { key: 'set', label: 'Set', kind: 'text', placeholder: 'e.g. Upper Deck' },
    { key: 'card_number', label: 'Card #', kind: 'text' },
    { key: 'grade', label: 'Grade', kind: 'text', placeholder: 'e.g. PSA 9' },
  ],
  book: [
    { key: 'author', label: 'Author', kind: 'text' },
    { key: 'isbn', label: 'ISBN', kind: 'text' },
    { key: 'publisher', label: 'Publisher', kind: 'text' },
    { key: 'year', label: 'Year', kind: 'number' },
  ],
  game: [
    { key: 'platform', label: 'Platform', kind: 'text', placeholder: 'e.g. Super Nintendo' },
    { key: 'publisher', label: 'Publisher', kind: 'text' },
    { key: 'year', label: 'Year', kind: 'number' },
  ],
  vinyl: [
    { key: 'artist', label: 'Artist', kind: 'text' },
    { key: 'label', label: 'Label', kind: 'text' },
    { key: 'year', label: 'Year', kind: 'number' },
    { key: 'format', label: 'Format', kind: 'text', placeholder: 'e.g. LP, EP, 7-inch' },
  ],
};

export const TITLE_LABELS: Record<MediaType, { label: string; placeholder: string }> = {
  card: { label: 'Player', placeholder: 'e.g. Ken Griffey Jr.' },
  book: { label: 'Title', placeholder: 'e.g. Dune' },
  game: { label: 'Title', placeholder: 'e.g. Super Metroid' },
  vinyl: { label: 'Album', placeholder: 'e.g. Abbey Road' },
};

export type SortKey =
  | 'newest'
  | 'oldest'
  | 'title'
  | 'price_high'
  | 'price_low'
  | 'value_high'
  | 'value_low'
  | 'year_new'
  | 'year_old';

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest added' },
  { value: 'oldest', label: 'Oldest added' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'price_high', label: 'Price: high to low' },
  { value: 'price_low', label: 'Price: low to high' },
  { value: 'value_high', label: 'Est. value: high to low' },
  { value: 'value_low', label: 'Est. value: low to high' },
  { value: 'year_new', label: 'Year: newest first' },
  { value: 'year_old', label: 'Year: oldest first' },
];

export interface ScanSuggestion {
  title: string | null;
  details: Record<string, unknown>;
}

export interface CardValuation {
  medianPrice: number;
  lowPrice: number;
  highPrice: number;
  sampleSize: number;
  query: string;
  ebaySearchUrl: string;
  updatedAt: string;
}

export interface CardPriceQuery {
  title: string;
  year?: string | number | null;
  set?: string | null;
  card_number?: string | null;
  grade?: string | null;
  sport?: string | null;
}

export function getCardValuation(
  details: Record<string, unknown> | null | undefined,
): CardValuation | null {
  if (!details || typeof details['valuation'] !== 'object' || details['valuation'] === null) {
    return null;
  }
  const v = details['valuation'] as Record<string, unknown>;
  if (typeof v['medianPrice'] !== 'number' || !Number.isFinite(v['medianPrice'])) {
    return null;
  }
  return {
    medianPrice: v['medianPrice'],
    lowPrice: typeof v['lowPrice'] === 'number' ? v['lowPrice'] : v['medianPrice'],
    highPrice: typeof v['highPrice'] === 'number' ? v['highPrice'] : v['medianPrice'],
    sampleSize: typeof v['sampleSize'] === 'number' ? v['sampleSize'] : 1,
    query: typeof v['query'] === 'string' ? v['query'] : '',
    ebaySearchUrl: typeof v['ebaySearchUrl'] === 'string' ? v['ebaySearchUrl'] : 'https://www.ebay.com',
    updatedAt: typeof v['updatedAt'] === 'string' ? v['updatedAt'] : '',
  };
}
