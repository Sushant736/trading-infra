'use client';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://35.200.170.189:3000') + '/api/v1';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://35.200.170.189:3000';

export default function EmbedTrader({ params }: { params: { accountId: string } }) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const accountId = params.accountId;

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

  useEffect(() => {
    // WebSocket
    const connect = async () => {
      const { io } = await import('socket.io-client');
      const socket = io(WS_URL, { transports: ['websocket', 'polling'], reconnection: true });
      socketRef.current = socket;
      socket.on('connect', () => {
        setWsStatus('connected');
        socket.emit('subscribe', { symbols: ['EURUSD'], accountId });
      });
      socket.on('disconnect', () => setWsStatus('disconnected'));
      socket.on('prices', (updates: any[]) => {
        updates.forEach(u => { if (u.symbol === 'EURUSD') setPrice({ bid: u.bid, ask: u.ask, spread: u.spread }); });
      });
    };
    connect();

    // Poll trades + risk + candles
    const poll = async () => {
      try {
        const [tradesRes, riskRes, candleRes] = await Promise.all([
          fetch(`${API}/trading/open/${accountId}`),
          fetch(`${API}/trading/risk/${accountId}`),
          fetch(`${API}/trading/candles/EURUSD?tf=${tf}&limit=300`),
        ]);
        if (tradesRes.ok) setTrades(await tradesRes.json());
        if (riskRes.ok) setRisk(await riskRes.json());
        if (candleRes.ok) setCandles(await candleRes.json());
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 3000);
    return () => {
      clearInterval(iv);
      socketRef.current?.disconnect();
    };
  }, [accountId, tf]);

  // Chart
  useEffect(() => {
    if (!chartRef.current || !candles.length) return;
    const init = async () => {
      const { createChart } = await import('lightweight-charts');
      if (!chartInstance.current) {
        chartInstance.current = createChart(chartRef.current, {
          width: chartRef.current.clientWidth,
          height: chartRef.current.clientHeight || 380,
          layout: { background: { color: '#ffffff' }, textColor: '#374151' },
          grid: { vertLines: { color: '#f3f4f6' }, horzLines: { color: '#f3f4f6' } },
          crosshair: { mode: 1 },
          rightPriceScale: { borderColor: '#e5e7eb' },
          timeScale: { borderColor: '#e5e7eb', timeVisible: true, secondsVisible: false },
          handleScroll: true, handleScale: true,
        });
        candleSeries.current = chartInstance.current.addCandlestickSeries({
          upColor: '#111827', downColor: '#6b7280',
          borderUpColor: '#111827', borderDownColor: '#6b7280',
          wickUpColor: '#111827', wickDownColor: '#6b7280',
          priceFormat: { type: 'price', precision: 5, minMove: 0.00001 },
        });
      }
      candleSeries.current.setData(candles.map((c: any) => ({
        time: Math.floor(c.time / 1000) as any,
        open: c.open, high: c.high, low: c.low, close: c.close,
      })));
      // Price line
      if (price.bid) {
        if (priceLine.current) { try { candleSeries.current.removePriceLine(priceLine.current); } catch {} }
        priceLine.current = candleSeries.current.createPriceLine({
          price: price.bid, color: '#111827', lineWidth: 1, lineStyle: 2,
          axisLabelVisible: true, title: 'BID',
        });
      }
      // Trade lines
      tradeLines.current.forEach(l => { try { candleSeries.current.removePriceLine(l); } catch {} });
      tradeLines.current = [];
      trades.forEach((t: any) => {
        const pnl = parseFloat(t.floating_pnl);
        const line = candleSeries.current.createPriceLine({
          price: Number(t.open_price), color: t.side === 'BUY' ? '#111827' : '#6b7280',
          lineWidth: 1, lineStyle: 1, axisLabelVisible: true,
          title: `${t.side} ${t.volume} ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`,
        });
        tradeLines.current.push(line);
        if (t.sl_price && Number(t.sl_price) > 0) {
          tradeLines.current.push(candleSeries.current.createPriceLine({ price: Number(t.sl_price), color: '#ef4444', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'SL' }));
        }
        if (t.tp_price && Number(t.tp_price) > 0) {
          tradeLines.current.push(candleSeries.current.createPriceLine({ price: Number(t.tp_price), color: '#22c55e', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'TP' }));
        }
      });
    };
    init();
  }, [candles, trades, price.bid]);

  // Price line update
  useEffect(() => {
    if (!candleSeries.current || !price.bid) return;
    try {
      if (priceLine.current) candleSeries.current.removePriceLine(priceLine.current);
      priceLine.current = candleSeries.current.createPriceLine({
        price: price.bid, color: '#111827', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'BID',
      });
    } catch {}
  }, [price.bid]);

  const placeTrade = async (side: 'BUY' | 'SELL') => {
    setLoading(true);
    try {
      const openPrice = side === 'BUY' ? price.ask : price.bid;
      await fetch(`${API}/trading/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId, symbol: 'EURUSD', side,
          volume: parseFloat(volume), open_price: openPrice,
          sl_price: sl ? parseFloat(sl) : null,
          tp_price: tp ? parseFloat(tp) : null,
        })
      });
      setSl(''); setTp('');
      window.parent?.postMessage({ type: 'trade_opened', side, volume: parseFloat(volume), price: openPrice }, '*');
    } catch {}
    setLoading(false);
  };

  const closeTrade = async (id: string) => {
    try {
      await fetch(`${API}/trading/close/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ close_price: price.bid })
      });
    } catch {}
  };

  const totalPnL = trades.reduce((s, t) => s + parseFloat(t.floating_pnl || 0), 0);

  const RiskBar = ({ label, value, max, color }: any) => {
    const pct = Math.min(100, (parseFloat(value) / parseFloat(max)) * 100);
    return (
      <div className="mb-1.5">
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-gray-400">{label}</span>
          <span className={pct >= 80 ? 'text-red-500 font-bold' : 'text-gray-600'}>{parseFloat(value).toFixed(2)}% / {parseFloat(max).toFixed(0)}%</span>
        </div>
        <div className="h-1 bg-gray-100 rounded-full">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct >= 80 ? '#ef4444' : pct >= 50 ? '#f59e0b' : color }} />
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen bg-white flex overflow-hidden" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Left panel */}
      <div className="w-56 border-r border-gray-100 flex flex-col shrink-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-900">EURUSD</div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-xs text-gray-400">{price.spread} pip</span>
          </div>
        </div>

        {/* BUY/SELL */}
        <div className="p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => placeTrade('SELL')} disabled={loading}
              className="rounded-lg p-2.5 text-center border border-gray-200 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all disabled:opacity-50">
              <div className="text-xs text-gray-400 group-hover:text-white mb-0.5">SELL</div>
              <div className="text-sm font-bold font-mono text-red-500">{Number(price.bid).toFixed(5)}</div>
            </button>
            <button onClick={() => placeTrade('BUY')} disabled={loading}
              className="rounded-lg p-2.5 text-center border border-gray-200 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all disabled:opacity-50">
              <div className="text-xs text-gray-400 mb-0.5">BUY</div>
              <div className="text-sm font-bold font-mono text-green-600">{Number(price.ask).toFixed(5)}</div>
            </button>
          </div>

          <div>
            <label className="text-xs text-gray-400">Volume</label>
            <input value={volume} onChange={e => setVolume(e.target.value)} type="number"
              className="w-full mt-0.5 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:border-gray-400" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400">SL</label>
              <input value={sl} onChange={e => setSl(e.target.value)} placeholder="0.00000"
                className="w-full mt-0.5 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-gray-400" />
            </div>
            <div>
              <label className="text-xs text-gray-400">TP</label>
              <input value={tp} onChange={e => setTp(e.target.value)} placeholder="0.00000"
                className="w-full mt-0.5 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-gray-400" />
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="px-4 py-3 border-t border-gray-100 space-y-1.5">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Account</div>
          {[
            ['Balance', `$${parseFloat(risk?.balance||'0').toLocaleString('en',{minimumFractionDigits:2})}`],
            ['Equity', `$${parseFloat(risk?.equity||'0').toLocaleString('en',{minimumFractionDigits:2})}`],
            ['Float PnL', `${totalPnL>=0?'+':''}${totalPnL.toFixed(2)}`],
            ['Positions', `${trades.length}/${risk?.max_open_trades||10}`],
          ].map(([k,v]) => (
            <div key={k} className="flex justify-between text-xs">
              <span className="text-gray-400">{k}</span>
              <span className={`font-mono font-medium ${k==='Float PnL'?(totalPnL>=0?'text-green-600':'text-red-500'):'text-gray-900'}`}>{v}</span>
            </div>
          ))}
        </div>

        {/* Risk */}
        {risk && (
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Risk</div>
            <RiskBar label="Daily Loss" value={risk.daily_loss_pct} max={risk.max_daily_loss_pct} color="#111827" />
            <RiskBar label="Drawdown" value={risk.drawdown_pct} max={risk.max_drawdown_pct} color="#374151" />
            {risk.status === 'BREACHED' && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 text-center font-medium">⚠ Account Breached</div>
            )}
          </div>
        )}
      </div>

      {/* Right - Chart + Positions */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TF selector */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-100">
          {[['1','M1'],['5','M5'],['15','M15'],['30','M30'],['60','H1']].map(([v,l]) => (
            <button key={v} onClick={() => setTf(v)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${tf===v?'bg-gray-900 text-white':'text-gray-400 hover:text-gray-900'}`}>
              {l}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-300 font-mono">{trades.length} pos</span>
        </div>

        {/* Chart */}
        <div ref={chartRef} className="flex-1" />

        {/* Positions */}
        {trades.length > 0 && (
          <div className="border-t border-gray-100 max-h-36 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Symbol','Side','Vol','Open','Current','PnL',''].map(h=>(
                    <th key={h} className="text-left px-3 py-1.5 text-gray-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-medium">{t.symbol}</td>
                    <td className={`px-3 py-1.5 font-bold ${t.side==='BUY'?'text-gray-900':'text-gray-500'}`}>{t.side}</td>
                    <td className="px-3 py-1.5 font-mono">{t.volume}</td>
                    <td className="px-3 py-1.5 font-mono">{Number(t.open_price).toFixed(5)}</td>
                    <td className="px-3 py-1.5 font-mono">{Number(t.current_price).toFixed(5)}</td>
                    <td className={`px-3 py-1.5 font-mono font-bold ${parseFloat(t.floating_pnl)>=0?'text-green-600':'text-red-500'}`}>
                      {parseFloat(t.floating_pnl)>=0?'+':''}{parseFloat(t.floating_pnl).toFixed(2)}
                    </td>
                    <td className="px-3 py-1.5">
                      <button onClick={() => closeTrade(t.id)}
                        className="border border-gray-200 hover:bg-gray-900 hover:text-white hover:border-gray-900 px-2 py-0.5 rounded text-xs transition-all">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
