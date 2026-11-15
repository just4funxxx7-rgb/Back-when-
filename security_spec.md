# Firestore Security Specification — Aetheria: Outcast Lands

## 1. Data Invariants
1. **Default Deny**: All paths are denied by default (`match /{document=**} { allow read, write: if false; }`).
2. **Verified Identity**: All write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Admin Governance**: Admin privileges (`isAdmin()`) are granted strictly to verified emails `new.dawn.industries2026@gmail.com` and `just4funxxx7@gmail.com` or UIDs existing in `/admins/{uid}`.
4. **PII Split Isolation**: User emails and private Workspace metadata are stored exclusively in `/survivors/{userId}/private/{docId}`, accessible only by the document owner (`request.auth.uid == userId`) or `isAdmin()`.
5. **Strict Schema & Key Whitelisting**: Every `create` and `update` validates exact keys (`hasAll` + `hasOnly`), bounded string lengths (`.size()`), and server timestamps (`request.time`).
6. **Terminal State Locking**: Once an `ExpeditionReport` reaches `status == 'archived'`, non-admin updates are locked.

## 2. The "Dirty Dozen" Payloads
1. **Unverified Admin Email Spoof**: `{ email: "new.dawn.industries2026@gmail.com", email_verified: false }` attempting to write to `/admins/uid1`.
2. **Shadow Field Injection**: Adding `{ isSuperAdmin: true }` to `/survivors/{userId}`.
3. **Owner Spoofing on Create**: User A creating `/survivors/userA` with `ownerId: "userB"`.
4. **Cross-User PII Read**: User B attempting `get` on `/survivors/userA/private/info`.
5. **ID Poisoning**: Creating `/expeditionReports/{2000_char_id}` exceeding 128-char regex guard.
6. **Denial-of-Wallet String Overflow**: Submitting a 50,000-character `summary` in `/expeditionReports/{id}` (limit 1500).
7. **Timestamp Forgery**: Submitting a past or future `createdAt` instead of `request.time`.
8. **Immutable Field Mutation**: Updating `ownerId` or `createdAt` on an existing `/survivors/{userId}` document.
9. **Terminal State Bypass**: Updating an `ExpeditionReport` whose existing `status` is `'archived'` as a non-admin.
10. **Unscoped List Scraping**: Querying `/expeditionReports` without filtering `resource.data.ownerId == request.auth.uid`.
11. **Privilege Escalation**: Non-admin user attempting to create a document in `/admins/{selfUid}`.
12. **Orphaned Private Subdocument**: Creating `/survivors/{userId}/private/info` when parent `/survivors/{userId}` does not exist.
