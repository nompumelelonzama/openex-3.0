package com.openex.integration

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.openex.dto.OrderBookSnapshot
import com.openex.dto.RegisterRequest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.http.MediaType
import org.springframework.messaging.converter.MappingJackson2MessageConverter
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompFrameHandler
import org.springframework.messaging.simp.stomp.StompHeaders
import org.springframework.messaging.simp.stomp.StompSession
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.messaging.WebSocketStompClient
import org.springframework.web.socket.sockjs.client.SockJsClient
import org.springframework.web.socket.sockjs.client.WebSocketTransport
import java.lang.reflect.Type
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

/**
 * Proves Day 6's deliverable end-to-end: submitting an order over the real REST API
 * causes a fresh OrderBookSnapshot to be pushed to /topic/orderbook/{symbol} via STOMP,
 * exactly as a browser client (React, or any generic WebSocket client) would receive it.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderBookWebSocketIntegrationTest {
    @LocalServerPort
    private var port: Int = 0

    @Autowired
    lateinit var mockMvc: MockMvc

    @Autowired
    lateinit var objectMapper: ObjectMapper

    private lateinit var jwt: String

    @BeforeEach
    fun registerAndDepositFunds() {
        val email = "trader-${UUID.randomUUID()}@example.com"
        val registerBody = objectMapper.writeValueAsString(RegisterRequest(email, "password123"))

        val registerResult =
            mockMvc
                .perform(
                    post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(registerBody),
                ).andReturn()

        jwt = objectMapper.readTree(registerResult.response.contentAsString).get("token").asText()

        mockMvc.perform(
            post("/api/wallets/deposit")
                .header("Authorization", "Bearer $jwt")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"currency":"USD","amount":100000}"""),
        )
    }

    @Test
    fun `submitting an order broadcasts a fresh order book snapshot over STOMP`() {
        // Short unique suffix -- the symbol column is VARCHAR(20), so a full UUID
        // ("BTC-USD-" + 36 chars) overflows it.
        val symbol = "BTC${UUID.randomUUID().toString().take(8)}"
        println("DIAG: using symbol=$symbol, connecting to ws://localhost:$port/ws")

        val transport = WebSocketTransport(StandardWebSocketClient())
        val sockJsClient = SockJsClient(listOf(transport))
        val stompClient = WebSocketStompClient(sockJsClient)
        // The default MappingJackson2MessageConverter() uses a plain ObjectMapper with no
        // Kotlin support, which can't instantiate OrderBookSnapshot's data-class constructor.
        // Without this, deserialization fails *silently* -- StompSessionHandlerAdapter's
        // default handleException() is a no-op, so the failure never surfaces; the test just
        // times out waiting for a frame that was actually sent but couldn't be decoded.
        val kotlinAwareMapper = ObjectMapper().registerKotlinModule().registerModule(JavaTimeModule())
        stompClient.messageConverter =
            MappingJackson2MessageConverter().apply { objectMapper = kotlinAwareMapper }

        val snapshotFuture = CompletableFuture<OrderBookSnapshot>()

        val session: StompSession =
            stompClient
                .connectAsync(
                    "ws://localhost:$port/ws",
                    object : StompSessionHandlerAdapter() {
                        override fun handleException(
                            session: StompSession,
                            command: StompCommand?,
                            headers: StompHeaders,
                            payload: ByteArray,
                            exception: Throwable,
                        ) {
                            println("DIAG: STOMP client exception: ${exception.javaClass.name}: ${exception.message}")
                        }
                    },
                ).get(10, TimeUnit.SECONDS)
        println("DIAG: STOMP connected, session id=${session.sessionId}")

        session.subscribe(
            "/topic/orderbook/$symbol",
            object : StompFrameHandler {
                override fun getPayloadType(headers: StompHeaders): Type = OrderBookSnapshot::class.java

                override fun handleFrame(
                    headers: StompHeaders,
                    payload: Any?,
                ) {
                    println("DIAG: frame received! payload=$payload")
                    snapshotFuture.complete(payload as OrderBookSnapshot)
                }
            },
        )
        println("DIAG: subscribed to /topic/orderbook/$symbol")

        // Give the subscription a moment to register server-side before we submit the order.
        Thread.sleep(1000)

        val orderResult =
            mockMvc
                .perform(
                    post("/api/orders")
                        .header("Authorization", "Bearer $jwt")
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"symbol":"$symbol","side":"BUY","type":"LIMIT","price":50000,"quantity":0.01}"""),
                ).andReturn()
        println("DIAG: order POST status=${orderResult.response.status} body=${orderResult.response.contentAsString}")

        val snapshot = snapshotFuture.get(10, TimeUnit.SECONDS)
        println("DIAG: snapshot received successfully")

        assertEquals(symbol, snapshot.symbol)
        assertTrue(snapshot.bids.isNotEmpty(), "the resting BUY order should appear as a bid in the broadcast snapshot")
        assertEquals(0, java.math.BigDecimal("0.01").compareTo(snapshot.bids.first().quantity))

        session.disconnect()
    }
}
