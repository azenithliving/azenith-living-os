-- P6-M4 — the consultant answers from the owner's own approved words.
--
-- `consultant_faq` has held approved question/answer pairs since migration 024,
-- and three things were missing: nobody read the table back at reply time,
-- nothing recorded WHO approved a row, and nothing could switch a row off. This
-- migration adds the two columns the gate needs and seeds three answers taken
-- verbatim from the copy already published on the storefront — so the consultant
-- can be trusted with them without inventing a policy nobody wrote.
--
-- Idempotent: safe to run twice. No row is overwritten or deleted.

--SPLIT--
ALTER TABLE consultant_faq ADD COLUMN IF NOT EXISTS approved_by TEXT;

--SPLIT--
ALTER TABLE consultant_faq ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

--SPLIT--
COMMENT ON COLUMN consultant_faq.approved_by IS
  'Who signed this answer. A row with no approver is never said to a visitor in the owner''s name (P6-M4 gate).';

--SPLIT--
COMMENT ON COLUMN consultant_faq.is_active IS
  'false = kept for history but never answered automatically.';

--SPLIT--
INSERT INTO consultant_faq (question, answer, approved_by)
SELECT v.q, v.a, 'site-copy:p6-m4'
FROM (VALUES
  (
    'ما الذي تقدمه أزينث ليفينج في تصميم المنازل؟',
    'أزينث ليفينج تقدم رؤية تصميم متكاملة تشمل توزيع المساحة، اختيار الخامات، الإضاءة، الأثاث، وحلول التخزين بما يناسب الاستخدام اليومي والطابع الفاخر للمنزل.'
  ),
  (
    'هل يمكن تخصيص التصميم حسب مساحة المنزل؟',
    'نعم، يتم التعامل مع كل مشروع حسب المقاسات الفعلية، أسلوب الحياة، الميزانية، وطريقة استخدام الغرفة حتى تكون النتيجة عملية وراقية في نفس الوقت.'
  ),
  (
    'هل الخدمة مناسبة للشقق والفيلات في مصر؟',
    'نعم، خدمات التصميم الداخلي والتشطيبات والأثاث المخصص مناسبة للشقق والفيلات داخل القاهرة ومصر.'
  )
) AS v(q, a)
WHERE NOT EXISTS (
  SELECT 1 FROM consultant_faq f WHERE f.question = v.q
);

--SPLIT--
-- The gate reads approved-and-active rows by recency. A sequential scan over a
-- handful of rows is fine; the index is what keeps it fine when the owner has
-- approved hundreds.
CREATE INDEX IF NOT EXISTS idx_consultant_faq_autonomy
  ON consultant_faq (is_active, approved_by, created_at DESC);
