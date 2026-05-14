'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const ACCOUNT_ID = '515aedd1-44a7-4942-82c7-3f0ac26787cf';
const API = 'http://35.200.170.189:3000/api/v1';

function CandleChart({ candles, trades, tf }: { candles: any[], trades: any[], tf: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !candles.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    const PAD = { top: 20, right: 60, bottom: 30, left: 10 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, W, H);

    const visible = candles.slice(-80);
    const prices = visible.flatMap(c => [c.high, c.low]);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const priceRange = maxP - minP || 0.0001;
    const padding = priceRange * 0.1;
    const pMin = minP - padding;
    const pMax = maxP + padding;
    const pRange = pMax - pMin;

    const toY = (p: number) => PAD.top + chartH - ((p - pMin) / pRange) * chartH;
    const candleW = Math.max(2, (chartW / visible.length) * 0.7);
    const gap = chartW / visible.length;

    // Grid
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = PAD.top + (chartH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(W - PAD.right, y);
      ctx.stroke();
      const price = pMax - (pRange / 5) * i;
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px monospace';
      ctx.fillText(price.toFixed(5), W - PAD.right + 4, y + 4);
    }

    // Candles
    visible.forEach((c, i) => {
      const x = PAD.left + i * gap + gap / 2;
      const openY = toY(c.open);
      const closeY = toY(c.close);
      const highY = toY(c.high);
      const lowY = toY(c.low);
      const bull = c.close >= c.open;
      const color = bull ? '#22c55e' : '#ef4444';

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      ctx.fillStyle = color;
      const bodyTop = Math.min(openY, closeY);
      const bodyH = Math.max(1, Math.abs(closeY - openY));
      ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
    });

    // Trade lines
    trades.forEach(t => {
      const price = Number(t.open_price);
      if (price < pMin || price > pMax) return;
      const y = toY(price);
      const color = t.side === 'BUY' ? '#3b82f6' : '#f59e0b';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(W - PAD.right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.font = '10px monospace';
      ctx.fillText(`${t.side} ${t.volume} @ ${Number(t.open_price).toFixed(5)}`, PAD.left + 4, y - 4);
    });

    // Time labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px monospace';
    const step = Math.max(1, Math.floor(visible.length / 6));
    visible.forEach((c, i) => {
      if (i % step !== 0) return;
      const x = PAD.left + i * gap + gap / 2;
      const d = new Date(c.time);
      const label = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
      ctx.fillText(label, x - 15, H - 8);
    });

  }, [candles, trades]);

  return <canvas ref={canvasRef} width={900} height={400} style={{width:'100%',height:'400px'}} />;
}

