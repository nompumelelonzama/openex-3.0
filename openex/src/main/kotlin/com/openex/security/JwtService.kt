package com.openex.security

import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.Date
import java.util.UUID
import javax.crypto.SecretKey

@Service
class JwtService(
    @Value("\${openex.jwt.secret}") secret: String,
    @Value("\${openex.jwt.expiration-minutes}") private val expirationMinutes: Long,
) {
    // HS256 requires a >= 256-bit (32 byte) key; pad short dev secrets so local/dev
    // configs don't crash, while still using the full production secret when it's long enough.
    private val key: SecretKey =
        Keys.hmacShaKeyFor(
            secret.toByteArray().let { bytes -> if (bytes.size >= 32) bytes else bytes.copyOf(32) },
        )

    fun generateToken(
        userId: UUID,
        email: String,
    ): String {
        val now = Instant.now()
        return Jwts
            .builder()
            .subject(userId.toString())
            .claim("email", email)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(expirationMinutes, ChronoUnit.MINUTES)))
            .signWith(key)
            .compact()
    }

    fun expirationSeconds(): Long = expirationMinutes * 60

    fun extractUserId(token: String): UUID? =
        runCatching {
            UUID.fromString(
                Jwts
                    .parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .payload.subject,
            )
        }.getOrNull()

    fun isValid(token: String): Boolean =
        runCatching {
            Jwts
                .parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
            true
        }.getOrDefault(false)
}
