export default function IntelligencePage() {
  return (
    <div style={{ 
      padding: '2rem',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a1b 0%, #2d2d2e 100%)',
      color: '#F5F1E9'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
          color: '#C5A059',
          fontFamily: 'Playfair Display, serif'
        }}>
          Intelligence Dashboard
        </h1>
        
        <div style={{
          background: 'rgba(197, 160, 89, 0.1)',
          border: '1px solid rgba(197, 160, 89, 0.3)',
          borderRadius: '12px',
          padding: '2rem',
          marginTop: '2rem'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            marginBottom: '1rem',
            color: '#C5A059'
          }}>
            🧠 AI Intelligence Center
          </h2>
          <p style={{
            fontSize: '1.1rem',
            lineHeight: '1.6',
            opacity: 0.9
          }}>
            This feature is coming soon. The Intelligence Dashboard will provide 
            advanced analytics, predictive insights, and AI-powered decision support 
            for your interior design business.
          </p>
          
          <div style={{
            marginTop: '2rem',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '1rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid rgba(197, 160, 89, 0.2)'
            }}>
              <span style={{ color: '#C5A059', fontWeight: 'bold' }}>📊 Analytics</span>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '1rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid rgba(197, 160, 89, 0.2)'
            }}>
              <span style={{ color: '#C5A059', fontWeight: 'bold' }}>🔮 Predictions</span>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '1rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid rgba(197, 160, 89, 0.2)'
            }}>
              <span style={{ color: '#C5A059', fontWeight: 'bold' }}>🎯 Insights</span>
            </div>
          </div>
        </div>
        
        <p style={{
          marginTop: '2rem',
          textAlign: 'center',
          opacity: 0.6,
          fontSize: '0.9rem'
        }}>
          Azenith Living Intelligence Module | Coming Q2 2026
        </p>
      </div>
    </div>
  );
}
