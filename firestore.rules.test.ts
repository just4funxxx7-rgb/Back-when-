// Phase 0 Security Rules Verification Specification
// Verifies that all Dirty Dozen attack payloads return PERMISSION_DENIED.

export const DIRTY_DOZEN_TEST_CASES = [
  { id: 1, name: 'Unverified Admin Email Spoof', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Shadow Field Injection', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Owner Spoofing on Create', expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Cross-User PII Read', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Path ID Poisoning', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'Summary String Overflow', expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'Client Timestamp Forgery', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'Immutable ownerId Mutation', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'Terminal Archived State Update', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Unscoped List Scraping', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Self-Assigned Admin Escalation', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'Orphaned Subcollection Write', expected: 'PERMISSION_DENIED' },
];
