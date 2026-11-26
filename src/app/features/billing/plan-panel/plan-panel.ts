import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BRAND } from '../../../core/brand';
import { PLAN_LIMITS, PRO_PRICES, PlanStore } from '../../../core/plan-store';

/** The Membership drawer: what each plan includes, and the buttons to upgrade or manage billing. */
@Component({
  selector: 'app-plan-panel',
  imports: [CurrencyPipe],
  templateUrl: './plan-panel.html',
  styleUrl: './plan-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanPanel {
  protected readonly plan = inject(PlanStore);

  /** Everything the person has saved, drafts included (the free limit counts all of them). */
  readonly itemCount = input.required<number>();

  protected readonly brand = BRAND;
  protected readonly limits = PLAN_LIMITS;
  protected readonly prices = PRO_PRICES;
  /** How much the yearly plan saves compared with paying monthly for 12 months. */
  protected readonly yearlySavingPercent = Math.round(
    (1 - PRO_PRICES.yearly.amount / (PRO_PRICES.monthly.amount * 12)) * 100,
  );

  protected readonly usedPercent = computed(() =>
    Math.min(100, Math.round((this.itemCount() / PLAN_LIMITS.freeItems) * 100)),
  );
  protected readonly renewalLabel = computed(() =>
    this.plan.subscription()?.cancel_at_period_end ? 'Pro ends on' : 'Renews on',
  );
  /** e.g. "Nov 26, 2027". Uses Intl directly: Angular's DatePipe would add ~9 kB to the first page load. */
  protected readonly periodEnd = computed(() => {
    const end = this.plan.subscription()?.current_period_end;
    return end ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(Date.parse(end)) : null;
  });
}
