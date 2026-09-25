-- P6 — سحب سطر الشركة المكرر من سجل الشركات.
--
-- التوحيد (20260925_p6_one_store.sql) نقل كل الصفوف على خبرة واحدة، فبقى السطر
-- التاني باسم «Azenith Living» نفس الاسم ونفس تاريخ الإنشاء — **بلا أي صف
-- يشير إليه** (متحقق: 0). سطر فاضي بيقابل اسم شركتين هو اللي بيخلي أي كود
-- قديم أو أي وكيل جديد يغلط ويمسك الخبرة الغلط، فالأفضل يتسحب.
--
-- السلامة:
--  • نسخة كاملة من سجل الشركات قبل أي حاجة، في جدول `_p6_backup_companies`.
--  • الحذف مشروط: بيشتغل بس لو الجدول الرئيسي (`p6_store_company`) مشجر
--    إن السطر ده هو خبرة الدار — فالمسح الغلط للسطر الصحيح متعطل بالمفاتيح.
--  • الإرجاع: INSERT INTO public.companies SELECT * FROM public._p6_backup_companies WHERE id = '<المسحوب>';
--
-- العبارات مفصولة بسطر فيه بالضبط:  --SPLIT--

--SPLIT--
CREATE TABLE IF NOT EXISTS public._p6_backup_companies AS SELECT * FROM public.companies;

--SPLIT--
DO $$
DECLARE
  canon uuid;
  retired uuid := '00000000-0000-0000-0000-000000000001';
  still_referenced int := 0;
BEGIN
  SELECT company_id INTO canon FROM public.p6_store_company WHERE single_row LIMIT 1;

  IF canon IS NULL THEN
    RAISE EXCEPTION 'مفيش خبرة مسجلة للدّار في p6_store_company — أرفض أي حذف';
  END IF;

  -- safety: the row we retire must not be the live one, under any circumstance
  IF retired = canon THEN
    RAISE EXCEPTION 'السطر المطلوب سحبه هو خبرة الدار الحية (%); رفض الحذف', canon;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = retired) THEN
    RAISE NOTICE 'السطر المكرر مسحوب قبل كده — مفيش حاجة تتعمل';
    RETURN;
  END IF;

  DELETE FROM public.companies WHERE id = retired;
  GET DIAGNOSTICS still_referenced = ROW_COUNT;
  RAISE NOTICE 'انسحب سطر الشركة المكرر: % صف', still_referenced;
END
$$;
