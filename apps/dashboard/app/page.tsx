'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://35.200.170.189:3000') + '/api/v1';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'trader'|'firm-admin'|'super-admin'>('trader');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const body: any = { email, password };
      if (role === 'trader') body.server = server.toUpperCase();
      const res = await fetch(`${API}/auth/${role}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid credentials');
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

  const roles = [
    { key: 'trader', label: 'Trader' },
    { key: 'firm-admin', label: 'Firm Admin' },
    { key: 'super-admin', label: 'Admin' },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-lg font-black">PS</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">PropScholar</h1>
          <p className="text-sm text-gray-400 mt-0.5">Trading Infrastructure</p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm">
          {/* Role selector */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            {roles.map(r => (
              <button key={r.key} onClick={() => { setRole(r.key as any); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  role === r.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                }`}>{r.label}</button>
            ))}
          </div>

          <div className="space-y-3">
            {/* Server (trader only) */}
            {role === 'trader' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">SERVER</label>
                <input
                  type="text"
                  value={server}
                  onChange={e => setServer(e.target.value.toUpperCase())}
                  placeholder="PROPSCHOLAR-LIVE"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-mono uppercase focus:outline-none focus:border-gray-400 bg-gray-50"
                  autoCapitalize="characters"
                  autoCorrect="off"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-gray-400 bg-gray-50"
                autoComplete="email"
                inputMode="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">PASSWORD</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-gray-400 bg-gray-50 pr-12"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleLogin}
              disabled={loading || !email || !password || (role === 'trader' && !server)}
              className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white font-medium py-3.5 rounded-xl text-sm transition-all mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-xs text-gray-300">
        PropScholar Trading Infrastructure © 2026
      </div>
    </div>
  );
}
