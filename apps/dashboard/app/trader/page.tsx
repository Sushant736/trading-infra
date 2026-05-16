'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://35.200.170.189:3000') + '/api/v1';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://35.200.170.189:3000';

export default function TraderDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [accountId, setAccountId] = useState('');
  const [price, setPrice] = useState<any>({ bid: 0, ask: 0, spread: 0 });
  const [trades, setTrades] = useState<any[]>([]);
  const [candles, setCandles] = useState<any[]>([]);
  const [risk, setRisk] = useState<any>(null);
  const [volume, setVolume] = useState('0.01');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [loading, setLoading] = useState(false);
  const [tf, setTf] = useState('1');
  const [wsStatus, setWsStatus] = useState<'connecting'|'connected'|'disconnected'>('connecting');
  const chartRef = useRef<any>(null);
  const chartInstance = useRef<any>(null);
  const candleSeries = useRef<any>(null);
  const priceLine = useRef<any>(null);
  const tradeLines = useRef<any[]>([]);
  const socketRef = useRef<any>(null);
  const accountIdRef = useRef('');
  const tfRef = useRef('1');

  const token = () => localStorage.getItem('token') || '';

  useEffect(() => {
    tfRef.current = tf;
  }, [tf]);

  useEffect(() => {
    accountIdRef.current = accountId;
  }, [accountId]);

  // Init auth + account
  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (!t) { router.push('/'); return; }
    setUser(JSON.parse(u || '{}'));

    fetch(`${API}/trading/my-account`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(acc => {
        if (acc?.id) {
          setAccountId(acc.id);
          accountIdRef.current = acc.id;
          loadTrades(acc.id);
          loadRisk(acc.id);
          loadCandles(acc.id, '1');
        }
      });
  }, []);

  // WebSocket connection
  useEffect(() => {
    let socket: any;
    const connect = async () => {
      const { io } = await import('socket.io-client');
      socket = io(WS_URL, { transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 1000 });
      socketRef.current = socket;

      socket.on('connect', () => {
        setWsStatus('connected');
        socket.emit('subscribe', { symbols: ['EURUSD'], accountId: accountIdRef.current });
      });

      socket.on('disconnect', () => setWsStatus('disconnected'));
      socket.on('connect_error', () => setWsStatus('disconnected'));

      socket.on('prices', (updates: any[]) => {
        updates.forEach(u => {
          if (u.symbol === 'EURUSD') {
            setPrice({ bid: u.bid, ask: u.ask, spread: u.spread });
          }
        });
      });

      socket.on('risk_alert', (data: any) => {
        console.warn('Risk alert:', data);
        if (accountIdRef.current) loadRisk(accountIdRef.current);
      });
    };

    connect();
    return () => { if (socket) socket.disconnect(); };
  }, []);

  // Subscribe with accountId once available
  useEffect(() => {
    if (accountId && socketRef.current?.connected) {
      socketRef.current.emit('subscribe', { symbols: ['EURUSD'], accountId });
    }
  }, [accountId]);

  // Poll trades + risk + candles every 3s (reduced from 2s since prices are via WS)
  useEffect(() => {
    if (!accountId) return;
    const iv = setInterval(() => {
      loadTrades(accountId);
      loadRisk(accountId);
      loadCandles(accountId, tf);
    }, 3000);
    return () => clearInterval(iv);
  }, [accountId, tf]);

  const loadTrades = async (aid: string) => {
    const r = await fetch(`${API}/trading/open/${aid}`);
    if (r.ok) setTrades(await r.json());
  };

  const loadRisk = async (aid: string) => {
    const r = await fetch(`${API}/trading/risk/${aid}`);
    if (r.ok) setRisk(await r.json());
  };

  const loadCandles = async (aid: string, timeframe: string) => {
    const r = await fetch(`${API}/trading/candles/EURUSD?tf=${timeframe}&limit=300`);
    if (r.ok) setCandles(await r.json());
  };

  // Chart
  useEffect(() => {
    if (!chartRef.current || !candles.length) return;
    const init = async () => {
      const { createChart } = await import('lightweight-charts');
      if (!chartInstance.current) {
        chartInstance.current = createChart(chartRef.current, {
          width: chartRef.current.clientWidth,
          height: 420,
          layout: { background: { color: '#0d1117' }, textColor: '#8b949e' },
          grid: { vertLines: { color: '#161b22' }, horzLines: { color: '#161b22' } },
          crosshair: { mode: 1 },
          rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
          timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
          handleScroll: true, handleScale: true,
        });
        candleSeries.current = chartInstance.current.addCandlestickSeries({
          upColor: '#26a641', downColor: '#da3633',
          borderUpColor: '#26a641', borderDownColor: '#da3633',
          wickUpColor: '#26a641', wickDownColor: '#da3633',
          priceFormat: { type: 'price', precision: 5, minMove: 0.00001 },
        });
      }
      candleSeries.current.setData(candles.map((c: any) => ({
        time: Math.floor(c.time / 1000) as any,
        open: c.open, high: c.high, low: c.low, close: c.close,
      })));

      if (price.bid) {
        if (priceLine.current) { try { candleSeries.current.removePriceLine(priceLine.current); } catch {} }
        priceLine.current = candleSeries.current.createPriceLine({
          price: price.bid, color: '#58a6ff', lineWidth: 1, lineStyle: 2,
          axisLabelVisible: true, title: 'BID',
        });
      }

      tradeLines.current.forEach(l => { try { candleSeries.current.removePriceLine(l); } catch {} });
      tradeLines.current = [];
      trades.forEach((t: any) => {
        const color = t.side === 'BUY' ? '#3b82f6' : '#f59e0b';
        const pnl = parseFloat(t.floating_pnl);
        tradeLines.current.push(candleSeries.current.createPriceLine({
          price: Number(t.open_price), color, lineWidth: 1, lineStyle: 1,
          axisLabelVisible: true,
          title: `${t.side} ${t.volume} ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`,
        }));
        if (t.sl_price && Number(t.sl_price) > 0) {
          tradeLines.current.push(candleSeries.current.createPriceLine({
            price: Number(t.sl_price), color: '#ef4444', lineWidth: 1, lineStyle: 3,
            axisLabelVisible: true, title: 'SL',
          }));
        }
        if (t.tp_price && Number(t.tp_price) > 0) {
          tradeLines.current.push(candleSeries.current.createPriceLine({
            price: Number(t.tp_price), color: '#22c55e', lineWidth: 1, lineStyle: 3,
            axisLabelVisible: true, title: 'TP',
          }));
        }
      });
    };
    init();
  }, [candles, trades, price.bid]);

  // Update price line only when price changes (no full redraw)
  useEffect(() => {
    if (!candleSeries.current || !price.bid) return;
    try {
      if (priceLine.current) candleSeries.current.removePriceLine(priceLine.current);
      priceLine.current = candleSeries.current.createPriceLine({
        price: price.bid, color: '#58a6ff', lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: 'BID',
      });
    } catch {}
  }, [price.bid]);

  const placeTrade = async (side: 'BUY' | 'SELL') => {
    if (!accountId) return;
    setLoading(true);
    try {
      const openPrice = side === 'BUY' ? price.ask : price.bid;
      await fetch(`${API}/trading/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          account_id: accountId, symbol: 'EURUSD', side,
          volume: parseFloat(volume), open_price: openPrice,
          sl_price: sl ? parseFloat(sl) : null,
          tp_price: tp ? parseFloat(tp) : null,
        })
      });
      setSl(''); setTp('');
      setTimeout(() => loadTrades(accountId), 500);
    } catch {}
    setLoading(false);
  };

  const closeTrade = async (id: string) => {
    try {
      await fetch(`${API}/trading/close/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ close_price: price.bid })
      });
      setTimeout(() => { loadTrades(accountId); loadRisk(accountId); }, 500);
    } catch {}
  };

  const totalPnL = trades.reduce((s, t) => s + parseFloat(t.floating_pnl || 0), 0);

  const RiskBar = ({ label, value, max, color }: any) => {
    const pct = Math.min(100, (parseFloat(value) / parseFloat(max)) * 100);
    return (
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">{label}</span>
          <span className={pct >= 80 ? 'text-red-400 font-bold' : 'text-gray-300'}>
            {parseFloat(value).toFixed(2)}% / {parseFloat(max).toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: pct >= 80 ? '#ef4444' : pct >= 50 ? '#f59e0b' : color }} />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">PropScholar</h1>
          <span className={`text-xs px-2 py-0.5 rounded border font-mono ${
            wsStatus === 'connected' ? 'bg-green-900/30 border-green-800 text-green-400' :
            wsStatus === 'connecting' ? 'bg-yellow-900/30 border-yellow-800 text-yellow-400' :
            'bg-red-900/30 border-red-800 text-red-400'
          }`}>
            {wsStatus === 'connected' ? '⬤ LIVE' : wsStatus === 'connecting' ? '◌ CONNECTING' : '⬤ OFFLINE'}
          </span>
          {risk && (
            <span className={`text-xs px-2 py-0.5 rounded border font-bold ${
              risk.status === 'BREACHED' ? 'bg-red-900/50 border-red-700 text-red-400' : 'bg-green-900/30 border-green-800 text-green-400'
            }`}>{risk.status}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/trader/history')}
            className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded">History</button>
          <span className="text-sm text-gray-400">{user?.email}</span>
          <button onClick={() => { localStorage.clear(); router.push('/'); }}
            className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded">Logout</button>
        </div>
      </div>

      <div className="p-4 flex gap-4">
        <div className="w-60 shrink-0 space-y-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">EURUSD</span>
              <span className="text-xs text-gray-500">{price.spread} pip</span>
            </div>
            <div className="flex gap-1.5 mb-4">
              <button onClick={() => placeTrade('SELL')} disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg p-2.5 text-center transition-colors">
                <div className="text-xs text-red-200 mb-0.5">SELL</div>
                <div className="text-sm font-bold font-mono">{Number(price.bid).toFixed(5)}</div>
              </button>
              <button onClick={() => placeTrade('BUY')} disabled={loading}
                className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded-lg p-2.5 text-center transition-colors">
                <div className="text-xs text-green-200 mb-0.5">BUY</div>
                <div className="text-sm font-bold font-mono">{Number(price.ask).toFixed(5)}</div>
              </button>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500">Volume (lots)</label>
                <input value={volume} onChange={e => setVolume(e.target.value)}
                  className="w-full mt-0.5 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs text-red-400">Stop Loss</label>
                <input value={sl} onChange={e => setSl(e.target.value)}
                  className="w-full mt-0.5 bg-gray-800 border border-red-900 rounded px-3 py-1.5 text-sm font-mono" placeholder="0.00000" />
              </div>
              <div>
                <label className="text-xs text-green-400">Take Profit</label>
                <input value={tp} onChange={e => setTp(e.target.value)}
                  className="w-full mt-0.5 bg-gray-800 border border-green-900 rounded px-3 py-1.5 text-sm font-mono" placeholder="0.00000" />
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Account</div>
            {[
              ['Balance', `$${parseFloat(risk?.balance||'100000').toLocaleString('en',{minimumFractionDigits:2})}`, ''],
              ['Equity', `$${parseFloat(risk?.equity||'100000').toLocaleString('en',{minimumFractionDigits:2})}`, ''],
              ['Float PnL', `${totalPnL>=0?'+':''}${totalPnL.toFixed(2)}`, totalPnL>=0?'text-green-400':'text-red-400'],
              ['Positions', `${trades.length} / ${risk?.max_open_trades||10}`, ''],
            ].map(([k,v,c]) => (
              <div key={k as string} className="flex justify-between text-sm">
                <span className="text-gray-400">{k}</span>
                <span className={`font-mono ${c}`}>{v}</span>
              </div>
            ))}
          </div>

          {risk && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Risk Monitor</div>
              <RiskBar label="Daily Loss" value={risk.daily_loss_pct} max={risk.max_daily_loss_pct} color="#3b82f6" />
              <RiskBar label="Drawdown" value={risk.drawdown_pct} max={risk.max_drawdown_pct} color="#8b5cf6" />
              <div className="mt-2 pt-2 border-t border-gray-800 flex justify-between text-xs">
                <span className="text-gray-500">Open Trades</span>
                <span className={risk.open_trades>=risk.max_open_trades?'text-red-400 font-bold':'text-gray-300'}>
                  {risk.open_trades} / {risk.max_open_trades}
                </span>
              </div>
              {risk.status === 'BREACHED' && (
                <div className="mt-3 p-2 bg-red-900/30 border border-red-800 rounded text-xs text-red-400 text-center font-bold">
                  ⚠ ACCOUNT BREACHED
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800">
              <span className="text-xs text-gray-500 mr-1">TF:</span>
              {[['1','M1'],['5','M5'],['15','M15'],['30','M30'],['60','H1']].map(([v,l]) => (
                <button key={v} onClick={() => setTf(v)}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${tf===v?'bg-blue-600 text-white':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {l}
                </button>
              ))}
              <span className="ml-auto text-xs text-gray-600 font-mono">
                {wsStatus==='connected' ? `${trades.length} pos` : '...'}
              </span>
            </div>
            <div ref={chartRef} style={{ height: '420px' }} />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Open Positions</h2>
            {trades.length === 0 ? (
              <div className="text-gray-600 text-sm text-center py-4">No open positions</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-600 text-xs border-b border-gray-800">
                    {['Symbol','Side','Volume','Open','Current','PnL',''].map(h => (
                      <th key={h} className="text-left py-1.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.map(t => (
                    <tr key={t.id} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                      <td className="py-2 font-medium">{t.symbol}</td>
                      <td className={`py-2 font-bold text-xs ${t.side==='BUY'?'text-green-400':'text-red-400'}`}>{t.side}</td>
                      <td className="py-2 font-mono text-xs">{t.volume}</td>
                      <td className="py-2 font-mono text-xs">{Number(t.open_price).toFixed(5)}</td>
                      <td className="py-2 font-mono text-xs">{Number(t.current_price).toFixed(5)}</td>
                      <td className={`py-2 font-mono font-bold text-xs ${parseFloat(t.floating_pnl)>=0?'text-green-400':'text-red-400'}`}>
                        {parseFloat(t.floating_pnl)>=0?'+':''}{parseFloat(t.floating_pnl).toFixed(2)}
                      </td>
                      <td className="py-2">
                        <button onClick={() => closeTrade(t.id)}
                          className="bg-gray-800 hover:bg-red-900 border border-gray-700 text-xs px-2.5 py-1 rounded transition-colors">
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
