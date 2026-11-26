import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CsvImport } from './csv-import';

describe('CsvImport', () => {
  let component: CsvImport;
  let fixture: ComponentFixture<CsvImport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CsvImport],
    }).compileComponents();

    fixture = TestBed.createComponent(CsvImport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps file inputs keyboard-focusable (no hidden attribute)', () => {
    const inputs = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type=file]');
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of Array.from(inputs)) {
      expect(input.hidden).toBe(false);
      input.focus();
      expect(document.activeElement).toBe(input);
    }
  });
});
