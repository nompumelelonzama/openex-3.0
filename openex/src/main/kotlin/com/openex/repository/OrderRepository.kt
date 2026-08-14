package com.openex.repository

import com.openex.entity.Order
import com.openex.entity.OrderSide
import com.openex.entity.OrderStatus
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface OrderRepository : JpaRepository<Order, UUID> {
    fun findAllBySymbolAndSideAndStatusIn(
        symbol: String,
        side: OrderSide,
        statuses: List<OrderStatus>,
    ): List<Order>

    fun findAllByUserIdOrderByCreatedAtDesc(userId: UUID): List<Order>
}
