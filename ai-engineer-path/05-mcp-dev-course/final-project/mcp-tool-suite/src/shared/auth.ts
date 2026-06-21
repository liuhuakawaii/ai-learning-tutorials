export interface AuthConfig {
  apiKey?: string;
  rateLimit?: number;
}

export function validateApiKey(provided: string, expected: string): boolean {
  return provided === expected;
}

export function sanitizeSqlInput(sql: string): string {
  const forbidden = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "TRUNCATE"];
  const upper = sql.toUpperCase();
  for (const kw of forbidden) {
    if (upper.includes(kw)) {
      throw new Error(`禁止的 SQL 关键字: ${kw}`);
    }
  }
  return sql;
}

const requestCounts = new Map<string, number>();

export function checkRateLimit(clientId: string, limit: number = 100): boolean {
  const count = requestCounts.get(clientId) || 0;
  if (count >= limit) return false;
  requestCounts.set(clientId, count + 1);
  return true;
}
