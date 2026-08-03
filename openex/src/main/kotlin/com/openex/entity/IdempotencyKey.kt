package com.openex.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "idempotency_keys")
class IdempotencyKey(
    @Id
    @Column(name = "idempotency_key")
    val idempotencyKey: String,
    @Column(name = "user_id", nullable = false)
    val userId: UUID,
    @Column(name = "request_hash", nullable = false)
    val requestHash: String,
    @Column(name = "response_status", nullable = false)
    val responseStatus: Int,
    @Column(name = "response_body", nullable = false, columnDefinition = "TEXT")
    val responseBody: String,
    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
