import json
import logging
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global redis_client
    if redis_client is None:
        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=5,
        )
    return redis_client


async def close_redis():
    global redis_client
    if redis_client:
        await redis_client.close()
        redis_client = None


class CacheService:
    def __init__(self, prefix: str = "cache", ttl: int = 3600):
        self.prefix = prefix
        self.ttl = ttl

    async def get(self, key: str) -> str | None:
        try:
            r = await get_redis()
            return await r.get(f"{self.prefix}:{key}")
        except Exception as e:
            logger.warning("Redis get failed: %s", e)
            return None

    async def set(self, key: str, value: str, ttl: int | None = None):
        try:
            r = await get_redis()
            await r.set(f"{self.prefix}:{key}", value, ex=ttl or self.ttl)
        except Exception as e:
            logger.warning("Redis set failed: %s", e)

    async def delete(self, key: str):
        try:
            r = await get_redis()
            await r.delete(f"{self.prefix}:{key}")
        except Exception as e:
            logger.warning("Redis delete failed: %s", e)

    async def get_json(self, key: str) -> dict | None:
        data = await self.get(key)
        if data:
            try:
                return json.loads(data)
            except json.JSONDecodeError:
                return None
        return None

    async def set_json(self, key: str, value: dict, ttl: int | None = None):
        await self.set(key, json.dumps(value, ensure_ascii=False), ttl)


class SessionCache:
    def __init__(self):
        self.cache = CacheService(prefix="session", ttl=86400)

    async def get_messages(self, session_id: str) -> list[dict] | None:
        return await self.cache.get_json(f"{session_id}:messages")

    async def set_messages(self, session_id: str, messages: list[dict]):
        await self.cache.set_json(f"{session_id}:messages", messages)

    async def invalidate(self, session_id: str):
        await self.cache.delete(f"{session_id}:messages")


class RateLimiter:
    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def check(self, key: str) -> bool:
        try:
            r = await get_redis()
            current = await r.incr(f"ratelimit:{key}")
            if current == 1:
                await r.expire(f"ratelimit:{key}", self.window_seconds)
            return current <= self.max_requests
        except Exception as e:
            logger.warning("Rate limit check failed: %s", e)
            return True
