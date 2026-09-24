-- QAYYIM FACADE MIGRATION — Prime → Qayyim-Core Merge (Strangler Safe)
-- يدمج prime في qayyim-core بلا فقدان بيانات، ويجهز View الموحدة

-- 1) دمج صفوف agent_profiles: prime → qayyim-core
DO $$
DECLARE prime_id UUID; core_id UUID;
BEGIN
  SELECT id INTO prime_id FROM public.agent_profiles WHERE agent_key='prime' LIMIT 1;
  SELECT id INTO core_id FROM public.agent_profiles WHERE agent_key='qayyim-core' LIMIT 1;

  IF prime_id IS NOT NULL THEN
    IF core_id IS NULL THEN
      -- لا يوجد qayyim-core بعد → حول prime نفسه ليصبح qayyim-core
      UPDATE public.agent_profiles
        SET agent_key='qayyim-core',
            name='قيّم الدار — القائد',
            description='قائد سرب القيّم: تنسيق، تدقيق شامل، نشر/تراجع، بوابة جودة',
            updated_at=NOW()
        WHERE id=prime_id;
    ELSE
      -- الاثنان موجودان → انقل المهام والمحادثات ثم احذف prime
      UPDATE public.agent_tasks SET agent_profile_id=core_id WHERE agent_profile_id=prime_id;
      -- المحادثات: استبدل prime بـ qayyim-core داخل مصفوفة participants
      UPDATE public.agent_conversations
        SET participants = ARRAY_REPLACE(participants, 'prime', 'qayyim-core'),
            updated_at=NOW()
        WHERE 'prime'=ANY(participants);
      -- احذف صف prime بعد النقل
      DELETE FROM public.agent_profiles WHERE id=prime_id;
    END IF;
  END IF;
END $$;

-- 2) View موحدة للواجهة الخارجية (Enterprise — 7 وكلاء فقط)
CREATE OR REPLACE VIEW public.enterprise_agents AS
SELECT * FROM public.agent_profiles
WHERE agent_key IN ('qayyim-core','vanguard','analyst','coder','ops','security','learner')
  AND is_active=true;

-- 3) تنظيف View القديم إن وجد
DROP VIEW IF EXISTS public.v_prime_status;

-- 4) فهرس مساعد لأداء QayyimFacade
CREATE INDEX IF NOT EXISTS idx_agent_profiles_key_active ON public.agent_profiles(agent_key, is_active);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_profile_status ON public.agent_tasks(agent_profile_id, status);
