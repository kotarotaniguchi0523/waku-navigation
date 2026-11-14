import { unstable_redirect as redirect } from 'waku/router/server';
import { isGateClosed } from '../lib/gate.js';

export default function Gate() {
  if (isGateClosed()) {
    redirect('/new');
  }
  return <h1 data-testid="page">gate</h1>;
}
export const getConfig = () => ({ render: 'dynamic' }) as const;
