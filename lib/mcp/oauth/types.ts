export type OAuthClientRecord = {
  id: string;
  name: string;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: "none";
};

export type AuthCodeRecord = {
  codeHash: string;
  clientId: string;
  clientLabel: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  scope: string;
  resource: string | null;
  supabaseRefreshEncrypted: string;
  expiresAt: string;
};

export type GrantRecord = {
  id: string;
  clientId: string;
  clientLabel: string;
  userId: string;
  scope: string;
  resource: string | null;
  accessTokenHash: string | null;
  accessExpiresAt: string | null;
  refreshTokenHash: string | null;
  refreshExpiresAt: string | null;
  supabaseRefreshEncrypted: string;
  supabaseAccessEncrypted: string | null;
  supabaseAccessExpiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type GrantSummary = {
  id: string;
  clientLabel: string;
  createdAt: string;
  refreshExpiresAt: string | null;
};

export type OAuthFailure = {
  ok: false;
  status: number;
  error: string;
  description: string;
};

export type TokenSuccess = {
  ok: true;
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

export interface OAuthStore {
  saveClient(client: OAuthClientRecord): Promise<void>;
  getClient(id: string): Promise<OAuthClientRecord | null>;
  saveCode(code: AuthCodeRecord): Promise<void>;
  /** Marks the code used and returns it. A second call returns null. */
  consumeCode(codeHash: string, now: Date): Promise<AuthCodeRecord | null>;
  saveGrant(grant: GrantRecord): Promise<void>;
  getGrant(id: string): Promise<GrantRecord | null>;
  getGrantByAccessHash(hash: string): Promise<GrantRecord | null>;
  getGrantByRefreshHash(hash: string): Promise<GrantRecord | null>;
  /** Replaces the current refresh token only when the expected hash still matches. */
  rotateTokens(
    id: string,
    expectedRefreshHash: string,
    next: Pick<
      GrantRecord,
      "accessTokenHash" | "accessExpiresAt" | "refreshTokenHash" | "refreshExpiresAt"
    >,
  ): Promise<boolean>;
  /** Stores a rotated Supabase session only when the previous ciphertext still matches. */
  saveSupabaseSession(
    id: string,
    expectedRefreshEncrypted: string,
    next: Pick<GrantRecord, "supabaseRefreshEncrypted" | "supabaseAccessEncrypted" | "supabaseAccessExpiresAt">,
  ): Promise<boolean>;
  listGrants(userId: string): Promise<GrantSummary[]>;
  revokeGrant(id: string, userId: string): Promise<boolean>;
  revokeByTokenHash(hash: string): Promise<boolean>;
}
