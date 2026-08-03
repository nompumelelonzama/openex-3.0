package com.openex.repository

import com.openex.entity.LedgerEntry
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.math.BigDecimal
import java.util.UUID

interface LedgerEntryRepository : JpaRepository<LedgerEntry, UUID> {
    fun findAllByTransactionId(transactionId: UUID): List<LedgerEntry>

    // CREDIT counts positive, DEBIT counts negative -> current balance for the account.
    @Query(
        """
        SELECT COALESCE(SUM(
            CASE WHEN le.direction = 'CREDIT' THEN le.amount ELSE -le.amount END
        ), 0)
        FROM LedgerEntry le
        WHERE le.accountId = :accountId
        """,
    )
    fun balanceOf(
        @Param("accountId") accountId: UUID,
    ): BigDecimal
}
