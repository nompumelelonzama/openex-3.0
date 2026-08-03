package com.openex.service

import com.openex.entity.EntryDirection
import com.openex.entity.LedgerEntry
import com.openex.repository.LedgerEntryRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.util.UUID

class UnbalancedTransactionException(message: String) : RuntimeException(message)
class InsufficientFundsException(message: String) : RuntimeException(message)

/**
 * The only place in the codebase allowed to write to `ledger_entries`.
 *
 * Invariant enforced on every call: the CREDIT entries and DEBIT entries in a
 * single postTransaction() call must sum to the same amount. If they don't,
 * or if a debited account would go negative, the whole @Transactional method
 * throws and Spring rolls back every row it touched — no partial writes.
 */
@Service
class LedgerService(
    private val ledgerEntryRepository: LedgerEntryRepository,
) {

    data class LedgerLine(
        val accountId: UUID,
        val amount: BigDecimal,
        val direction: EntryDirection,
        val memo: String? = null,
    )

    /**
     * Posts a balanced set of ledger lines as one atomic transaction.
     * Returns the transactionId used to tie the rows together.
     */
    @Transactional
    fun postTransaction(lines: List<LedgerLine>, transactionId: UUID = UUID.randomUUID(), allowOverdraft: Boolean = false): UUID {
        require(lines.isNotEmpty()) { "A ledger transaction needs at least one line" }

        val totalCredits = lines.filter { it.direction == EntryDirection.CREDIT }
            .fold(BigDecimal.ZERO) { acc, l -> acc + l.amount }
        val totalDebits = lines.filter { it.direction == EntryDirection.DEBIT }
            .fold(BigDecimal.ZERO) { acc, l -> acc + l.amount }

        if (totalCredits.compareTo(totalDebits) != 0) {
            throw UnbalancedTransactionException(
                "Ledger transaction does not balance: credits=$totalCredits debits=$totalDebits",
            )
        }

        if (!allowOverdraft) {
            // Group debits by account so we validate the *net* effect, not each line in isolation.
            lines.filter { it.direction == EntryDirection.DEBIT }
                .groupBy { it.accountId }
                .forEach { (accountId, debitLines) ->
                    val debitTotal = debitLines.fold(BigDecimal.ZERO) { acc, l -> acc + l.amount }
                    val currentBalance = ledgerEntryRepository.balanceOf(accountId)
                    if (currentBalance < debitTotal) {
                        throw InsufficientFundsException(
                            "Account $accountId has insufficient balance: balance=$currentBalance required=$debitTotal",
                        )
                    }
                }
        }

        lines.forEach { line ->
            ledgerEntryRepository.save(
                LedgerEntry(
                    transactionId = transactionId,
                    accountId = line.accountId,
                    amount = line.amount,
                    direction = line.direction,
                    memo = line.memo,
                ),
            )
        }

        return transactionId
    }

    /** Convenience wrapper for the common two-leg case: move `amount` from one account to another. */
    @Transactional
    fun transfer(
        fromAccountId: UUID,
        toAccountId: UUID,
        amount: BigDecimal,
        memo: String? = null,
        transactionId: UUID = UUID.randomUUID(),
        allowOverdraft: Boolean = false,
    ): UUID =
        postTransaction(
            listOf(
                LedgerLine(fromAccountId, amount, EntryDirection.DEBIT, memo),
                LedgerLine(toAccountId, amount, EntryDirection.CREDIT, memo),
            ),
            transactionId,
            allowOverdraft,
        )

    fun balanceOf(accountId: UUID): BigDecimal = ledgerEntryRepository.balanceOf(accountId)
}
