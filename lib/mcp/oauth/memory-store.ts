import type {
  AuthCodeRecord,
  GrantRecord,
  GrantSummary,
  OAuthClientRecord,
  OAuthStore,
} from "@/lib/mcp/oauth/types";

/** Process-local store for tests. Production uses the Supabase store. */
export function createMemoryOAuthStore(): OAuthStore {
  const clients = new Map<string, OAuthClientRecord>();
  const codes = new Map<string, AuthCodeRecord & { consumedAt?: string }>();
  const grants = new Map<string, GrantRecord>();

  return {
    async saveClient(client) {
      clients.set(client.id, client);
    },
    async getClient(id) {
      return clients.get(id) ?? null;
    },
    async saveCode(code) {
      codes.set(code.codeHash, { ...code });
    },
    async consumeCode(codeHash, now) {
      const code = codes.get(codeHash);
      if (!code || code.consumedAt || Date.parse(code.expiresAt) <= now.getTime()) return null;
      code.consumedAt = now.toISOString();
      return code;
    },
    async saveGrant(grant) {
      grants.set(grant.id, { ...grant });
    },
    async getGrant(id) {
      return grants.get(id) ?? null;
    },
    async getGrantByAccessHash(hash) {
      return [...grants.values()].find((grant) => grant.accessTokenHash === hash && !grant.revokedAt) ?? null;
    },
    async getGrantByRefreshHash(hash) {
      return [...grants.values()].find((grant) => grant.refreshTokenHash === hash && !grant.revokedAt) ?? null;
    },
    async rotateTokens(id, expectedRefreshHash, next) {
      const grant = grants.get(id);
      if (!grant || grant.revokedAt || grant.refreshTokenHash !== expectedRefreshHash) return false;
      Object.assign(grant, next);
      return true;
    },
    async saveSupabaseSession(id, expectedRefreshEncrypted, next) {
      const grant = grants.get(id);
      if (!grant || grant.revokedAt || grant.supabaseRefreshEncrypted !== expectedRefreshEncrypted) return false;
      Object.assign(grant, next);
      return true;
    },
    async listGrants(userId) {
      return [...grants.values()]
        .filter((grant) => grant.userId === userId && !grant.revokedAt)
        .map(summary);
    },
    async revokeGrant(id, userId) {
      const grant = grants.get(id);
      if (!grant || grant.userId !== userId || grant.revokedAt) return false;
      clear(grant);
      return true;
    },
    async revokeByTokenHash(hash) {
      const grant = [...grants.values()].find(
        (item) => !item.revokedAt && (item.accessTokenHash === hash || item.refreshTokenHash === hash),
      );
      if (!grant) return false;
      clear(grant);
      return true;
    },
  };
}

function summary(grant: GrantRecord): GrantSummary {
  return {
    id: grant.id,
    clientLabel: grant.clientLabel,
    createdAt: grant.createdAt,
    refreshExpiresAt: grant.refreshExpiresAt,
  };
}

function clear(grant: GrantRecord) {
  grant.revokedAt = new Date().toISOString();
  grant.accessTokenHash = null;
  grant.refreshTokenHash = null;
  grant.supabaseRefreshEncrypted = "";
  grant.supabaseAccessEncrypted = null;
}
