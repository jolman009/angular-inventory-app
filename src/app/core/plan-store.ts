import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Supabase } from './supabase';

/** What each plan includes. The server enforces the same numbers (see supabase/migrations and functions). */
export const PLAN_LIMITS = {
  freeItems: 100,
  freeScansPerDay: 3,
  proScansPerDay: 50,
} as const;

export type BillingPeriod = 'monthly' | 'yearly';

/** Shown on the plans panel. Must match the prices set up in Stripe. */
export const PRO_PRICES: Record<BillingPeriod, { amount: number; per: string }> = {
  monthly: { amount: 3.99, per: 'month' },
  yearly: { amount: 29.99, per: 'year' },
};

/** The person's row in the subscriptions table (written only by the server). */
export interface Subscription {
  status: string | null;
  plan: BillingPeriod | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

/** Stripe statuses that still count as paid. past_due = Stripe is retrying a failed card. */
const PRO_STATUSES = ['active', 'trialing', 'past_due'];

@Injectable({ providedIn: 'root' })
export class PlanStore {
  private supabase = inject(Supabase);
  private document = inject(DOCUMENT);
  private db = this.supabase.client;

  readonly subscription = signal<Subscription | null>(null);
  readonly loaded = signal(false);
  /** Set while we send the person to Stripe, so buttons can't be pressed twice. */
  readonly redirecting = signal(false);
  readonly error = signal<string | null>(null);
  /** True right after Stripe sends the person back from a successful payment. */
  readonly justPaid = signal(false);

  readonly isPro = computed(() => PRO_STATUSES.includes(this.subscription()?.status ?? ''));
  readonly paymentProblem = computed(() => this.subscription()?.status === 'past_due');

  constructor() {
    // Stripe returns people to /collection?panel=plans&checkout=success after paying.
    let returnedFromCheckout = /[?&]checkout=success\b/.test(this.document.location?.search ?? '');

    // Going back from Stripe can show this page from the browser's cache, buttons still disabled.
    this.document.defaultView?.addEventListener('pageshow', () => this.redirecting.set(false));

    // Load the plan whenever someone signs in, and forget it when they sign out.
    effect(() => {
      const userId = this.supabase.session()?.user.id;
      if (!userId) {
        this.subscription.set(null);
        this.loaded.set(false);
        return;
      }
      if (returnedFromCheckout) {
        returnedFromCheckout = false;
        this.justPaid.set(true);
        void this.waitForUpgrade();
      } else {
        void this.load();
      }
    });
  }

  async load() {
    const { data, error } = await this.db
      .from('subscriptions')
      .select('status, plan, current_period_end, cancel_at_period_end')
      .maybeSingle();
    if (error) {
      // Not fatal: the person just sees the free plan, and the server still decides what they can do.
      console.warn('Could not load plan', error);
    } else {
      this.subscription.set((data as Subscription | null) ?? null);
    }
    this.loaded.set(true);
  }

  /** Stripe tells our server about a payment a few seconds after the person returns, so check a few times. */
  private async waitForUpgrade() {
    for (let attempt = 0; attempt < 8; attempt++) {
      await this.load();
      if (this.isPro()) return;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  /** Sends the person to Stripe's payment page. */
  startCheckout(period: BillingPeriod) {
    return this.goTo('billing-checkout', { plan: period }, "We couldn't open the payment page. Try again.");
  }

  /** Sends a Pro member to Stripe's page for changing their card, plan, or cancelling. */
  openBillingPortal() {
    return this.goTo('billing-portal', {}, "We couldn't open the billing page. Try again.");
  }

  private async goTo(fn: string, body: object, fallback: string) {
    this.error.set(null);
    this.redirecting.set(true);
    const { data, error } = await this.db.functions.invoke(fn, { body });

    if (error || !data?.url) {
      let message = fallback;
      if (error instanceof FunctionsHttpError) {
        try {
          message = (await error.context.json()).error ?? message;
        } catch {
          // keep the fallback
        }
      }
      this.error.set(message);
      this.redirecting.set(false);
      return;
    }
    this.document.location.assign(data.url as string);
  }
}
