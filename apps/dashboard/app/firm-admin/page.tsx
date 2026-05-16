'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = 'http://35.200.170.189:3000/api/v1';

const emptyPhase = {
  phase_number: '', phase_name: '', balance: '10000',
  profit_target_pct: '10', max_daily_loss_pct: '5',
  max_drawdown_pct: '10', max_open_trades: '5',
  min_trading_days: '10', news_trading_allowed: true, weekend_holding_allowed: true,
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
  const [showCreatePhase, setShowCreatePhase] = useState(false);
  const [editPhase, setEditPhase] = useState<any>(null);
  const [newPhase, setNewPhase] = useState<any>({...emptyPhase});
  const [rules, setRules] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [newTrader, setNewTrader] = useState({ full_name:'', email:'', password:'', balance:'10000', currency:'USD' });
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

  const saveRules = async () => {
    setSaving(true);
    await fetch(`${API}/firm/risk-rules`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...h() }, body: JSON.stringify(rules) });
    setSaving(false);
    loadAll(token());
  };

  const createTrader = async () => {
    const res = await fetch(`${API}/firm/traders`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h() }, body: JSON.stringify({ ...newTrader, server_name: dashboard?.firm?.server_name }) });
    if (res.ok) { const data = await res.json(); setCreatedCreds(data.credentials); loadAll(token()); }
  };

  const toggleTrader = async (id: string) => {
    await fetch(`${API}/firm/traders/${id}/toggle`, { method: 'PATCH', headers: h() });
    loadAll(token());
  };

  const createPhase = async () => {
    await fetch(`${API}/firm/phases`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h() }, body: JSON.stringify(newPhase) });
    setShowCreatePhase(false);
    setNewPhase({...emptyPhase});
    loadAll(token());
  };

  const savePhase = async () => {
    await fetch(`${API}/firm/phases/${editPhase.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...h() }, body: JSON.stringify(editPhase) });
    setEditPhase(null);
    loadAll(token());
  };

  const deletePhase = async (id: string) => {
    if (!confirm('Delete this phase?')) return;
    await fetch(`${API}/firm/phases/${id}`, { method: 'DELETE', headers: h() });
    loadAll(token());
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const stats = dashboard?.stats;

  const PhaseForm = ({ data, onChange, onSave, onCancel, title }: any) => (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg my-4">
        <h2 className="font-bold mb-4">{title}</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Phase Number', 'phase_number', 'number'],
            ['Phase Name', 'phase_name', 'text'],
            ['Starting Balance ($)', 'balance', 'number'],
            ['Profit Target (%)', 'profit_target_pct', 'number'],
            ['Max Daily Loss (%)', 'max_daily_loss_pct', 'number'],
            ['Max Drawdown (%)', 'max_drawdown_pct', 'number'],
            ['Max Open Trades', 'max_open_trades', 'number'],
            ['Min Trading Days', 'min_trading_days', 'number'],
          ].map(([label, key, type]) => (
            <div key={key as string}>
              <label className="text-xs text-gray-400">{label}</label>
              <input type={type as string} value={data[key as string]||''}
                onChange={e => onChange({...data, [key as string]: e.target.value})}
                className="w-full mt-0.5 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono" />
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={data.news_trading_allowed} onChange={e => onChange({...data, news_trading_allowed: e.target.checked})} className="w-4 h-4" />
            <span className="text-gray-300">News Trading Allowed</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={data.weekend_holding_allowed} onChange={e => onChange({...data, weekend_holding_allowed: e.target.checked})} className="w-4 h-4" />
            <span className="text-gray-300">Weekend Holding</span>
          </label>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 bg-gray-800 hover:bg-gray-700 py-2.5 rounded-lg text-sm">Cancel</button>
          <button onClick={onSave} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg text-sm font-medium">Save</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">{dashboard?.firm?.name || 'Firm Admin'}</h1>
          <span className="text-xs bg-purple-900/50 border border-purple-800 px-2 py-0.5 rounded text-purple-400 font-mono">{dashboard?.firm?.server_name}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{user?.email}</span>
          <button onClick={() => { localStorage.clear(); router.push('/'); }} className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded">Logout</button>
        </div>
      </div>

      <div className="border-b border-gray-800 px-6 flex gap-1 overflow-x-auto">
        {(['overview','traders','phases','challenges','rules','breaches','webhook'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium capitalize whitespace-nowrap transition-all border-b-2 ${tab===t?'border-blue-500 text-white':'border-transparent text-gray-400 hover:text-gray-200'}`}>
            {t==='phases' ? `📋 Phases (${phases.length})` :
             t==='challenges' ? `🏆 Challenges (${challenges.length})` :
             t==='breaches' ? `Breaches${riskEvents.length>0?` (${riskEvents.length})`:''}`  :
             t==='webhook' ? '🔗 Webhook' : t}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* OVERVIEW */}
        {tab==='overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {[
                ['Active Traders', stats?.active_traders, 'text-blue-400'],
                ['Open Positions', stats?.open_positions, 'text-yellow-400'],
                ['Floating PnL', `${parseFloat(stats?.total_floating_pnl||0)>=0?'+':''}${parseFloat(stats?.total_floating_pnl||0).toFixed(2)}`, parseFloat(stats?.total_floating_pnl||0)>=0?'text-green-400':'text-red-400'],
                ['Total Traders', stats?.total_traders, 'text-gray-300'],
                ['Challenge Phases', phases.length, 'text-purple-400'],
                ['Breaches Today', stats?.breaches_today, parseInt(stats?.breaches_today||0)>0?'text-red-400':'text-gray-300'],
              ].map(([k,v,c]) => (
                <div key={k as string} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">{k}</div>
                  <div className={`text-2xl font-bold font-mono ${c}`}>{v}</div>
                </div>
              ))}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold">Challenge Phases Overview</h2>
                <button onClick={() => setTab('phases')} className="text-xs text-blue-400 hover:text-blue-300">Manage →</button>
              </div>
              <div className="flex gap-3">
                {phases.map((p, i) => (
                  <div key={p.id} className="flex-1 bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded font-mono">P{p.phase_number}</span>
                      <span className="text-xs text-gray-300 font-medium">{p.phase_name}</span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-400">
                      <div>Target: <span className="text-green-400 font-mono">{p.profit_target_pct}%</span></div>
                      <div>Daily Loss: <span className="text-red-400 font-mono">{p.max_daily_loss_pct}%</span></div>
                      <div>Days: <span className="text-gray-300 font-mono">{p.min_trading_days}</span></div>
                    </div>
                    {i < phases.length - 1 && <div className="text-center text-gray-600 mt-2">↓</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TRADERS */}
        {tab==='traders' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Traders ({traders.length})</h2>
              <button onClick={() => setShowCreateTrader(true)} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium">+ Create Trader</button>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800">
                    {['Trader','Code','Balance','Equity','Float PnL','Open','Status','Action'].map(h => (
                      <th key={h} className="text-left px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {traders.map(t => (
                    <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-3"><div className="font-medium">{t.full_name}</div><div className="text-xs text-gray-500">{t.email}</div></td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{t.trader_code}</td>
                      <td className="px-4 py-3 font-mono text-xs">${parseFloat(t.current_balance||0).toLocaleString('en',{minimumFractionDigits:2})}</td>
                      <td className="px-4 py-3 font-mono text-xs">${parseFloat(t.equity||0).toLocaleString('en',{minimumFractionDigits:2})}</td>
                      <td className={`px-4 py-3 font-mono text-xs font-bold ${parseFloat(t.floating_pnl)>=0?'text-green-400':'text-red-400'}`}>{parseFloat(t.floating_pnl)>=0?'+':''}{parseFloat(t.floating_pnl).toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs">{t.open_trades}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded border ${t.is_active?'bg-green-900/30 border-green-800 text-green-400':'bg-red-900/30 border-red-800 text-red-400'}`}>{t.is_active?'ACTIVE':'DISABLED'}</span></td>
                      <td className="px-4 py-3"><button onClick={() => toggleTrader(t.id)} className={`text-xs px-3 py-1 rounded border ${t.is_active?'border-red-800 text-red-400 hover:bg-red-900/30':'border-green-800 text-green-400 hover:bg-green-900/30'}`}>{t.is_active?'Disable':'Enable'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {traders.length===0 && <div className="text-gray-500 text-sm text-center py-8">No traders yet.</div>}
            </div>
          </div>
        )}

        {/* PHASES */}
        {tab==='phases' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-semibold">Challenge Phases</h2>
                <p className="text-xs text-gray-500 mt-0.5">Define the rules for each phase traders must pass</p>
              </div>
              <button onClick={() => setShowCreatePhase(true)} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium">+ Add Phase</button>
            </div>

            <div className="space-y-3">
              {phases.map((p, idx) => (
                <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold bg-blue-900/50 border border-blue-800 text-blue-400 px-3 py-1 rounded-lg font-mono">P{p.phase_number}</span>
                      <div>
                        <div className="font-semibold">{p.phase_name}</div>
                        <div className="text-xs text-gray-500">{p.is_active ? '✓ Active' : '✗ Inactive'}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditPhase({...p})} className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded border border-gray-700">Edit</button>
                      <button onClick={() => deletePhase(p.id)} className="text-xs border border-red-900 text-red-400 hover:bg-red-900/30 px-3 py-1.5 rounded">Delete</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {[
                      ['Balance', `$${parseFloat(p.balance).toLocaleString()}`, 'text-white'],
                      ['Profit Target', `${p.profit_target_pct}%`, 'text-green-400'],
                      ['Max Daily Loss', `${p.max_daily_loss_pct}%`, 'text-red-400'],
                      ['Max Drawdown', `${p.max_drawdown_pct}%`, 'text-orange-400'],
                      ['Max Trades', p.max_open_trades, 'text-blue-400'],
                      ['Min Days', p.min_trading_days, 'text-purple-400'],
                      ['News Trading', p.news_trading_allowed ? 'Allowed' : 'Blocked', p.news_trading_allowed ? 'text-green-400' : 'text-red-400'],
                      ['Weekend Hold', p.weekend_holding_allowed ? 'Allowed' : 'Blocked', p.weekend_holding_allowed ? 'text-green-400' : 'text-red-400'],
                    ].map(([k,v,c]) => (
                      <div key={k as string} className="bg-gray-800 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">{k}</div>
                        <div className={`text-sm font-mono font-semibold ${c}`}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {idx < phases.length - 1 && (
                    <div className="flex items-center justify-center mt-3 text-gray-600 text-xs gap-2">
                      <div className="h-px flex-1 bg-gray-800" />
                      <span>passes to Phase {phases[idx+1].phase_number}</span>
                      <div className="h-px flex-1 bg-gray-800" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHALLENGES */}
        {tab==='challenges' && (
          <div className="space-y-4">
            <h2 className="font-semibold">Active Challenges ({challenges.length})</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800">
                    {['Trader','Phase','Account','Balance','Profit %','Target','Status','Started'].map(h => (
                      <th key={h} className="text-left px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {challenges.map(c => {
                    const profit = parseFloat(c.actual_profit_pct||0);
                    const target = parseFloat(c.profit_target_pct||0);
                    const progress = target > 0 ? Math.min(100, (profit/target)*100) : 100;
                    return (
                      <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                        <td className="px-4 py-3"><div className="text-xs font-medium">{c.trader_name}</div><div className="text-xs text-gray-500">{c.trader_email}</div></td>
                        <td className="px-4 py-3"><span className="text-xs bg-blue-900/30 border border-blue-800 text-blue-400 px-2 py-0.5 rounded font-mono">P{c.phase_number}</span><div className="text-xs text-gray-500 mt-0.5">{c.phase_name}</div></td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{c.broker_account_id}</td>
                        <td className="px-4 py-3 font-mono text-xs">${parseFloat(c.current_balance||0).toLocaleString('en',{minimumFractionDigits:2})}</td>
                        <td className="px-4 py-3">
                          <div className={`text-xs font-mono font-bold ${profit>=0?'text-green-400':'text-red-400'}`}>{profit>=0?'+':''}{profit.toFixed(2)}%</div>
                          {target > 0 && <div className="w-16 h-1 bg-gray-700 rounded mt-1"><div className="h-full bg-green-500 rounded" style={{width:`${progress}%`}}/></div>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{target > 0 ? `${target}%` : 'Funded'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
                            c.status==='PASSED'?'bg-green-900/30 border-green-800 text-green-400':
                            c.status==='FAILED'?'bg-red-900/30 border-red-800 text-red-400':
                            'bg-blue-900/30 border-blue-800 text-blue-400'
                          }`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{new Date(c.started_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {challenges.length===0 && <div className="text-gray-500 text-sm text-center py-8">No active challenges.</div>}
            </div>
          </div>
        )}

        {/* RULES */}
        {tab==='rules' && rules && (
          <div className="max-w-lg space-y-4">
            <h2 className="font-semibold">Global Risk Rules — {dashboard?.firm?.name}</h2>
            <p className="text-xs text-gray-500">Default rules for all accounts. Phase rules override these per challenge.</p>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
              {[
                ['Max Daily Loss %','max_daily_loss_pct','e.g. 5 = 5% of balance'],
                ['Max Drawdown %','max_drawdown_pct','e.g. 10 = 10% from peak'],
                ['Max Position Size (lots)','max_position_size','e.g. 1 = 1 lot max'],
                ['Max Open Trades','max_open_trades','e.g. 10 = 10 positions max'],
              ].map(([label,key,hint]) => (
                <div key={key as string}>
                  <label className="text-xs text-gray-400">{label}</label>
                  <p className="text-xs text-gray-600 mb-1">{hint}</p>
                  <input type="number" value={rules[key as string]||''} onChange={e => setRules({...rules,[key as string]:e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono" />
                </div>
              ))}
              <button onClick={saveRules} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-2.5 rounded-lg text-sm font-medium">
                {saving?'Saving...':'Save Rules'}
              </button>
            </div>
          </div>
        )}

        {/* BREACHES */}
        {tab==='breaches' && (
          <div className="space-y-4">
            <h2 className="font-semibold">Risk Events</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 text-xs border-b border-gray-800">{['Trader','Event','Severity','Value','Limit','Time'].map(h=><th key={h} className="text-left px-4 py-3">{h}</th>)}</tr></thead>
                <tbody>
                  {riskEvents.map(e=>(
                    <tr key={e.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                      <td className="px-4 py-3"><div className="text-xs font-medium">{e.trader_name}</div><div className="text-xs text-gray-500 font-mono">{e.broker_account_id}</div></td>
                      <td className="px-4 py-3 text-xs font-mono text-yellow-400">{e.event_type}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${e.severity==='CRITICAL'?'bg-red-900/50 text-red-400':'bg-yellow-900/30 text-yellow-400'}`}>{e.severity}</span></td>
                      <td className="px-4 py-3 font-mono text-xs">{parseFloat(e.value_at_trigger).toFixed(2)}%</td>
                      <td className="px-4 py-3 font-mono text-xs">{parseFloat(e.threshold).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {riskEvents.length===0&&<div className="text-gray-500 text-sm text-center py-8">No risk events.</div>}
            </div>
          </div>
        )}

        {/* WEBHOOK */}
        {tab==='webhook' && webhookInfo && (
          <div className="max-w-2xl space-y-4">
            <h2 className="font-semibold">Webhook Integration</h2>
            <p className="text-xs text-gray-400">Auto-create trader accounts from your website on purchase.</p>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider">Webhook URL</label>
                <div className="flex gap-2 mt-1.5">
                  <code className="flex-1 bg-gray-800 rounded px-3 py-2 text-sm text-green-400 font-mono break-all">{webhookInfo.webhook_url}</code>
                  <button onClick={()=>copy(webhookInfo.webhook_url,'url')} className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-xs whitespace-nowrap">{copied==='url'?'✓ Copied':'Copy'}</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider">Secret Key</label>
                <p className="text-xs text-gray-600 mb-1.5">Header: <code className="text-yellow-400">x-webhook-secret</code></p>
                <div className="flex gap-2">
                  <code className="flex-1 bg-gray-800 rounded px-3 py-2 text-sm text-yellow-400 font-mono">{webhookInfo.secret}</code>
                  <button onClick={()=>copy(webhookInfo.secret,'secret')} className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-xs whitespace-nowrap">{copied==='secret'?'✓ Copied':'Copy'}</button>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold">Actions</h3>
              {[
                ['POST','green','create_challenge',{action:'create_challenge',email:'trader@example.com',full_name:'John Doe',balance:10000,challenge_type:'phase1'}],
                ['POST','red','disable_trader',{action:'disable_trader',email:'trader@example.com'}],
                ['POST','blue','get_trader',{action:'get_trader',account_number:'TRD123456'}],
              ].map(([method,color,name,body]) => (
                <div key={name as string} className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs bg-${color}-900/50 border border-${color}-800 text-${color}-400 px-2 py-0.5 rounded font-mono`}>{method as string}</span>
                    <span className="text-sm font-medium capitalize">{(name as string).replace('_',' ')}</span>
                  </div>
                  <pre className="text-xs text-gray-300 overflow-x-auto">{JSON.stringify(body,null,2)}</pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Phase Modal */}
      {showCreatePhase && <PhaseForm data={newPhase} onChange={setNewPhase} onSave={createPhase} onCancel={()=>{setShowCreatePhase(false);setNewPhase({...emptyPhase});}} title="Create Phase" />}

      {/* Edit Phase Modal */}
      {editPhase && <PhaseForm data={editPhase} onChange={setEditPhase} onSave={savePhase} onCancel={()=>setEditPhase(null)} title={`Edit ${editPhase.phase_name}`} />}

      {/* Create Trader Modal */}
      {showCreateTrader && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            {createdCreds ? (
              <div>
                <h2 className="font-bold text-green-400 mb-4">✓ Trader Created</h2>
                <div className="bg-gray-800 rounded-lg p-4 space-y-2 font-mono text-sm">
                  {Object.entries(createdCreds).map(([k,v])=>(<div key={k} className="flex justify-between"><span className="text-gray-400 capitalize">{k}:</span><span className="text-white">{v as string}</span></div>))}
                </div>
                <button onClick={()=>{setCreatedCreds(null);setShowCreateTrader(false);setNewTrader({full_name:'',email:'',password:'',balance:'10000',currency:'USD'});}} className="w-full mt-4 bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg text-sm">Done</button>
              </div>
            ) : (
              <div>
                <h2 className="font-bold mb-4">Create Trader</h2>
                <div className="space-y-3">
                  {[['Full Name','full_name','text','John Doe'],['Email','email','email','trader@example.com'],['Password','password','password','••••••••'],['Account Balance','balance','number','10000']].map(([label,key,type,placeholder])=>(
                    <div key={key as string}><label className="text-xs text-gray-400">{label}</label><input type={type as string} value={(newTrader as any)[key as string]} onChange={e=>setNewTrader({...newTrader,[key as string]:e.target.value})} className="w-full mt-0.5 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" placeholder={placeholder as string} /></div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={()=>setShowCreateTrader(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 py-2.5 rounded-lg text-sm">Cancel</button>
                  <button onClick={createTrader} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg text-sm font-medium">Create</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
