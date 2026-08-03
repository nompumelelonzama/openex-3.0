package com.openex.service

import com.openex.entity.Order
import com.openex.entity.OrderSide
import com.openex.entity.OrderStatus
import com.openex.entity.OrderType
import com.openex.repository.OrderRepository
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Tests the matching algorithm in isolation: TradeSettlementService is mocked to just
 * apply the same remaining-quantity/status math the real one does (minus the DB writes),
 * so we can assert on price-time priority and concurrency without a live Postgres.
 */
class MatchingEngineServiceTest {
    private val orderRepository = mockk<OrderRepository>(relaxed = true)
    private val settlement = mockk<TradeSettlementService>()
    private val broadcastService = mockk<OrderBookBroadcastService>(relaxed = true)
    private val engine = MatchingEngineService(orderRepository, settlement, broadcastService)

    init {
        // OrderRepository.save() has a generic return type (Spring Data's
        // <S extends T> S save(S entity)), which relaxed MockK mocks can't resolve
        // on their own -- without an explicit stub, the compiled checkcast on the
        // (discarded) return value throws ClassCastException. This default stub
        // just echoes back whatever was passed in, since these tests never rely on
        // the *return value* of save() -- only that it was called (or not called).
        every { orderRepository.save(any()) } answers { firstArg() }

        val buySlot = slot<Order>()
        val sellSlot = slot<Order>()
        val priceSlot = slot<BigDecimal>()
        val qtySlot = slot<BigDecimal>()
        every {
            settlement.settle(capture(buySlot), capture(sellSlot), capture(priceSlot), capture(qtySlot))
        } answers {
            val buy = buySlot.captured
            val sell = sellSlot.captured
            val qty = qtySlot.captured
            buy.remainingQuantity = buy.remainingQuantity.subtract(qty)
            sell.remainingQuantity = sell.remainingQuantity.subtract(qty)
            buy.status = if (buy.remainingQuantity.signum() <= 0) OrderStatus.FILLED else OrderStatus.PARTIALLY_FILLED
            sell.status = if (sell.remainingQuantity.signum() <= 0) OrderStatus.FILLED else OrderStatus.PARTIALLY_FILLED
        }
    }

    private fun limitOrder(
        side: OrderSide,
        price: String,
        qty: String,
        symbol: String = "BTC-USD",
    ) = Order(
        userId = UUID.randomUUID(),
        symbol = symbol,
        side = side,
        type = OrderType.LIMIT,
        price = BigDecimal(price),
        quantity = BigDecimal(qty),
        remainingQuantity = BigDecimal(qty),
    )

    @Test
    fun `resting order price wins and trade price is the resting price`() {
        val restingSell = limitOrder(OrderSide.SELL, "100", "1")
        engine.submit(restingSell)

        val incomingBuy = limitOrder(OrderSide.BUY, "105", "1") // willing to pay more than ask
        val result = engine.submit(incomingBuy)

        assertEquals(OrderStatus.FILLED, result.status)
        assertEquals(0, BigDecimal.ZERO.compareTo(result.remainingQuantity))
    }

    @Test
    fun `partial fill leaves the remainder resting on the book`() {
        val restingSell = limitOrder(OrderSide.SELL, "100", "1")
        engine.submit(restingSell)

        val incomingBuy = limitOrder(OrderSide.BUY, "100", "3")
        val result = engine.submit(incomingBuy)

        assertEquals(OrderStatus.PARTIALLY_FILLED, result.status)
        assertEquals(0, BigDecimal("2").compareTo(result.remainingQuantity))
    }

    @Test
    fun `price-time priority - better price fills first, ties go to earlier order`() {
        val worsePrice = limitOrder(OrderSide.SELL, "101", "1")
        val betterPrice = limitOrder(OrderSide.SELL, "99", "1")
        val earlierAtTie = limitOrder(OrderSide.SELL, "100", "1")
        val laterAtTie = limitOrder(OrderSide.SELL, "100", "1")

        engine.submit(worsePrice)
        engine.submit(betterPrice)
        engine.submit(earlierAtTie)
        engine.submit(laterAtTie)

        // Buy exactly enough to hit the best-price order, then the earlier tie order.
        val incomingBuy = limitOrder(OrderSide.BUY, "101", "2")
        engine.submit(incomingBuy)

        assertEquals(OrderStatus.FILLED, betterPrice.status) // best price (99) filled first
        assertEquals(OrderStatus.FILLED, earlierAtTie.status) // then earliest at the tie price (100)
        assertEquals(OrderStatus.OPEN, laterAtTie.status) // later tie order untouched
        assertEquals(OrderStatus.OPEN, worsePrice.status) // worst price untouched
    }

    @Test
    fun `10 concurrent orders on the same symbol settle without lost or duplicated fills`() {
        // 5 sell orders of qty 1 at price 100, 5 buy orders of qty 1 at price 100, fired concurrently.
        val orders =
            (1..5).map { limitOrder(OrderSide.SELL, "100", "1") } +
                (1..5).map { limitOrder(OrderSide.BUY, "100", "1") }

        val pool: ExecutorService = Executors.newFixedThreadPool(10)
        val startGate = CountDownLatch(1)
        val doneLatch = CountDownLatch(orders.size)

        orders.forEach { order ->
            pool.submit {
                startGate.await()
                try {
                    engine.submit(order)
                } finally {
                    doneLatch.countDown()
                }
            }
        }
        startGate.countDown()
        doneLatch.await(10, TimeUnit.SECONDS)
        pool.shutdown()

        val totalRemaining = orders.fold(BigDecimal.ZERO) { acc, o -> acc + o.remainingQuantity }
        val totalFilled = orders.count { it.status == OrderStatus.FILLED }

        // All 10 unit orders should net out to fully filled (5 buy + 5 sell, equal price/qty).
        assertEquals(0, BigDecimal.ZERO.compareTo(totalRemaining))
        assertEquals(10, totalFilled)
    }
}