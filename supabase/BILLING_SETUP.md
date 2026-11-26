# Vaulted Pro billing setup (Stripe + Supabase)

The app code is ready. These steps connect it to your Stripe account. Do everything in a
**Stripe sandbox** first. A sandbox is a separate test copy of your Stripe account: nobody is
charged, and you pay with Stripe's test card `4242 4242 4242 4242` (any future expiry date,
any CVC, any ZIP).

Your Supabase project: `hejeahinipihvztvoeeo`. Your app: https://angular-inventory-app-red.vercel.app

> Order matters a little: run the SQL (step 1) **before** deploying the updated `scan-item`,
> `ebay-price` and `delete-account` functions, because they call the new `is_pro` database function.

## 1. Supabase: run the SQL

1. Supabase dashboard > **SQL Editor** > New query.
2. Paste all of `supabase/migrations/20261127000000_subscriptions.sql` and click **Run**.
   It creates the `subscriptions` table, the `is_pro` check and the 100-item free limit.
   It's safe to run twice.

## 2. Stripe: make a sandbox just for Vaulted

1. In the Stripe Dashboard, open the account menu (top left) > **Sandboxes** > **Create sandbox**.
2. Name it `Vaulted`. Do steps 3 to 7 inside this sandbox.

Using its own sandbox keeps Vaulted's test data and settings apart from anything else in your account.

## 3. Stripe: tax settings (before you create prices)

Do this first, because a price's tax behavior **can't be changed after the price is created**.

