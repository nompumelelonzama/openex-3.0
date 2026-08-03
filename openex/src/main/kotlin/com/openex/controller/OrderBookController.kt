package com.openex.controller

import com.openex.dto.OrderBookSnapshot
import com.openex.service.MatchingEngineService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/orderbook")
class OrderBookController(
    private val matchingEngineService: MatchingEngineService,
) {
    /** One-shot snapshot for initial page load; live updates come over /topic/orderbook/{symbol}. */
    @GetMapping("/{symbol}")
    fun getSnapshot(
        @PathVariable symbol: String,
    ): OrderBookSnapshot = matchingEngineService.currentSnapshot(symbol)
}
