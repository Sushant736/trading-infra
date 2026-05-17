'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://35.200.170.189:3000') + '/api/v1';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [page, setPage] = useState('overview');
  const [firms, setFirms] = useState<any[]>([]);
  const [selectedFirm, setSelectedFirm] = useState<any>(null);
  const [firmTraders, setFirmTraders] = useState<any[]>([]);
  const [allTraders, setAllTraders] = useState<any[]>([]);
  const [allPositions, setAllPositions] = useState<any[]>([]);
  const [riskEvents, setRiskEvents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showCreateFirm, setShowCreateFirm] = useState(false);
  const [showCreateFirmAdmin, setShowCreateFirmAdmin] = useState(false);
  const [newFirm, setNewFirm] = useState({ name: '', currency: 'USD', timezone: 'UTC', max_traders: '50', max_daily_loss: '5', max_drawdown: '10', max_open_trades: '10' });
  const [newFirmAdmin, setNewFirmAdmin] = useState({ email: '', password: '', full_name: '', firm_id: '' });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');

  const token = () => localStorage.getItem('token') || '';
  const h = () => ({ Authorization: `Bearer ${token()}` });

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (!t) { router.push('/'); return; }
    setUser(JSON.parse(u || '{}'));
    loadAll(t);
  }, []);

  const loadAll = async (t: string) => {
    const headers = { Authorization: `Bearer ${t}` };
    const [firmsRes, statsRes, tradersRes, eventsRes] = await Promise.all([
      fetch(`${API}/firms`, { headers }),
      fetch(`${API}/firms/stats`, { headers }),
      fetch(`${API}/firms/all-traders`, { headers }),
      fetch(`${API}/firms/all-risk-events`, { headers }),
    ]);
    if (firmsRes.ok) setFirms(await firmsRes.json());
    if (statsRes.ok) setStats(await statsRes.json());
    if (tradersRes.ok) setAllTraders(await tradersRes.json());
    if (eventsRes.ok) setRiskEvents(await eventsRes.json());
  };

  const loadFirmDetail = async (firm: any) => {
    setSelectedFirm(firm);
    setPage('firms');
    const res = await fetch(`${API}/firms/${firm.id}/traders`, { headers: h() });
    if (res.ok) setFirmTraders(await res.json());
  };

  const createFirm = async () => {
    setSaving(true);
    const res = await fetch(`${API}/firms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...h() },
      body: JSON.stringify({
        name: newFirm.name, currency: newFirm.currency, timezone: newFirm.timezone,
        max_traders: parseInt(newFirm.max_traders),
        max_daily_loss: parseFloat(newFirm.max_daily_loss),
        max_drawdown: parseFloat(newFirm.max_drawdown),
        max_open_trades: parseInt(newFirm.max_open_trades),
      })
    });
    setSaving(false);
    if (res.ok) { setShowCreateFirm(false); setNewFirm({ name: '', currency: 'USD', timezone: 'UTC', max_traders: '50', max_daily_loss: '5', max_drawdown: '10', max_open_trades: '10' }); loadAll(token()); }
  };

  const createFirmAdmin = async () => {
    setSaving(true);
    await fetch(`${API}/firms/${newFirmAdmin.firm_id}/admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...h() },
      body: JSON.stringify(newFirmAdmin)
    });
    setSaving(false);
    setShowCreateFirmAdmin(false);
    setNewFirmAdmin({ email: '', password: '', full_name: '', firm_id: '' });
  };

  const deactivateFirm = async (id: string) => {
    if (!confirm('Deactivate this firm?')) return;
    await fetch(`${API}/firms/${id}`, { method: 'DELETE', headers: h() });
    loadAll(token());
  };

  const copy = (text: string, key: string) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 2000); };

  const Inp = ({ label, value, onChange, type = 'text', hint = '' }: any) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
    </div>
  );

  const StatCard = ({ label, value, sub, color = 'text-gray-900' }: any) => (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs text-gray-400 mb-2">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );

  const navItems = [
    { key: 'overview', icon: '⬡', label: 'Overview' },
    { key: 'firms', icon: '◈', label: 'Firms', badge: firms.length },
    { key: 'traders', icon: '◉', label: 'All Traders', badge: allTraders.length },
    { key: 'risk', icon: '◬', label: 'Risk Events', badge: riskEvents.filter((e: any) => e.severity === 'CRITICAL').length || undefined },
    { key: 'settings', icon: '◇', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar */}
      <div className="w-56 bg-gray-950 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
              <span className="text-gray-900 text-xs font-black">PS</span>
            </div>
            <div>
              <div className="text-xs font-semibold text-white">PropScholar</div>
              <div className="text-xs text-gray-500">Super Admin</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map(item => (
            <button key={item.key}
              onClick={() => { setPage(item.key); setSelectedFirm(null); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                page === item.key && !selectedFirm ? 'bg-white text-gray-900' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}>
              <div className="flex items-center gap-2.5">
                <span>{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${page === item.key && !selectedFirm ? 'bg-gray-100 text-gray-600' : 'bg-gray-800 text-gray-400'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-2 border-t border-gray-800">
          <div className="px-3 py-1.5 text-xs text-gray-600 truncate">{user?.email}</div>
          <button onClick={() => { localStorage.clear(); router.push('/'); }}
            className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-800 hover:text-white rounded-lg">Logout</button>
        </div>
      </div>

      {/* Firms sub-sidebar */}
      {(page === 'firms') && (
        <div className="w-64 border-r border-gray-100 flex flex-col bg-gray-50/50">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-sm font-semibold">Firms</h3>
            <button onClick={() => setShowCreateFirm(true)} className="text-xs bg-gray-900 text-white px-2.5 py-1 rounded-lg">+ New</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {firms.map(firm => (
              <button key={firm.id} onClick={() => loadFirmDetail(firm)}
                className={`w-full text-left p-3 rounded-xl transition-all ${selectedFirm?.id === firm.id ? 'bg-white border border-gray-200 shadow-sm' : 'hover:bg-white'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-gray-400">{firm.server_name}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${firm.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                </div>
                <div className="text-sm font-medium text-gray-900">{firm.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{firm.trader_count || 0} traders · {firm.account_count || 0} accounts</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 overflow-y-auto">

        {/* OVERVIEW */}
        {page === 'overview' && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-semibold">Overview</h1>
              <div className="flex gap-2">
                <button onClick={() => setShowCreateFirm(true)} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium">+ New Firm</button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Total Firms" value={stats?.firms || 0} />
              <StatCard label="Total Traders" value={stats?.traders || 0} />
              <StatCard label="Active Accounts" value={stats?.accounts || 0} />
              <StatCard label="Open Positions" value={stats?.open_positions || 0} />
              <StatCard label="Total Volume" value={`${parseFloat(stats?.total_volume || 0).toFixed(2)} lots`} />
              <StatCard label="Risk Breaches" value={riskEvents.length} color={riskEvents.length > 0 ? 'text-red-500' : 'text-gray-900'} />
              <StatCard label="Critical Alerts" value={riskEvents.filter((e: any) => e.severity === 'CRITICAL').length} color="text-red-500" />
              <StatCard label="Active Firms" value={firms.filter((f: any) => f.is_active).length} color="text-green-600" />
            </div>

            {/* Firms grid */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-semibold">All Firms</h2>
                <button onClick={() => setPage('firms')} className="text-xs text-gray-400 hover:text-gray-900">View all →</button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {firms.map(firm => (
                  <button key={firm.id} onClick={() => loadFirmDetail(firm)}
                    className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-400 hover:shadow-sm transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{firm.name}</div>
                        <div className="text-xs font-mono text-gray-400 mt-0.5">{firm.server_name}</div>
                      </div>
                      <span className={`w-2 h-2 rounded-full mt-1 ${firm.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {[
                        ['Traders', firm.trader_count || 0],
                        ['Accounts', firm.account_count || 0],
                      ].map(([k, v]) => (
                        <div key={k as string} className="bg-gray-50 rounded-lg p-2">
                          <div className="text-xs text-gray-400">{k}</div>
                          <div className="text-sm font-semibold text-gray-900">{v}</div>
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent risk events */}
            {riskEvents.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-sm font-semibold">Recent Risk Events</h2>
                  <button onClick={() => setPage('risk')} className="text-xs text-gray-400 hover:text-gray-900">View all →</button>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100 bg-gray-50">{['Firm','Account','Event','Severity','Value','Time'].map(h=><th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                    <tbody>
                      {riskEvents.slice(0, 5).map((e: any) => (
                        <tr key={e.id} className="border-b border-gray-50">
                          <td className="px-4 py-2 text-xs font-medium">{e.firm_name}</td>
                          <td className="px-4 py-2 font-mono text-xs text-gray-500">{e.broker_account_id}</td>
                          <td className="px-4 py-2 text-xs font-mono">{e.event_type}</td>
                          <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full border ${e.severity==='CRITICAL'?'border-red-200 bg-red-50 text-red-600':'border-yellow-200 bg-yellow-50 text-yellow-600'}`}>{e.severity}</span></td>
                          <td className="px-4 py-2 font-mono text-xs">{parseFloat(e.value_at_trigger).toFixed(2)}%</td>
                          <td className="px-4 py-2 text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FIRM DETAIL */}
        {page === 'firms' && selectedFirm && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${selectedFirm.is_active ? 'border-green-200 text-green-600 bg-green-50' : 'border-red-200 text-red-500 bg-red-50'}`}>
                    {selectedFirm.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{selectedFirm.server_name}</span>
                </div>
                <h1 className="text-xl font-semibold">{selectedFirm.name}</h1>
                <p className="text-sm text-gray-400 mt-0.5">{selectedFirm.currency} · {selectedFirm.timezone} · Max {selectedFirm.max_traders} traders</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setNewFirmAdmin({...newFirmAdmin, firm_id: selectedFirm.id}); setShowCreateFirmAdmin(true); }}
                  className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50">+ Firm Admin</button>
                <button onClick={() => deactivateFirm(selectedFirm.id)}
                  className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50">Deactivate</button>
              </div>
            </div>

            {/* Firm stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                ['Traders', selectedFirm.trader_count || firmTraders.length],
                ['Accounts', selectedFirm.account_count || 0],
                ['Subscription', selectedFirm.subscription_tier],
                ['Max Traders', selectedFirm.max_traders],
              ].map(([k, v]) => (
                <div key={k as string} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">{k}</div>
                  <div className="text-lg font-semibold text-gray-900 capitalize">{v}</div>
                </div>
              ))}
            </div>

            {/* Webhook */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Webhook Secret</div>
              <div className="flex gap-2">
                <code className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700">{selectedFirm.webhook_secret || '—'}</code>
                {selectedFirm.webhook_secret && <button onClick={() => copy(selectedFirm.webhook_secret, 'wh')} className="border border-gray-200 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-white">{copied==='wh'?'✓':'Copy'}</button>}
              </div>
            </div>

            {/* Traders table */}
            <div>
              <h2 className="text-sm font-semibold mb-3">Traders ({firmTraders.length})</h2>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">{['Trader','Code','Balance','Equity','Float PnL','Open Trades','Breaches','Status'].map(h=><th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                  <tbody>
                    {firmTraders.map((t: any) => (
                      <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3"><div className="text-xs font-medium">{t.full_name}</div><div className="text-xs text-gray-400">{t.email}</div></td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.trader_code}</td>
                        <td className="px-4 py-3 font-mono text-xs">${parseFloat(t.current_balance||0).toLocaleString('en',{minimumFractionDigits:2})}</td>
                        <td className="px-4 py-3 font-mono text-xs">${parseFloat(t.equity||0).toLocaleString('en',{minimumFractionDigits:2})}</td>
                        <td className={`px-4 py-3 font-mono text-xs font-semibold ${parseFloat(t.floating_pnl||0)>=0?'text-green-600':'text-red-500'}`}>{parseFloat(t.floating_pnl||0)>=0?'+':''}{parseFloat(t.floating_pnl||0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-xs text-center">{t.open_trades}</td>
                        <td className="px-4 py-3 text-xs text-center">{parseInt(t.breaches_today||0)>0?<span className="text-red-500 font-semibold">{t.breaches_today}</span>:'—'}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${t.is_active?'border-green-200 bg-green-50 text-green-600':'border-red-200 bg-red-50 text-red-500'}`}>{t.is_active?'Active':'Disabled'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {firmTraders.length===0&&<div className="text-center py-6 text-sm text-gray-400">No traders in this firm.</div>}
              </div>
            </div>
          </div>
        )}

        {/* FIRMS LIST (no selection) */}
        {page === 'firms' && !selectedFirm && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Select a firm from the list</div>
        )}

        {/* ALL TRADERS */}
        {page === 'traders' && (
          <div className="p-6 space-y-4">
            <h1 className="text-xl font-semibold">All Traders</h1>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 bg-gray-50">{['Trader','Firm','Code','Balance','Equity','Float PnL','Open','Status'].map(h=><th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                <tbody>
                  {allTraders.map((t: any) => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="text-xs font-medium">{t.full_name}</div><div className="text-xs text-gray-400">{t.email}</div></td>
                      <td className="px-4 py-3 text-xs text-gray-600">{t.firm_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.trader_code}</td>
                      <td className="px-4 py-3 font-mono text-xs">${parseFloat(t.current_balance||0).toLocaleString('en',{minimumFractionDigits:2})}</td>
                      <td className="px-4 py-3 font-mono text-xs">${parseFloat(t.equity||0).toLocaleString('en',{minimumFractionDigits:2})}</td>
                      <td className={`px-4 py-3 font-mono text-xs font-semibold ${parseFloat(t.floating_pnl||0)>=0?'text-green-600':'text-red-500'}`}>{parseFloat(t.floating_pnl||0)>=0?'+':''}{parseFloat(t.floating_pnl||0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs">{t.open_trades}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${t.is_active?'border-green-200 bg-green-50 text-green-600':'border-red-200 bg-red-50 text-red-500'}`}>{t.is_active?'Active':'Disabled'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {allTraders.length===0&&<div className="text-center py-8 text-sm text-gray-400">No traders yet.</div>}
            </div>
          </div>
        )}

        {/* RISK EVENTS */}
        {page === 'risk' && (
          <div className="p-6 space-y-4">
            <h1 className="text-xl font-semibold">Risk Events</h1>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                ['Total Events', riskEvents.length, ''],
                ['Critical', riskEvents.filter((e:any)=>e.severity==='CRITICAL').length, 'text-red-500'],
                ['Last 24h', riskEvents.filter((e:any)=>new Date(e.created_at)>new Date(Date.now()-86400000)).length, ''],
              ].map(([k,v,c])=>(
                <div key={k as string} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-1">{k}</div>
                  <div className={`text-2xl font-semibold ${c||'text-gray-900'}`}>{v}</div>
                </div>
              ))}
            </div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 bg-gray-50">{['Firm','Trader','Account','Event','Severity','Value','Limit','Time'].map(h=><th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                <tbody>
                  {riskEvents.map((e:any)=>(
                    <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs font-medium">{e.firm_name}</td>
                      <td className="px-4 py-2 text-xs">{e.trader_name}</td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">{e.broker_account_id}</td>
                      <td className="px-4 py-2 text-xs font-mono">{e.event_type}</td>
                      <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full border ${e.severity==='CRITICAL'?'border-red-200 bg-red-50 text-red-600':'border-yellow-200 bg-yellow-50 text-yellow-600'}`}>{e.severity}</span></td>
                      <td className="px-4 py-2 font-mono text-xs">{parseFloat(e.value_at_trigger).toFixed(2)}%</td>
                      <td className="px-4 py-2 font-mono text-xs">{parseFloat(e.threshold).toFixed(2)}%</td>
                      <td className="px-4 py-2 text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {riskEvents.length===0&&<div className="text-center py-8 text-sm text-gray-400">No risk events.</div>}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {page === 'settings' && (
          <div className="p-6 max-w-2xl space-y-6">
            <h1 className="text-xl font-semibold">Settings</h1>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold">Create Firm Admin</h2>
              <div className="grid grid-cols-2 gap-3">
                <Inp label="Full Name" value={newFirmAdmin.full_name} onChange={(v:string)=>setNewFirmAdmin({...newFirmAdmin,full_name:v})} />
                <Inp label="Email" value={newFirmAdmin.email} onChange={(v:string)=>setNewFirmAdmin({...newFirmAdmin,email:v})} type="email" />
                <Inp label="Password" value={newFirmAdmin.password} onChange={(v:string)=>setNewFirmAdmin({...newFirmAdmin,password:v})} type="password" />
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Firm</label>
                  <select value={newFirmAdmin.firm_id} onChange={e=>setNewFirmAdmin({...newFirmAdmin,firm_id:e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400">
                    <option value="">Select firm...</option>
                    {firms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={createFirmAdmin} disabled={saving||!newFirmAdmin.firm_id||!newFirmAdmin.email}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-700">
                {saving?'Creating...':'Create Firm Admin'}
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold mb-3">System Info</h2>
              <div className="space-y-2 text-sm">
                {[
                  ['API Status', 'Online', 'text-green-600'],
                  ['Risk Engine', 'Running (30s)', 'text-green-600'],
                  ['WebSocket', 'Active', 'text-green-600'],
                  ['Redis', 'Connected', 'text-green-600'],
                  ['Database', 'PostgreSQL', 'text-gray-600'],
                ].map(([k,v,c])=>(
                  <div key={k} className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-500">{k}</span>
                    <span className={`font-medium ${c}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Firm Modal */}
      {showCreateFirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="font-semibold mb-4">Create New Firm</h2>
            <div className="space-y-3">
              <Inp label="Firm Name" value={newFirm.name} onChange={(v:string)=>setNewFirm({...newFirm,name:v})} hint="Server name auto-generated from this" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Currency</label>
                  <select value={newFirm.currency} onChange={e=>setNewFirm({...newFirm,currency:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    {['USD','EUR','GBP','AUD'].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <Inp label="Max Traders" value={newFirm.max_traders} onChange={(v:string)=>setNewFirm({...newFirm,max_traders:v})} type="number" />
                <Inp label="Max Daily Loss %" value={newFirm.max_daily_loss} onChange={(v:string)=>setNewFirm({...newFirm,max_daily_loss:v})} type="number" />
                <Inp label="Max Drawdown %" value={newFirm.max_drawdown} onChange={(v:string)=>setNewFirm({...newFirm,max_drawdown:v})} type="number" />
                <Inp label="Max Open Trades" value={newFirm.max_open_trades} onChange={(v:string)=>setNewFirm({...newFirm,max_open_trades:v})} type="number" />
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Timezone</label>
                  <select value={newFirm.timezone} onChange={e=>setNewFirm({...newFirm,timezone:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    {['UTC','US/Eastern','US/Pacific','Europe/London','Asia/Dubai','Asia/Kolkata'].map(tz=><option key={tz}>{tz}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowCreateFirm(false)} className="flex-1 border border-gray-200 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={createFirm} disabled={saving||!newFirm.name} className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-700">{saving?'Creating...':'Create Firm'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Firm Admin Modal */}
      {showCreateFirmAdmin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="font-semibold mb-4">Create Firm Admin for {selectedFirm?.name}</h2>
            <div className="space-y-3">
              <Inp label="Full Name" value={newFirmAdmin.full_name} onChange={(v:string)=>setNewFirmAdmin({...newFirmAdmin,full_name:v})} />
              <Inp label="Email" value={newFirmAdmin.email} onChange={(v:string)=>setNewFirmAdmin({...newFirmAdmin,email:v})} type="email" />
              <Inp label="Password" value={newFirmAdmin.password} onChange={(v:string)=>setNewFirmAdmin({...newFirmAdmin,password:v})} type="password" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowCreateFirmAdmin(false)} className="flex-1 border border-gray-200 py-2.5 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={createFirmAdmin} disabled={saving} className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
                {saving?'Creating...':'Create Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
