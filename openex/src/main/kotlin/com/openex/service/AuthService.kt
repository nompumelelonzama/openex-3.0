package com.openex.service

import com.openex.dto.AuthResponse
import com.openex.dto.LoginRequest
import com.openex.dto.RegisterRequest
import com.openex.entity.User
import com.openex.repository.UserRepository
import com.openex.security.JwtService
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException
import org.springframework.http.HttpStatus

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtService: JwtService,
    private val walletService: WalletService,
) {

    fun register(request: RegisterRequest): AuthResponse {
        if (userRepository.existsByEmail(request.email)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Email already registered")
        }

        val user = try {
            userRepository.save(
                User(email = request.email, passwordHash = passwordEncoder.encode(request.password)),
            )
        } catch (e: DataIntegrityViolationException) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "Email already registered")
        }

        // Give every new user USD and BTC wallets so the trading UI has something to show.
        walletService.ensureAccount(user.id, "USD")
        walletService.ensureAccount(user.id, "BTC")

        val token = jwtService.generateToken(user.id, user.email)
        return AuthResponse(token, jwtService.expirationSeconds())
    }

    fun login(request: LoginRequest): AuthResponse {
        val user = userRepository.findByEmail(request.email)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials")

        if (!passwordEncoder.matches(request.password, user.passwordHash)) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials")
        }

        val token = jwtService.generateToken(user.id, user.email)
        return AuthResponse(token, jwtService.expirationSeconds())
    }
}
