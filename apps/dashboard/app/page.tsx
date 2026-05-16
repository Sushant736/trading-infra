'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://35.200.170.189:3000') + '/api/v1';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState('');
  const [role, setRole] = useState('trader');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      let endpoint = '';
      let body: any = { email, password };

      if (role === 'trader') {
        endpoint = `${API}/auth/trader/login`;
        if (!server) { setError('Server name is required'); setLoading(false); return; }
        body.server = server;
      } else if (role === 'firm-admin') {
        endpoint = `${API}/auth/firm-admin/login`;
      } else {
        endpoint = `${API}/auth/super-admin/login`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');

      localStorage.setItem('token', data.access_token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.role === 'SUPER_ADMIN') router.push('/super-admin');
      else if (data.role === 'FIRM_ADMIN') router.push('/firm-admin');
      else router.push('/trader');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">PropScholar</h1>
          <p className="text-gray-500 text-sm mt-2">Trading Infrastructure Platform</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          {/* Role Tabs */}
          <div className="flex bg-gray-800/50 rounded-xl p-1 mb-6">
            {[
              { id: 'trader', label: 'Trader' },
              { id: 'firm-admin', label: 'Firm Admin' },
              { id: 'super-admin', label: 'Super Admin' },
            ].map(r => (
              <button key={r.id} onClick={() => { setRole(r.id); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${role === r.id ? 'bg-white text-gray-900 shadow' : 'text-gray-400 hover:text-white'}`}>
                {r.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {/* Server field - only for traders */}
            {role === 'trader' && (
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1.5">Server</label>
                <input
                  type="text"
                  value={server}
                  onChange={e => setServer(e.target.value.toUpperCase())}
                  className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 rounded-xl px-4 py-3 text-white text-sm font-mono tracking-widest uppercase focus:outline-none transition-colors"
                  placeholder="PROPSCHOLAR-LIVE"
                  autoComplete="off"
                />
                <p className="text-xs text-gray-600 mt-1">Enter the server name provided by your firm</p>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all text-sm mt-2">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          PropScholar Trading Infrastructure © 2026
        </p>
      </div>
    </div>
  );
}
