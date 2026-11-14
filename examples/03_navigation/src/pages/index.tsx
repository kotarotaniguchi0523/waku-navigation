export default function Home() {
  return (
    <>
      <h1 data-testid="page">home</h1>
      <div style={{ height: '3000px' }} />
      <p id="frag">fragment target</p>
      <div style={{ height: '1000px' }} />
    </>
  );
}
export const getConfig = () => ({ render: 'dynamic' }) as const;
