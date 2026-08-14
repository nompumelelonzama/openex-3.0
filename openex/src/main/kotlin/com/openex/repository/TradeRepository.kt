package com.openex.repository

import com.openex.entity.Trade
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface TradeRepository : JpaRepository<Trade, UUID> {
    /**
     * All trades where the given user was either the buyer or the seller, newest first.
     * Joins back to Order (twice) purely to filter by ownership -- Trade itself only
     * stores buy/sell order ids, not user ids directly.
     */
    @Query(
        """
        SELECT t FROM Trade t
        WHERE t.buyOrderId IN (SELECT o.id FROM Order o WHERE o.userId = :userId)
           OR t.sellOrderId IN (SELECT o.id FROM Order o WHERE o.userId = :userId)
        ORDER BY t.createdAt DESC
        """,
    )
    fun findAllForUser(
        @Param("userId") userId: UUID,
    ): List<Trade>
}
