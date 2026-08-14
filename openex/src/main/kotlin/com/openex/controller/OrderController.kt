package com.openex.controller
import com.fasterxml.jackson.databind.ObjectMapper
import com.openex.dto.CreateOrderRequest
import com.openex.dto.OrderResponse
import com.openex.security.CurrentUser
import com.openex.service.IdempotencyService
import com.openex.service.OrderService
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
@RestController
@RequestMapping("/api/orders")
class OrderController(
    private val orderService: OrderService,
    private val idempotencyService: IdempotencyService,
    private val objectMapper: ObjectMapper,
) {
    @PostMapping
    fun createOrder(
        @Valid @RequestBody request: CreateOrderRequest,
        httpRequest: HttpServletRequest,
    ): ResponseEntity<String> {
        val userId = CurrentUser.id()
        val idempotencyKey =
            httpRequest.getHeader("Idempotency-Key")
                ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency-Key header is required")
        val requestHash = idempotencyService.hashOf(request)
        idempotencyService.lookup(idempotencyKey, requestHash)?.let { cached ->
            return ResponseEntity
                .status(cached.status)
                .header("Idempotency-Replayed", "true")
                .body(cached.body)
        }
        val response: OrderResponse = orderService.createOrder(userId, request)
        val bodyJson = objectMapper.writeValueAsString(response)
        idempotencyService.store(idempotencyKey, userId, requestHash, HttpStatus.CREATED.value(), bodyJson)
        return ResponseEntity.status(HttpStatus.CREATED).body(bodyJson)
    }

    @GetMapping
    fun getOrderHistory(): ResponseEntity<List<OrderResponse>> {
        val userId = CurrentUser.id()
        val history = orderService.getOrderHistory(userId)
        return ResponseEntity.ok(history)
    }
}
