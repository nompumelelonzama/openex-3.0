package com.openex.controller

import com.openex.dto.TradeResponse
import com.openex.security.CurrentUser
import com.openex.service.TradeHistoryService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/trades")
class TradeController(
    private val tradeHistoryService: TradeHistoryService,
) {
    @GetMapping
    fun getTradeHistory(): List<TradeResponse> = tradeHistoryService.historyFor(CurrentUser.id())
}
