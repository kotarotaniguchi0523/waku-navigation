export default function About() {
  return <h1 data-testid="page">about</h1>;
}
export const getConfig = () => ({ render: 'dynamic' }) as const;
