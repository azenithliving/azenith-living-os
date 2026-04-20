async function testDelete() {
    const targetSessionId = 'vis_1776655684073_xaup8xbf0'; 
    
    console.log(`--- Testing Deletion for Session: ${targetSessionId} ---`);
    
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        const response = await fetch(`${supabaseUrl}/rest/v1/consultant_sessions?session_id=eq.${targetSessionId}`, {
            method: 'DELETE',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Success! Record deleted from DB:', data);
        } else {
            console.error('❌ Failed to delete:', await response.status);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

testDelete();
