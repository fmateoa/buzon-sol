export function redisOptions(): { host: string; port: number; username?: string; password?: string; tls?: object } {
  const url = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") throw new Error("Invalid Redis URL");
  return { host: url.hostname, port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    tls: url.protocol === "rediss:" ? {} : undefined };
}

/** API requests fail promptly when Redis cannot accept a job. Workers keep retrying separately. */
export function redisApiOptions() {
  return { ...redisOptions(), connectTimeout: 5_000, maxRetriesPerRequest: 1, enableOfflineQueue: false };
}
