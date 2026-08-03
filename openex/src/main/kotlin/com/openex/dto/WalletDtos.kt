package com.openex.dto

import jakarta.validation.constraints.DecimalMin
import jakarta.validation.constraints.NotBlank
import java.math.BigDecimal

data class DepositRequest(
    @field:NotBlank val currency: String,
    @field:DecimalMin(value = "0.00000001") val amount: BigDecimal,
)

data class BalanceResponse(
    val currency: String,
    val balance: BigDecimal,
)
