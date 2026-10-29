export type MediaType = 'card' | 'book' | 'game' | 'vinyl';
export type ItemStatus = 'owned' | 'wishlist' | 'for_sale' | 'sold' | 'lent';

export const MEDIA_TYPES: MediaType[] = ['card', 'book', 'game', 'vinyl'];
export const ITEM_STATUSES: ItemStatus[] = ['owned', 'wishlist', 'for_sale', 'sold', 'lent'];

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
  created_at: string;
}

export type NewItem = Omit<Item, 'id' | 'created_at' | 'image_path'> & {
  image_path?: string | null;
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
