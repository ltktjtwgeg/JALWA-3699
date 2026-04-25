# Security Specification for Wingo Game

## Data Invariants
1. **Games**:
   - A game must have a valid `periodId` (format: YYYYMMDD + typePrefix + index).
   - Only admins can create games or update their results.
   - Status transitions strictly from `active` to `completed`.
2. **Bets**:
   - A user can only place a bet if they have sufficient balance (enforced server-side, rules verify identity).
   - `amount` must be > 0.
   - `uid` must match `request.auth.uid`.
   - `status` defaults to `pending`. Only server/admin can transition to `win` or `lost`.
3. **Users**:
   - `balance` is strictly for reading. Writes are privileged (only server/admin).
   - Users can only read their own profile.
4. **Transactions**:
   - Immutable records once completed.
   - Created only for the authenticated user.

## The Dirty Dozen (Test Cases)
1. **Identity Theft**: User A tries to create a bet with `uid` of User B.
2. **Infinite Money**: User A tries to update their own `balance` field.
3. **Ghost Bet**: User A tries to update a `win` status on their own bet.
4. **Game Rigging**: User A tries to create a `Game` document with a pre-set `resultNumber`.
5. **Time Travel**: User A tries to update a `Game` result after it's `completed`.
6. **Negative Bet**: User A tries to place a bet with `amount: -100`.
7. **Cross-Game Leeching**: User A tries to read bets of User B.
8. **PII Leak**: User A tries to list all `users` email addresses via a query.
9. **Role Escalation**: User A tries to set their `role` to `admin` during profile update.
10. **Withdrawal Spoof**: User A tries to create a `completed` withdrawal transaction without admin approval.
11. **ID Poisoning**: User A tries to create a game with a 1MB string as ID.
12. **Orphaned Writes**: User A tries to update a bet without the parent game existence check (hard to do in client, but rules should verify).
