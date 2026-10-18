export function createSessionVerifier({ verifyToken, createClerkClient }) {
  return async (token, env) => {
    const claims = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      issuer: env.CLERK_ISSUER,
      authorizedParties: [env.APP_ORIGIN],
    });
    if (!claims.sub || !claims.sid || claims.azp !== env.APP_ORIGIN) throw new Error('Invalid session');
    const client = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
    const session = await client.sessions.getSession(claims.sid);
    if (session.status !== 'active' || session.userId !== claims.sub) throw new Error('Inactive session');
    return { userId: claims.sub };
  };
}
