'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('super-admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/auth/${role}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">PropScholar</h1>
          <p className="text-gray-400 text-sm mt-1">Trading Infrastructure</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider">Login as</label>
            <div className="flex gap-2 mt-2">
              {['super-admin','firm-admin','trader'].map(r => (
                <button key={r} onClick={() => setRole(r)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    role === r ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}>
                  {r === 'super-admin' ? 'Super Admin' : r === 'firm-admin' ? 'Firm Admin' : 'Trader'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="admin@propscholars.com" />
          </div>

          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button onClick={handleLogin} disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-all">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
export const dynamic = 'force-dynamic';
