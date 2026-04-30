-- إنشاء جدول قواعد الأتمتة
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger TEXT NOT NULL,
  conditions JSONB,
  actions JSONB,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

-- سياسة: فقط المسؤولون (SOVEREIGN, ADMIN) يمكنهم الوصول
CREATE POLICY "Admins can manage automation_rules" ON automation_rules
  USING (auth.role() IN ('ADMIN', 'SOVEREIGN'));

-- إنشاء دالة تحديث updated_at (إذا لم تكن موجودة)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إضافة updated_at trigger (باستخدام DO block لتجنب خطأ "IF NOT EXISTS")
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_automation_rules_updated_at') THEN
        CREATE TRIGGER update_automation_rules_updated_at
        BEFORE UPDATE ON automation_rules
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;