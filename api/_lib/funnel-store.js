import { createHash } from 'node:crypto';

const EVENT_NAMES = ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase'];
const DAY_TTL = 34_560_000;
const EVENT_TTL = 7_776_000;
const DETAIL_TTL = 604_800;
const RECENT_LIMIT = 50;

const redisConfig = () => ({
  url: String(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/$/, ''),
  token: String(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '')
});

const SCRIPT = `
local isNew = redis.call('SET', KEYS[1], '1', 'NX', 'EX', ARGV[1])
local observed = 0
local accepted = 0
if isNew then
  observed = 1
  redis.call('HINCRBY', KEYS[2], ARGV[2] .. ':observed', 1)
  if ARGV[4] == '1' then redis.call('HINCRBY', KEYS[2], ARGV[2] .. ':fbp', 1) end
  if ARGV[5] == '1' then redis.call('HINCRBY', KEYS[2], ARGV[2] .. ':fbc', 1) end
  redis.call('HSET', KEYS[2], '_updatedAt', ARGV[3])
  redis.call('EXPIRE', KEYS[2], ARGV[6])
  redis.call('ZADD', KEYS[3], ARGV[3], ARGV[7])
  redis.call('HSET', KEYS[4], 'eventName', ARGV[2], 'eventKey', ARGV[7], 'eventTime', ARGV[3], 'path', ARGV[8], 'value', ARGV[9], 'currency', ARGV[10], 'fbp', ARGV[4], 'fbc', ARGV[5], 'metaAccepted', '0')
  redis.call('EXPIRE', KEYS[4], ARGV[11])
end
if ARGV[12] == '1' then
  local isAccepted = redis.call('SET', KEYS[5], '1', 'NX', 'EX', ARGV[1])
  if isAccepted then
    accepted = 1
    redis.call('HINCRBY', KEYS[2], ARGV[2] .. ':metaAccepted', 1)
    redis.call('HSET', KEYS[4], 'metaAccepted', '1')
    redis.call('EXPIRE', KEYS[2], ARGV[6])
  end
end
redis.call('ZREMRANGEBYRANK', KEYS[3], 0, -51)
return {observed, accepted}
`;

