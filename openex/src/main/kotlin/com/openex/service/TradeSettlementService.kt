package com.openex.service

import com.openex.entity.EntryDirection
import com.openex.entity.Order
import com.openex.entity.OrderStatus
import com.openex.entity.Trade
import com.openex.repository.OrderRepository
import com.openex.repository.TradeRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal

/**
 * Settles a single match between a resting order and an incoming order:
 * - writes the balanced ledger legs (base asset one way, quote currency the other)
 * - writes the trade row
 * - updates both orders' remaining_quantity / status
 * All in one DB transaction, so a partial fill can never exist without its ledger entries.
 */
@Service
class TradeSettlementService(
    private val ledgerService: LedgerService,
    private val walletService: WalletService,
    private val orderRepository: OrderRepository,
    private val tradeRepository: TradeRepository,
) {

    /** symbol is expected in "BASE-QUOTE" form, e.g. "BTC-USD". */
    private fun parseSymbol(symbol: String): Pair<String, String> {
        val parts = symbol.split("-")
        require(parts.size == 2) { "Symbol must be in BASE-QUOTE form, e.g. BTC-USD, got '$symbol'" }
        return parts[0] to parts[1]
    }

    @Transactional
    fun settle(buyOrder: Order, sellOrder: Order, matchPrice: BigDecimal, matchQuantity: BigDecimal) {
        val (base, quote) = parseSymbol(buyOrder.symbol)

        val buyerBaseAccount = walletService.ensureAccount(buyOrder.userId, base)
        val buyerQuoteAccount = walletService.ensureAccount(buyOrder.userId, quote)
        val sellerBaseAccount = walletService.ensureAccount(sellOrder.userId, base)
        val sellerQuoteAccount = walletService.ensureAccount(sellOrder.userId, quote)

        val quoteAmount = matchPrice.multiply(matchQuantity)

        val txId = ledgerService.postTransaction(
            listOf(
                // Buyer pays quote currency, receives base asset.
                LedgerService.LedgerLine(buyerQuoteAccount.id, quoteAmount, EntryDirection.DEBIT, "trade: pay quote"),
                LedgerService.LedgerLine(sellerQuoteAccount.id, quoteAmount, EntryDirection.CREDIT, "trade: receive quote"),
                // Seller delivers base asset, buyer receives it.
                LedgerService.LedgerLine(sellerBaseAccount.id, matchQuantity, EntryDirection.DEBIT, "trade: deliver base"),
                LedgerService.LedgerLine(buyerBaseAccount.id, matchQuantity, EntryDirection.CREDIT, "trade: receive base"),
            ),
        )

        applyFill(buyOrder, matchQuantity)
        applyFill(sellOrder, matchQuantity)
        orderRepository.save(buyOrder)
        orderRepository.save(sellOrder)

        tradeRepository.save(
            Trade(
                symbol = buyOrder.symbol,
                buyOrderId = buyOrder.id,
                sellOrderId = sellOrder.id,
                price = matchPrice,
                quantity = matchQuantity,
                ledgerTransactionId = txId,
            ),
        )
    }

    private fun applyFill(order: Order, filledQuantity: BigDecimal) {
        order.remainingQuantity = order.remainingQuantity.subtract(filledQuantity)
        order.status = if (order.remainingQuantity.compareTo(BigDecimal.ZERO) <= 0) {
            OrderStatus.FILLED
        } else {
            OrderStatus.PARTIALLY_FILLED
        }
        order.updatedAt = java.time.Instant.now()
    }
}
