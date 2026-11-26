import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ItemStore } from '../item-store';
import { ItemForm } from './item-form';

describe('ItemForm', () => {
  let component: ItemForm;
  let fixture: ComponentFixture<ItemForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemForm],
    }).compileComponents();

    fixture = TestBed.createComponent(ItemForm);
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

  it('shows a save failure inside the form and keeps the input', async () => {
    const store = TestBed.inject(ItemStore);
    vi.spyOn(store, 'add').mockImplementation(async () => {
      store.error.set("Can't reach the server. Check your connection and try again.");
    });
    component['form'].controls.title.setValue('Dune');
    await component.submit();
    fixture.detectChanges();

    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role=alert]');
    expect(alert?.textContent).toContain("Can't reach the server");
    expect(component['form'].controls.title.value).toBe('Dune');
  });

  it('announces a successful add', async () => {
    const store = TestBed.inject(ItemStore);
    vi.spyOn(store, 'add').mockImplementation(async () => {
      store.error.set(null);
    });
    component['form'].controls.title.setValue('Dune');
    await component.submit();
    fixture.detectChanges();

    const status = (fixture.nativeElement as HTMLElement).querySelector('[role=status]');
    expect(status?.textContent).toContain('Added “Dune”');
  });

  it('shows readable type and status names in the dropdowns', () => {
    const el = fixture.nativeElement as HTMLElement;
    const [typeSelect, statusSelect] = Array.from(el.querySelectorAll('select'));
    const typeText = Array.from(typeSelect.options).map(o => o.textContent?.trim());
    const statusText = Array.from(statusSelect.options).map(o => o.textContent?.trim());
    expect(typeText).toEqual(['Card', 'Book', 'Game', 'Record']);
    expect(statusText).toEqual(['Owned', 'Wishlist', 'For sale', 'Sold', 'Lent out']);
    // the stored values stay the same, only the visible text changed
    expect(Array.from(statusSelect.options).map(o => o.value)).toContain('for_sale');
  });

  it('links the title error to its input for screen readers', () => {
    const el = fixture.nativeElement as HTMLElement;
    const title = el.querySelector<HTMLInputElement>('input[formcontrolname=title]')!;
    expect(title.getAttribute('aria-invalid')).toBe('false');

    component['form'].controls.title.markAsTouched();
    fixture.detectChanges();

    expect(title.getAttribute('aria-invalid')).toBe('true');
    const id = title.getAttribute('aria-describedby');
    expect(id).toBe('title-error');
    expect(el.querySelector('#' + id)?.textContent).toContain('is required');
  });

  it('links a "numbers only" error to its detail field', () => {
    const el = fixture.nativeElement as HTMLElement;
    const year = component['detailsGroup'].controls['year'];
    year.setValue('abc');
    year.markAsTouched();
    fixture.detectChanges();

    const input = el.querySelector<HTMLInputElement>('input[aria-describedby="detail-error-year"]');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#detail-error-year')?.textContent).toContain('Numbers only');
  });

  it('links the negative price error to the price input', () => {
    const el = fixture.nativeElement as HTMLElement;
    component['form'].controls.purchase_price.setValue(-5);
    fixture.detectChanges();

    const price = el.querySelector<HTMLInputElement>('input[formcontrolname=purchase_price]')!;
    expect(price.getAttribute('aria-describedby')).toBe('price-error');
    expect(el.querySelector('#price-error')?.textContent).toContain("can't be negative");
  });

  it('still saves detail fields after the type is switched', async () => {
    const store = TestBed.inject(ItemStore);
    const add = vi.spyOn(store, 'add').mockImplementation(async () => store.error.set(null));
    const el = fixture.nativeElement as HTMLElement;

    const typeSelect = el.querySelector<HTMLSelectElement>('select[formcontrolname=type]')!;
    typeSelect.value = typeSelect.options[3].value; // Record
    typeSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const inputs = el.querySelectorAll<HTMLInputElement>('fieldset.details input');
    const year = inputs[2]; // Artist, Label, Year, Format
    year.value = '1969';
    year.dispatchEvent(new Event('input'));
    component['form'].controls.title.setValue('Abbey Road');
    await component.submit();

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'vinyl', details: expect.objectContaining({ year: 1969 }) }),
    );
  });
});
