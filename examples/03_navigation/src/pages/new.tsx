export default function New() {
  return <h1 data-testid="page">new</h1>;
}
export const getConfig = () => ({ render: 'dynamic' }) as const;
