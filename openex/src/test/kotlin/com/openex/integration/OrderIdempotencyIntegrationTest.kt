package com.openex.integration

import com.fasterxml.jackson.databind.ObjectMapper
import com.openex.dto.LoginRequest
import com.openex.dto.RegisterRequest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/**
 * Runs against a real Postgres + Redis (see ci.yml service containers / docker-compose).
 * Proves: retrying POST /api/orders with the same Idempotency-Key never creates a second
 * order — the second call returns the exact cached response from the first.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderIdempotencyIntegrationTest {

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var objectMapper: ObjectMapper

    private lateinit var jwt: String

    @BeforeEach
    fun registerAndDepositFunds() {
        val email = "trader-${UUID.randomUUID()}@example.com"
        val registerBody = objectMapper.writeValueAsString(RegisterRequest(email, "password123"))

        val registerResult = mockMvc.perform(
            post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(registerBody),
        ).andExpect(status().isCreated).andReturn()

        jwt = objectMapper.readTree(registerResult.response.contentAsString).get("token").asText()

        // Give the account enough USD to cover the test order.
        mockMvc.perform(
            post("/api/wallets/deposit")
                .header("Authorization", "Bearer $jwt")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"currency":"USD","amount":100000}"""),
        ).andExpect(status().isOk)
    }

    @Test
    fun `duplicate Idempotency-Key returns the cached response instead of creating a second order`() {
        val idempotencyKey = UUID.randomUUID().toString()
        val orderBody = """{"symbol":"BTC-USD","side":"BUY","type":"LIMIT","price":50000,"quantity":0.01}"""

        val first = mockMvc.perform(
            post("/api/orders")
                .header("Authorization", "Bearer $jwt")
                .header("Idempotency-Key", idempotencyKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content(orderBody),
        ).andExpect(status().isCreated).andReturn().response.contentAsString

        val second = mockMvc.perform(
            post("/api/orders")
                .header("Authorization", "Bearer $jwt")
                .header("Idempotency-Key", idempotencyKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content(orderBody),
        ).andExpect(status().isCreated)
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Idempotency-Replayed", "true"))
            .andReturn().response.contentAsString

        assertEquals(first, second, "retried request must return the exact same order, not create a new one")

        val firstOrderId = objectMapper.readTree(first).get("id").asText()
        val secondOrderId = objectMapper.readTree(second).get("id").asText()
        assertTrue(firstOrderId == secondOrderId)
    }

    @Test
    fun `same key with a different request body is rejected with 409`() {
        val idempotencyKey = UUID.randomUUID().toString()

        mockMvc.perform(
            post("/api/orders")
                .header("Authorization", "Bearer $jwt")
                .header("Idempotency-Key", idempotencyKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"symbol":"BTC-USD","side":"BUY","type":"LIMIT","price":50000,"quantity":0.01}"""),
        ).andExpect(status().isCreated)

        mockMvc.perform(
            post("/api/orders")
                .header("Authorization", "Bearer $jwt")
                .header("Idempotency-Key", idempotencyKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"symbol":"BTC-USD","side":"BUY","type":"LIMIT","price":51000,"quantity":0.02}"""),
        ).andExpect(status().isConflict)
    }
}
