import { Hono } from 'hono';
import { reddit, redis } from '@devvit/web/server';
import {
  buyAttributePoint,
  buyPerk,
  createDefaultStable,
  heal,
  parseStable,
} from '../../shared/stable';
import type { ActionResult, Stable } from '../../shared/stable';
import type { StableAction, StableActionResponse, StableResponse } from '../../shared/api';

// Authoritative stable persistence. The server owns every spend (anti-cheat,
// CONCEPT: serveur = autorité aux enjeux) and is the only writer of the Redis
// blob. Keyed per user so progression persists across daily posts.
export const stable = new Hono();

function stableKey(username: string): string {
  return `stable:${username}`;
}

async function loadOrCreate(username: string): Promise<Stable> {
  const existing = parseStable(await redis.get(stableKey(username)));
  if (existing) return existing;
  const fresh = createDefaultStable(username, username);
  await redis.set(stableKey(username), JSON.stringify(fresh));
  return fresh;
}

stable.get('/', async (c) => {
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const s = await loadOrCreate(username);
  return c.json<StableResponse>({ type: 'stable', stable: s });
});

stable.post('/action', async (c) => {
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const action = parseAction(await c.req.json().catch(() => null));
  if (!action) {
    return c.json<StableActionResponse>({ type: 'error', error: 'invalid action' }, 400);
  }

  const s = await loadOrCreate(username);
  const result = applyAction(s, action);
  if (!result.ok) {
    return c.json<StableActionResponse>({ type: 'error', error: result.error }, 400);
  }

  await redis.set(stableKey(username), JSON.stringify(s));
  return c.json<StableActionResponse>({ type: 'stable', stable: s });
});

function applyAction(s: Stable, action: StableAction): ActionResult {
  switch (action.action) {
    case 'attr':
      return buyAttributePoint(s, action.gladiatorId, action.attr);
    case 'perk':
      return buyPerk(s, action.gladiatorId, action.attr);
    case 'heal':
      return heal(s, action.gladiatorId);
  }
}

function parseAction(body: unknown): StableAction | null {
  if (typeof body !== 'object' || body === null) return null;
  if (!('action' in body) || !('gladiatorId' in body)) return null;
  const { action, gladiatorId } = body;
  if (typeof gladiatorId !== 'string') return null;

  if (action === 'heal') return { action, gladiatorId };
  if (action === 'attr' || action === 'perk') {
    if (!('attr' in body)) return null;
    const attr = body.attr;
    if (attr === 'force' || attr === 'agility' || attr === 'resilience') {
      return { action, gladiatorId, attr };
    }
  }
  return null;
}
