'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://35.200.170.189:3000') + '/api/v1';

const PROGRAM_TYPES: Record<string, { label: string; color: string; steps: number }> = {
  one_step: { label: 'One-Step', color: 'bg-blue-50 text-blue-700 border-blue-200', steps: 1 },
  two_step: { label: 'Two-Step', color: 'bg-purple-50 text-purple-700 border-purple-200', steps: 2 },
  three_step: { label: 'Three-Step', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', steps: 3 },
  instant_funded: { label: 'Instant Funded', color: 'bg-green-50 text-green-700 border-green-200', steps: 0 },
};

const defaultPhase = {
  name: '', phase_type: 'evaluation', balance: '10000', price: '0',
  profit_target_pct: '10', max_daily_loss_pct: '5', max_drawdown_pct: '10',
  max_open_trades: '5', max_lot_size: '0', min_trading_days: '10',
  min_trading_days_per_week: '0', consistency_rule_enabled: false,
  consistency_pct: '30', news_trading_allowed: true, weekend_holding_allowed: true,
  copy_trading_allowed: false, ea_trading_allowed: true,
};

export default function FirmAdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [traders, setTraders] = useState<any[]>([]);
  const [riskEvents, setRiskEvents] = useState<any[]>([]);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [programs, setPrograms] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [page, setPage] = useState('overview');
  const [selectedProgram, setSelectedProgram] = useState<any>(null);
  const [editingPhase, setEditingPhase] = useState<any>(null);
  const [phaseForm, setPhaseForm] = useState<any>({...defaultPhase, phase_order: 1});
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [showNewProgram, setShowNewProgram] = useState(false);
  const [newProgram, setNewProgram] = useState({ name: '', type: 'one_step', description: '' });
  const [rules, setRules] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [newTrader, setNewTrader] = useState({ full_name: '', email: '', password: '', balance: '10000' });
  const [createdCreds, setCreatedCreds] = useState<any>(null);
  const [showCreateTrader, setShowCreateTrader] = useState(false);
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
    const [dashRes, tradersRes, eventsRes, webhookRes, programsRes, challengesRes] = await Promise.all([
      fetch(`${API}/firm/dashboard`, { headers }),
      fetch(`${API}/firm/traders`, { headers }),
      fetch(`${API}/firm/risk-events`, { headers }),
      fetch(`${API}/firm/webhook-info`, { headers }),
      fetch(`${API}/firm/programs`, { headers }),
      fetch(`${API}/firm/challenges`, { headers }),
    ]);
    if (dashRes.ok) { const d = await dashRes.json(); setDashboard(d); setRules(d.rules); }
    if (tradersRes.ok) setTraders(await tradersRes.json());
    if (eventsRes.ok) setRiskEvents(await eventsRes.json());
    if (webhookRes.ok) setWebhookInfo(await webhookRes.json());
    if (programsRes.ok) {
      const progs = await programsRes.json();
      setPrograms(progs);
      if (selectedProgram) {
        const updated = progs.find((p: any) => p.id === selectedProgram.id);
        if (updated) setSelectedProgram(updated);
      }
    }
    if (challengesRes.ok) setChallenges(await challengesRes.json());
  };

  const createProgram = async () => {
    await fetch(`${API}/firm/programs`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h() }, body: JSON.stringify(newProgram) });
    setShowNewProgram(false);
    setNewProgram({ name: '', type: 'one_step', description: '' });
    loadAll(token());
  };

  const deleteProgram = async (id: string) => {
    if (!confirm('Delete this program?')) return;
    await fetch(`${API}/firm/programs/${id}`, { method: 'DELETE', headers: h() });
    setSelectedProgram(null);
    setPage('programs');
    loadAll(token());
  };

  const openAddPhase = (order: number, type = 'evaluation') => {
    setPhaseForm({ ...defaultPhase, phase_order: order, phase_type: type, name: type === 'funded' ? 'Funded Account' : `Phase ${order}` });
    setEditingPhase(null);
    setShowPhaseModal(true);
  };

  const openEditPhase = (phase: any) => {
    setPhaseForm({ ...phase });
    setEditingPhase(phase);
    setShowPhaseModal(true);
  };

  const savePhase = async () => {
    if (!selectedProgram) return;
    setSaving(true);
    await fetch(`${API}/firm/programs/${selectedProgram.id}/phases`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...h() }, body: JSON.stringify(phaseForm)
    });
    setSaving(false);
    setShowPhaseModal(false);
    loadAll(token());
  };

  const deletePhase = async (order: number) => {
    if (!selectedProgram) return;
    await fetch(`${API}/firm/programs/${selectedProgram.id}/phases/${order}`, { method: 'DELETE', headers: h() });
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

  const copy = (text: string, key: string) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 2000); };

  const Toggle = ({ checked, onChange, label, hint }: any) => (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <div className="text-sm text-gray-700">{label}</div>
        {hint && <div className="text-xs text-gray-400">{hint}</div>}
      </div>
      <button onClick={() => onChange(!checked)} className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-gray-900' : 'bg-gray-200'}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );

  const Inp = ({ label, value, onChange, type = 'text', hint = '' }: any) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
    </div>
  );

  const stats = dashboard?.stats;

  const navItems = [
    { key: 'overview', icon: '⬡', label: 'Overview' },
    { key: 'programs', icon: '◈', label: 'Programs', badge: programs.length },
    { key: 'traders', icon: '◉', label: 'Traders', badge: traders.length },
    { key: 'challenges', icon: '◎', label: 'Challenges', badge: challenges.length },
    { key: 'rules', icon: '◇', label: 'Risk Rules' },
    { key: 'breaches', icon: '◬', label: 'Breaches', badge: riskEvents.length || undefined },
    { key: 'webhook', icon: '◌', label: 'Webhook' },
  ];

  const PhaseCard = ({ phase, onEdit, onDelete }: any) => {
    const isFunded = phase.phase_type === 'funded';
    return (
      <div className={`border rounded-xl p-4 ${isFunded ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${isFunded ? 'bg-green-600 text-white' : 'bg-gray-900 text-white'}`}>
              {isFunded ? 'FUNDED' : `P${phase.phase_order}`}
            </span>
            <span className="text-sm font-medium text-gray-900">{phase.name}</span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => onEdit(phase)} className="text-xs border border-gray-200 px-2 py-1 rounded hover:bg-gray-50 text-gray-500">Edit</button>
            <button onClick={() => onDelete(phase.phase_order)} className="text-xs border border-red-200 px-2 py-1 rounded hover:bg-red-50 text-red-500">×</button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            ['Balance', `$${parseFloat(phase.balance).toLocaleString()}`, 'text-gray-900'],
            ['Target', phase.profit_target_pct > 0 ? `${phase.profit_target_pct}%` : '—', 'text-green-600'],
            ['Daily Loss', `${phase.max_daily_loss_pct}%`, 'text-red-500'],
            ['Drawdown', `${phase.max_drawdown_pct}%`, 'text-orange-500'],
            ['Min Days', phase.min_trading_days, 'text-gray-600'],
            ['Max Trades', phase.max_open_trades, 'text-gray-600'],
            ['Lot Size', phase.max_lot_size > 0 ? `${phase.max_lot_size}` : '∞', 'text-gray-600'],
            ['Days/Wk', phase.min_trading_days_per_week > 0 ? phase.min_trading_days_per_week : '—', 'text-gray-600'],
          ].map(([k, v, c]) => (
            <div key={k as string} className="bg-white/70 rounded-lg p-2">
              <div className="text-xs text-gray-400">{k}</div>
              <div className={`text-xs font-mono font-semibold mt-0.5 ${c}`}>{v}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {phase.consistency_rule_enabled && <span className="text-xs bg-purple-50 border border-purple-200 text-purple-600 px-2 py-0.5 rounded-full">Consistency {phase.consistency_pct}%</span>}
          {phase.news_trading_allowed && <span className="text-xs bg-gray-50 border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full">News ✓</span>}
          {phase.weekend_holding_allowed && <span className="text-xs bg-gray-50 border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Weekend ✓</span>}
          {phase.copy_trading_allowed && <span className="text-xs bg-gray-50 border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Copy ✓</span>}
          {phase.ea_trading_allowed && <span className="text-xs bg-gray-50 border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full">EA ✓</span>}
        </div>
      </div>
    );
  };

  const ProgramDetail = ({ program }: any) => {
    const ptype = PROGRAM_TYPES[program.type] || PROGRAM_TYPES.one_step;
    const evalPhases = program.phases?.filter((p: any) => p.phase_type === 'evaluation') || [];
    const fundedPhase = program.phases?.find((p: any) => p.phase_type === 'funded');
    const maxEvalPhases = program.type === 'one_step' ? 1 : program.type === 'two_step' ? 2 : program.type === 'three_step' ? 3 : 0;
    const canAddEval = program.type !== 'instant_funded' && evalPhases.length < maxEvalPhases;
    const canAddFunded = !fundedPhase;

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ptype.color}`}>{ptype.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${program.is_active ? 'border-green-200 text-green-600 bg-green-50' : 'border-gray-200 text-gray-400'}`}>
                  {program.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{program.name}</h2>
              {program.description && <p className="text-sm text-gray-400 mt-0.5">{program.description}</p>}
            </div>
            <button onClick={() => deleteProgram(program.id)} className="text-xs border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg">Delete Program</button>
          </div>

          {/* Flow visualization */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
            <div className="text-xs font-medium text-gray-500 mb-3">PROGRAM FLOW</div>
            <div className="flex items-center gap-2 flex-wrap">
              {program.type === 'instant_funded' ? (
                <div className="flex items-center gap-2">
                  <div className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg font-medium">Purchase</div>
                  <span className="text-gray-400">→</span>
                  <div className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium">Funded Account</div>
                </div>
              ) : (
                <>
                  <div className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg font-medium">Purchase</div>
                  {Array.from({ length: maxEvalPhases }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-gray-400">→</span>
                      <div className={`text-xs px-3 py-1.5 rounded-lg font-medium border ${evalPhases[i] ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-dashed border-gray-300 text-gray-400'}`}>
                        {evalPhases[i] ? evalPhases[i].name : `Phase ${i + 1}`}
                      </div>
                    </div>
                  ))}
                  <span className="text-gray-400">→</span>
                  <div className={`text-xs px-3 py-1.5 rounded-lg font-medium border ${fundedPhase ? 'bg-green-50 border-green-200 text-green-700' : 'border-dashed border-gray-300 text-gray-400'}`}>
                    {fundedPhase ? fundedPhase.name : 'Funded Account'}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Evaluation Phases */}
          {program.type !== 'instant_funded' && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Evaluation Phases</h3>
                {canAddEval && (
                  <button onClick={() => openAddPhase(evalPhases.length + 1, 'evaluation')}
                    className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700">
                    + Add Phase {evalPhases.length + 1}
                  </button>
                )}
              </div>
              {evalPhases.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                  <p className="text-sm text-gray-400 mb-3">No evaluation phase configured</p>
                  <button onClick={() => openAddPhase(1, 'evaluation')} className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg">Configure Phase 1</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {evalPhases.map((phase: any) => (
                    <div key={phase.id}>
                      <PhaseCard phase={phase} onEdit={openEditPhase} onDelete={deletePhase} />
                      {evalPhases.indexOf(phase) < evalPhases.length - 1 && (
                        <div className="flex items-center justify-center py-2 text-gray-400 text-sm">↓ pass to next phase</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Funded Phase */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                {program.type === 'instant_funded' ? 'Funded Account Rules' : 'Funded Account (After Passing)'}
              </h3>
              {canAddFunded && (
                <button onClick={() => openAddPhase(evalPhases.length + 1, 'funded')}
                  className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-500">
                  + Configure Funded Rules
                </button>
              )}
            </div>
            {!fundedPhase ? (
              <div className="border-2 border-dashed border-green-200 rounded-xl p-8 text-center">
                <p className="text-sm text-gray-400 mb-3">Funded account rules not set</p>
                <button onClick={() => openAddPhase(evalPhases.length + 1, 'funded')} className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg">Set Funded Rules</button>
              </div>
            ) : (
              <PhaseCard phase={fundedPhase} onEdit={openEditPhase} onDelete={deletePhase} />
            )}
          </div>

          {/* Webhook snippet */}
          {webhookInfo && (
            <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-medium text-gray-500 mb-2">WEBHOOK — USE THIS PROGRAM ID</div>
              <div className="flex gap-2">
                <code className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 break-all">
                  {`{"action":"create_challenge","program_id":"${program.id}","email":"trader@example.com","balance":10000}`}
                </code>
                <button onClick={() => copy(`{"action":"create_challenge","program_id":"${program.id}","email":"trader@example.com","balance":10000}`, 'snippet')}
                  className="border border-gray-200 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-white whitespace-nowrap">
                  {copied === 'snippet' ? '✓' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar */}
      <div className="w-56 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">{dashboard?.firm?.name?.[0] || 'F'}</span>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-900 leading-tight">{dashboard?.firm?.name}</div>
              <div className="text-xs text-gray-400 font-mono">{dashboard?.firm?.server_name}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map(item => (
            <button key={item.key}
              onClick={() => { setPage(item.key); setSelectedProgram(null); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                page === item.key && !selectedProgram ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}>
              <div className="flex items-center gap-2.5">
                <span className="text-base">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${page === item.key && !selectedProgram ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-2 border-t border-gray-100">
          <div className="px-3 py-2 text-xs text-gray-400">{user?.email}</div>
          <button onClick={() => { localStorage.clear(); router.push('/'); }}
            className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-lg">Logout</button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">

        {/* Programs list (sub-sidebar when on programs page) */}
        {(page === 'programs' || selectedProgram) && (
          <div className="w-64 border-r border-gray-100 flex flex-col bg-gray-50/50">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-900">Programs</h3>
              <button onClick={() => setShowNewProgram(true)}
                className="text-xs bg-gray-900 text-white px-2.5 py-1 rounded-lg">+ New</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {programs.map(prog => {
                const ptype = PROGRAM_TYPES[prog.type] || PROGRAM_TYPES.one_step;
                const isSelected = selectedProgram?.id === prog.id;
                return (
                  <button key={prog.id} onClick={() => { setSelectedProgram(prog); setPage('programs'); }}
                    className={`w-full text-left p-3 rounded-xl transition-all ${isSelected ? 'bg-white border border-gray-200 shadow-sm' : 'hover:bg-white'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${ptype.color}`}>{ptype.label}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${prog.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                    </div>
                    <div className="text-sm font-medium text-gray-900">{prog.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {prog.phases?.length || 0} phase{prog.phases?.length !== 1 ? 's' : ''} configured
                    </div>
                  </button>
                );
              })}
              {programs.length === 0 && (
                <div className="text-center py-8 text-xs text-gray-400">No programs yet</div>
              )}
            </div>
          </div>
        )}

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          {/* OVERVIEW */}
          {page === 'overview' && !selectedProgram && (
            <div className="p-6 space-y-6">
              <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
              <div className="grid grid-cols-3 gap-4">
                {[
                  ['Active Traders', stats?.active_traders, ''],
                  ['Open Positions', stats?.open_positions, ''],
                  ['Float PnL', `${parseFloat(stats?.total_floating_pnl||0)>=0?'+':''}${parseFloat(stats?.total_floating_pnl||0).toFixed(2)}`, parseFloat(stats?.total_floating_pnl||0)>=0?'text-green-600':'text-red-500'],
                  ['Programs', programs.length, ''],
                  ['Active Accounts', stats?.active_accounts, ''],
                  ['Breaches Today', stats?.breaches_today, parseInt(stats?.breaches_today||0)>0?'text-red-500':''],
                ].map(([k,v,c]) => (
                  <div key={k as string} className="border border-gray-200 rounded-xl p-4 bg-white">
                    <div className="text-xs text-gray-400 mb-2">{k}</div>
                    <div className={`text-2xl font-semibold ${c||'text-gray-900'}`}>{v}</div>
                  </div>
                ))}
              </div>

              <div className="border border-gray-200 rounded-xl p-5 bg-white">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-semibold">Challenge Programs</h2>
                  <button onClick={() => setPage('programs')} className="text-xs text-gray-500 hover:text-gray-900">Manage →</button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {programs.map(prog => {
                    const ptype = PROGRAM_TYPES[prog.type] || PROGRAM_TYPES.one_step;
                    return (
                      <button key={prog.id} onClick={() => { setSelectedProgram(prog); setPage('programs'); }}
                        className="text-left border border-gray-200 rounded-xl p-4 hover:border-gray-400 hover:shadow-sm transition-all">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ptype.color}`}>{ptype.label}</span>
                        <div className="text-sm font-medium text-gray-900 mt-2">{prog.name}</div>
                        <div className="text-xs text-gray-400 mt-1">{prog.phases?.length || 0} phases · {prog.is_active ? 'Active' : 'Inactive'}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* PROGRAMS - detail */}
          {page === 'programs' && selectedProgram && <ProgramDetail program={selectedProgram} />}

          {/* PROGRAMS - no selection */}
          {page === 'programs' && !selectedProgram && (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select a program from the list
            </div>
          )}

          {/* TRADERS */}
          {page === 'traders' && (
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h1 className="text-xl font-semibold">Traders</h1>
                <button onClick={() => setShowCreateTrader(true)} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm">+ Create Trader</button>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">{['Trader','Code','Balance','Equity','Float PnL','Open','Status','Action'].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                  <tbody>
                    {traders.map(t=>(
                      <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3"><div className="font-medium text-xs">{t.full_name}</div><div className="text-xs text-gray-400">{t.email}</div></td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.trader_code}</td>
                        <td className="px-4 py-3 font-mono text-xs">${parseFloat(t.current_balance||0).toLocaleString('en',{minimumFractionDigits:2})}</td>
                        <td className="px-4 py-3 font-mono text-xs">${parseFloat(t.equity||0).toLocaleString('en',{minimumFractionDigits:2})}</td>
                        <td className={`px-4 py-3 font-mono text-xs font-semibold ${parseFloat(t.floating_pnl)>=0?'text-green-600':'text-red-500'}`}>{parseFloat(t.floating_pnl)>=0?'+':''}{parseFloat(t.floating_pnl).toFixed(2)}</td>
                        <td className="px-4 py-3 text-xs">{t.open_trades}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${t.is_active?'border-green-200 bg-green-50 text-green-600':'border-red-200 bg-red-50 text-red-500'}`}>{t.is_active?'Active':'Disabled'}</span></td>
                        <td className="px-4 py-3"><button onClick={()=>fetch(`${API}/firm/traders/${t.id}/toggle`,{method:'PATCH',headers:h()}).then(()=>loadAll(token()))} className={`text-xs px-3 py-1 rounded-lg border ${t.is_active?'border-red-200 text-red-500':'border-green-200 text-green-600'}`}>{t.is_active?'Disable':'Enable'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {traders.length===0&&<div className="text-center py-8 text-sm text-gray-400">No traders yet.</div>}
              </div>
            </div>
          )}

          {/* CHALLENGES */}
          {page === 'challenges' && (
            <div className="p-6 space-y-4">
              <h1 className="text-xl font-semibold">Challenges</h1>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">{['Trader','Phase','Account','Balance','Profit','Target','Status','Started'].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                  <tbody>
                    {challenges.map(c=>{
                      const profit=parseFloat(c.actual_profit_pct||0);
                      const target=parseFloat(c.profit_target_pct||0);
                      return(
                        <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3"><div className="text-xs font-medium">{c.trader_name}</div><div className="text-xs text-gray-400">{c.trader_email}</div></td>
                          <td className="px-4 py-3"><span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded font-mono">P{c.phase_number}</span></td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.broker_account_id}</td>
                          <td className="px-4 py-3 font-mono text-xs">${parseFloat(c.current_balance||0).toLocaleString('en',{minimumFractionDigits:2})}</td>
                          <td className={`px-4 py-3 font-mono text-xs font-semibold ${profit>=0?'text-green-600':'text-red-500'}`}>{profit>=0?'+':''}{profit.toFixed(2)}%</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{target>0?`${target}%`:'—'}</td>
                          <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${c.status==='PASSED'?'border-green-200 bg-green-50 text-green-600':c.status==='FAILED'?'border-red-200 bg-red-50 text-red-500':'border-blue-200 bg-blue-50 text-blue-600'}`}>{c.status}</span></td>
                          <td className="px-4 py-3 text-xs text-gray-400">{new Date(c.started_at).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {challenges.length===0&&<div className="text-center py-8 text-sm text-gray-400">No challenges yet.</div>}
              </div>
            </div>
          )}

          {/* RISK RULES */}
          {page === 'rules' && rules && (
            <div className="p-6 max-w-lg">
              <h1 className="text-xl font-semibold mb-1">Risk Rules</h1>
              <p className="text-sm text-gray-400 mb-6">Global defaults for all accounts on <span className="font-mono">{dashboard?.firm?.server_name}</span></p>
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                {[['Max Daily Loss %','max_daily_loss_pct','e.g. 5 = 5% per day'],['Max Drawdown %','max_drawdown_pct','e.g. 10 = 10% from peak'],['Max Position Size (lots)','max_position_size','e.g. 1 = 1 lot max'],['Max Open Trades','max_open_trades','e.g. 10 positions max']].map(([label,key,hint])=>(
                  <Inp key={key} label={label} value={rules[key]||''} onChange={(v:string)=>setRules({...rules,[key]:v})} type="number" hint={hint} />
                ))}
                <button onClick={saveRules} disabled={saving} className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium">{saving?'Saving...':'Save Rules'}</button>
              </div>
            </div>
          )}

          {/* BREACHES */}
          {page === 'breaches' && (
            <div className="p-6 space-y-4">
              <h1 className="text-xl font-semibold">Risk Events</h1>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">{['Trader','Event','Severity','Value','Limit','Time'].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>)}</tr></thead>
                  <tbody>
                    {riskEvents.map(e=>(
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
                {riskEvents.length===0&&<div className="text-center py-8 text-sm text-gray-400">No risk events.</div>}
              </div>
            </div>
          )}

          {/* WEBHOOK */}
          {page === 'webhook' && webhookInfo && (
            <div className="p-6 max-w-2xl space-y-4">
              <h1 className="text-xl font-semibold">Webhook Integration</h1>
              <p className="text-sm text-gray-400">Auto-create accounts from your website on purchase.</p>
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                {[['Webhook URL', webhookInfo.webhook_url, 'url'],['Secret Key', webhookInfo.secret, 'secret']].map(([label,val,key])=>(
                  <div key={key}>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</label>
                    {key==='secret'&&<p className="text-xs text-gray-400 mb-1.5">Send as header: <code className="bg-gray-100 px-1 rounded text-xs">x-webhook-secret</code></p>}
                    <div className="flex gap-2 mt-1.5">
                      <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 break-all">{val}</code>
                      <button onClick={()=>copy(val,key)} className="border border-gray-200 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-50 whitespace-nowrap">{copied===key?'✓':'Copy'}</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-3">Webhook Payload (include program_id)</h3>
                <div className="space-y-3">
                  {programs.map(prog=>(
                    <div key={prog.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-gray-700">{prog.name}</span>
                        <button onClick={()=>copy(`{"action":"create_challenge","program_id":"${prog.id}","email":"trader@example.com","balance":10000}`,prog.id)} className="text-xs text-gray-400 hover:text-gray-700">{copied===prog.id?'✓ Copied':'Copy'}</button>
                      </div>
                      <code className="text-xs text-gray-600 font-mono">{`{"action":"create_challenge","program_id":"${prog.id}","email":"...","balance":10000}`}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Program Modal */}
      {showNewProgram && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="font-semibold mb-4">Create Program</h2>
            <div className="space-y-3">
              <Inp label="Program Name" value={newProgram.name} onChange={(v:string)=>setNewProgram({...newProgram,name:v})} />
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Type</label>
                <select value={newProgram.type} onChange={e=>setNewProgram({...newProgram,type:e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400">
                  <option value="one_step">One-Step Evaluation</option>
                  <option value="two_step">Two-Step Evaluation</option>
                  <option value="three_step">Three-Step Evaluation</option>
                  <option value="instant_funded">Instant Funded</option>
                </select>
              </div>
              <Inp label="Description (optional)" value={newProgram.description} onChange={(v:string)=>setNewProgram({...newProgram,description:v})} />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowNewProgram(false)} className="flex-1 border border-gray-200 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={createProgram} className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Phase Modal */}
      {showPhaseModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-4 shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold">{editingPhase ? `Edit ${editingPhase.name}` : phaseForm.phase_type === 'funded' ? 'Configure Funded Account' : `Add Phase ${phaseForm.phase_order}`}</h2>
              <button onClick={()=>setShowPhaseModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Basic</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Inp label="Phase Name" value={phaseForm.name} onChange={(v:string)=>setPhaseForm({...phaseForm,name:v})} />
                  <Inp label="Balance ($)" value={phaseForm.balance} onChange={(v:string)=>setPhaseForm({...phaseForm,balance:v})} type="number" />
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Financial Rules</h3>
                <div className="grid grid-cols-3 gap-3">
                  <Inp label="Profit Target %" value={phaseForm.profit_target_pct} onChange={(v:string)=>setPhaseForm({...phaseForm,profit_target_pct:v})} type="number" hint="0 = no target" />
                  <Inp label="Max Daily Loss %" value={phaseForm.max_daily_loss_pct} onChange={(v:string)=>setPhaseForm({...phaseForm,max_daily_loss_pct:v})} type="number" />
                  <Inp label="Max Drawdown %" value={phaseForm.max_drawdown_pct} onChange={(v:string)=>setPhaseForm({...phaseForm,max_drawdown_pct:v})} type="number" />
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Trading Rules</h3>
                <div className="grid grid-cols-3 gap-3">
                  <Inp label="Min Trading Days" value={phaseForm.min_trading_days} onChange={(v:string)=>setPhaseForm({...phaseForm,min_trading_days:v})} type="number" />
                  <Inp label="Min Days/Week" value={phaseForm.min_trading_days_per_week} onChange={(v:string)=>setPhaseForm({...phaseForm,min_trading_days_per_week:v})} type="number" hint="0 = no min" />
                  <Inp label="Max Open Trades" value={phaseForm.max_open_trades} onChange={(v:string)=>setPhaseForm({...phaseForm,max_open_trades:v})} type="number" />
                  <Inp label="Max Lot Size" value={phaseForm.max_lot_size} onChange={(v:string)=>setPhaseForm({...phaseForm,max_lot_size:v})} type="number" hint="0 = no limit" />
                </div>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                <Toggle checked={phaseForm.consistency_rule_enabled} onChange={(v:boolean)=>setPhaseForm({...phaseForm,consistency_rule_enabled:v})} label="Consistency Rule" hint="No single day can exceed X% of total profit" />
                {phaseForm.consistency_rule_enabled && (
                  <div className="mt-3">
                    <Inp label="Consistency %" value={phaseForm.consistency_pct} onChange={(v:string)=>setPhaseForm({...phaseForm,consistency_pct:v})} type="number" hint="e.g. 30 = no day > 30% of total profit" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Permissions</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 divide-y divide-gray-100">
                  <Toggle checked={phaseForm.news_trading_allowed} onChange={(v:boolean)=>setPhaseForm({...phaseForm,news_trading_allowed:v})} label="News Trading" />
                  <Toggle checked={phaseForm.weekend_holding_allowed} onChange={(v:boolean)=>setPhaseForm({...phaseForm,weekend_holding_allowed:v})} label="Weekend Holding" />
                  <Toggle checked={phaseForm.copy_trading_allowed} onChange={(v:boolean)=>setPhaseForm({...phaseForm,copy_trading_allowed:v})} label="Copy Trading" />
                  <Toggle checked={phaseForm.ea_trading_allowed} onChange={(v:boolean)=>setPhaseForm({...phaseForm,ea_trading_allowed:v})} label="EA / Bot Trading" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
              <button onClick={()=>setShowPhaseModal(false)} className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={savePhase} disabled={saving} className="bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-700">
                {saving?'Saving...':editingPhase?'Save Changes':'Save Phase'}
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
                  {Object.entries(createdCreds).map(([k,v])=>(<div key={k} className="flex justify-between text-sm"><span className="text-gray-500 capitalize">{k}</span><span className="font-mono font-medium">{v as string}</span></div>))}
                </div>
                <button onClick={()=>{setCreatedCreds(null);setShowCreateTrader(false);setNewTrader({full_name:'',email:'',password:'',balance:'10000'});}} className="w-full mt-4 bg-gray-900 text-white py-2.5 rounded-lg text-sm">Done</button>
              </div>
            ) : (
              <div>
                <h2 className="font-semibold mb-4">Create Trader</h2>
                <div className="space-y-3">
                  {[['Full Name','full_name','text'],['Email','email','email'],['Password','password','password'],['Balance','balance','number']].map(([label,key,type])=>(
                    <Inp key={key} label={label} value={(newTrader as any)[key]} onChange={(v:string)=>setNewTrader({...newTrader,[key]:v})} type={type} />
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={()=>setShowCreateTrader(false)} className="flex-1 border border-gray-200 py-2.5 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                  <button onClick={createTrader} className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700">Create</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
