-- Migration: the execution ledger must reference the identity the gate actually signs in with.
--
-- Measured live 2026-10-19, minutes after 20261019_c created the table: every tool call still died on
-- «insert or update on table "agent_executions" violates foreign key constraint
-- "agent_executions_actor_user_id_fkey"». The actor arriving at the door is the admin's auth user id —
-- it lives in `auth.users`, which is exactly what `approval_requests.actor_user_id` already references
-- (measured: approval_requests_actor_user_id_fkey => FOREIGN KEY (actor_user_id) REFERENCES auth.users(id)
-- ON DELETE SET NULL). The 031 draft pointed it at the legacy public `users` table instead, which holds
-- 33 rows of an older model and not the signed-in owner.
--
-- Additive and relaxing only: no row is deleted, no column is dropped.

ALTER TABLE agent_executions DROP CONSTRAINT IF EXISTS agent_executions_actor_user_id_fkey;

ALTER TABLE agent_executions
    ADD CONSTRAINT agent_executions_actor_user_id_fkey
    FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
