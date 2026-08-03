-- Fixed, well-known system user that owns "mint" accounts. Faucet deposits are modeled
-- as a transfer FROM the mint account TO the user's account, so the ledger still nets to
-- zero system-wide even though new simulated funds are being introduced.
INSERT INTO users (id, email, password_hash, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'system@openex.internal',
    'unusable-no-login',
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;
