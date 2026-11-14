export default function Focus() {
  return (
    <>
      <h1 data-testid="page">focus</h1>
      {/* The browser's focus reset after a navigation targets this element. */}
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <input data-testid="auto" autoFocus />
    </>
  );
}
export const getConfig = () => ({ render: 'dynamic' }) as const;
