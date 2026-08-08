// Browser shim for `isomorphic-ws`. The browser build of the package only
// exposes `globalThis.WebSocket`; the indexer client reads `ws.WebSocket`.

export const WebSocket = globalThis.WebSocket;

const ws = {
  WebSocket,
};

export default ws;