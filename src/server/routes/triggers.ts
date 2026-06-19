import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { openDailyArena } from '../core/dailyArena';
import { utcDay } from '../../shared/daily';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    const arena = await openDailyArena(utcDay());
    const input = await c.req.json<OnAppInstallRequest>();

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Arena ${arena.day} opened in subreddit ${context.subredditName} with post ${arena.postId} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to create post',
      },
      400
    );
  }
});
