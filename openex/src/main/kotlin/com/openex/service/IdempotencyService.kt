package com.openex.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.openex.entity.IdempotencyKey
import com.openex.repository.IdempotencyKeyRepository
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.security.MessageDigest
import java.time.Duration
import java.util.UUID

/**
 * Backs POST /api/orders (and any future mutating financial endpoint) with an
 * Idempotency-Key cache. Postgres (idempotency_keys table) is the source of truth so a
 * retried request always gets exactly the original response, even after a restart;
 * Redis is used as a fast negative/positive lookup cache in front of it.
 */
@Service
class IdempotencyService(
    private val idempotencyKeyRepository: IdempotencyKeyRepository,
    private val redisTemplate: StringRedisTemplate,
    private val objectMapper: ObjectMapper,
) {
    private val redisTtl = Duration.ofHours(24)

    data class CachedResponse(val status: Int, val body: String)

    fun hashOf(requestBody: Any): String {
        val json = objectMapper.writeValueAsString(requestBody)
        val digest = MessageDigest.getInstance("SHA-256").digest(json.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }

    /**
     * Returns the cached response for [key] if one exists. Throws 409 if the same key
     * was used with a *different* request body (protects against accidental key reuse).
     */
    fun lookup(key: String, requestHash: String): CachedResponse? {
        redisTemplate.opsForValue().get(redisCacheKey(key))?.let { cached ->
            val parsed = objectMapper.readValue(cached, CachedResponse::class.java)
            return parsed
        }

        val existing = idempotencyKeyRepository.findById(key).orElse(null) ?: return null

        if (existing.requestHash != requestHash) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "Idempotency-Key '$key' was already used with a different request body",
            )
        }

        val response = CachedResponse(existing.responseStatus, existing.responseBody)
        cacheInRedis(key, response)
        return response
    }

    @Transactional
    fun store(key: String, userId: UUID, requestHash: String, status: Int, body: String) {
        idempotencyKeyRepository.save(
            IdempotencyKey(
                idempotencyKey = key,
                userId = userId,
                requestHash = requestHash,
                responseStatus = status,
                responseBody = body,
            ),
        )
        cacheInRedis(key, CachedResponse(status, body))
    }

    private fun cacheInRedis(key: String, response: CachedResponse) {
        redisTemplate.opsForValue().set(redisCacheKey(key), objectMapper.writeValueAsString(response), redisTtl)
    }

    private fun redisCacheKey(key: String) = "idempotency:$key"
}
