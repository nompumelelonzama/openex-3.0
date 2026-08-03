package com.openex.repository

import com.openex.entity.IdempotencyKey
import org.springframework.data.jpa.repository.JpaRepository

interface IdempotencyKeyRepository : JpaRepository<IdempotencyKey, String>
