import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// In-memory OAuth token cache across warm edge invocations
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getEbayAccessToken(clientId: string, clientSecret: string, baseUrl: string): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${baseUrl}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('eBay OAuth failed', res.status, text.slice(0, 300));
    throw new Error('Could not authenticate with eBay API.');
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in ?? 7200) * 1000;
  return cachedToken;
}

function cleanToken(val: unknown, maxLen = 80): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[^\w\s.#/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function roundCurrency(n: number): number {
  return Math.round(n * 100) / 100;
}

interface EbaySummaryItem {
  title?: string;
  price?: { value?: string; currency?: string };
  shippingOptions?: { shippingCost?: { value?: string } }[];
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const clientId = Deno.env.get('EBAY_CLIENT_ID');
  const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET');
  const ebayEnv = (Deno.env.get('EBAY_ENV') ?? 'production').toLowerCase();
  const baseUrl = ebayEnv === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';

  if (!clientId || !clientSecret) {
    console.error('EBAY_CLIENT_ID or EBAY_CLIENT_SECRET is not set');
    return json({ error: 'eBay price estimation is not configured on the server yet.' }, 500);
  }

  // 1. Verify signed-in Supabase user
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'Please sign in again.' }, 401);

  // 2. Parse card details
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const title = cleanToken(payload.title, 120);
  if (!title) {
    return json({ error: 'Player / card title is required to estimate price.' }, 400);
  }

  const year = cleanToken(payload.year, 10);
  const set = cleanToken(payload.set, 80);
  const rawCardNum = cleanToken(payload.card_number, 25).replace(/^#/, '');
  const cardNumber = rawCardNum ? `#${rawCardNum}` : '';
  const grade = cleanToken(payload.grade, 30);
  const sport = cleanToken(payload.sport, 30);

  const coreParts = [year, set, title, cardNumber, grade].filter(Boolean);
  const humanQuery = coreParts.join(' ');
  const negativeFilters = '-lot -break -reprint -rp -digital -box -pack -case';
  const searchQuery = `${humanQuery} ${negativeFilters}`.trim();

  // Category 261328 = Sports Trading Card Singles, 183454 = CCG Individual Cards
  const categoryIds = sport === 'Other' ? '261328,183454' : '261328';

  const ebaySearchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(humanQuery)}&LH_BIN=1`;

  let accessToken: string;
  try {
    accessToken = await getEbayAccessToken(clientId, clientSecret, baseUrl);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'eBay authentication failed.' }, 502);
  }

  // 3. Query eBay Browse API (Fixed Price listings)
  const searchParams = new URLSearchParams({
    q: searchQuery,
    category_ids: categoryIds,
    filter: 'buyingOptions:{FIXED_PRICE}',
    limit: '50',
  });

  let browseRes: Response;
  try {
    browseRes = await fetch(
      `${baseUrl}/buy/browse/v1/item_summary/search?${searchParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
        signal: AbortSignal.timeout(20_000),
      },
    );
  } catch (e) {
    console.error('eBay Browse API request failed', e);
    return json({ error: 'eBay service did not respond. Try again.' }, 502);
  }

  if (!browseRes.ok) {
    console.error('eBay Browse API error', browseRes.status, (await browseRes.text()).slice(0, 300));
    return json({ error: 'Could not fetch card listings from eBay.' }, 502);
  }

  const browseData = (await browseRes.json()) as { itemSummaries?: EbaySummaryItem[] };
  const summaries = browseData.itemSummaries ?? [];

  // Extract delivered price (item price + first shipping option if numeric)
  const rawPrices: number[] = [];
  for (const item of summaries) {
    const base = Number(item.price?.value);
    if (!Number.isFinite(base) || base <= 0) continue;
    const ship = Number(item.shippingOptions?.[0]?.shippingCost?.value ?? 0);
    const total = base + (Number.isFinite(ship) && ship >= 0 ? ship : 0);
    rawPrices.push(total);
  }

  if (!rawPrices.length) {
    return json({
      valuation: null,
      notice: `No active fixed-price eBay listings found for "${humanQuery}".`,
      ebaySearchUrl,
    });
  }

  rawPrices.sort((a, b) => a - b);

  // Trim bottom 15% and top 20% when sample size >= 6 to exclude $0.99 junk and wishful asks
  let working = rawPrices;
  if (rawPrices.length >= 6) {
    const start = Math.floor(rawPrices.length * 0.15);
    const end = Math.ceil(rawPrices.length * 0.8);
    if (end > start) {
      working = rawPrices.slice(start, end);
    }
  }

  const medianPrice = roundCurrency(percentile(working, 0.5));
  const lowPrice = roundCurrency(percentile(working, 0.25));
  const highPrice = roundCurrency(percentile(working, 0.75));

  return json({
    valuation: {
      medianPrice,
      lowPrice,
      highPrice,
      sampleSize: rawPrices.length,
      query: humanQuery,
      ebaySearchUrl,
      updatedAt: new Date().toISOString(),
    },
    notice: null,
  });
});
