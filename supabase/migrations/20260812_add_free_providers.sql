-- Migration 20260812: استبدال providers مدفوعة بـ providers مجانية
-- إضافة: nvidia, chutes
-- حذف من الـ CHECK: openai, anthropic, sambanova, xai

-- تحديث الـ CHECK constraint
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_provider_check;

ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_provider_check
  CHECK (provider IN (
    -- ✅ مجاني دائم — نواة النظام
    'groq',
    'openrouter',
    'mistral',
    'deepseek',
    'together',
    'cerebras',
    'cohere',
    'google',
    'pexels',
    -- ✅ مجاني دائم — بروفايدرز جديدة
    'nvidia',
    'chutes',
    -- ✅ مجاني دائم — بروفايدرز مساعدة
    'aimlapi',
    'cloudflare',
    'huggingface',
    -- ✅ أدوات مساعدة
    'api_ninjas',
    'apifreellm',
    'bytez'
  ));

COMMENT ON CONSTRAINT api_keys_provider_check ON public.api_keys
  IS 'Free-only providers — xAI/OpenAI/Anthropic/SambaNova removed (paid). NVIDIA NIM + Chutes AI added. Updated 2026-08-12';