1. **Settings** > **Tax** (or **Tax** in the left menu):
   - **Head office address**: your business address. Stripe Tax does nothing until this is set.
   - **Default tax behavior**: **Inclusive**. You chose this: people always pay exactly $3.99 or $29.99,
     and any tax comes out of that.
   - **Preset product tax code**: pick the code for software sold as a subscription service. Stripe's
     planner suggested `txcd_10103000`. Check its description in
     [Stripe's tax code list](https://docs.stripe.com/tax/tax-codes) and confirm it with your tax advisor.
2. **Tax** > **Locations** (threshold monitoring): leave it on. Stripe watches your live sales and
   emails you if you may need to register somewhere. It only counts live sales, not the sandbox.
3. **Registrations**: Stripe only collects tax in places where you add a registration. Until then
   it collects nothing, even with tax switched on. Ask a tax advisor where you need to register, then
   add those under **Tax** > **Locations** > **Add registration**. Adding a registration in Stripe
   doesn't register you with the state; it records a registration you already have (or use Stripe's
   "Register for me" if you're eligible).

## 4. Stripe: create the product and prices

1. **Product catalog** > **Add product**.
   - Name: `Vaulted Pro`
   - Tax code: the one from step 3 (it may fill in by itself).
   - Add a price: **Recurring**, `$3.99`, **Monthly**. Under tax behavior, check it says **Inclusive**. Save.
   - Add a second price to the same product: **Recurring**, `$29.99`, **Yearly**, **Inclusive**. Save.
2. Open each price and copy its ID (starts with `price_`). You need both in step 8.

## 5. Stripe: billing settings

1. **Settings** > **Billing** > **Customer portal** (the page behind the app's **Manage billing** button).
   Turn on: update payment method, view invoices, cancel subscription ("at end of billing period"),
   and switch plans (add both Vaulted Pro prices). Save.
2. **Settings** > **Billing** > **Revenue recovery** (Subscriptions and emails in older dashboards):
   - **Smart Retries**: on. Stripe retries failed card charges at the best times.
   - **Card updater** (automatic card updates): on.
   - **If all retries fail**: **cancel the subscription**. Vaulted then moves the person back to Free.
3. **Settings** > **Customer emails**: turn on
   - successful payment receipts,
   - failed payment emails (with a link to update the card),
   - upcoming renewal reminders for **yearly** plans.
4. **Settings** > **Branding**: add your logo and color so invoices and receipts look like Vaulted.
   Subscriptions create an invoice every billing period, so this is your invoicing set-up.

## 6. Stripe: create a restricted API key

A restricted key (starts with `rk_`) can only do what you allow, so it's much safer than the full
secret key if it ever leaked.

**Developers** > **API keys** > **Create restricted key**. Name it `Vaulted Supabase` and set:

| Permission | Access |
| --- | --- |
| Customers | Write |
| Checkout Sessions | Write |
| Customer portal | Write |
| Subscriptions | Write |
| Charges | Read |

Leave everything else as **None**. Create it and copy the key.
If a test later fails with a "permission" error, the function logs name what's missing; add only that.

## 7. Stripe: add the webhook

The webhook is how Stripe tells your app "this person paid", "this person cancelled" and so on.

1. **Developers** > **Webhooks** > **Add destination** > Webhook.
2. Endpoint URL: `https://hejeahinipihvztvoeeo.supabase.co/functions/v1/stripe-webhook`
3. Events to send:
   - `checkout.session.completed`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`,
     `customer.subscription.paused`, `customer.subscription.resumed`
   - `invoice.paid`, `invoice.payment_failed`
   - `charge.dispute.created`, `radar.early_fraud_warning.created`, `charge.refunded`
4. Save, then click **Reveal** under **Signing secret** and copy it (starts with `whsec_`).

What the app does with the last three: a dispute (chargeback) or an early fraud warning ends that
person's Pro at once, so a stolen card isn't charged again. A refund is only logged; if you refund
someone and also want Pro to end, cancel their subscription in Stripe too.

## 8. Supabase: add the secrets

Supabase dashboard > **Edge Functions** > **Secrets**. Add:

| Name | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | the restricted key from step 6 (`rk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | the `whsec_...` from step 7 |
| `STRIPE_PRICE_MONTHLY` | the `$3.99` price ID (`price_...`) |
| `STRIPE_PRICE_YEARLY` | the `$29.99` price ID (`price_...`) |
| `APP_URL` | while testing the PR: its preview link. After merging: `https://angular-inventory-app-red.vercel.app`. No slash at the end. |
| `STRIPE_AUTOMATIC_TAX` | leave this out for now. Set it to `on` once you have at least one tax registration (step 3). |

Never put the Stripe key or `whsec_` secret in the Angular app, in chat, or in git. They live only here.

## 9. Supabase: deploy the functions

Edge Functions > deploy each one from this repo (paste the `index.ts` into the dashboard editor,
like you did for `delete-account`). For **every** function below, set **Verify JWT** to **OFF**:
each one checks the caller itself.

New:
- `billing-checkout` (opens Stripe's payment page)
- `billing-portal` (opens Manage billing)
- `stripe-webhook` (Stripe calls this; it checks Stripe's signature instead of a login)

Updated (redeploy):
- `scan-item` (3 scans a day on Free, 50 on Pro)
- `ebay-price` (Pro only)
- `delete-account` (now cancels the person's subscription before deleting the account)

## 10. Test it (on the PR preview link)

1. Sign in with a test account. Open **Upgrade to Pro**: you should see "Free" and your item count.
2. Click **$3.99 / month**, pay with `4242 4242 4242 4242`. You should come back to the app and,
   within a few seconds, see "Welcome to Vaulted Pro!".
3. In Stripe > **Webhooks** > your endpoint, the recent deliveries should all show **200**.
4. Click **Manage billing** > cancel. The app should say "Pro ends on ...".
5. On a free account: scan 4 photos in a day; the 4th should say you've used your 3 free scans.
6. Optional, failed renewal: Stripe's [test clocks](https://docs.stripe.com/billing/testing/test-clocks)
   let you fast-forward a test subscription. Switch its card to `4000 0000 0000 0341` (a card that
   declines charges) and advance past the renewal date: the app should show the "payment didn't go
   through" warning, and Pro should end once Stripe's retries run out.
7. Tax (only after you set `STRIPE_AUTOMATIC_TAX=on` and added a registration in the sandbox): check out
   with an address in that state. The checkout total stays $3.99, and the invoice shows the tax inside it.

## Going live checklist

1. Fill in the refund policy placeholder in the Terms page (`src/app/features/legal/terms/terms.html`, section 5).
2. Activate your Stripe account (business details, bank account for payouts).
3. In **live** mode, repeat steps 3 to 7: tax settings and registrations, product and prices (Inclusive),
   billing settings and emails, a live restricted key (`rk_live_...`), a live webhook and its new secret.
   Sandbox settings, prices and registrations don't carry over.
4. Replace the Supabase secrets with the live values, and set `APP_URL` to the production address.
5. Make one real purchase with your own card, check it in the Dashboard, then refund it.
6. Keep watching **Tax** > **Locations** for threshold alerts, and decide filing with your tax advisor
   (Stripe can file US sales tax for you with Tax Complete).
