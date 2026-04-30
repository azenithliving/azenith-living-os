-- إنشاء جدول إعدادات الموقع
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- تفعيل RLS
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- فقط ADMIN/SOVEREIGN يمكنهم القراءة والكتابة
CREATE POLICY "Admins can manage site_settings" ON site_settings
  USING (auth.role() IN ('ADMIN', 'SOVEREIGN'));

-- إضافة updated_at trigger
CREATE OR REPLACE FUNCTION update_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_site_settings_updated_at ON site_settings;
CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_site_settings_updated_at();
