/**
 * The row shape the automation rules desk writes.
 *
 * Measured on the live record 2026-10-24: `automation_rules` answers to 9 columns and has never
 * had `is_active`, `created_by` or `updated_by`. The desk sent all three anyway and then stripped
 * them after the record refused, so every save paid refused round trips, and `is_active` was a
 * second name for the one fact `enabled` already owns.
 */
export const AUTOMATION_WRITE_COLUMNS = [
  "name",
  "trigger",
  "conditions",
  "actions",
  "enabled",
  "company_id",
] as const;
