package com.openex.service

import com.openex.dto.OrderBookSnapshot
import com.openex.dto.PriceLevel
import com.openex.dto.TradeEvent
import com.openex.entity.Order
import com.openex.entity.OrderSide
import com.openex.entity.OrderStatus
import com.openex.entity.OrderType
import com.openex.repository.OrderRepository
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.util.ArrayDeque
import java.util.TreeMap
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantLock

/**
 * One in-memory order book per symbol, price-time priority on both sides.
 *
 * - Bids (BUY) are kept highest price first.
 * - Asks (SELL) are kept lowest price first.
 * - At a given price level, orders are a FIFO queue (time priority).
 *
 * A single lock per symbol serializes matching for that symbol so concurrent submissions
 * can't interleave and corrupt price-time ordering; different symbols can match in parallel.
 * Every fill is settled (ledger + order rows) transactionally before matching continues,
 * so the in-memory book and the database are never allowed to diverge. After every state
 * change (submit or cancel) a fresh snapshot is broadcast to /topic/orderbook/{symbol}.
 */
@Service
class MatchingEngineService(
    private val orderRepository: OrderRepository,
    private val tradeSettlementService: TradeSettlementService,
    private val broadcastService: OrderBookBroadcastService,
) {
    private class OrderBook {
        // Bids: highest price first -> reverseOrder comparator
        val bids = TreeMap<BigDecimal, ArrayDeque<Order>>(Comparator.reverseOrder())
        // Asks: lowest price first -> natural order
        val asks = TreeMap<BigDecimal, ArrayDeque<Order>>()

        fun sideFor(side: OrderSide) = if (side == OrderSide.BUY) bids else asks
        fun oppositeSideFor(side: OrderSide) = if (side == OrderSide.BUY) asks else bids

        fun add(order: Order) {
            val price = requireNotNull(order.price) { "Only LIMIT orders rest on the book" }
            sideFor(order.side).getOrPut(price) { ArrayDeque() }.addLast(order)
        }

        fun removeIfPresent(order: Order) {
            val price = order.price ?: return
            val map = sideFor(order.side)
            val level = map[price] ?: return
            level.remove(order)
            if (level.isEmpty()) map.remove(price)
        }

        fun bestOpposite(side: OrderSide): Order? {
            val opposite = oppositeSideFor(side)
            val entry = opposite.firstEntry() ?: return null
            return entry.value.peekFirst()
        }

        fun popBestOppositeIfFilled(side: OrderSide, order: Order) {
            val opposite = oppositeSideFor(side)
            val entry = opposite.firstEntry() ?: return
            if (entry.value.peekFirst() === order) {
                entry.value.pollFirst()
                if (entry.value.isEmpty()) opposite.remove(entry.key)
            }
        }

        fun levels(side: TreeMap<BigDecimal, ArrayDeque<Order>>, depth: Int): List<PriceLevel> =
            side.entries.take(depth).map { (price, orders) ->
                PriceLevel(
                    price = price,
                    quantity = orders.fold(BigDecimal.ZERO) { acc, o -> acc + o.remainingQuantity },
                    orderCount = orders.size,
                )
            }

        fun snapshot(symbol: String, depth: Int = 20): OrderBookSnapshot =
            OrderBookSnapshot(symbol = symbol, bids = levels(bids, depth), asks = levels(asks, depth))
    }

    private val books = ConcurrentHashMap<String, OrderBook>()
    private val locks = ConcurrentHashMap<String, ReentrantLock>()

    private fun bookFor(symbol: String) = books.getOrPut(symbol) { OrderBook() }
    private fun lockFor(symbol: String) = locks.getOrPut(symbol) { ReentrantLock() }

    /** Returns the (now-updated) incoming order after matching, either resting, filled, or partially filled. */
    fun submit(incoming: Order): Order {
        val lock = lockFor(incoming.symbol)
        lock.lock()
        try {
            val book = bookFor(incoming.symbol)
            matchAgainstBook(book, incoming)

            if (incoming.remainingQuantity > BigDecimal.ZERO) {
                if (incoming.type == OrderType.LIMIT) {
                    book.add(incoming)
                    orderRepository.save(incoming)
                } else {
                    // MARKET order with no remaining liquidity to match: cancel the unfilled remainder.
                    incoming.status = if (incoming.remainingQuantity.compareTo(incoming.quantity) == 0) {
                        OrderStatus.CANCELLED
                    } else {
                        OrderStatus.PARTIALLY_FILLED
                    }
                    orderRepository.save(incoming)
                }
            }

            broadcastService.broadcastSnapshot(book.snapshot(incoming.symbol))
            return incoming
        } finally {
            lock.unlock()
        }
    }

    private fun crosses(incoming: Order, restingPrice: BigDecimal): Boolean {
        if (incoming.type == OrderType.MARKET) return true
        val incomingPrice = incoming.price ?: return false
        return if (incoming.side == OrderSide.BUY) {
            incomingPrice >= restingPrice
        } else {
            incomingPrice <= restingPrice
        }
    }

    private fun matchAgainstBook(book: OrderBook, incoming: Order) {
        while (incoming.remainingQuantity > BigDecimal.ZERO) {
            val resting = book.bestOpposite(incoming.side) ?: break
            val matchPrice = requireNotNull(resting.price) { "Resting order must be a LIMIT order with a price" }
            if (!crosses(incoming, matchPrice)) break

            val matchQty = minOf(incoming.remainingQuantity, resting.remainingQuantity)
            // matchPrice comes from the resting order, which sets the trade price

            val buyOrder = if (incoming.side == OrderSide.BUY) incoming else resting
            val sellOrder = if (incoming.side == OrderSide.BUY) resting else incoming

            // Settles ledger + trade + order rows transactionally; mutates both Order objects.
            tradeSettlementService.settle(buyOrder, sellOrder, matchPrice, matchQty)
            broadcastService.broadcastTrade(TradeEvent(incoming.symbol, matchPrice, matchQty))

            if (resting.remainingQuantity <= BigDecimal.ZERO) {
                book.popBestOppositeIfFilled(incoming.side, resting)
            }
        }
    }

    fun cancel(order: Order) {
        val lock = lockFor(order.symbol)
        lock.lock()
        try {
            val book = bookFor(order.symbol)
            book.removeIfPresent(order)
            order.status = OrderStatus.CANCELLED
            orderRepository.save(order)
            broadcastService.broadcastSnapshot(book.snapshot(order.symbol))
        } finally {
            lock.unlock()
        }
    }

    /** Used by REST/WebSocket handlers that want the current book without waiting for a change. */
    fun currentSnapshot(symbol: String): OrderBookSnapshot = bookFor(symbol).snapshot(symbol)
}
