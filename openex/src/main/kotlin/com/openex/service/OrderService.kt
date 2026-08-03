package com.openex.service

import com.openex.dto.CreateOrderRequest
import com.openex.dto.OrderResponse
import com.openex.entity.Order
import com.openex.entity.OrderType
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@Service
class OrderService(
    private val matchingEngineService: MatchingEngineService,
) {

    fun createOrder(userId: UUID, request: CreateOrderRequest): OrderResponse {
        if (request.type == OrderType.LIMIT && request.price == null) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "price is required for LIMIT orders")
        }

        val order = Order(
            userId = userId,
            symbol = request.symbol,
            side = request.side,
            type = request.type,
            price = if (request.type == OrderType.LIMIT) request.price else null,
            quantity = request.quantity,
            remainingQuantity = request.quantity,
        )

        val result = matchingEngineService.submit(order)
        return result.toResponse()
    }
}

fun Order.toResponse() = OrderResponse(
    id = id,
    symbol = symbol,
    side = side,
    type = type,
    price = price,
    quantity = quantity,
    remainingQuantity = remainingQuantity,
    status = status,
)
