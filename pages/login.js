import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getSessionFromRequest } from '../lib/auth.js';

export async function getServerSideProps({ req }) {
    const session = getSessionFromRequest(req);
    if (session) {
        return { redirect: { destination: '/admin', permanent: false } };
    }
    return { props: {} };
}

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok) {
                router.push('/admin');
            } else {
                setError(data.message || 'Login failed');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f0f2f5',
        }}>
            <Head>
                <title>Admin Login</title>
            </Head>

            <div style={{
                background: 'white',
                padding: '40px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                width: '100%',
                maxWidth: '380px',
            }}>
                <h1 style={{ margin: '0 0 24px 0', fontSize: '22px', textAlign: 'center' }}>
                    Admin Login
                </h1>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoComplete="username"
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #d9d9d9',
                                borderRadius: '4px',
                                fontSize: '14px',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #d9d9d9',
                                borderRadius: '4px',
                                fontSize: '14px',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            marginBottom: '16px',
                            padding: '10px 12px',
                            background: '#fff0f0',
                            color: '#d32f2f',
                            borderRadius: '4px',
                            fontSize: '14px',
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '10px',
                            background: loading ? '#aaa' : '#0070f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '15px',
                            fontWeight: '600',
                            cursor: loading ? 'default' : 'pointer',
                        }}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
