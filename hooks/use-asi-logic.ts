import { useState, useEffect, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';

export function useAsiLogic() {
  const [patches, setPatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Use useMemo to ensure we have a stable supabase instance
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    async function fetchPatches() {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('*')
          .eq('setting_category', 'asi_logic')
          .order('updated_at', { ascending: false });

        if (!error && data) {
          setPatches(data.map(d => ({
            id: d.id,
            key: d.setting_key,
            value: typeof d.setting_value === 'string' ? JSON.parse(d.setting_value) : d.setting_value
          })));
        }
      } catch (err) {
        console.error("Failed to fetch ASI logic:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchPatches();

    // Subscribe to changes for live site evolution
    const channel = supabase
      .channel('asi_patches_live')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'site_settings',
        filter: 'setting_category=eq.asi_logic'
      }, () => {
        console.log("🔄 ASI Patch Update Detected!");
        fetchPatches();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return { patches, loading };
}
