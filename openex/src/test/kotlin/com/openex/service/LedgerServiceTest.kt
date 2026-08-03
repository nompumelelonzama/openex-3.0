package com.openex.service

import com.openex.entity.EntryDirection
import com.openex.repository.LedgerEntryRepository
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.util.UUID

/**
 * Pure unit tests against a mocked repository — no Spring context needed.
 * See OrderIdempotencyIntegrationTest / MatchingEngineServiceTest for tests
 * that run against a real Postgres instance and check actual persisted rows.
 */
class LedgerServiceTest {

    private val repo = mockk<LedgerEntryRepository>(relaxed = true)
    private val ledgerService = LedgerService(repo)

    @Test
    fun `balanced transaction posts one CREDIT and one DEBIT that sum to zero`() {
        val from = UUID.randomUUID()
        val to = UUID.randomUUID()
        every { repo.balanceOf(from) } returns BigDecimal("100.00000000")

        val savedLines = mutableListOf<com.openex.entity.LedgerEntry>()
        every { repo.save(capture(savedLines)) } answers { firstArg() }

        ledgerService.transfer(from, to, BigDecimal("40.00000000"))

        assertEquals(2, savedLines.size)
        val net = savedLines.fold(BigDecimal.ZERO) { acc, e ->
            acc + if (e.direction == EntryDirection.CREDIT) e.amount else e.amount.negate()
        }
        assertEquals(0, net.compareTo(BigDecimal.ZERO), "ledger entries for a transaction must net to zero")

        val debit = savedLines.first { it.direction == EntryDirection.DEBIT }
        val credit = savedLines.first { it.direction == EntryDirection.CREDIT }
        assertEquals(from, debit.accountId)
        assertEquals(to, credit.accountId)
        assertEquals(debit.transactionId, credit.transactionId)
    }

    @Test
    fun `unbalanced transaction is rejected before anything is saved`() {
        val a = UUID.randomUUID()
        val b = UUID.randomUUID()

        assertThrows(UnbalancedTransactionException::class.java) {
            ledgerService.postTransaction(
                listOf(
                    LedgerService.LedgerLine(a, BigDecimal("50"), EntryDirection.DEBIT),
                    LedgerService.LedgerLine(b, BigDecimal("49"), EntryDirection.CREDIT),
                ),
            )
        }

        verify(exactly = 0) { repo.save(any()) }
    }

    @Test
    fun `insufficient funds blocks the transfer and saves nothing`() {
        val from = UUID.randomUUID()
        val to = UUID.randomUUID()
        every { repo.balanceOf(from) } returns BigDecimal("10.00000000")

        assertThrows(InsufficientFundsException::class.java) {
            ledgerService.transfer(from, to, BigDecimal("40.00000000"))
        }

        verify(exactly = 0) { repo.save(any()) }
    }

    @Test
    fun `allowOverdraft bypasses the balance check, e g for faucet-backed mint transfers`() {
        val mint = UUID.randomUUID()
        val user = UUID.randomUUID()
        // no stub for repo.balanceOf(mint) -> would return 0 by default via relaxed mock,
        // proving the check is genuinely skipped rather than accidentally passing.

        ledgerService.transfer(mint, user, BigDecimal("1000"), allowOverdraft = true)

        verify(exactly = 2) { repo.save(any()) }
    }
}
