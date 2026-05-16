'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = 'http://35.200.170.189:3000/api/v1';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>({});
  const [firms, setFirms] = useState<any[]>([]);
  const [selectedFirm, setSelectedFirm] = useState<any>(null);
  const [firmTraders, setFirmTraders] = useState<any[]>([]);
  const [view, setView] = useState<'overview' | 'firm'>('overview');
  const [showCreateFirm, setShowCreateFirm] = useState(false);
  const [showCreateTrader, setShowCreateTrader] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<any>({});

  const token = () => localStorage.getItem('token') || '';
  const h = () => ({ 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' });

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    const role = localStorage.getItem('role');
    if (!t || role !== 'SUPER_ADMIN') { router.push('/'); return; }
    setUser(JSON.parse(u || '{}'));
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, firmsRes] = await Promise.all([
        fetch(`${API}/firms/stats`, { headers: h() }),
        fetch(`${API}/firms`, { headers: h() }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (firmsRes.ok) setFirms(await firmsRes.json());
    } catch {}
  };

  const selectFirm = async (firm: any) => {
    setSelectedFirm(firm);
    setView('firm');
    const res = await fetch(`${API}/firms/${firm.id}/traders`, { headers: h() });
    if (res.ok) setFirmTraders(await res.json());
  };

  const createFirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/firms`, {
        method: 'POST', headers: h(),
        body: JSON.stringify(form)
      });
      if (res.ok) { setShowCreateFirm(false); setForm({}); loadData(); }
    } catch {}
    setLoading(false);
  };

  const createTrader = async () => {
    if (!selectedFirm) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/firms/${selectedFirm.id}/traders`, {
        method: 'POST', headers: h(),
        body: JSON.stringify(form)
      });
      if (res.ok) { setShowCreateTrader(false); setForm({}); selectFirm(selectedFirm); }
    } catch {}
    setLoading(false);
  };

  const createAdmin = async () => {
    if (!selectedFirm) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/firms/${selectedFirm.id}/admins`, {
        method: 'POST', headers: h(),
        body: JSON.stringify(form)
      });
      if (res.ok) { setShowCreateAdmin(false); setForm({}); }
    } catch {}
    setLoading(false);
  };

  const deactivateFirm = async (id: string) => {
    if (!confirm('Deactivate this firm?')) return;
    await fetch(`${API}/firms/${id}`, { method: 'DELETE', headers: h() });
    loadData();
  };

  const StatCard = ({ label, value, sub, color }: any) => (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-3xl font-bold font-mono ${color || 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );

  const Modal = ({ title, onClose, onSubmit, children }: any) => (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">{children}</div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-800">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 py-2.5 rounded-lg text-sm">Cancel</button>
          <button onClick={onSubmit} disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-2.5 rounded-lg text-sm font-medium">
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );

  const Input = ({ label, field, type = 'text', placeholder }: any) => (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <input type={type} value={form[field] || ''} onChange={e => setForm({ ...form, [field]: e.target.value })}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold">PropScholar</h1>
            <p className="text-xs text-gray-500">Super Admin Control Panel</p>
          </div>
          {view === 'firm' && (
            <button onClick={() => { setView('overview'); setSelectedFirm(null); }}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
              ← Back to Overview
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm text-white">{user?.email}</div>
            <div className="text-xs text-blue-400">Super Admin</div>
          </div>
          <button onClick={() => { localStorage.clear(); router.push('/'); }}
            className="text-xs bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg">Logout</button>
        </div>
      </div>

      <div className="p-6">
        {view === 'overview' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-5 gap-4 mb-8">
              <StatCard label="Total Firms" value={stats.firms || 0} />
              <StatCard label="Total Traders" value={stats.traders || 0} />
              <StatCard label="Active Accounts" value={stats.accounts || 0} />
              <StatCard label="Open Positions" value={stats.open_positions || 0} color="text-blue-400" />
              <StatCard label="Total Volume" value={`${(stats.total_volume || 0).toFixed(2)}`} sub="lots traded" color="text-emerald-400" />
            </div>

            {/* Firms Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <h2 className="font-semibold">Firms</h2>
                <button onClick={() => { setShowCreateFirm(true); setForm({}); }}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2">
                  + Create Firm
                </button>
              </div>
              {firms.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <div className="text-4xl mb-3">🏢</div>
                  <div className="font-medium">No firms yet</div>
                  <div className="text-sm mt-1">Create your first prop firm</div>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      {['Firm', 'Slug', 'Traders', 'Accounts', 'Currency', 'Plan', 'Status', ''].map(h => (
                        <th key={h} className="text-left px-6 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {firms.map(f => (
                      <tr key={f.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-white">{f.name}</div>
                          <div className="text-xs text-gray-500">{f.id.slice(0,8)}...</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-400">{f.slug}</td>
                        <td className="px-6 py-4 text-sm">{f.trader_count || 0}</td>
                        <td className="px-6 py-4 text-sm">{f.account_count || 0}</td>
                        <td className="px-6 py-4 text-sm">{f.currency}</td>
                        <td className="px-6 py-4">
                          <span className="text-xs bg-purple-900/50 border border-purple-800 px-2 py-1 rounded text-purple-300">
                            {f.subscription_tier}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded ${f.is_active ? 'bg-emerald-900/50 border border-emerald-800 text-emerald-300' : 'bg-red-900/50 border border-red-800 text-red-300'}`}>
                            {f.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => selectFirm(f)}
                              className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-all">
                              Manage
                            </button>
                            {f.is_active && (
                              <button onClick={() => deactivateFirm(f.id)}
                                className="text-xs bg-red-900/30 hover:bg-red-900/60 border border-red-900 px-3 py-1.5 rounded-lg text-red-400 transition-all">
                                Deactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {view === 'firm' && selectedFirm && (
          <>
            {/* Firm Header */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{selectedFirm.name}</h2>
                  <div className="text-gray-400 text-sm mt-1">Slug: {selectedFirm.slug} • Currency: {selectedFirm.currency}</div>
                  <div className="text-gray-500 text-xs mt-1">ID: {selectedFirm.id}</div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setShowCreateAdmin(true); setForm({}); }}
                    className="bg-gray-800 hover:bg-gray-700 text-sm px-4 py-2 rounded-lg">
                    + Firm Admin
                  </button>
                  <button onClick={() => { setShowCreateTrader(true); setForm({ balance: 10000, currency: 'USD' }); }}
                    className="bg-blue-600 hover:bg-blue-500 text-sm px-4 py-2 rounded-lg">
                    + Create Trader
                  </button>
                </div>
              </div>
            </div>

            {/* Traders Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="px-6 py-4 border-b border-gray-800">
                <h3 className="font-semibold">Traders ({firmTraders.length})</h3>
              </div>
              {firmTraders.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <div className="text-4xl mb-3">👤</div>
                  <div className="font-medium">No traders yet</div>
                  <div className="text-sm mt-1">Create the first trader for this firm</div>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      {['Trader', 'Code', 'Account', 'Balance', 'Equity', 'Float PnL', 'Open Trades', 'Status'].map(h => (
                        <th key={h} className="text-left px-6 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {firmTraders.map(t => (
                      <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-6 py-4">
                          <div className="font-medium">{t.full_name}</div>
                          <div className="text-xs text-gray-500">{t.email}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-400">{t.trader_code}</td>
                        <td className="px-6 py-4 font-mono text-xs">{t.broker_account_id || '—'}</td>
                        <td className="px-6 py-4 font-mono text-sm">${parseFloat(t.current_balance || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 font-mono text-sm">${parseFloat(t.equity || 0).toLocaleString()}</td>
                        <td className={`px-6 py-4 font-mono font-bold text-sm ${parseFloat(t.floating_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {parseFloat(t.floating_pnl || 0) >= 0 ? '+' : ''}{parseFloat(t.floating_pnl || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm">{t.open_trades || 0}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded ${t.is_active ? 'bg-emerald-900/50 border border-emerald-800 text-emerald-300' : 'bg-red-900/50 border border-red-800 text-red-300'}`}>
                            {t.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {/* Create Firm Modal */}
      {showCreateFirm && (
        <Modal title="Create New Firm" onClose={() => setShowCreateFirm(false)} onSubmit={createFirm}>
          <Input label="Firm Name *" field="name" placeholder="e.g. Alpha Prop Trading" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Currency" field="currency" placeholder="USD" />
            <Input label="Max Traders" field="max_traders" type="number" placeholder="10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Max Daily Loss %" field="max_daily_loss" type="number" placeholder="5" />
            <Input label="Max Drawdown %" field="max_drawdown" type="number" placeholder="10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Max Position Size (lots)" field="max_position_size" type="number" placeholder="1" />
            <Input label="Max Open Trades" field="max_open_trades" type="number" placeholder="5" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Subscription Tier</label>
            <select value={form.subscription_tier || 'basic'} onChange={e => setForm({ ...form, subscription_tier: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none">
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
        </Modal>
      )}

      {/* Create Trader Modal */}
      {showCreateTrader && (
        <Modal title="Create Trader Account" onClose={() => setShowCreateTrader(false)} onSubmit={createTrader}>
          <Input label="Full Name *" field="full_name" placeholder="John Doe" />
          <Input label="Email *" field="email" type="email" placeholder="trader@example.com" />
          <Input label="Password *" field="password" type="password" placeholder="Min 8 characters" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Starting Balance" field="balance" type="number" placeholder="10000" />
            <Input label="Currency" field="currency" placeholder="USD" />
          </div>
          <Input label="Broker Name" field="broker_name" placeholder="IC Markets" />
        </Modal>
      )}

      {/* Create Firm Admin Modal */}
      {showCreateAdmin && (
        <Modal title="Create Firm Admin" onClose={() => setShowCreateAdmin(false)} onSubmit={createAdmin}>
          <Input label="Full Name *" field="full_name" placeholder="Admin Name" />
          <Input label="Email *" field="email" type="email" placeholder="admin@firm.com" />
          <Input label="Password *" field="password" type="password" placeholder="Min 8 characters" />
        </Modal>
      )}
    </div>
  );
}
