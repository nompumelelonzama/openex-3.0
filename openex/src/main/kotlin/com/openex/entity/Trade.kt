package com.openex.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "trades")
class Trade(
    @Id
    val id: UUID = UUID.randomUUID(),

    @Column(nullable = false)
    val symbol: String,

    @Column(name = "buy_order_id", nullable = false)
    val buyOrderId: UUID,

    @Column(name = "sell_order_id", nullable = false)
    val sellOrderId: UUID,

    @Column(nullable = false, precision = 18, scale = 8)
    val price: BigDecimal,

    @Column(nullable = false, precision = 18, scale = 8)
    val quantity: BigDecimal,

    @Column(name = "ledger_transaction_id", nullable = false)
    val ledgerTransactionId: UUID,

    @Column(name = "created_at", nullable = false)
    val createdAt: Instant = Instant.now(),
)
