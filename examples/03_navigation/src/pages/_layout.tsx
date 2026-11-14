import type { ReactNode } from 'react';
import { Nav } from '../components/nav.js';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      <main>{children}</main>
    </>
  );
}
