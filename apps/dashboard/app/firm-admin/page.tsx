'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://35.200.170.189:3000') + '/api/v1';

const defaultPhase = {
  phase_number: '', phase_name: '', description: '', price: '0', balance: '10000',
  profit_target_pct: '10', max_daily_loss_pct: '5', max_drawdown_pct: '10',
  max_open_trades: '5', max_lot_size: '0', min_trading_days: '10',
  min_trading_days_per_week: '0', min_profit_per_day_pct: '0',
  consistency_rule_enabled: false, consistency_pct: '30',
  news_trading_allowed: true, weekend_holding_allowed: true,
  copy_trading_allowed: false, ea_trading_allowed: true, is_active: true,
};

export default function FirmAdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [traders, setTraders] = useState<any[]>([]);
  const [riskEvents, setRiskEvents] = useState<any[]>([]);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [phases, setPhases] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview'|'traders'|'phases'|'challenges'|'rules'|'breaches'|'webhook'>('overview');
  const [showCreateTrader, setShowCreateTrader] = useState(false);
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [editingPhase, setEditingPhase] = useState<any>(null);
  const [phaseForm, setPhaseForm] = useState<any>({...defaultPhase});
  const [rules, setRules] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [newTrader, setNewTrader] = useState({ full_name:'', email:'', password:'', balance:'10000' });
  const [createdCreds, setCreatedCreds] = useState<any>(null);
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
    const [dashRes, tradersRes, eventsRes, webhookRes, phasesRes, challengesRes] = await Promise.all([
      fetch(`${API}/firm/dashboard`, { headers }),
      fetch(`${API}/firm/traders`, { headers }),
      fetch(`${API}/firm/risk-events`, { headers }),
      fetch(`${API}/firm/webhook-info`, { headers }),
      fetch(`${API}/firm/phases`, { headers }),
      fetch(`${API}/firm/challenges`, { headers }),
    ]);
    if (dashRes.ok) { const d = await dashRes.json(); setDashboard(d); setRules(d.rules); }
    if (tradersRes.ok) setTraders(await tradersRes.json());
    if (eventsRes.ok) setRiskEvents(await eventsRes.json());
    if (webhookRes.ok) setWebhookInfo(await webhookRes.json());
    if (phasesRes.ok) setPhases(await phasesRes.json());
    if (challengesRes.ok) setChallenges(await challengesRes.json());
  };

  const openCreatePhase = () => { setPhaseForm({...defaultPhase}); setEditingPhase(null); setShowPhaseModal(true); };
  const openEditPhase = (p: any) => {
    setPhaseForm({
      phase_number: p.phase_number, phase_name: p.phase_name, description: p.description||'',
      price: p.price||'0', balance: p.balance, profit_target_pct: p.profit_target_pct,
      max_daily_loss_pct: p.max_daily_loss_pct, max_drawdown_pct: p.max_drawdown_pct,
      max_open_trades: p.max_open_trades, max_lot_size: p.max_lot_size||'0',
      min_trading_days: p.min_trading_days, min_trading_days_per_week: p.min_trading_days_per_week||'0',
      min_profit_per_day_pct: p.min_profit_per_day_pct||'0',
      consistency_rule_enabled: p.consistency_rule_enabled||false,
      consistency_pct: p.consistency_pct||'30',
      news_trading_allowed: p.news_trading_allowed, weekend_holding_allowed: p.weekend_holding_allowed,
      copy_trading_allowed: p.copy_trading_allowed||false, ea_trading_allowed: p.ea_trading_allowed!==false,
      is_active: p.is_active,
    });
    setEditingPhase(p);
    setShowPhaseModal(true);
  };

  const savePhase = async () => {
    setSaving(true);
    if (editingPhase) {
      await fetch(`${API}/firm/phases/${editingPhase.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...h() }, body: JSON.stringify(phaseForm) });
    } else {
      await fetch(`${API}/firm/phases`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h() }, body: JSON.stringify(phaseForm) });
    }
    setSaving(false);
    setShowPhaseModal(false);
    loadAll(token());
  };

  const deletePhase = async (id: string) => {
    if (!confirm('Delete this phase?')) return;
    await fetch(`${API}/firm/phases/${id}`, { method: 'DELETE', headers: h() });
    loadAll(token());
  };

  const saveRules = async () => {
    setSaving(true);
    await fetch(`${API}/firm/risk-rules`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...h() }, body: JSON.stringify(rules) });
    setSaving(false);
    loadAll(token());
  };

  const createTrader = async () => {
    const res = await fetch(`${API}/firm/traders`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h() }, body: JSON.stringify({ ...newTrader, server_name: dashboard?.firm?.server_name }) });
    if (res.ok) { const d = await res.json(); setCreatedCreds(d.credentials); loadAll(token()); }
  };

  const toggleTrader = async (id: string) => {
    await fetch(`${API}/firm/traders/${id}/toggle`, { method: 'PATCH', headers: h() });
    loadAll(token());
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const Toggle = ({ checked, onChange, label }: any) => (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <div onClick={() => onChange(!checked)} className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-gray-900' : 'bg-gray-200'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </label>
  );

  const Input = ({ label, value, onChange, type = 'text', hint = '' }: any) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400 bg-white" />
    </div>
  );

  const stats = dashboard?.stats;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'phases', label: `Phases (${phases.length})` },
    { key: 'traders', label: `Traders (${traders.length})` },
    { key: 'challenges', label: `Challenges (${challenges.length})` },
    { key: 'rules', label: 'Risk Rules' },
    { key: 'breaches', label: `Breaches${riskEvents.length > 0 ? ` (${riskEvents.length})` : ''}` },
    { key: 'webhook', label: 'Webhook' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">{dashboard?.firm?.name?.[0] || 'F'}</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">{dashboard?.firm?.name || 'Firm Admin'}</h1>
            <p className="text-xs text-gray-400 font-mono">{dashboard?.firm?.server_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user?.email}</span>
          <button onClick={() => { localStorage.clear(); router.push('/'); }}
            className="text-xs border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-gray-600">Logout</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-0 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
              tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}>{t.label}</button>
        ))}
      </div>

      <div className="max-w-7xl mx-auto p-6">

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-6 gap-4">
              {[
                ['Active Traders', stats?.active_traders, 'text-gray-900'],
                ['Open Positions', stats?.open_positions, 'text-gray-900'],
                ['Float PnL', `${parseFloat(stats?.total_floating_pnl||0)>=0?'+':''}${parseFloat(stats?.total_floating_pnl||0).toFixed(2)}`, parseFloat(stats?.total_floating_pnl||0)>=0?'text-green-600':'text-red-500'],
                ['Challenge Phases', phases.length, 'text-gray-900'],
                ['Active Accounts', stats?.active_accounts, 'text-gray-900'],
                ['Breaches Today', stats?.breaches_today, parseInt(stats?.breaches_today||0)>0?'text-red-500':'text-gray-900'],
              ].map(([k,v,c]) => (
                <div key={k as string} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-gray-400 mb-2">{k}</div>
                  <div className={`text-2xl font-semibold ${c}`}>{v}</div>
                </div>
              ))}
            </div>

            {/* Phases preview */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-semibold">Challenge Structure</h2>
                <button onClick={() => setTab('phases')} className="text-xs text-gray-500 hover:text-gray-900">Manage →</button>
              </div>
              <div className="flex items-stretch gap-0">
                {phases.map((p, i) => (
                  <div key={p.id} className="flex items-center">
                    <div className="border border-gray-200 rounded-xl p-4 min-w-48">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded font-mono">P{p.phase_number}</span>
                        <span className="text-xs font-medium text-gray-700">{p.phase_name}</span>
                      </div>
                      <div className="space-y-1">
                        {[
                          ['Target', `${p.profit_target_pct}%`, p.profit_target_pct > 0 ? 'text-green-600' : 'text-gray-400'],
                          ['Daily Loss', `${p.max_daily_loss_pct}%`, 'text-red-500'],
                          ['Drawdown', `${p.max_drawdown_pct}%`, 'text-orange-500'],
                          ['Min Days', p.min_trading_days, 'text-gray-700'],
                        ].map(([k,v,c]) => (
                          <div key={k as string} className="flex justify-between text-xs">
                            <span className="text-gray-400">{k}</span>
                            <span className={`font-mono font-medium ${c}`}>{v}</span>
                          </div>
                        ))}
                        {p.consistency_rule_enabled && (
                          <div className="flex justify-between text-xs mt-1 pt-1 border-t border-gray-100">
                            <span className="text-gray-400">Consistency</span>
                            <span className="font-mono font-medium text-purple-600">{p.consistency_pct}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {i < phases.length - 1 && (
                      <div className="px-2 text-gray-300 text-lg">→</div>
                    )}
                  </div>
                ))}
                {phases.length === 0 && <p className="text-sm text-gray-400">No phases created yet.</p>}
              </div>
            </div>

            {/* Server info */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold mb-3">Server Configuration</h2>
              <div className="grid grid-cols-4 gap-3">
                {[
                  ['Server Name', dashboard?.firm?.server_name],
                  ['Currency', dashboard?.firm?.currency],
                  ['Timezone', dashboard?.firm?.timezone],
                  ['Max Traders', dashboard?.firm?.max_traders],
                ].map(([k,v]) => (
                  <div key={k as string} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">{k}</div>
                    <div className="text-sm font-mono font-semibold">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PHASES */}
        {tab === 'phases' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">Challenge Phases</h2>
                <p className="text-sm text-gray-400 mt-0.5">Define rules for each evaluation phase</p>
              </div>
              <button onClick={openCreatePhase}
                className="bg-gray-900 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                + Add Phase
              </button>
            </div>

            <div className="space-y-3">
              {phases.map((p, idx) => (
                <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold bg-gray-900 text-white px-3 py-1 rounded-lg font-mono">P{p.phase_number}</span>
                      <div>
                        <div className="font-semibold text-gray-900">{p.phase_name}</div>
                        {p.description && <div className="text-xs text-gray-400 mt-0.5">{p.description}</div>}
                        {p.price > 0 && <div className="text-xs text-gray-500 mt-0.5">Price: ${parseFloat(p.price).toFixed(2)}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${p.is_active ? 'border-green-200 text-green-600 bg-green-50' : 'border-red-200 text-red-500 bg-red-50'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button onClick={() => openEditPhase(p)} className="text-xs border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-gray-600">Edit</button>
                      <button onClick={() => deletePhase(p.id)} className="text-xs border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg">Delete</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-3">
                    {[
                      ['Balance', `$${parseFloat(p.balance).toLocaleString()}`, 'text-gray-900'],
                      ['Profit Target', `${p.profit_target_pct}%`, 'text-green-600'],
                      ['Max Daily Loss', `${p.max_daily_loss_pct}%`, 'text-red-500'],
                      ['Max Drawdown', `${p.max_drawdown_pct}%`, 'text-orange-500'],
                      ['Max Trades', p.max_open_trades, 'text-gray-700'],
                      ['Max Lot Size', p.max_lot_size > 0 ? `${p.max_lot_size} lots` : 'No limit', 'text-gray-700'],
                      ['Min Days', p.min_trading_days, 'text-gray-700'],
                      ['Days/Week', p.min_trading_days_per_week > 0 ? p.min_trading_days_per_week : 'No min', 'text-gray-700'],
                    ].map(([k,v,c]) => (
                      <div key={k as string} className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">{k}</div>
                        <div className={`text-sm font-mono font-semibold ${c}`}>{v}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      [p.consistency_rule_enabled, `Consistency Rule: ${p.consistency_pct}%`],
                      [p.news_trading_allowed, 'News Trading'],
                      [p.weekend_holding_allowed, 'Weekend Holding'],
                      [p.copy_trading_allowed, 'Copy Trading'],
                      [p.ea_trading_allowed, 'EA/Bot Trading'],
                    ].map(([val, label]) => (
                      <span key={label as string} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                        val ? 'border-green-200 text-green-600 bg-green-50' : 'border-gray-200 text-gray-400 bg-gray-50'
                      }`}>
                        {val ? '✓' : '✗'} {label as string}
                      </span>
                    ))}
                  </div>

                  {idx < phases.length - 1 && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-400">→ Passes to</div>
                      <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{phases[idx+1].phase_name}</span>
                    </div>
                  )}
                </div>
              ))}
              {phases.length === 0 && (
                <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
                  <p className="text-gray-400 text-sm">No phases yet. Create your first challenge phase.</p>
                  <button onClick={openCreatePhase} className="mt-3 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm">+ Create Phase</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TRADERS */}
        {tab === 'traders' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Traders</h2>
              <button onClick={() => setShowCreateTrader(true)} className="bg-gray-900 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Create Trader</button>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Trader','Code','Balance','Equity','Float PnL','Positions','Status','Action'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {traders.map(t => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="font-medium text-gray-900">{t.full_name}</div><div className="text-xs text-gray-400">{t.email}</div></td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.trader_code}</td>
                      <td className="px-4 py-3 font-mono text-xs">${parseFloat(t.current_balance||0).toLocaleString('en',{minimumFractionDigits:2})}</td>
                      <td className="px-4 py-3 font-mono text-xs">${parseFloat(t.equity||0).toLocaleString('en',{minimumFractionDigits:2})}</td>
                      <td className={`px-4 py-3 font-mono text-xs font-semibold ${parseFloat(t.floating_pnl)>=0?'text-green-600':'text-red-500'}`}>
                        {parseFloat(t.floating_pnl)>=0?'+':''}{parseFloat(t.floating_pnl).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{t.open_trades}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${t.is_active?'border-green-200 bg-green-50 text-green-600':'border-red-200 bg-red-50 text-red-500'}`}>
                          {t.is_active?'Active':'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleTrader(t.id)}
                          className={`text-xs px-3 py-1 rounded-lg border ${t.is_active?'border-red-200 text-red-500 hover:bg-red-50':'border-green-200 text-green-600 hover:bg-green-50'}`}>
                          {t.is_active?'Disable':'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {traders.length === 0 && <div className="text-gray-400 text-sm text-center py-8">No traders yet.</div>}
            </div>
          </div>
        )}

        {/* CHALLENGES */}
        {tab === 'challenges' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Active Challenges</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Trader','Phase','Account','Balance','Profit','Target','Status','Started'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {challenges.map(c => {
                    const profit = parseFloat(c.actual_profit_pct||0);
                    const target = parseFloat(c.profit_target_pct||0);
                    const progress = target > 0 ? Math.min(100, (profit/target)*100) : 100;
                    return (
                      <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3"><div className="font-medium text-gray-900 text-xs">{c.trader_name}</div><div className="text-xs text-gray-400">{c.trader_email}</div></td>
                        <td className="px-4 py-3"><span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded font-mono">P{c.phase_number}</span></td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.broker_account_id}</td>
                        <td className="px-4 py-3 font-mono text-xs">${parseFloat(c.current_balance||0).toLocaleString('en',{minimumFractionDigits:2})}</td>
                        <td className="px-4 py-3">
                          <div className={`text-xs font-mono font-semibold ${profit>=0?'text-green-600':'text-red-500'}`}>{profit>=0?'+':''}{profit.toFixed(2)}%</div>
                          {target > 0 && <div className="w-16 h-1 bg-gray-100 rounded mt-1"><div className="h-full bg-gray-900 rounded" style={{width:`${progress}%`}}/></div>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{target > 0 ? `${target}%` : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            c.status==='PASSED'?'border-green-200 bg-green-50 text-green-600':
                            c.status==='FAILED'?'border-red-200 bg-red-50 text-red-500':
                            'border-blue-200 bg-blue-50 text-blue-600'
                          }`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{new Date(c.started_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {challenges.length === 0 && <div className="text-gray-400 text-sm text-center py-8">No challenges yet.</div>}
            </div>
          </div>
        )}

        {/* RULES */}
        {tab === 'rules' && rules && (
          <div className="max-w-lg space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Global Risk Rules</h2>
              <p className="text-sm text-gray-400 mt-0.5">Default rules for all accounts on <span className="font-mono">{dashboard?.firm?.server_name}</span></p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              {[
                ['Max Daily Loss %', 'max_daily_loss_pct', '5% of balance per day'],
                ['Max Drawdown %', 'max_drawdown_pct', '10% from peak equity'],
                ['Max Position Size (lots)', 'max_position_size', '1 lot maximum'],
                ['Max Open Trades', 'max_open_trades', '10 positions maximum'],
              ].map(([label, key, hint]) => (
                <div key={key as string}>
                  <label className="text-xs font-medium text-gray-500">{label}</label>
                  <p className="text-xs text-gray-400 mb-1">{hint}</p>
                  <input type="number" value={rules[key as string]||''}
                    onChange={e => setRules({...rules, [key as string]: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-gray-400" />
                </div>
              ))}
              <button onClick={saveRules} disabled={saving}
                className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium">
                {saving ? 'Saving...' : 'Save Rules'}
              </button>
            </div>
          </div>
        )}

        {/* BREACHES */}
        {tab === 'breaches' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Risk Events</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Trader','Event','Severity','Value','Limit','Time'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {riskEvents.map(e => (
                    <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="text-xs font-medium">{e.trader_name}</div><div className="text-xs text-gray-400 font-mono">{e.broker_account_id}</div></td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-700">{e.event_type}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${e.severity==='CRITICAL'?'border-red-200 bg-red-50 text-red-600':'border-yellow-200 bg-yellow-50 text-yellow-600'}`}>{e.severity}</span></td>
                      <td className="px-4 py-3 font-mono text-xs">{parseFloat(e.value_at_trigger).toFixed(2)}%</td>
                      <td className="px-4 py-3 font-mono text-xs">{parseFloat(e.threshold).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {riskEvents.length === 0 && <div className="text-gray-400 text-sm text-center py-8">No risk events. All traders within limits.</div>}
            </div>
          </div>
        )}

        {/* WEBHOOK */}
        {tab === 'webhook' && webhookInfo && (
          <div className="max-w-2xl space-y-4">
            <h2 className="text-lg font-semibold">Webhook Integration</h2>
            <p className="text-sm text-gray-400">Auto-create trader accounts from your website on purchase.</p>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Webhook URL</label>
                <div className="flex gap-2 mt-1.5">
                  <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 font-mono break-all">{webhookInfo.webhook_url}</code>
                  <button onClick={() => copy(webhookInfo.webhook_url, 'url')} className="border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg text-xs text-gray-600 whitespace-nowrap">{copied==='url'?'✓ Copied':'Copy'}</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Secret Key</label>
                <p className="text-xs text-gray-400 mb-1.5">Send as header: <code className="bg-gray-100 px-1 rounded">x-webhook-secret</code></p>
                <div className="flex gap-2">
                  <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-700">{webhookInfo.secret}</code>
                  <button onClick={() => copy(webhookInfo.secret, 'secret')} className="border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg text-xs text-gray-600 whitespace-nowrap">{copied==='secret'?'✓ Copied':'Copy'}</button>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold">Actions</h3>
              {[
                ['create_challenge', {action:'create_challenge',email:'trader@example.com',full_name:'John Doe',balance:10000,challenge_type:'phase1'}],
                ['disable_trader', {action:'disable_trader',email:'trader@example.com'}],
                ['get_trader', {action:'get_trader',account_number:'TRD123456'}],
              ].map(([name, body]) => (
                <div key={name as string} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded font-mono">POST</span>
                    <span className="text-sm font-medium capitalize">{(name as string).replace('_',' ')}</span>
                  </div>
                  <pre className="text-xs text-gray-600 overflow-x-auto">{JSON.stringify(body, null, 2)}</pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Phase Modal */}
      {showPhaseModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-4 shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold">{editingPhase ? `Edit ${editingPhase.phase_name}` : 'Create Challenge Phase'}</h2>
              <button onClick={() => setShowPhaseModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

              {/* Basic Info */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Basic Info</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Phase Number" value={phaseForm.phase_number} onChange={(v: string) => setPhaseForm({...phaseForm, phase_number: v})} type="number" />
                  <Input label="Phase Name" value={phaseForm.phase_name} onChange={(v: string) => setPhaseForm({...phaseForm, phase_name: v})} />
                  <Input label="Price ($)" value={phaseForm.price} onChange={(v: string) => setPhaseForm({...phaseForm, price: v})} type="number" hint="What traders pay for this phase" />
                  <Input label="Starting Balance ($)" value={phaseForm.balance} onChange={(v: string) => setPhaseForm({...phaseForm, balance: v})} type="number" />
                </div>
                <div className="mt-3">
                  <Input label="Description (optional)" value={phaseForm.description} onChange={(v: string) => setPhaseForm({...phaseForm, description: v})} />
                </div>
              </div>

              {/* Financial Rules */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Financial Rules</h3>
                <div className="grid grid-cols-3 gap-3">
                  <Input label="Profit Target %" value={phaseForm.profit_target_pct} onChange={(v: string) => setPhaseForm({...phaseForm, profit_target_pct: v})} type="number" hint="0 = no target" />
                  <Input label="Max Daily Loss %" value={phaseForm.max_daily_loss_pct} onChange={(v: string) => setPhaseForm({...phaseForm, max_daily_loss_pct: v})} type="number" />
                  <Input label="Max Drawdown %" value={phaseForm.max_drawdown_pct} onChange={(v: string) => setPhaseForm({...phaseForm, max_drawdown_pct: v})} type="number" />
                </div>
              </div>

              {/* Trading Rules */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Trading Rules</h3>
                <div className="grid grid-cols-3 gap-3">
                  <Input label="Min Trading Days" value={phaseForm.min_trading_days} onChange={(v: string) => setPhaseForm({...phaseForm, min_trading_days: v})} type="number" />
                  <Input label="Min Days/Week" value={phaseForm.min_trading_days_per_week} onChange={(v: string) => setPhaseForm({...phaseForm, min_trading_days_per_week: v})} type="number" hint="0 = no minimum" />
                  <Input label="Max Open Trades" value={phaseForm.max_open_trades} onChange={(v: string) => setPhaseForm({...phaseForm, max_open_trades: v})} type="number" />
                  <Input label="Max Lot Size" value={phaseForm.max_lot_size} onChange={(v: string) => setPhaseForm({...phaseForm, max_lot_size: v})} type="number" hint="0 = no limit" />
                  <Input label="Min Daily Profit %" value={phaseForm.min_profit_per_day_pct} onChange={(v: string) => setPhaseForm({...phaseForm, min_profit_per_day_pct: v})} type="number" hint="0 = no minimum" />
                </div>
              </div>

              {/* Consistency Rule */}
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                <Toggle
                  checked={phaseForm.consistency_rule_enabled}
                  onChange={(v: boolean) => setPhaseForm({...phaseForm, consistency_rule_enabled: v})}
                  label="Consistency Rule"
                />
                {phaseForm.consistency_rule_enabled && (
                  <div className="mt-3">
                    <Input
                      label="Consistency % (max % of total profit from single day)"
                      value={phaseForm.consistency_pct}
                      onChange={(v: string) => setPhaseForm({...phaseForm, consistency_pct: v})}
                      type="number"
                      hint="e.g. 30 = no single day can be >30% of total profit"
                    />
                  </div>
                )}
              </div>

              {/* Permissions */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Permissions</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 divide-y divide-gray-100">
                  <Toggle checked={phaseForm.news_trading_allowed} onChange={(v: boolean) => setPhaseForm({...phaseForm, news_trading_allowed: v})} label="News Trading Allowed" />
                  <Toggle checked={phaseForm.weekend_holding_allowed} onChange={(v: boolean) => setPhaseForm({...phaseForm, weekend_holding_allowed: v})} label="Weekend Holding Allowed" />
                  <Toggle checked={phaseForm.copy_trading_allowed} onChange={(v: boolean) => setPhaseForm({...phaseForm, copy_trading_allowed: v})} label="Copy Trading Allowed" />
                  <Toggle checked={phaseForm.ea_trading_allowed} onChange={(v: boolean) => setPhaseForm({...phaseForm, ea_trading_allowed: v})} label="EA / Bot Trading Allowed" />
                  <Toggle checked={phaseForm.is_active} onChange={(v: boolean) => setPhaseForm({...phaseForm, is_active: v})} label="Phase Active" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
              <button onClick={() => setShowPhaseModal(false)} className="border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm text-gray-600">Cancel</button>
              <button onClick={savePhase} disabled={saving} className="bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium">
                {saving ? 'Saving...' : editingPhase ? 'Save Changes' : 'Create Phase'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Trader Modal */}
      {showCreateTrader && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            {createdCreds ? (
              <div>
                <h2 className="font-semibold text-green-600 mb-4">✓ Trader Created</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                  {Object.entries(createdCreds).map(([k,v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-gray-500 capitalize">{k}</span>
                      <span className="font-mono font-medium">{v as string}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setCreatedCreds(null); setShowCreateTrader(false); setNewTrader({full_name:'',email:'',password:'',balance:'10000'}); }}
                  className="w-full mt-4 bg-gray-900 text-white py-2.5 rounded-lg text-sm">Done</button>
              </div>
            ) : (
              <div>
                <h2 className="font-semibold mb-4">Create Trader</h2>
                <div className="space-y-3">
                  {[['Full Name','full_name','text'],['Email','email','email'],['Password','password','password'],['Balance','balance','number']].map(([label,key,type]) => (
                    <Input key={key} label={label} value={(newTrader as any)[key]} onChange={(v: string) => setNewTrader({...newTrader, [key]: v})} type={type} />
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setShowCreateTrader(false)} className="flex-1 border border-gray-200 hover:bg-gray-50 py-2.5 rounded-lg text-sm">Cancel</button>
                  <button onClick={createTrader} className="flex-1 bg-gray-900 hover:bg-gray-700 text-white py-2.5 rounded-lg text-sm font-medium">Create</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
