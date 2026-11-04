import { parse, unparse } from 'papaparse';
import {
  DETAIL_FIELDS,
  ITEM_STATUSES,
  Item,
  ItemStatus,
  MEDIA_TYPES,
  MediaType,
  NewItem,
  getCardValuation,
} from './item.model';

export interface RowError {
  row: number; // the row number as it appears in a spreadsheet (header = row 1)
  message: string;
}

export interface ParseResult {
  valid: NewItem[];
  errors: RowError[];
}

const BASE_COLUMNS = ['type', 'title', 'status', 'condition', 'purchase_price', 'notes'];
const DETAIL_KEYS = [...new Set(Object.values(DETAIL_FIELDS).flat().map(f => f.key))];
export const CSV_COLUMNS = [...BASE_COLUMNS, ...DETAIL_KEYS];

// Friendly alternative column names people might already have in a spreadsheet
const HEADER_ALIASES: Record<string, string> = {
  name: 'title',
  player: 'title',
  album: 'title',
  price: 'purchase_price',
  paid: 'purchase_price',
  price_paid: 'purchase_price',
  card_no: 'card_number',
  card_: 'card_number',
};

const normalizeHeader = (h: string) => {
  const n = h.trim().toLowerCase().replace(/[\s#-]+/g, '_').replace(/_+$/, '');
  return HEADER_ALIASES[n] ?? n;
};

export function parseCsv(text: string): ParseResult {
  const parsed = parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
  });

  const headers = parsed.meta.fields ?? [];
  if (!headers.includes('type') || !headers.includes('title')) {
    return {
      valid: [],
      errors: [
        {
          row: 1,
          message: 'The first row must contain "type" and "title" column headings.',
        },
      ],
    };
  }

  const valid: NewItem[] = [];
  const errors: RowError[] = [];

  parsed.data.forEach((raw, index) => {
    const row = index + 2; // +1 for the header row, +1 because spreadsheets count from 1
    const get = (key: string) => (raw[key] ?? '').trim();
    const fail = (message: string): void => {
      errors.push({ row, message });
    };
    const type = get('type').toLowerCase() as MediaType;
    if (!MEDIA_TYPES.includes(type)) {
      return fail(`Type "${get('type')}" must be one of: ${MEDIA_TYPES.join(', ')}.`);
    }

    const title = get('title');
    if (!title) return fail('Title is required.');
    if (title.length > 200) return fail('Title is longer than 200 characters.');

    const status = (get('status').toLowerCase().replace(/\s+/g, '_') || 'owned') as ItemStatus;
    if (!ITEM_STATUSES.includes(status)) {
      return fail(`Status "${get('status')}" must be one of: ${ITEM_STATUSES.join(', ')}.`);
    }

    let price: number | null = null;
    const priceText = get('purchase_price').replace(/[$,]/g, '');
    if (priceText) {
      price = Number(priceText);
      if (!Number.isFinite(price) || price < 0) {
        return fail(`Price "${get('purchase_price')}" must be a number that is 0 or more.`);
      }
    }

    const details: Record<string, unknown> = {};
    for (const f of DETAIL_FIELDS[type]) {
      const v = get(f.key);
      if (!v) continue;

      if (f.kind === 'number') {
        if (!/^\d+$/.test(v)) return fail(`${f.label} "${v}" must be a whole number.`);
        details[f.key] = Number(v);
      } else if (f.kind === 'select') {
        // match ignoring upper/lower case; anything unrecognized becomes "Other"
        details[f.key] = f.options?.find(o => o.toLowerCase() === v.toLowerCase()) ?? 'Other';
      } else {
        details[f.key] = v;
      }
    }

    valid.push({
      type,
      title,
      status,
      condition: get('condition') || null,
      purchase_price: price,
      notes: get('notes') || null,
      details,
    });
  });

  return { valid, errors };
}

/** A small example file people can open in a spreadsheet and fill in. */
export function templateCsv(): string {
  const rows = [
    { type: 'card', title: 'Ken Griffey Jr.', status: 'owned', condition: 'Near mint', purchase_price: 25, team: 'Seattle Mariners', sport: 'Baseball', year: 1989, set: 'Upper Deck', card_number: '1' },
    { type: 'book', title: 'Dune', status: 'wishlist', author: 'Frank Herbert', year: 1965 },
    { type: 'vinyl', title: 'Abbey Road', status: 'owned', condition: 'VG+', purchase_price: 18.5, artist: 'The Beatles', label: 'Apple', year: 1969, format: 'LP' },
  ];
  return unparse(rows, { columns: CSV_COLUMNS });
}

export function itemsToCsv(items: Item[]): string {
  const rows = items.map(i => ({
    type: i.type,
    title: i.title,
    status: i.status,
    condition: i.condition ?? '',
    purchase_price: i.purchase_price ?? '',
    estimated_price: getCardValuation(i.details)?.medianPrice ?? '',
    notes: i.notes ?? '',
    ...Object.fromEntries(DETAIL_KEYS.map(k => [k, i.details[k] ?? ''])),
  }));
  // escapeFormulae stops spreadsheets from treating text like "=1+1" as a formula
  return unparse(rows, {
    columns: ['type', 'title', 'status', 'condition', 'purchase_price', 'estimated_price', 'notes', ...DETAIL_KEYS],
    escapeFormulae: true,
  });
}

export function downloadCsv(filename: string, csv: string) {
  // the leading \ufeff helps Excel read accented characters correctly
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
