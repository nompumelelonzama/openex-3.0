package com.openex.dto

import com.openex.entity.OrderSide
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

data class TradeResponse(
    val id: UUID,
    val symbol: String,
    val side: OrderSide,
    val price: BigDecimal,
    val quantity: BigDecimal,
    val createdAt: Instant,
)
