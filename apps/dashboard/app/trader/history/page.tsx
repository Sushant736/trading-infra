'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ACCOUNT_ID = '515aedd1-44a7-4942-82c7-3f0ac26787cf';
const API = 'http://35.200.170.189:3000/api/v1';

export default function TradeHistory() {
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalPnL: 0, wins: 0, losses: 0, winRate: 0 });

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) { router.push('/'); return; }
    fetch(`${API}/trading/history/${ACCOUNT_ID}`)
      .then(r => r.json())
      .then(data => {
        setHistory(data);
        const wins = data.filter((t: any) => parseFloat(t.floating_pnl) > 0).length;
        const losses = data.filter((t: any) => parseFloat(t.floating_pnl) <= 0).length;
        const totalPnL = data.reduce((s: number, t: any) => s + parseFloat(t.floating_pnl || 0), 0);
        setStats({ totalPnL, wins, losses, winRate: data.length ? (wins / data.length) * 100 : 0 });
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">PropScholar</h1>
          <span className="text-xs text-gray-500">Trade History</span>
        </div>
        <button onClick={() => router.push('/trader')}
          className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded">
          ← Back to Trading
        </button>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            ['Total PnL', `${stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}`, stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'],
            ['Win Rate', `${stats.winRate.toFixed(1)}%`, 'text-blue-400'],
            ['Wins', `${stats.wins}`, 'text-green-400'],
            ['Losses', `${stats.losses}`, 'text-red-400'],
          ].map(([k, v, c]) => (
            <div key={k} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">{k}</div>
              <div className={`text-2xl font-bold font-mono ${c}`}>{v}</div>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-4">Closed Positions</h2>
          {history.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-8">No closed trades yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  {['Symbol','Side','Volume','Open','Close','PnL','Opened','Closed'].map(h => (
                    <th key={h} className="text-left py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(t => (
                  <tr key={t.id} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2">{t.symbol}</td>
                    <td className={`py-2 font-bold text-xs ${t.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{t.side}</td>
                    <td className="py-2 font-mono text-xs">{t.volume}</td>
                    <td className="py-2 font-mono text-xs">{Number(t.open_price).toFixed(5)}</td>
                    <td className="py-2 font-mono text-xs">{Number(t.current_price).toFixed(5)}</td>
                    <td className={`py-2 font-mono font-bold text-xs ${parseFloat(t.floating_pnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {parseFloat(t.floating_pnl) >= 0 ? '+' : ''}{parseFloat(t.floating_pnl).toFixed(2)}
                    </td>
                    <td className="py-2 text-xs text-gray-400">{new Date(t.opened_at).toLocaleString()}</td>
                    <td className="py-2 text-xs text-gray-400">{t.closed_at ? new Date(t.closed_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
