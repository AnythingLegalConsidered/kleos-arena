import { reddit } from '@devvit/web/server';

export const createPost = async (title = 'kleos-arena') => {
  return await reddit.submitCustomPost({
    title,
  });
};
