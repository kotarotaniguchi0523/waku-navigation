// Dynamic and slow: the payload arrives late, so the transition suspends.
export default async function Long({ query = '' }: { query?: string }) {
  const delay = Number(new URLSearchParams(query).get('d') ?? 300);
  await new Promise((resolve) => setTimeout(resolve, delay));
  return (
    <>
      <h1 data-testid="page">long</h1>
      <div style={{ height: '6000px' }} />
    </>
  );
}
export const getConfig = () => ({ render: 'dynamic' }) as const;
