package com.openex.repository

import com.openex.entity.Trade
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TradeRepository : JpaRepository<Trade, UUID>
