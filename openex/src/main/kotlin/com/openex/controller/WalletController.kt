package com.openex.controller

import com.openex.dto.BalanceResponse
import com.openex.dto.DepositRequest
import com.openex.security.CurrentUser
import com.openex.service.WalletService
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/wallets")
class WalletController(
    private val walletService: WalletService,
) {

    @GetMapping
    fun getBalances(): ResponseEntity<List<BalanceResponse>> =
        ResponseEntity.ok(walletService.getBalances(CurrentUser.id()))

    /** Simulated-funds faucet — deposits are minted from the system account, see WalletService. */
    @PostMapping("/deposit")
    fun deposit(@Valid @RequestBody request: DepositRequest): ResponseEntity<BalanceResponse> =
        ResponseEntity.ok(walletService.deposit(CurrentUser.id(), request.currency, request.amount))
}
