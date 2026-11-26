import { createClient } from 'npm:@supabase/supabase-js@2';

// Deletes the caller's whole account in one request: their Pro subscription, photos, items and login.
// Runs on the server with the service role, so the browser never needs those powers.

const BUCKET = 'item-images';

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

  // 1. Who is calling? Only a signed-in user can delete, and only their own account.
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'Please sign in again.' }, 401);
  const uid = auth.user.id;

  // 2. Stop billing first. Deleting the Stripe customer cancels any Vaulted Pro subscription
  //    at once, so nobody is charged for an account that no longer exists. If this fails we
  //    stop before deleting anything.
  const { data: billing } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', uid)
    .maybeSingle();
  if (billing?.stripe_customer_id) {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    let cancelled = false;
    if (stripeKey) {
      const res = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(billing.stripe_customer_id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${stripeKey}` },
        signal: AbortSignal.timeout(15_000),
      }).catch(e => {
        console.error('Stripe request failed', e);
        return null;
      });
      // 404 means Stripe already has no such customer, which is fine.
      cancelled = !!res && (res.ok || res.status === 404);
      if (res && !cancelled) console.error('Stripe customer delete failed', res.status, (await res.text()).slice(0, 300));
    } else {
      console.error('STRIPE_SECRET_KEY is not set, so the subscription could not be cancelled');
    }
    if (!cancelled) {
      return json({ error: "We couldn't cancel your Vaulted Pro subscription. Nothing was deleted, so please try again." }, 500);
    }
  }

  // 3. Photos next. If this fails we stop, so the account and items are left untouched
  //    and the user can simply try again.
  const storage = admin.storage.from(BUCKET);
  const paths: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data: files, error: listError } = await storage.list(uid, { limit: 1000, offset });
    if (listError) {
      console.error('listing photos failed', listError);
      return json({ error: "We couldn't remove your photos. Nothing was deleted, so please try again." }, 500);
    }
    paths.push(...(files ?? []).filter(f => f.id).map(f => `${uid}/${f.name}`));
    if (!files || files.length < 1000) break;
  }

  for (let i = 0; i < paths.length; i += 100) {
    const { error: removeError } = await storage.remove(paths.slice(i, i + 100));
    if (removeError) {
      console.error('removing photos failed', removeError);
      return json({ error: "We couldn't remove all your photos. Your account is still here, so please try again." }, 500);
    }
  }

  // 4. The login. Items and scan counts are removed with it by the database
  //    (their user_id columns use ON DELETE CASCADE).
  const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
  if (deleteError) {
    console.error('deleteUser failed', deleteError);
    return json({ error: "We couldn't close your account. Your items are still saved, so please try again." }, 500);
  }

  return json({ ok: true });
});
