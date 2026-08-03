package com.openex.service

import com.openex.dto.BalanceResponse
import com.openex.entity.Account
import com.openex.repository.AccountRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.util.UUID

@Service
class WalletService(
    private val accountRepository: AccountRepository,
    private val ledgerService: LedgerService,
) {
    companion object {
        // Fixed system user seeded in V2__seed_system_user.sql. Owns one "mint" account
        // per currency; deposits are a real, FK-safe ledger transfer from mint -> user.
        val SYSTEM_USER_ID: UUID = UUID.fromString("00000000-0000-0000-0000-000000000001")
    }

    @Transactional
    fun ensureAccount(
        userId: UUID,
        currency: String,
    ): Account =
        accountRepository.findByUserIdAndCurrency(userId, currency)
            ?: accountRepository.save(Account(userId = userId, currency = currency))

    private fun mintAccount(currency: String): Account = ensureAccount(SYSTEM_USER_ID, currency)

    /** The simulated-funds "faucet". Money is minted from the system account for [currency]. */
    @Transactional
    fun deposit(
        userId: UUID,
        currency: String,
        amount: BigDecimal,
    ): BalanceResponse {
        require(amount > BigDecimal.ZERO) { "Deposit amount must be positive" }

        val userAccount = ensureAccount(userId, currency)
        val mint = mintAccount(currency)

        ledgerService.transfer(
            fromAccountId = mint.id,
            toAccountId = userAccount.id,
            amount = amount,
            memo = "faucet deposit",
            // the mint account is allowed to go negative -- it's not real money
            allowOverdraft = true,
        )

        return BalanceResponse(currency, ledgerService.balanceOf(userAccount.id))
    }

    fun getBalances(userId: UUID): List<BalanceResponse> =
        accountRepository.findAllByUserId(userId).map { account ->
            BalanceResponse(account.currency, ledgerService.balanceOf(account.id))
        }
}
