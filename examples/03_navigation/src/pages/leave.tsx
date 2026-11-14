import { unstable_redirect as redirect } from 'waku/router/server';

export default function Leave() {
  redirect('https://example.com/landing');
}
export const getConfig = () => ({ render: 'dynamic' }) as const;
