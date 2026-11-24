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
});
