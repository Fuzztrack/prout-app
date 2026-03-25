export function maskToken(token?: string | null) {
  if (!token) return 'none';
  if (token.length <= 12) return token;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

export function logSessionSnapshot(source: string, session: any) {
  if (!__DEV__) return;

  if (!session) {
    console.log(`🧭 [Session:${source}] session=null`);
    return;
  }

  const provider =
    session.user?.app_metadata?.provider ||
    session.user?.identities?.[0]?.provider ||
    'unknown';
  const expiresAt = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : 'none';

  console.log(`🧭 [Session:${source}]`, {
    userId: session.user?.id,
    provider,
    expiresAt,
    hasRefreshToken: !!session.refresh_token,
    refreshTokenPreview: maskToken(session.refresh_token),
    accessTokenPreview: maskToken(session.access_token),
    accessTokenLength: session.access_token?.length || 0,
  });
}

export async function logSignOutIntent(source: string, getUser: () => Promise<any>) {
  if (!__DEV__) return;

  try {
    const { data: { user } } = await getUser();
    console.log(`🚪 [SignOut:${source}]`, {
      userId: user?.id || null,
      provider:
        user?.app_metadata?.provider ||
        user?.identities?.[0]?.provider ||
        'unknown',
    });
  } catch (error: any) {
    console.log(`🚪 [SignOut:${source}] user_lookup_failed`, {
      message: error?.message || String(error),
    });
  }
}
