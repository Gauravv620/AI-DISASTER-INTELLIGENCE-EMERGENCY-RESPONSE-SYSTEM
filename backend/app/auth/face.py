# Server-side biometric verification boundary.
# The browser must not make the final authentication decision.
# Production flow:
# 1. authenticate temporary challenge
# 2. retrieve enrolled embedding securely
# 3. compare with same model/version
# 4. enforce threshold and anti-replay controls
# 5. audit event
# 6. issue authorization only after all factors succeed
