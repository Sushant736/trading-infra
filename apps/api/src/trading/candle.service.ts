import { Injectable } from '@nestjs/common';
import { createClient } from 'redis';

@Injectable()
export class CandleService {
  async getCandles(symbol: string, timeframe: number, limit: number = 100) {
    const client = createClient({ url: 'redis://:changeme@localhost:6379' });
    await client.connect();
    const msgs = await client.xRevRange(`feed:${symbol}`, '+', '-', { COUNT: 1000000 });
    await client.disconnect();

    if (!msgs.length) return [];

    const ticks = msgs.reverse().map(m => {
      const d = JSON.parse(m.message.data as string);
      return { time: new Date(d.timestamp).getTime(), bid: d.bid, ask: d.ask };
    });

    const tfMs = timeframe * 60 * 1000;
    const candles: any[] = [];
    let current: any = null;

    for (const tick of ticks) {
      const candleTime = Math.floor(tick.time / tfMs) * tfMs;
      if (!current || current.time !== candleTime) {
        if (current) candles.push(current);
        current = {
          time: candleTime,
          open: tick.bid,
          high: tick.bid,
          low: tick.bid,
          close: tick.bid,
        };
      } else {
        current.high = Math.max(current.high, tick.bid);
        current.low = Math.min(current.low, tick.bid);
        current.close = tick.bid;
      }
    }
    if (current) candles.push(current);
    return candles.slice(-limit);
  }
}
