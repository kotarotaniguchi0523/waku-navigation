export default function LongStatic() {
  return (
    <>
      <h1 data-testid="page">long-static</h1>
      <div style={{ height: '6000px' }} />
    </>
  );
}
export const getConfig = () => ({ render: 'static' }) as const;
