import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Opens Stripe's billing page, where a Pro member can change their card, switch between
// monthly and yearly, see invoices, or cancel.
//
// Secrets: STRIPE_SECRET_KEY and APP_URL (the same ones billing-checkout uses).

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
  const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '');
  if (!stripeKey || !appUrl) {
    console.error('STRIPE_SECRET_KEY or APP_URL is not set');
    return json({ error: 'Billing is not set up yet.' }, 500);
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'Please sign in again.' }, 401);

  const { data: row } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!row?.stripe_customer_id) return json({ error: "You don't have a billing account yet." }, 404);

  try {
    const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });
    const portal = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${appUrl}/collection?panel=plans`,
    });
    return json({ url: portal.url });
  } catch (e) {
    console.error('Billing portal failed', e);
    return json({ error: "We couldn't open the billing page. Try again." }, 502);
  }
});
