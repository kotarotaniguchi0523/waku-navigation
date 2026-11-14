import { unstable_redirect as redirect } from 'waku/router/server';
export default function Old() {
  redirect('/new');
}
export const getConfig = () => ({ render: 'dynamic' }) as const;
