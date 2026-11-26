# Vaulted Pro billing setup (Stripe + Supabase)

The app code is ready. These steps connect it to your Stripe account. Do them in **Stripe test mode**
first: nobody is charged, and you pay with Stripe's test card `4242 4242 4242 4242`
(any future expiry date, any CVC, any ZIP).

Your Supabase project: `hejeahinipihvztvoeeo`. Your app: https://angular-inventory-app-red.vercel.app

> Order matters a little: run the SQL (step 1) **before** deploying the updated `scan-item`,
> `ebay-price` and `delete-account` functions, because they call the new `is_pro` database function.

## 1. Supabase: run the SQL

1. Supabase dashboard > **SQL Editor** > New query.
2. Paste all of `supabase/migrations/20261127000000_subscriptions.sql` and click **Run**.
   It creates the `subscriptions` table, the `is_pro` check and the 100-item free limit.
   It's safe to run twice.

## 2. Stripe: create the product and prices

1. Go to https://dashboard.stripe.com and turn on **Test mode** (toggle at the top).
2. **Product catalog** > **Add product**.
   - Name: `Vaulted Pro`
   - Add a price: **Recurring**, `$3.99`, billing period **Monthly**. Save.
   - Add a second price to the same product: **Recurring**, `$29.99`, **Yearly**. Save.
3. Open each price and copy its ID (starts with `price_`). You need both in step 5.

## 3. Stripe: turn on the customer portal

This is the page behind the app's **Manage billing** button.

1. **Settings** > **Billing** > **Customer portal**.
2. Turn on: update payment method, view invoices, cancel subscription (choose "at end of billing period"),
   and switch plans (add both Vaulted Pro prices).
3. Save.

## 4. Stripe: add the webhook

The webhook is how Stripe tells your app "this person paid" or "this person cancelled".

1. **Developers** > **Webhooks** > **Add endpoint** (in newer dashboards: **Add destination** > Webhook).
2. Endpoint URL: `https://hejeahinipihvztvoeeo.supabase.co/functions/v1/stripe-webhook`
3. Events to send:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.paused`
   - `customer.subscription.resumed`
4. Save, then click **Reveal** under **Signing secret** and copy it (starts with `whsec_`).

## 5. Supabase: add the secrets

Supabase dashboard > **Edge Functions** > **Secrets** (or Project Settings > Edge Functions). Add:

| Name | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe > Developers > API keys > **Secret key** (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | the `whsec_...` from step 4 |
| `STRIPE_PRICE_MONTHLY` | the `$3.99` price ID (`price_...`) |
| `STRIPE_PRICE_YEARLY` | the `$29.99` price ID (`price_...`) |
| `APP_URL` | `https://angular-inventory-app-red.vercel.app` (no slash at the end) |

Never put the `sk_` key or `whsec_` secret in the Angular app or in git. They live only here.

## 6. Supabase: deploy the functions

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

## 7. Test it (on the PR preview link)

1. Sign in with a test account. Open **Upgrade to Pro**: you should see "Free" and your item count.
2. Click **$3.99 / month**, pay with `4242 4242 4242 4242`. You should come back to the app and,
   within a few seconds, see "Welcome to Vaulted Pro!".
3. In Stripe > **Webhooks** > your endpoint, the recent deliveries should all show **200**.
4. Click **Manage billing** > cancel. The app should say "Pro ends on ...".
5. On a free account: scan 4 photos in a day; the 4th should say you've used your 3 free scans.

Note: after paying, Stripe sends people back to `APP_URL`. Production doesn't have this code until
the PR is merged, so while testing the preview, set `APP_URL` to the preview link (no slash at the end),
and change it back to the production address after merging.

## Going live later

Repeat steps 2 to 5 with Stripe's test mode **off** (live products, live `sk_live_` key and a new live
webhook secret), and replace the secrets. Before that, fill in the refund policy placeholder in
the Terms page (`src/app/features/legal/terms/terms.html`, section 5).