async function command(parts) {
  const { url, token } = redisConfig();
  if (!url || !token) throw new Error('analytics_storage_not_configured');
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.upstash.io')) throw new Error('analytics_storage_url_invalid');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(parts),
    signal: AbortSignal.timeout(4000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw new Error(payload.error || `analytics_storage_http_${response.status}`);
  return payload.result;
}

async function pipeline(commands) {
  const { url, token } = redisConfig();
  if (!url || !token) throw new Error('analytics_storage_not_configured');
  const endpoint = new URL(`${url}/pipeline`);
  if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.upstash.io')) throw new Error('analytics_storage_url_invalid');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(7000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(payload)) throw new Error(payload.error || `analytics_storage_http_${response.status}`);
  const failed = payload.find(item => item?.error);
  if (failed) throw new Error(failed.error);
  return payload.map(item => item?.result);
}

const safeEventName = name => EVENT_NAMES.includes(name) ? name : '';
const eventKeyFor = eventId => {
  return createHash('sha256').update(String(eventId)).digest('hex').slice(0, 32);
};

export function funnelStorageConfigured() {
  const { url, token } = redisConfig();
  try { return Boolean(url && token && new URL(url).protocol === 'https:' && new URL(url).hostname.endsWith('.upstash.io')); }
  catch { return false; }
}

export async function recordFunnelEvent({ eventName, eventId, eventTime = Date.now(), path = '/', value = 0, currency = 'BRL', fbp = false, fbc = false, metaAccepted = false }) {
  const name = safeEventName(eventName);
  if (!name || !eventId) return { configured: funnelStorageConfigured(), stored: false, reason: 'invalid_event' };
  if (!funnelStorageConfigured()) return { configured: false, stored: false, reason: 'analytics_storage_not_configured' };
  const at = Number(eventTime) > 0 ? Number(eventTime) : Date.now();
  const day = new Date(at).toISOString().slice(0, 10);
  const eventKey = eventKeyFor(eventId);
  try {
    const result = await command([
      'EVAL', SCRIPT, 5,
      `newboox:analytics:seen:${eventKey}`,
      `newboox:analytics:day:${day}`,
      'newboox:analytics:recent',
      `newboox:analytics:event:${eventKey}`,
      `newboox:analytics:accepted:${eventKey}`,
      EVENT_TTL, name, at,
      fbp ? 1 : 0, fbc ? 1 : 0, DAY_TTL, eventKey,
      String(path).slice(0, 80), Math.max(0, Number(value) || 0), String(currency).slice(0, 3).toUpperCase(),
      DETAIL_TTL, metaAccepted ? 1 : 0
    ]);
    return { configured: true, stored: Number(result?.[0]) === 1, duplicate: Number(result?.[0]) !== 1, metaAcceptanceRecorded: Number(result?.[1]) === 1 };
  } catch (error) {
    return { configured: true, stored: false, reason: error.message };
  }
}

export async function getFunnelData(range) {
  const events = Object.fromEntries(EVENT_NAMES.map(name => [name, { observed: 0, metaAccepted: 0, withFbp: 0, withFbc: 0 }]));
  if (!funnelStorageConfigured()) return { available: false, configured: false, events, recent: [], reason: 'Configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN na Vercel. O histórico começa a ser contado após a ativação.' };
  try {
    const days = [];
    for (let at = new Date(`${range.start}T00:00:00.000Z`); at <= new Date(`${range.end}T00:00:00.000Z`); at = new Date(at.getTime() + 86_400_000)) days.push(at.toISOString().slice(0, 10));
    const dailyRows = await pipeline(days.map(day => ['HGETALL', `newboox:analytics:day:${day}`]));
    for (const row of dailyRows) {
      const data = Array.isArray(row) ? Object.fromEntries(Array.from({ length: Math.floor(row.length / 2) }, (_, i) => [row[i * 2], row[i * 2 + 1]])) : row || {};
      for (const name of EVENT_NAMES) {
        events[name].observed += Number(data[`${name}:observed`] || 0);
        events[name].metaAccepted += Number(data[`${name}:metaAccepted`] || 0);
        events[name].withFbp += Number(data[`${name}:fbp`] || 0);
        events[name].withFbc += Number(data[`${name}:fbc`] || 0);
      }
    }
    const [recentKeys] = await pipeline([['ZREVRANGE', 'newboox:analytics:recent', 0, RECENT_LIMIT - 1]]);
    const keys = Array.isArray(recentKeys) ? recentKeys : [];
    const rows = keys.length ? await pipeline(keys.map(key => ['HGETALL', `newboox:analytics:event:${key}`])) : [];
    const rangeStart = Date.parse(`${range.start}T00:00:00.000Z`);
    const rangeEnd = Date.parse(`${range.end}T23:59:59.999Z`);
    const recent = rows.map(row => {
      const data = Array.isArray(row) ? Object.fromEntries(Array.from({ length: Math.floor(row.length / 2) }, (_, i) => [row[i * 2], row[i * 2 + 1]])) : row || {};
      return {
        eventName: String(data.eventName || ''),
        eventKey: String(data.eventKey || ''),
        eventTime: Number(data.eventTime || 0),
        path: String(data.path || '/'),
        value: Number(data.value || 0),
        currency: String(data.currency || 'BRL'),
        fbp: data.fbp === '1',
        fbc: data.fbc === '1',
        metaAccepted: data.metaAccepted === '1'
      };
    }).filter(item => safeEventName(item.eventName) && item.eventTime >= rangeStart && item.eventTime <= rangeEnd);
    return { available: true, configured: true, range: { start: range.start, end: range.end }, events, recent };
  } catch {
    return { available: false, configured: true, events, recent: [], reason: 'A base de analytics configurada não respondeu; tente atualizar o painel.' };
  }
}

