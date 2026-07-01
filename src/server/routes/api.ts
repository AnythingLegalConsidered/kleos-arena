import { Hono } from 'hono';
import { stable } from './stable';
import { arena } from './arena';

export const api = new Hono();

api.route('/stable', stable);
api.route('/arena', arena);
