import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuickCapture } from './quick-capture';

describe('QuickCapture', () => {
  let component: QuickCapture;
  let fixture: ComponentFixture<QuickCapture>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuickCapture],
    }).compileComponents();

    fixture = TestBed.createComponent(QuickCapture);
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
