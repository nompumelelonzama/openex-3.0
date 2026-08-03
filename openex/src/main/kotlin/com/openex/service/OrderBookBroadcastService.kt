package com.openex.service

import com.openex.dto.OrderBookSnapshot
import com.openex.dto.TradeEvent
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service

@Service
class OrderBookBroadcastService(
    private val messagingTemplate: SimpMessagingTemplate,
) {
    fun broadcastSnapshot(snapshot: OrderBookSnapshot) {
        messagingTemplate.convertAndSend("/topic/orderbook/${snapshot.symbol}", snapshot)
    }

    fun broadcastTrade(trade: TradeEvent) {
        messagingTemplate.convertAndSend("/topic/trades/${trade.symbol}", trade)
    }
}
