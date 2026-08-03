package com.openex.security

import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

/** JwtAuthFilter stores the authenticated user's id as the Authentication principal. */
object CurrentUser {
    fun id(): UUID =
        SecurityContextHolder.getContext().authentication?.principal as? UUID
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated")
}
