package com.openex.dto

import java.math.BigDecimal
import java.time.Instant

data class PriceLevel(
    val price: BigDecimal,
    val quantity: BigDecimal,
    val orderCount: Int,
)

data class OrderBookSnapshot(
    val symbol: String,
    // highest price first
    val bids: List<PriceLevel>,
    // lowest price first
    val asks: List<PriceLevel>,
    val timestamp: Instant = Instant.now(),
)

/** Emitted alongside the book snapshot whenever a match actually occurs. */
data class TradeEvent(
    val symbol: String,
    val price: BigDecimal,
    val quantity: BigDecimal,
    val timestamp: Instant = Instant.now(),
)
