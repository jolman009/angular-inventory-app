import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlanStore } from '../../../core/plan-store';
import { PlanPanel } from './plan-panel';

describe('PlanPanel', () => {
  let fixture: ComponentFixture<PlanPanel>;
  let plan: PlanStore;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PlanPanel] }).compileComponents();
    plan = TestBed.inject(PlanStore);
    fixture = TestBed.createComponent(PlanPanel);
    fixture.componentRef.setInput('itemCount', 42);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('shows free plan usage and both Pro prices to free members', () => {
    expect(el.textContent).toContain('42 of 100');
    const buttons = Array.from(el.querySelectorAll('button')).map(b => b.textContent ?? '');
    expect(buttons.some(t => t.includes('$29.99 / year'))).toBe(true);
    expect(buttons.some(t => t.includes('$3.99 / month'))).toBe(true);
    expect(el.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('42');
  });

  it('shows Manage billing instead of prices to Pro members', () => {
    plan.subscription.set({
      status: 'active',
      plan: 'yearly',
      current_period_end: '2027-11-26T00:00:00Z',
      cancel_at_period_end: false,
    });
    fixture.detectChanges();

    expect(el.textContent).toContain('Manage billing');
    expect(el.textContent).toContain('Renews on');
    expect(el.textContent).not.toContain('$3.99');
  });

  it('keeps Pro while Stripe retries a failed payment, and warns about it', () => {
    plan.subscription.set({ status: 'past_due', plan: 'monthly', current_period_end: null, cancel_at_period_end: false });
    fixture.detectChanges();

    expect(plan.isPro()).toBe(true);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("didn't go through");
  });

  it('treats a cancelled subscription as the free plan', () => {
    plan.subscription.set({ status: 'canceled', plan: 'monthly', current_period_end: null, cancel_at_period_end: false });
    fixture.detectChanges();

    expect(plan.isPro()).toBe(false);
    expect(el.textContent).toContain('42 of 100');
  });
});
