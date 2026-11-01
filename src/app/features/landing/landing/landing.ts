import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BRAND } from '../../../core/brand';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  protected readonly brand = BRAND;
  protected readonly year = new Date().getFullYear();

  protected readonly features = [
    {
      title: 'Cards, books, games, records',
      text: "Each type has its own fields: a card's set and year, a book's author and ISBN, a record's label and format.",
    },
    {
      title: 'A status on every item',
      text: 'Mark items owned, on your wishlist, for sale, sold, or lent out, and see the counts at a glance.',
    },
    {
      title: 'A photo for each',
      text: 'Add a picture to any item and it shows up right in your list.',
    },
    {
      title: 'Find anything',
      text: 'Search by title or detail, filter by type or status, and sort by price, year, or date added.',
    },
    {
      title: 'Bring it in, take it out',
      text: 'Import a spreadsheet to get started, and export your whole collection whenever you like.',
    },
    {
      title: 'Yours alone',
      text: 'Your collection is visible only to you. Install Shoebox on your phone or desktop and it opens like an app.',
    },
  ];
}
