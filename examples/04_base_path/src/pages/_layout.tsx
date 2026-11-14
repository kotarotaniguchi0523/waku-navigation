import type { ReactNode } from 'react';
import { Links } from '../components/links.js';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Links />
      <main>{children}</main>
    </>
  );
}
