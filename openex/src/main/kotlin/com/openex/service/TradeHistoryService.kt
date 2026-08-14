package com.openex.service

import com.openex.dto.TradeResponse
import com.openex.entity.OrderSide
import com.openex.repository.OrderRepository
import com.openex.repository.TradeRepository
import org.springframework.stereotype.Service
import java.util.UUID

@Service
class TradeHistoryService(
    private val tradeRepository: TradeRepository,
    private val orderRepository: OrderRepository,
) {
    fun historyFor(userId: UUID): List<TradeResponse> {
        val trades = tradeRepository.findAllForUser(userId)

        // One lookup per trade is fine at this data volume; avoids a heavier join projection
        // for what's currently a dev-scale feature.
        return trades.map { trade ->
            val buyOrder = orderRepository.findById(trade.buyOrderId).orElse(null)
            val side = if (buyOrder != null && buyOrder.userId == userId) OrderSide.BUY else OrderSide.SELL

            TradeResponse(
                id = trade.id,
                symbol = trade.symbol,
                side = side,
                price = trade.price,
                quantity = trade.quantity,
                createdAt = trade.createdAt,
            )
        }
    }
}
