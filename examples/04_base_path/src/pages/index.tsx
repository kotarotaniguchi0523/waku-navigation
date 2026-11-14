export default function Home() {
  return <h1 data-testid="page">home</h1>;
}
export const getConfig = () => ({ render: 'dynamic' }) as const;
