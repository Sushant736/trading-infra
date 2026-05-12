'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (!token) { router.push('/'); return; }
    setUser(JSON.parse(u || '{}'));
  }, []);

  const logout = () => {
    localStorage.clear();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">PropScholar</h1>
          <p className="text-xs text-gray-400">Super Admin Panel</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user?.email}</span>
          <button onClick={logout} className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg">Logout</button>
        </div>
      </div>

      <div className="p-6 grid grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Total Firms</p>
          <p className="text-3xl font-bold mt-2">0</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Total Traders</p>
          <p className="text-3xl font-bold mt-2">0</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Active Accounts</p>
          <p className="text-3xl font-bold mt-2">0</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Risk Breaches</p>
          <p className="text-3xl font-bold mt-2 text-red-400">0</p>
        </div>
      </div>

      <div className="px-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Firms</h2>
          <div className="text-gray-400 text-sm text-center py-8">No firms yet. Create your first firm.</div>
          <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg">
            + Add Firm
          </button>
        </div>
      </div>
    </div>
  );
}
