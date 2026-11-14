export default function Short() {
  return <h1 data-testid="page">short</h1>;
}
export const getConfig = () => ({ render: 'dynamic' }) as const;
