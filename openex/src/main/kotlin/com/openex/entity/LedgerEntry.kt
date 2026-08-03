package com.openex.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

enum class EntryDirection { CREDIT, DEBIT }

/**
 * Immutable double-entry ledger row. Balances are never stored directly —
 * an account's balance is always SUM(CREDIT) - SUM(DEBIT) over its entries.
 * Every business transaction (deposit, trade, withdrawal) writes at least one
 * CREDIT and one DEBIT sharing the same [transactionId], and the two amounts
 * must be equal so the ledger nets to zero.
 */
@Entity
@Table(name = "ledger_entries")
class LedgerEntry(
    @Id
    val id: UUID = UUID.randomUUID(),
    @Column(name = "transaction_id", nullable = false)
    val transactionId: UUID,
    @Column(name = "account_id", nullable = false)
    val accountId: UUID,
    @Column(nullable = false, precision = 18, scale = 8)
    val amount: BigDecimal,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    val direction: EntryDirection,
    val memo: String? = null,
    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
