-- Migration 20260813: Replace paid providers with free alternatives
-- حذف: openai, anthropic, sambanova (مدفوعون فقط)
-- إضافة: nvidia, chutes (مجانيون بالكامل)

-- إزالة الـ constraint القديم وإعادة بناءه بالقائمة المحدثة
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_provider_check;

ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_provider_check
  CHECK (provider IN (
    'groq',
    'openrouter',
    'mistral',
    'pexels',
    'cerebras',
    'together',
    'cohere',
    'deepseek',
    'google',
    'xai',
    'aimlapi',
    'cloudflare',
    'huggingface',
    'api_ninjas',
    'bytez',
    'apifreellm',
    'nvidia',
    'chutes'
  ));

COMMENT ON CONSTRAINT api_keys_provider_check ON public.api_keys
  IS 'Supports 18 AI providers (free-tier only) — updated 2026-08-13';

-- ✅ المفاتيح الموجودة لـ openai/anthropic/sambanova لن تُحذف
-- بل ستبقى في قاعدة البيانات لكن النظام لن يستطيع إضافة مفاتيح جديدة لهم
