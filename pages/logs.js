// File: pages/logs.js
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function LogsViewer() {
    const [logs, setLogs] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch('/api/read-logs');
            const data = await response.json();

            if (response.ok) {
                setLogs(data.logs || '');
            } else {
                setError(data.message || 'Failed to load logs');
                setLogs('');
            }
        } catch (err) {
            setError('Error loading logs: ' + (err.message || 'Unknown error'));
            setLogs('');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        // Auto-refresh logs every 10 seconds
        const interval = setInterval(fetchLogs, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <Head>
        <title>Conversion Logs</title>
        <meta name="description" content="View conversion tracking logs" />
      </Head>
      
      <header style={{ marginBottom: '20px' }}>
        <h1>Conversion Tracking Logs</h1>
        <div>
          <button 
            onClick={fetchLogs}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'default' : 'pointer'
            }}
          >
            {loading ? 'Loading...' : 'Refresh Logs'}
          </button>
        </div>
      </header>
      
      {error && (
        <div style={{ 
          padding: '12px', 
          background: '#fff0f0', 
          color: '#d32f2f',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}
      
      {logs ? (
        <pre style={{ 
          background: '#f1f1f1', 
          padding: '15px', 
          borderRadius: '4px',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          {logs}
        </pre>
      ) : !error && !loading ? (
        <p>No logs available yet. Try making a conversion request first.</p>
      ) : null}
      
            <footer style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
        <p>
          <strong>Note:</strong> These logs are now stored persistently in MySQL database and will survive function restarts. 
          Visit <a href="/admin" style={{ color: '#0070f3' }}>Admin Dashboard</a> for detailed statistics and cache management.
        </p>
      </footer>
    </div>
    );
}