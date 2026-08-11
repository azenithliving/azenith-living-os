-- Migration 20260812: Expand api_keys CHECK constraint
-- يضيف providers جديدة كانت موجودة في الكود لكن غائبة عن الـ CHECK

-- إزالة الـ constraint القديم وإعادة بناءه بالقائمة الكاملة
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_provider_check;

ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_provider_check
  CHECK (provider IN (
    'groq',
    'openrouter',
    'mistral',
    'pexels',
    'cerebras',
    'sambanova',
    'together',
    'cohere',
    'deepseek',
    'openai',
    'google',
    'anthropic',
    'xai',
    'aimlapi',
    'cloudflare',
    'huggingface',
    'api_ninjas',
    'bytez',
    'apifreellm'
  ));

COMMENT ON CONSTRAINT api_keys_provider_check ON public.api_keys
  IS 'Supports 19 AI providers — updated 2026-08-12';
