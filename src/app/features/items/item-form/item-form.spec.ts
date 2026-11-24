import { ComponentFixture, TestBed } from '@angular/core/testing';

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
});
