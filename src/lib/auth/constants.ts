// Kept separate from session.ts so edge middleware can import just the
// cookie name without pulling in firebase-admin (which needs the Node
// runtime, not Edge, and breaks the middleware bundle with a "Cannot find
// module 'node:crypto'" error if imported transitively).
export const SESSION_COOKIE_NAME = "__session";
