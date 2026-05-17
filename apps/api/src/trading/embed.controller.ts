import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { createClient } from 'redis';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Controller('embed')
export class EmbedController {
  constructor(@InjectDataSource() private db: DataSource) {}

  @Get('widget/:accountId')
  async getWidget(@Param('accountId') accountId: string, @Res() res: Response) {
    const price = await this.getPrice('EURUSD');
    const html = this.buildWidget(accountId, price);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(html);
  }

  @Get('price/:symbol')
  async getPriceJson(@Param('symbol') symbol: string) {
    return this.getPrice(symbol);
  }

  private async getPrice(symbol: string) {
    try {
      const client = createClient({ url: 'redis://:changeme@localhost:6379' });
      await client.connect();
      const msgs = await client.xRevRange(`feed:${symbol}`, '+', '-', { COUNT: 1 });
      await client.disconnect();
      if (!msgs.length) return { bid: 0, ask: 0, spread: 0 };
      return JSON.parse(msgs[0].message.data as string);
    } catch { return { bid: 0, ask: 0, spread: 0 }; }
  }

  private buildWidget(accountId: string, price: any) {
    const apiBase = process.env.API_URL || 'http://35.200.170.189:3000';
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PropScholar Trade</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #111; }
  .widget { max-width: 320px; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .header { padding: 12px 16px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
  .pair { font-size: 13px; font-weight: 600; color: #111; }
  .spread { font-size: 11px; color: #999; }
  .prices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px; }
  .price-box { border-radius: 8px; padding: 10px; text-align: center; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
  .sell-box { background: #fff5f5; border-color: #fecaca; }
  .sell-box:hover { background: #ef4444; border-color: #ef4444; color: white; }
  .sell-box:hover .price-label { color: rgba(255,255,255,0.8); }
  .sell-box:hover .price-value { color: white; }
  .buy-box { background: #f0fdf4; border-color: #bbf7d0; }
  .buy-box:hover { background: #22c55e; border-color: #22c55e; color: white; }
  .buy-box:hover .price-label { color: rgba(255,255,255,0.8); }
  .buy-box:hover .price-value { color: white; }
  .price-label { font-size: 10px; font-weight: 500; color: #999; margin-bottom: 2px; }
  .sell-label { color: #ef4444; }
  .buy-label { color: #22c55e; }
  .price-value { font-size: 16px; font-weight: 700; font-family: monospace; color: #111; }
  .controls { padding: 0 12px 12px; }
  .input-group { margin-bottom: 8px; }
  .input-label { font-size: 10px; color: #999; font-weight: 500; margin-bottom: 4px; display: block; }
  .input { width: 100%; border: 1px solid #e5e5e5; border-radius: 6px; padding: 8px 10px; font-size: 13px; font-family: monospace; outline: none; }
  .input:focus { border-color: #111; }
  .status { padding: 8px 12px; font-size: 11px; text-align: center; min-height: 28px; }
  .status.success { color: #22c55e; }
  .status.error { color: #ef4444; }
  .live-dot { display: inline-block; width: 6px; height: 6px; background: #22c55e; border-radius: 50%; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .footer { padding: 8px 12px; border-top: 1px solid #f0f0f0; font-size: 10px; color: #bbb; text-align: center; }
</style>
</head>
<body>
<div class="widget">
  <div class="header">
    <span class="pair">EURUSD <span class="live-dot"></span></span>
    <span class="spread" id="spread">— pip</span>
  </div>
  <div class="prices">
    <div class="price-box sell-box" onclick="trade('SELL')">
      <div class="price-label sell-label">SELL</div>
      <div class="price-value" id="bid">—</div>
    </div>
    <div class="price-box buy-box" onclick="trade('BUY')">
      <div class="price-label buy-label">BUY</div>
      <div class="price-value" id="ask">—</div>
    </div>
  </div>
  <div class="controls">
    <div class="input-group">
      <label class="input-label">VOLUME (LOTS)</label>
      <input class="input" type="number" id="volume" value="0.01" step="0.01" min="0.01">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="input-group">
        <label class="input-label">STOP LOSS</label>
        <input class="input" type="number" id="sl" placeholder="0.00000" step="0.00001">
      </div>
      <div class="input-group">
        <label class="input-label">TAKE PROFIT</label>
        <input class="input" type="number" id="tp" placeholder="0.00000" step="0.00001">
      </div>
    </div>
  </div>
  <div class="status" id="status"></div>
  <div class="footer">PropScholar Executor</div>
</div>
<script>
const API = '${apiBase}/api/v1';
const ACCOUNT_ID = '${accountId}';
let currentPrice = { bid: 0, ask: 0 };

async function fetchPrice() {
  try {
    const r = await fetch(API + '/trading/price/EURUSD');
    const d = await r.json();
    currentPrice = d;
    document.getElementById('bid').textContent = Number(d.bid).toFixed(5);
    document.getElementById('ask').textContent = Number(d.ask).toFixed(5);
    document.getElementById('spread').textContent = d.spread + ' pip';
  } catch(e) {}
}

async function trade(side) {
  const vol = parseFloat(document.getElementById('volume').value);
  const sl = parseFloat(document.getElementById('sl').value) || null;
  const tp = parseFloat(document.getElementById('tp').value) || null;
  const price = side === 'BUY' ? currentPrice.ask : currentPrice.bid;
  if (!price) { setStatus('No price data', 'error'); return; }
  setStatus('Placing order...', '');
  try {
    const r = await fetch(API + '/trading/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: ACCOUNT_ID, symbol: 'EURUSD', side, volume: vol, open_price: price, sl_price: sl, tp_price: tp })
    });
    const d = await r.json();
    if (r.ok) {
      setStatus(side + ' ' + vol + ' lots @ ' + Number(price).toFixed(5), 'success');
      window.parent?.postMessage({ type: 'trade_opened', side, volume: vol, price }, '*');
    } else { setStatus('Failed: ' + (d.message||'Error'), 'error'); }
  } catch(e) { setStatus('Connection error', 'error'); }
}

function setStatus(msg, cls) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'status ' + cls;
  if (cls === 'success') setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 3000);
}

fetchPrice();
setInterval(fetchPrice, 1000);
</script>
</body>
</html>`;
  }
}
