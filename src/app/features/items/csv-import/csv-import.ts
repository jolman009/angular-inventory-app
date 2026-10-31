import { Component, computed, inject, output, signal } from '@angular/core';
import { ItemStore } from '../item-store';
import { ParseResult, downloadCsv, parseCsv, templateCsv } from '../csv';

const MAX_ROWS = 1000;

@Component({
  selector: 'app-csv-import',
  templateUrl: './csv-import.html',
  styleUrl: './csv-import.scss',
})
export class CsvImport {
  private store = inject(ItemStore);
  readonly done = output<void>();

  protected readonly fileName = signal<string | null>(null);
  protected readonly result = signal<ParseResult | null>(null);
  protected readonly readError = signal<string | null>(null);
  protected readonly importing = signal(false);
  protected readonly imported = signal<number | null>(null);

  // only show the first 10 problems so a messy file doesn't flood the screen
  protected readonly shownErrors = computed(() => this.result()?.errors.slice(0, 10) ?? []);

  async onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.imported.set(null);
    this.readError.set(null);
    this.result.set(null);

    if (file.size > 2_000_000) {
      this.readError.set('That file is over 2 MB. Try splitting it into smaller files.');
      return;
    }

    try {
      const parsed = parseCsv(await file.text());
      if (parsed.valid.length + parsed.errors.length > MAX_ROWS) {
        this.readError.set(`Please import ${MAX_ROWS.toLocaleString()} rows or fewer at a time.`);
        return;
      }
      this.fileName.set(file.name);
      this.result.set(parsed);
    } catch {
      this.readError.set('Could not read that file. Make sure it is a .csv file.');
    }
  }

  async runImport() {
    const r = this.result();
    if (!r || !r.valid.length) return;

    this.importing.set(true);
    const count = await this.store.addMany(r.valid);
    this.imported.set(count);
    this.result.set(null);
    this.importing.set(false);
  }

  downloadTemplate() {
    downloadCsv('collection-template.csv', templateCsv());
  }
}
