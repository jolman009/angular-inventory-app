import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BRAND } from '../../../core/brand';
import { MEDIA_TYPE_LABELS, MEDIA_TYPES, MediaType } from '../../items/item.model';

interface DemoCatalogCard {
  type: MediaType;
  label: string;
  heading: string;
  lines: string[];
  condition: string;
  price: string;
  status: string;
  statusKey: 'owned' | 'wishlist' | 'for_sale' | 'lent';
}

const DEMO_CARDS: Record<MediaType, DemoCatalogCard> = {
  card: {
    type: 'card',
    label: MEDIA_TYPE_LABELS.card,
    heading: 'Griffey, Ken, Jr.',
    lines: ['Upper Deck, 1989 · No. 1', 'Seattle Mariners · Baseball', 'Grade: PSA 9'],
    condition: 'Near mint',
    price: '$185.00',
    status: 'Owned',
    statusKey: 'owned',
  },
  book: {
    type: 'book',
    label: MEDIA_TYPE_LABELS.book,
    heading: 'Dune — Herbert, Frank',
    lines: ['Chilton Books, 1965 · 1st Ed.', 'ISBN 978-0-441-17271-9', 'Hardcover dust jacket'],
    condition: 'Very good',
    price: '$320.00',
    status: 'Owned',
    statusKey: 'owned',
  },
  game: {
    type: 'game',
    label: MEDIA_TYPE_LABELS.game,
    heading: 'Super Metroid',
    lines: ['Super Nintendo (SNES), 1994', 'Publisher: Nintendo R&D1', 'Complete in box (CIB)'],
    condition: 'Mint',
    price: '$140.00',
    status: 'Lent out',
    statusKey: 'lent',
  },
  vinyl: {
    type: 'vinyl',
    label: MEDIA_TYPE_LABELS.vinyl,
    heading: 'Abbey Road — The Beatles',
    lines: ['Apple Records, 1969 · PCS 7088', 'Format: 12" LP, Stereo', 'UK pressing'],
    condition: 'Near mint',
    price: '$95.00',
    status: 'Wishlist',
    statusKey: 'wishlist',
  },
};

@Component({
  selector: 'app-landing',
  imports: [RouterLink, NgOptimizedImage],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {
  protected readonly brand = BRAND;
  protected readonly year = new Date().getFullYear();
  protected readonly mediaTypes = MEDIA_TYPES;
  protected readonly mediaLabels = MEDIA_TYPE_LABELS;
  protected readonly activeType = signal<MediaType>('card');
  protected readonly activeCard = computed(() => DEMO_CARDS[this.activeType()]);

  protected readonly features = [
    {
      tag: 'Tailored Schemas',
      title: 'Cards, books, games, records',
      text: "Each type has its own fields: a card's set and year, a book's author and ISBN, a record's label and format.",
    },
    {
      tag: 'Live KPIs',
      title: 'A status on every item',
      text: 'Mark items owned, on your wishlist, for sale, sold, or lent out, and track portfolio metrics at a glance.',
    },
    {
      tag: 'Gemini AI Scan',
      title: 'Snap a photo, auto-fill details',
      text: 'Use Quick Capture to photograph covers or cards in batches—Gemini reads the image and suggests fields automatically.',
    },
    {
      tag: 'Instant Facets',
      title: 'Find anything in seconds',
      text: 'Switch between visual gallery cards and compact rows, filter by media or status, and sort by price or year.',
    },
    {
      tag: 'Open Data',
      title: 'Bring it in, take it out',
      text: 'Import a CSV spreadsheet with validation to get started, and export your whole collection whenever you like.',
    },
    {
      tag: 'Private PWA',
      title: 'Yours alone, anywhere',
      text: `Your collection is visible only to you. Install ${BRAND.name} on your phone or desktop and it opens like a native app.`,
    },
  ];

  selectType(type: MediaType) {
    this.activeType.set(type);
  }
}
