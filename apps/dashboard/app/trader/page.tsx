'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TraderDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [price, setPrice] = useState<any>({ bid: 0, ask: 0, spread: 0 });
  const [trades, setTrades] = useState<any[]>([]);
  const [volume, setVolume] = useState('0.01');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [loading, setLoading] = useState(false);
  const [accountId, setAccountId] = useState('');

  const token = () => localStorage.getItem('token');
  const API = 'http://35.200.170.189:3000/api/v1';

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (!t) { router.push('/'); return; }
    const parsed = JSON.parse(u || '{}');
    setUser(parsed);
    setAccountId(parsed.id || '');
    loadTrades(parsed.id);
    const interval = setInterval(() => fetchPrice(), 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchPrice = async () => {
    try {
      const res = await fetch(`${API}/trading/price/EURUSD`);
      if (res.ok) setPrice(await res.json());
    } catch {}
  };

  const loadTrades = async (aid: string) => {
    try {
      const res = await fetch(`${API}/trading/open/${aid}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) setTrades(await res.json());
    } catch {}
  };

  const placeTrade = async (side: 'BUY' | 'SELL') => {
    setLoading(true);
    try {
      const openPrice = side === 'BUY' ? price.ask : price.bid;
      const res = await fetch(`${API}/trading/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          account_id: accountId,
          symbol: 'EURUSD',
          side,
          volume: parseFloat(volume),
          open_price: openPrice,
          sl_price: sl ? parseFloat(sl) : null,
          tp_price: tp ? parseFloat(tp) : null,
        })
      });
      if (res.ok) await loadTrades(accountId);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const closeTrade = async (tradeId: string) => {
    const closePrice = price.bid;
    try {
      await fetch(`${API}/trading/close/${tradeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ close_price: closePrice })
      });
      await loadTrades(accountId);
    } catch {}
  };

  const totalPnL = trades.reduce((sum, t) => sum + parseFloat(t.floating_pnl || 0), 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">PropScholar</h1>
          <p className="text-xs text-gray-400">Trader Panel</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user?.email}</span>
          <button onClick={() => { localStorage.clear(); router.push('/'); }}
            className="text-xs bg-gray-800 px-3 py-2 rounded-lg">Logout</button>
        </div>
      </div>

      <div className="p-6 grid grid-cols-3 gap-6">
        {/* Price Panel */}
        <div className="col-span-1 bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-400 mb-4">EURUSD</h2>
          <div className="flex gap-2 mb-4">
            <div className="flex-1 bg-red-900/30 border border-red-800 rounded-lg p-3 text-center">
              <div className="text-xs text-red-400">BID</div>
              <div className="text-xl font-bold text-red-300">{price.bid?.toFixed(5)}</div>
            </div>
            <div className="flex-1 bg-green-900/30 border border-green-800 rounded-lg p-3 text-center">
              <div className="text-xs text-green-400">ASK</div>
              <div className="text-xl font-bold text-green-300">{price.ask?.toFixed(5)}</div>
            </div>
          </div>
          <div className="text-center text-xs text-gray-500 mb-4">Spread: {price.spread} pips</div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400">Volume (lots)</label>
              <input value={volume} onChange={e => setVolume(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                placeholder="0.01" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Stop Loss</label>
              <input value={sl} onChange={e => setSl(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                placeholder="Optional" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Take Profit</label>
              <input value={tp} onChange={e => setTp(e.target.value)}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                placeholder="Optional" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => placeTrade('SELL')} disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg">
                SELL
              </button>
              <button onClick={() => placeTrade('BUY')} disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg">
                BUY
              </button>
            </div>
          </div>
        </div>

        {/* Trades Panel */}
        <div className="col-span-2 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Open Positions</h2>
              <div className={`text-lg font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                Total PnL: {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}
              </div>
            </div>
            {trades.length === 0 ? (
              <div className="text-gray-400 text-sm text-center py-8">No open positions</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-gray-800">
                    <th className="text-left py-2">Symbol</th>
                    <th className="text-left py-2">Side</th>
                    <th className="text-left py-2">Volume</th>
                    <th className="text-left py-2">Open Price</th>
                    <th className="text-left py-2">Current</th>
                    <th className="text-left py-2">PnL</th>
                    <th className="text-left py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map(t => (
                    <tr key={t.id} className="border-b border-gray-800/50">
                      <td className="py-3">{t.symbol}</td>
                      <td className={`py-3 font-bold ${t.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{t.side}</td>
                      <td className="py-3">{t.volume}</td>
                      <td className="py-3">{parseFloat(t.open_price).toFixed(5)}</td>
                      <td className="py-3">{parseFloat(t.current_price || 0).toFixed(5)}</td>
                      <td className={`py-3 font-bold ${parseFloat(t.floating_pnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {parseFloat(t.floating_pnl) >= 0 ? '+' : ''}{parseFloat(t.floating_pnl).toFixed(2)}
                      </td>
                      <td className="py-3">
                        <button onClick={() => closeTrade(t.id)}
                          className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs">
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
