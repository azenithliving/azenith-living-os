-- إنشاء جدول قواعد الأتمتة
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger TEXT NOT NULL, -- e.g., 'page_visit', 'form_submit', 'time_delay'
  conditions JSONB, -- e.g., {"page": "/furniture", "min_visits": 2}
  actions JSONB, -- e.g., {"type": "whatsapp", "message": "خصم 10%"}
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

-- سياسة: فقط المسؤولون (SOVEREIGN, ADMIN) يمكنهم الوصول
CREATE POLICY "Admins can manage automation_rules" ON automation_rules
  USING (auth.role() IN ('ADMIN', 'SOVEREIGN'));

-- إضافة updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
