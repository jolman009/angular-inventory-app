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
  created_at: string;
}

export type NewItem = Omit<Item, 'id' | 'created_at'>;
