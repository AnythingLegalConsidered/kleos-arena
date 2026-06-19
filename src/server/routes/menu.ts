import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { openDailyArena, resolveDailyArena } from '../core/dailyArena';
import { utcDay } from '../../shared/daily';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const arena = await openDailyArena(utcDay());
    if (!arena.postId) throw new Error('daily arena post id missing');

    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${arena.postId}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post',
      },
      400
    );
  }
});

menu.post('/arena-force-tick', async (c) => {
  try {
    const arena = await resolveDailyArena(utcDay());
    return c.json<UiResponse>(
      {
        showToast: `Arena ${arena.day} resolved: ${arena.standings.length} ranked teams`,
      },
      200
    );
  } catch (error) {
    console.error(`Error forcing arena tick: ${error}`);
    return c.json<UiResponse>(
      { showToast: 'Failed to resolve daily arena' },
      400
    );
  }
});
