import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Stripe calls this address whenever a subscription starts, renews, changes, fails to pay
// or ends. It copies the subscription's current state into the subscriptions table, which is
// what the app and the other functions read to decide who has Pro.
//
// Secrets:
//   STRIPE_SECRET_KEY      the same key the billing functions use
//   STRIPE_WEBHOOK_SECRET  whsec_... shown in Stripe after you add this webhook
//   STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY  to record which plan someone is on
//
// Deploy with "Verify JWT" OFF: Stripe can't send a Supabase login. Instead every request is
// checked against Stripe's signature below, and anything unsigned is rejected.

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function planFor(priceId: string | undefined): 'monthly' | 'yearly' | null {
  if (priceId && priceId === Deno.env.get('STRIPE_PRICE_MONTHLY')) return 'monthly';
  if (priceId && priceId === Deno.env.get('STRIPE_PRICE_YEARLY')) return 'yearly';
  return null;
}

/** Reads the subscription fresh from Stripe and saves it. Events can arrive out of order, so we never trust their copy. */
async function sync(subscriptionId: string) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  // Find whose subscription it is: the id we attached at checkout, else the saved customer.
  let userId = sub.metadata?.user_id as string | undefined;
  if (!userId) {
    const { data } = await admin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    userId = data?.user_id;
  }
  if (!userId) {
    console.warn('No Vaulted user for Stripe customer', customerId);
    return;
  }

  // Someone could in theory end up with an old canceled subscription and a new active one.
  // Never let an event about the old one overwrite the new one.
  const { data: current } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', userId)
    .maybeSingle();
  const liveStatuses = ['active', 'trialing', 'past_due'];
  if (
    current?.stripe_subscription_id &&
    current.stripe_subscription_id !== sub.id &&
    liveStatuses.includes(current.status ?? '') &&
    !liveStatuses.includes(sub.status)
  ) {
    return;
  }

  const item = sub.items.data[0];
  // Newer Stripe API versions keep the period end on the item instead of the subscription.
  const periodEnd =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    (item as unknown as { current_period_end?: number } | undefined)?.current_period_end;

  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    status: sub.status,
    plan: planFor(item?.price?.id),
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  });
  // 23503: the person deleted their account (which cancels the subscription), so there's no one left to update.
  if (error?.code === '23503') return;
  if (error) throw error;
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const signature = req.headers.get('Stripe-Signature');
  if (!secret || !signature) return new Response('Missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, secret, undefined, cryptoProvider);
  } catch (e) {
    console.error('Bad Stripe signature', e);
    return new Response('Bad signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          await sync(typeof session.subscription === 'string' ? session.subscription : session.subscription.id);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await sync((event.data.object as Stripe.Subscription).id);
        break;
      default:
        // Not an event we use. Answer 200 so Stripe doesn't keep resending it.
        break;
    }
  } catch (e) {
    // Answer with an error so Stripe tries again later.
    console.error(`Handling ${event.type} failed`, e);
    return new Response('Webhook handler failed', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