export default function TraderDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [price, setPrice] = useState<any>({ bid: 0, ask: 0, spread: 0 });
  const [trades, setTrades] = useState<any[]>([]);
  const [candles, setCandles] = useState<any[]>([]);
  const [volume, setVolume] = useState('0.01');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [loading, setLoading] = useState(false);
  const [tf, setTf] = useState('1');

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (!t) { router.push('/'); return; }
    setUser(JSON.parse(u || '{}'));

    const poll = async () => {
      try {
        const [priceRes, tradesRes, candleRes] = await Promise.all([
          fetch(`${API}/trading/price/EURUSD`),
          fetch(`${API}/trading/open/${ACCOUNT_ID}`),
          fetch(`${API}/trading/candles/EURUSD?tf=${tf}&limit=200`),
        ]);
        if (priceRes.ok) setPrice(await priceRes.json());
        if (tradesRes.ok) setTrades(await tradesRes.json());
        if (candleRes.ok) setCandles(await candleRes.json());
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [tf]);

  const placeTrade = async (side: 'BUY' | 'SELL') => {
    setLoading(true);
    try {
      const openPrice = side === 'BUY' ? price.ask : price.bid;
      await fetch(`${API}/trading/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: ACCOUNT_ID, symbol: 'EURUSD', side,
          volume: parseFloat(volume), open_price: openPrice,
          sl_price: sl ? parseFloat(sl) : null,
          tp_price: tp ? parseFloat(tp) : null,
        })
      });
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">PropScholar</h1>
          <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">Trader</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user?.email}</span>
          <button onClick={() => { localStorage.clear(); router.push('/'); }}
            className="text-xs bg-gray-800 px-3 py-1.5 rounded">Logout</button>
        </div>
      </div>

      <div className="p-4 flex gap-4">
        {/* Order Panel */}
        <div className="w-64 shrink-0 space-y-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-3 font-medium">EURUSD • FOREX</div>
            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-red-950/50 border border-red-900 rounded-lg p-2 text-center">
                <div className="text-xs text-red-400 mb-1">SELL</div>
                <div className="text-base font-bold text-red-300 font-mono">{Number(price.bid).toFixed(5)}</div>
              </div>
              <div className="flex-1 bg-green-950/50 border border-green-900 rounded-lg p-2 text-center">
                <div className="text-xs text-green-400 mb-1">BUY</div>
                <div className="text-base font-bold text-green-300 font-mono">{Number(price.ask).toFixed(5)}</div>
              </div>
            </div>
            <div className="text-center text-xs text-gray-500 mb-4">{price.spread} pips spread</div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-400">Volume (lots)</label>
                <input value={volume} onChange={e => setVolume(e.target.value)}
                  className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Stop Loss</label>
                <input value={sl} onChange={e => setSl(e.target.value)}
                  className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono"
                  placeholder="0.00000" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Take Profit</label>
                <input value={tp} onChange={e => setTp(e.target.value)}
                  className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono"
                  placeholder="0.00000" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => placeTrade('SELL')} disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-2.5 rounded text-sm">
                SELL
              </button>
              <button onClick={() => placeTrade('BUY')} disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-2.5 rounded text-sm">
                BUY
              </button>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2.5">
            <div className="text-xs text-gray-400 font-medium mb-2">ACCOUNT</div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Balance</span>
              <span className="font-mono">$100,000.00</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Equity</span>
              <span className="font-mono">${(100000 + totalPnL).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Float PnL</span>
              <span className={`font-mono font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Positions</span>
              <span className="font-mono">{trades.length}</span>
            </div>
          </div>
        </div>

        {/* Chart + Positions */}
        <div className="flex-1 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-400">Timeframe:</span>
              {[['1','M1'],['5','M5'],['15','M15'],['30','M30'],['60','H1']].map(([v,l]) => (
                <button key={v} onClick={() => setTf(v)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${tf === v ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {l}
                </button>
              ))}
            </div>
            <CandleChart candles={candles} trades={trades} tf={tf} />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3 text-gray-300">Open Positions</h2>
            {trades.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-6">No open positions</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800">
                    <th className="text-left py-2">Symbol</th>
                    <th className="text-left py-2">Side</th>
                    <th className="text-left py-2">Volume</th>
                    <th className="text-left py-2">Open Price</th>
                    <th className="text-left py-2">Current</th>
                    <th className="text-left py-2">PnL</th>
                    <th className="text-left py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map(t => (
                    <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2.5 font-medium">{t.symbol}</td>
                      <td className={`py-2.5 font-bold ${t.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{t.side}</td>
                      <td className="py-2.5 font-mono">{t.volume}</td>
                      <td className="py-2.5 font-mono">{Number(t.open_price).toFixed(5)}</td>
                      <td className="py-2.5 font-mono">{Number(t.current_price).toFixed(5)}</td>
                      <td className={`py-2.5 font-mono font-bold ${parseFloat(t.floating_pnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {parseFloat(t.floating_pnl) >= 0 ? '+' : ''}{parseFloat(t.floating_pnl).toFixed(2)}
                      </td>
                      <td className="py-2.5">
                        <button onClick={() => closeTrade(t.id)}
                          className="bg-gray-700 hover:bg-red-800 text-xs px-3 py-1 rounded transition-all">
                          Close
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
