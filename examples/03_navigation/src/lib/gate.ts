// Server state the action page flips, so a URL that rendered once can redirect
// the next time it loads.
let closed = false;

export const isGateClosed = () => closed;
export const setGateClosed = (value: boolean) => {
  closed = value;
};
