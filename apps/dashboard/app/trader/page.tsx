'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://35.200.170.189:3000') + '/api/v1';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://35.200.170.189:3000';

const PAIRS = [
  { symbol: 'EURUSD', pip: 0.0001, digits: 5, category: 'Forex' },
  { symbol: 'GBPUSD', pip: 0.0001, digits: 5, category: 'Forex' },
  { symbol: 'USDJPY', pip: 0.01,   digits: 3, category: 'Forex' },
  { symbol: 'XAUUSD', pip: 0.01,   digits: 2, category: 'Metals' },
  { symbol: 'BTCUSD', pip: 1,      digits: 2, category: 'Crypto' },
];

type Tab = 'chart' | 'positions' | 'account';

export default function TraderDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [accountId, setAccountId] = useState('');
  const [selectedPair, setSelectedPair] = useState(PAIRS[0]);
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [trades, setTrades] = useState<any[]>([]);
  const [candles, setCandles] = useState<any[]>([]);
  const [risk, setRisk] = useState<any>(null);
  const [volume, setVolume] = useState('0.01');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [loading, setLoading] = useState(false);
  const [tf, setTf] = useState('5');
  const [wsStatus, setWsStatus] = useState<'connecting'|'connected'|'disconnected'>('connecting');
  const [tab, setTab] = useState<Tab>('chart');
  const [showPairs, setShowPairs] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const chartRef = useRef<any>(null);
  const chartInstance = useRef<any>(null);
  const candleSeries = useRef<any>(null);
  const priceLine = useRef<any>(null);
  const tradeLines = useRef<any[]>([]);
  const socketRef = useRef<any>(null);

  const token = () => localStorage.getItem('token') || '';
  const currentPrice = prices[selectedPair.symbol] || { bid: 0, ask: 0, spread: 0 };
  const totalPnL = trades.reduce((s, t) => s + parseFloat(t.floating_pnl || 0), 0);

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (!t) { router.push('/'); return; }
    setUser(JSON.parse(u || '{}'));
    fetch(`${API}/trading/my-account`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json()).then(acc => { if (acc?.id) setAccountId(acc.id); });
  }, []);

  useEffect(() => {
    const connect = async () => {
      const { io } = await import('socket.io-client');
      const socket = io(WS_URL, { transports: ['websocket', 'polling'], reconnection: true });
      socketRef.current = socket;
      socket.on('connect', () => {
        setWsStatus('connected');
        socket.emit('subscribe', { symbols: PAIRS.map(p => p.symbol) });
      });
      socket.on('disconnect', () => setWsStatus('disconnected'));
      socket.on('prices', (updates: any[]) => {
        setPrices(prev => {
          const next = { ...prev };
          updates.forEach(u => { next[u.symbol] = { bid: u.bid, ask: u.ask, spread: u.spread }; });
          return next;
        });
      });
    };
    connect();
    return () => socketRef.current?.disconnect();
  }, []);

  useEffect(() => {
    if (!accountId) return;
    const poll = async () => {
      try {
        const [tradesRes, riskRes, candleRes] = await Promise.all([
          fetch(`${API}/trading/open/${accountId}`),
          fetch(`${API}/trading/risk/${accountId}`),
          fetch(`${API}/trading/candles/${selectedPair.symbol}?tf=${tf}&limit=200`),
        ]);
        if (tradesRes.ok) setTrades(await tradesRes.json());
        if (riskRes.ok) setRisk(await riskRes.json());
        if (candleRes.ok) setCandles(await candleRes.json());
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, [accountId, tf, selectedPair.symbol]);

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.remove();
      chartInstance.current = null;
      candleSeries.current = null;
      priceLine.current = null;
      tradeLines.current = [];
    }
    setCandles([]);
  }, [selectedPair.symbol]);

  useEffect(() => {
    if (!chartRef.current || !candles.length) return;
    const init = async () => {
      const { createChart } = await import('lightweight-charts');
      if (!chartInstance.current) {
        chartInstance.current = createChart(chartRef.current, {
          width: chartRef.current.clientWidth,
          height: chartRef.current.clientHeight || 340,
          layout: { background: { color: '#fafafa' }, textColor: '#374151' },
          grid: { vertLines: { color: '#f3f4f6' }, horzLines: { color: '#f3f4f6' } },
          crosshair: { mode: 1 },
          rightPriceScale: { borderColor: '#e5e7eb', scaleMargins: { top: 0.1, bottom: 0.1 } },
          timeScale: { borderColor: '#e5e7eb', timeVisible: true, secondsVisible: false },
          handleScroll: true, handleScale: true,
        });
        candleSeries.current = chartInstance.current.addCandlestickSeries({
          upColor: '#111827', downColor: '#9ca3af',
          borderUpColor: '#111827', borderDownColor: '#9ca3af',
          wickUpColor: '#111827', wickDownColor: '#9ca3af',
          priceFormat: { type: 'price', precision: selectedPair.digits, minMove: selectedPair.pip },
        });
      }
      candleSeries.current.setData(candles.map((c: any) => ({
        time: Math.floor(c.time / 1000) as any,
        open: c.open, high: c.high, low: c.low, close: c.close,
      })));
      if (currentPrice.bid) {
        if (priceLine.current) { try { candleSeries.current.removePriceLine(priceLine.current); } catch {} }
        priceLine.current = candleSeries.current.createPriceLine({
          price: currentPrice.bid, color: '#111827', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'BID',
        });
      }
      tradeLines.current.forEach(l => { try { candleSeries.current.removePriceLine(l); } catch {} });
      tradeLines.current = [];
      trades.filter((t: any) => t.symbol === selectedPair.symbol).forEach((t: any) => {
        const pnl = parseFloat(t.floating_pnl);
        tradeLines.current.push(candleSeries.current.createPriceLine({
          price: Number(t.open_price), color: t.side === 'BUY' ? '#111827' : '#6b7280',
          lineWidth: 1, lineStyle: 1, axisLabelVisible: true,
          title: `${t.side} ${pnl>=0?'+':''}${pnl.toFixed(2)}`,
        }));
      });
    };
    init();
  }, [candles, trades]);

  useEffect(() => {
    if (!candleSeries.current || !currentPrice.bid) return;
    try {
      if (priceLine.current) candleSeries.current.removePriceLine(priceLine.current);
      priceLine.current = candleSeries.current.createPriceLine({
        price: currentPrice.bid, color: '#111827', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'BID',
      });
    } catch {}
  }, [currentPrice.bid]);

  const placeTrade = async (side: 'BUY' | 'SELL') => {
    if (!accountId) return;
    setLoading(true);
    try {
      const openPrice = side === 'BUY' ? currentPrice.ask : currentPrice.bid;
      await fetch(`${API}/trading/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          account_id: accountId, symbol: selectedPair.symbol, side,
          volume: parseFloat(volume), open_price: openPrice,
          sl_price: sl ? parseFloat(sl) : null,
          tp_price: tp ? parseFloat(tp) : null,
        })
      });
      setSl(''); setTp('');
      setShowOrder(false);
    } catch {}
    setLoading(false);
  };

  const closeTrade = async (id: string) => {
    const trade = trades.find(t => t.id === id);
    const closePrice = prices[trade?.symbol || selectedPair.symbol]?.bid || currentPrice.bid;
    try {
      await fetch(`${API}/trading/close/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ close_price: closePrice })
      });
    } catch {}
  };

  const RiskBar = ({ label, value, max, color }: any) => {
    const pct = Math.min(100, (parseFloat(value) / parseFloat(max)) * 100);
    return (
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">{label}</span>
          <span className={pct >= 80 ? 'text-red-500 font-bold' : 'text-gray-600 font-mono'}>{parseFloat(value).toFixed(2)}% / {parseFloat(max).toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct >= 80 ? '#ef4444' : pct >= 50 ? '#f59e0b' : color }} />
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <button onClick={() => setShowPairs(true)} className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{selectedPair.symbol}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        <div className="flex items-center gap-2">
          {currentPrice.bid > 0 && (
            <>
              <span className="text-xs font-mono text-red-500">{Number(currentPrice.bid).toFixed(selectedPair.digits)}</span>
              <span className="text-xs text-gray-200">/</span>
              <span className="text-xs font-mono text-green-600">{Number(currentPrice.ask).toFixed(selectedPair.digits)}</span>
            </>
          )}
          <span className={`w-2 h-2 rounded-full ${wsStatus==='connected'?'bg-green-400':'bg-gray-300'}`} />
        </div>
        <button onClick={() => { localStorage.clear(); router.push('/'); }} className="text-xs text-gray-400">Exit</button>
      </div>

      {/* TF bar */}
      {tab === 'chart' && (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 shrink-0 overflow-x-auto">
          {[['1','M1'],['5','M5'],['15','M15'],['30','M30'],['60','H1']].map(([v,l]) => (
            <button key={v} onClick={() => setTf(v)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${tf===v?'bg-gray-900 text-white':'text-gray-400'}`}>
              {l}
            </button>
          ))}
          {trades.length > 0 && (
            <span className={`ml-auto text-xs font-mono font-semibold whitespace-nowrap ${totalPnL>=0?'text-green-600':'text-red-500'}`}>
              {totalPnL>=0?'+':''}{totalPnL.toFixed(2)}
            </span>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden relative">
        {tab === 'chart' && (
          <div ref={chartRef} className="w-full" style={{ height: '100%' }} />
        )}

        {tab === 'positions' && (
          <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <span className="text-sm font-semibold">Positions ({trades.length})</span>
              <span className={`text-sm font-mono font-semibold ${totalPnL>=0?'text-green-600':'text-red-500'}`}>{totalPnL>=0?'+':''}{totalPnL.toFixed(2)}</span>
            </div>
            {trades.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-300">
                <div className="text-4xl mb-2">◎</div>
                <div className="text-sm">No open positions</div>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {trades.map(t => {
                  const pnl = parseFloat(t.floating_pnl || 0);
                  const pair = PAIRS.find(p => p.symbol === t.symbol);
                  return (
                    <div key={t.id} className="px-4 py-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-900">{t.symbol}</span>
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${t.side==='BUY'?'bg-gray-900 text-white':'bg-gray-100 text-gray-600'}`}>{t.side}</span>
                          <span className="text-xs text-gray-400 font-mono">{t.volume} lot</span>
                        </div>
                        <span className={`text-sm font-mono font-bold ${pnl>=0?'text-green-600':'text-red-500'}`}>{pnl>=0?'+':''}{pnl.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex gap-3 text-xs text-gray-400">
                          <span>@ {Number(t.open_price).toFixed(pair?.digits||5)}</span>
                          {t.sl_price && Number(t.sl_price)>0 && <span className="text-red-400">SL {Number(t.sl_price).toFixed(pair?.digits||5)}</span>}
                          {t.tp_price && Number(t.tp_price)>0 && <span className="text-green-500">TP {Number(t.tp_price).toFixed(pair?.digits||5)}</span>}
                        </div>
                        <button onClick={() => closeTrade(t.id)}
                          className="text-xs border border-gray-200 hover:bg-gray-900 hover:text-white hover:border-gray-900 px-3 py-1 rounded-lg transition-all">
                          Close
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'account' && (
          <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
            {/* Account stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Balance', `$${parseFloat(risk?.balance||'0').toLocaleString('en',{minimumFractionDigits:2})}`, ''],
                ['Equity', `$${parseFloat(risk?.equity||'0').toLocaleString('en',{minimumFractionDigits:2})}`, ''],
                ['Float PnL', `${totalPnL>=0?'+':''}${totalPnL.toFixed(2)}`, totalPnL>=0?'text-green-600':'text-red-500'],
                ['Positions', `${trades.length}/${risk?.max_open_trades||10}`, ''],
              ].map(([k,v,c]) => (
                <div key={k as string} className="border border-gray-200 rounded-xl p-3">
                  <div className="text-xs text-gray-400 mb-1">{k}</div>
                  <div className={`text-base font-semibold font-mono ${c||'text-gray-900'}`}>{v}</div>
                </div>
              ))}
            </div>

            {/* Risk */}
            {risk && (
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Risk Limits</div>
                <RiskBar label="Daily Loss" value={risk.daily_loss_pct} max={risk.max_daily_loss_pct} color="#111827" />
                <RiskBar label="Drawdown" value={risk.drawdown_pct} max={risk.max_drawdown_pct} color="#374151" />
                {risk.status === 'BREACHED' && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center font-medium">⚠ Account Breached</div>
                )}
              </div>
            )}

            {/* User info */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Account</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Email</span><span className="text-gray-700">{user?.email}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Server</span><span className="font-mono text-gray-700">{user?.server_name}</span></div>
              </div>
            </div>

            <button onClick={() => router.push('/trader/history')}
              className="w-full border border-gray-200 rounded-xl py-3 text-sm text-gray-600 hover:bg-gray-50 transition-all">
              View Trade History →
            </button>
            <button onClick={() => { localStorage.clear(); router.push('/'); }}
              className="w-full border border-red-200 rounded-xl py-3 text-sm text-red-500 hover:bg-red-50 transition-all">
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="border-t border-gray-100 grid grid-cols-4 shrink-0 bg-white">
        {[
          { key: 'chart', icon: '📈', label: 'Chart' },
          { key: 'trade', icon: '⚡', label: 'Trade', action: () => setShowOrder(true) },
          { key: 'positions', icon: '◎', label: `Trades${trades.length>0?` (${trades.length})`:''}` },
          { key: 'account', icon: '◉', label: 'Account' },
        ].map(item => (
          <button key={item.key}
            onClick={() => item.action ? item.action() : setTab(item.key as Tab)}
            className={`flex flex-col items-center justify-center py-3 gap-0.5 transition-colors ${
              tab === item.key && !item.action ? 'text-gray-900' : 'text-gray-400'
            }`}>
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Pairs sheet */}
      {showPairs && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setShowPairs(false)}>
          <div className="bg-white rounded-t-2xl max-h-[70vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold">Select Pair</span>
              <button onClick={() => setShowPairs(false)} className="text-gray-400 text-xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto">
              {['Forex','Metals','Crypto'].map(cat => (
                <div key={cat}>
                  <div className="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-50">{cat}</div>
                  {PAIRS.filter(p => p.category === cat).map(pair => {
                    const p = prices[pair.symbol];
                    const isSelected = selectedPair.symbol === pair.symbol;
                    return (
                      <button key={pair.symbol}
                        onClick={() => { setSelectedPair(pair); setShowPairs(false); setTab('chart'); }}
                        className={`w-full flex justify-between items-center px-4 py-3 border-b border-gray-50 ${isSelected ? 'bg-gray-50' : ''}`}>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{pair.symbol}</span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />}
                        </div>
                        {p ? (
                          <div className="flex gap-3">
                            <span className="text-sm font-mono text-red-500">{Number(p.bid).toFixed(pair.digits)}</span>
                            <span className="text-sm font-mono text-green-600">{Number(p.ask).toFixed(pair.digits)}</span>
                          </div>
                        ) : <span className="text-xs text-gray-300">No feed</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Order sheet */}
      {showOrder && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setShowOrder(false)}>
          <div className="bg-white rounded-t-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
              <div>
                <span className="text-sm font-semibold">{selectedPair.symbol}</span>
                {currentPrice.bid > 0 && (
                  <span className="text-xs text-gray-400 ml-2">{currentPrice.spread} pip spread</span>
                )}
              </div>
              <button onClick={() => setShowOrder(false)} className="text-gray-400 text-xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-3">
              {/* BUY/SELL */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => placeTrade('SELL')} disabled={loading || !currentPrice.bid}
                  className="rounded-xl border-2 border-red-200 p-4 text-center active:bg-red-500 active:text-white active:border-red-500 transition-all disabled:opacity-40">
                  <div className="text-xs text-red-500 font-medium mb-1">SELL</div>
                  <div className="text-xl font-bold font-mono text-red-500">{currentPrice.bid > 0 ? Number(currentPrice.bid).toFixed(selectedPair.digits) : '—'}</div>
                </button>
                <button onClick={() => placeTrade('BUY')} disabled={loading || !currentPrice.ask}
                  className="rounded-xl border-2 border-green-200 p-4 text-center active:bg-green-500 active:text-white active:border-green-500 transition-all disabled:opacity-40">
                  <div className="text-xs text-green-600 font-medium mb-1">BUY</div>
                  <div className="text-xl font-bold font-mono text-green-600">{currentPrice.ask > 0 ? Number(currentPrice.ask).toFixed(selectedPair.digits) : '—'}</div>
                </button>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500">VOLUME (LOTS)</label>
                <div className="flex items-center gap-2 mt-1.5">
                  <button onClick={() => setVolume(v => Math.max(0.01, parseFloat(v)-0.01).toFixed(2))}
                    className="w-10 h-10 border border-gray-200 rounded-xl text-gray-600 text-lg font-bold flex items-center justify-center">−</button>
                  <input value={volume} onChange={e => setVolume(e.target.value)} type="number"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-center text-base font-mono font-semibold focus:outline-none focus:border-gray-400"
                    inputMode="decimal" />
                  <button onClick={() => setVolume(v => (parseFloat(v)+0.01).toFixed(2))}
                    className="w-10 h-10 border border-gray-200 rounded-xl text-gray-600 text-lg font-bold flex items-center justify-center">+</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">STOP LOSS</label>
                  <input value={sl} onChange={e => setSl(e.target.value)} placeholder="0.00000"
                    className="w-full mt-1.5 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-red-300"
                    inputMode="decimal" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">TAKE PROFIT</label>
                  <input value={tp} onChange={e => setTp(e.target.value)} placeholder="0.00000"
                    className="w-full mt-1.5 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-green-300"
                    inputMode="decimal" />
                </div>
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-400">
                  <span className="w-4 h-4 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                  Placing order...
                </div>
              )}
            </div>
            <div className="h-6 bg-white" />
          </div>
        </div>
      )}
    </div>
  );
}
