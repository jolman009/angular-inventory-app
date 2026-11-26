import Stripe from 'npm:stripe@23.2.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Starts a Vaulted Pro purchase. Returns the address of Stripe's own payment page,
// so card details are typed into Stripe and never pass through this app.
//
// Secrets this function needs (Supabase dashboard > Edge Functions > Secrets):
//   STRIPE_SECRET_KEY     a restricted key (rk_...) from a Stripe sandbox while testing; see supabase/BILLING_SETUP.md
//   STRIPE_AUTOMATIC_TAX  optional: "on" to let Stripe Tax work out sales tax. Leave it off until you have
//                         tax registrations in Stripe, because without them Stripe collects nothing.
//   STRIPE_PRICE_MONTHLY  price_... for the $3.99 / month price
//   STRIPE_PRICE_YEARLY   price_... for the $29.99 / year price
//   APP_URL               where people return after paying, e.g. https://angular-inventory-app-red.vercel.app

const CORS = {
  'Access-Control-Allow-Origin': '*', // safe here: every call must carry a valid user token
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const prices: Record<string, string | undefined> = {
    monthly: Deno.env.get('STRIPE_PRICE_MONTHLY'),
    yearly: Deno.env.get('STRIPE_PRICE_YEARLY'),
  };
  const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '');
  const automaticTax = Deno.env.get('STRIPE_AUTOMATIC_TAX') === 'on';
  if (!stripeKey || !prices.monthly || !prices.yearly || !appUrl) {
    console.error('Billing secrets are missing (STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, APP_URL)');
    return json({ error: 'Upgrades are not set up yet.' }, 500);
  }

  // 1. Who is calling?
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'Please sign in again.' }, 401);
  const user = auth.user;

  // 2. Which plan?
  let plan: unknown;
  try {
    ({ plan } = await req.json());
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  if (plan !== 'monthly' && plan !== 'yearly') return json({ error: 'Choose monthly or yearly.' }, 400);

  // 3. Don't sell Pro twice.
  const { data: isPro, error: proError } = await admin.rpc('is_pro', { p_user: user.id });
  if (proError) {
    console.error('is_pro failed', proError);
    return json({ error: 'Could not check your plan. Try again.' }, 500);
  }
  if (isPro) return json({ error: 'You already have Vaulted Pro.' }, 409);

  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });

  try {
    // 4. Reuse this person's Stripe customer, or make one. Stripe uses the email for receipts.
    const { data: existing } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create(
        { email: user.email, metadata: { user_id: user.id } },
        { idempotencyKey: `customer-${user.id}` }, // a double click can't make two customers
      );
      customerId = customer.id;
      const { error: saveError } = await admin
        .from('subscriptions')
        .upsert({ user_id: user.id, stripe_customer_id: customerId, updated_at: new Date().toISOString() });
      if (saveError) throw saveError;
    }

    // Our table can lag a few seconds behind Stripe right after a payment, so ask Stripe too.
    const live = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
    if (live.data.some(sub => ['active', 'trialing', 'past_due'].includes(sub.status))) {
      return json({ error: 'You already have Vaulted Pro.' }, 409);
    }

    // 5. Stripe's hosted payment page.
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: prices[plan], quantity: 1 }],
      subscription_data: { metadata: { user_id: user.id } },
      allow_promotion_codes: true,
      // Lets you compare checkout flows in the Stripe Dashboard.
      integration_identifier: 'vaulted-pro-checkout-qkzmwvta',
      // Sales tax. Prices are set up in Stripe as tax-inclusive, so people always pay the price shown.
      // Stripe needs the buyer's address to know which tax applies, and saves it on their customer.
      ...(automaticTax
        ? {
            automatic_tax: { enabled: true },
            billing_address_collection: 'required' as const,
            customer_update: { address: 'auto' as const, name: 'auto' as const },
          }
        : {}),
      success_url: `${appUrl}/collection?panel=plans&checkout=success`,
      cancel_url: `${appUrl}/collection?panel=plans`,
    });

    return json({ url: session.url });
  } catch (e) {
    console.error('Checkout failed', e);
    return json({ error: "We couldn't open the payment page. Try again." }, 502);
  }
});
