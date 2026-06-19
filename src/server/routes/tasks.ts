import { Hono } from 'hono';
import { runDailyTick } from '../core/dailyArena';

export const tasks = new Hono();

tasks.post('/daily-arena', async (c) => {
  const { resolved, opened } = await runDailyTick();
  console.log(
    `Daily arena tick resolved ${resolved.day} (${resolved.standings.length} teams) and opened ${opened.day}`
  );
  return c.json({});
});
