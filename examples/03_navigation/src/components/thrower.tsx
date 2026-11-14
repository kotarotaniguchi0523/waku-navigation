'use client';

// Fails while React renders the destination, after its payload loaded.
export function Thrower(): never {
  throw new Error('Render failure');
}
