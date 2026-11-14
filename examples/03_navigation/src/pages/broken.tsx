import { Thrower } from '../components/thrower.js';

export default function Broken() {
  return <Thrower />;
}
export const getConfig = () => ({ render: 'dynamic' }) as const;
