import { requestRefresh } from 'waku/router/server';
import { setGateClosed } from '../lib/gate.js';

let count = 0;

export default function Action() {
  return (
    <>
      <h1 data-testid="page">action</h1>
      <p data-testid="count">{count}</p>
      <form
        action={async () => {
          'use server';
          count += 1;
          requestRefresh();
        }}
      >
        <button data-testid="refresh">refresh</button>
      </form>
      <form
        action={async () => {
          'use server';
          setGateClosed(true);
        }}
      >
        <button data-testid="close-gate">close gate</button>
      </form>
      <form
        action={async () => {
          'use server';
          setGateClosed(false);
        }}
      >
        <button data-testid="open-gate">open gate</button>
      </form>
      <div style={{ height: '3000px' }} />
    </>
  );
}
export const getConfig = () => ({ render: 'dynamic' }) as const;
