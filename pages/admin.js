// File: pages/admin.js
import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetch('/api/admin/stats');
            const data = await response.json();

            if (response.ok) {
                setStats(data);
            } else {
                setError(data.message || 'Failed to load stats');
            }
        } catch (err) {
            setError('Error loading stats: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const clearCache = async () => {
        try {
            const response = await fetch(`/api/admin/clear-cache`, {
                method: 'POST'
            });
            const data = await response.json();

            if (response.ok) {
                alert(`Cleared ${data.clearedRows} total cached entries from global cache`);
                fetchStats(); // Refresh stats
            } else {
                alert('Error: ' + (data.message || 'Failed to clear global cache'));
            }
        } catch (err) {
            alert('Error clearing global cache: ' + err.message);
        }
    };

    const triggerManualDaily = async () => {
        if (!confirm('Are you sure you want to manually trigger the daily postback? This will send all cached conversions to RedTrack and clear the cache if successful.')) {
            return;
        }

        try {
            const response = await fetch('/api/admin/manual-daily-postback', {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                alert(`Manual daily postback successful!\n\nTotal Amount: $${data.totalAmount.toFixed(2)}\nClickid Used: ${data.clickidUsed}\nCache Entries Cleared: ${data.clearedEntries || 0}`);
            } else {
                alert(`Manual daily postback failed!\n\nError: ${data.error || data.message}\nTotal Amount: $${data.totalAmount?.toFixed(2) || '0.00'}`);
            }
            
            fetchStats(); // Refresh stats
        } catch (err) {
            alert('Error triggering manual daily postback: ' + err.message);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <Head>
                <title>Admin Dashboard</title>
                <meta name="description" content="Conversion tracking admin dashboard" />
            </Head>

            <header style={{ marginBottom: '30px' }}>
                <h1>Conversion Tracking Admin Dashboard</h1>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button 
                        onClick={fetchStats}
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
                        {loading ? 'Loading...' : 'Refresh Stats'}
                    </button>
                    
                    <button 
                        onClick={triggerManualDaily}
                        style={{
                            padding: '8px 16px',
                            background: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Manual Daily Postback
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

            {stats && (
                <div>
                    {/* Summary Stats */}
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                        gap: '20px',
                        marginBottom: '30px'
                    }}>
                        <div style={{ 
                            padding: '20px', 
                            background: '#f8f9fa', 
                            borderRadius: '8px',
                            border: '1px solid #e9ecef'
                        }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>Global Cached Amount</h3>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#0070f3' }}>
                                ${stats.totalCachedAmount.toFixed(2)}
                            </p>
                        </div>

                        <div style={{ 
                            padding: '20px', 
                            background: '#f8f9fa', 
                            borderRadius: '8px',
                            border: '1px solid #e9ecef'
                        }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>Active Clickids</h3>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                                {stats.uniqueClickids}
                            </p>
                        </div>

                        <div style={{ 
                            padding: '20px', 
                            background: '#f8f9fa', 
                            borderRadius: '8px',
                            border: '1px solid #e9ecef'
                        }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>Total Postbacks</h3>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#6f42c1' }}>
                                {stats.totalPostbacks}
                            </p>
                        </div>

                        <div style={{ 
                            padding: '20px', 
                            background: '#f8f9fa', 
                            borderRadius: '8px',
                            border: '1px solid #e9ecef'
                        }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>Success Rate</h3>
                            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#fd7e14' }}>
                                {stats.successRate.toFixed(1)}%
                            </p>
                        </div>
                    </div>

                    {/* Global Cache Management */}
                    <div style={{ 
                        background: '#f8f9fa', 
                        padding: '20px', 
                        borderRadius: '8px',
                        marginBottom: '30px'
                    }}>
                        <h3>Global Cache Management</h3>
                        <p style={{ marginBottom: '15px', color: '#666' }}>
                            Clear the entire global cache (all cached conversions from all clickids) or trigger the daily postback manually
                        </p>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button 
                                onClick={clearCache}
                                style={{
                                    padding: '8px 16px',
                                    background: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Clear Global Cache
                            </button>
                            
                            <button 
                                onClick={triggerManualDaily}
                                style={{
                                    padding: '8px 16px',
                                    background: '#fd7e14',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Send Daily Postback Now
                            </button>
                        </div>
                        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                            <strong>Note:</strong> The daily postback automatically runs at 11:59 PM New York time when any conversion request is received. 
                            Use "Send Daily Postback Now" to manually trigger it for testing purposes.
                        </div>
                    </div>

                    {/* Cached Conversions by Clickid (Reference Only) */}
                    {stats.cachedByClickid && stats.cachedByClickid.length > 0 && (
                        <div style={{ marginBottom: '30px' }}>
                            <h3>Cached Conversions by Clickid (Reference)</h3>
                            <p style={{ color: '#666', marginBottom: '15px' }}>
                                Note: These are shown for reference only. The system now uses global caching, 
                                so any $10+ conversion will trigger ALL cached amounts regardless of clickid.
                            </p>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ 
                                    width: '100%', 
                                    borderCollapse: 'collapse',
                                    background: 'white'
                                }}>
                                    <thead>
                                        <tr style={{ background: '#f8f9fa' }}>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Clickid</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Total Amount</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Count</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Last Updated</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.cachedByClickid.map((item, index) => (
                                            <tr key={index}>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                                    {item.clickid}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                    ${parseFloat(item.total_amount).toFixed(2)}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                    {item.conversion_count}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                                    {new Date(item.last_updated).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Recent Postbacks */}
                    {stats.recentPostbacks && stats.recentPostbacks.length > 0 && (
                        <div style={{ marginBottom: '30px' }}>
                            <h3>Recent Postbacks</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ 
                                    width: '100%', 
                                    borderCollapse: 'collapse',
                                    background: 'white'
                                }}>
                                    <thead>
                                        <tr style={{ background: '#f8f9fa' }}>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Clickid</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>Amount</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center' }}>Success</th>
                                            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.recentPostbacks.map((postback, index) => (
                                            <tr key={index}>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                                    {postback.clickid}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                                                    ${parseFloat(postback.amount).toFixed(2)}
                                                </td>
                                                <td style={{ 
                                                    padding: '12px', 
                                                    border: '1px solid #dee2e6', 
                                                    textAlign: 'center',
                                                    color: postback.success ? '#28a745' : '#dc3545',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {postback.success ? '✓' : '✗'}
                                                </td>
                                                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                                                    {new Date(postback.created_at).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div style={{ marginTop: '40px', textAlign: 'center' }}>
                <a href="/logs" style={{ 
                    padding: '10px 20px',
                    background: '#6c757d',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '4px',
                    marginRight: '10px'
                }}>
                    View Detailed Logs
                </a>
            </div>
        </div>
    );
}