import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createClient } from 'redis';

@WebSocketGateway({ cors: { origin: '*' }, transports: ['websocket', 'polling'] })
export class TradingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private clients = new Map<string, { socket: Socket; accountId?: string; symbols: Set<string> }>();
  private redis: any = null;

  afterInit() {
    this.connectRedis();
  }

  private async connectRedis() {
    this.redis = createClient({ url: 'redis://:changeme@localhost:6379' });
    await this.redis.connect();
    this.broadcast();
  }

  handleConnection(socket: Socket) {
    this.clients.set(socket.id, { socket, symbols: new Set(['EURUSD']) });
    console.log(`WS connected: ${socket.id} total=${this.clients.size}`);
  }

  handleDisconnect(socket: Socket) {
    this.clients.delete(socket.id);
    console.log(`WS disconnected: ${socket.id} total=${this.clients.size}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(@MessageBody() data: any, @ConnectedSocket() socket: Socket) {
    const c = this.clients.get(socket.id);
    if (!c) return;
    if (data.accountId) c.accountId = data.accountId;
    if (data.symbols) data.symbols.forEach((s: string) => c.symbols.add(s));
    socket.emit('subscribed', { ok: true });
  }

  private async broadcast() {
    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'];
    while (true) {
      try {
        if (this.clients.size > 0) {
          const updates: any[] = [];
          for (const sym of symbols) {
            const msgs = await this.redis.xRevRange(`feed:${sym}`, '+', '-', { COUNT: 1 });
            if (msgs.length) {
              const d = JSON.parse(msgs[0].message.data);
              updates.push({ symbol: sym, bid: d.bid, ask: d.ask, spread: d.spread });
            }
          }
          if (updates.length) {
            this.clients.forEach(({ socket, symbols: subs }) => {
              const relevant = updates.filter(u => subs.has(u.symbol));
              if (relevant.length) socket.emit('prices', relevant);
            });
          }
        }
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  pushToAccount(accountId: string, event: string, data: any) {
    this.clients.forEach(({ socket, accountId: aid }) => {
      if (aid === accountId) socket.emit(event, data);
    });
  }

  getStats() { return { connected: this.clients.size }; }
}
