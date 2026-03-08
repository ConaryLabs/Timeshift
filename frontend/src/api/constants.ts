// frontend/src/api/constants.ts
/** Sentinel error rejected on session expiry — global onError skips toast for these */
export const SESSION_EXPIRED = Symbol('SESSION_EXPIRED')
