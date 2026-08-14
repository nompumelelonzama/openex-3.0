package com.openex.dto

import com.openex.entity.OrderSide
import com.openex.entity.OrderStatus
import com.openex.entity.OrderType
import jakarta.validation.constraints.DecimalMin
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

data class CreateOrderRequest(
    @field:NotBlank val symbol: String,
    @field:NotNull val side: OrderSide,
    @field:NotNull val type: OrderType,
    // required for LIMIT, ignored for MARKET
    val price: BigDecimal? = null,
    @field:DecimalMin(value = "0.00000001") val quantity: BigDecimal,
)

data class OrderResponse(
    val id: UUID,
    val symbol: String,
    val side: OrderSide,
    val type: OrderType,
    val price: BigDecimal?,
    val quantity: BigDecimal,
    val remainingQuantity: BigDecimal,
    val status: OrderStatus,
    val createdAt: Instant,
)
