using System;
using System.Text;
using System.Net.Sockets;
using cAlgo.API;
using cAlgo.API.Internals;

namespace cAlgo.Robots
{
    [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.FullAccess)]
    public class PropScholarBridge : Robot
    {
        [Parameter("Redis Host", DefaultValue = "127.0.0.1")]
        public string RedisHost { get; set; }

        [Parameter("Redis Port", DefaultValue = 6379)]
        public int RedisPort { get; set; }

        [Parameter("Redis Password", DefaultValue = "changeme")]
        public string RedisPassword { get; set; }

        [Parameter("Symbol", DefaultValue = "EURUSD")]
        public string SymbolName { get; set; }

        private TcpClient _tcp;
        private NetworkStream _stream;
        private Symbol _symbol;

        protected override void OnStart()
        {
            _symbol = Symbols.GetSymbol(SymbolName);
            ConnectRedis();
            _symbol.Tick += OnTick;
            Positions.Opened += OnPositionOpened;
            Positions.Closed += OnPositionClosed;
            Positions.Modified += OnPositionModified;
            SendHeartbeat();
            Print("PropScholar Bridge started");
        }

        private void ConnectRedis()
        {
            try
            {
                _tcp = new TcpClient(RedisHost, RedisPort);
                _stream = _tcp.GetStream();
                // AUTH
                SendRaw($"*2\r\n$4\r\nAUTH\r\n${RedisPassword.Length}\r\n{RedisPassword}\r\n");
                Print($"Redis connected: {RedisHost}:{RedisPort}");
            }
            catch (Exception ex)
            {
                Print($"Redis connection failed: {ex.Message}");
            }
        }

        private void OnTick(SymbolTickEventArgs args)
        {
            var payload = $"{{" +
                $"\"type\":\"tick\"," +
                $"\"symbol\":\"{SymbolName}\"," +
                $"\"bid\":{args.Bid}," +
                $"\"ask\":{args.Ask}," +
                $"\"spread\":{Math.Round((args.Ask - args.Bid) / _symbol.PipSize, 1)}," +
                $"\"timestamp\":\"{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ss.fffZ}\"" +
                $"}}";
            XAdd($"feed:{SymbolName}", payload);
        }

        private void OnPositionOpened(PositionOpenedEventArgs args)
        {
            var p = args.Position;
            var payload = $"{{" +
                $"\"type\":\"position_opened\"," +
                $"\"position_id\":\"{p.Id}\"," +
                $"\"symbol\":\"{p.SymbolName}\"," +
                $"\"side\":\"{p.TradeType}\"," +
                $"\"volume\":{p.VolumeInUnits}," +
                $"\"open_price\":{p.EntryPrice}," +
                $"\"sl\":{(p.StopLoss.HasValue ? p.StopLoss.Value.ToString() : \"null\")}," +
                $"\"tp\":{(p.TakeProfit.HasValue ? p.TakeProfit.Value.ToString() : \"null\")}," +
                $"\"timestamp\":\"{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ss.fffZ}\"" +
                $"}}";
            XAdd("positions:opened", payload);
            SendAccountSnapshot();
        }

        private void OnPositionClosed(PositionClosedEventArgs args)
        {
            var p = args.Position;
            var payload = $"{{" +
                $"\"type\":\"position_closed\"," +
                $"\"position_id\":\"{p.Id}\"," +
                $"\"symbol\":\"{p.SymbolName}\"," +
                $"\"side\":\"{p.TradeType}\"," +
                $"\"volume\":{p.VolumeInUnits}," +
                $"\"open_price\":{p.EntryPrice}," +
                $"\"close_price\":{p.CurrentPrice}," +
                $"\"pnl\":{p.NetProfit}," +
                $"\"commission\":{p.Commissions}," +
                $"\"swap\":{p.Swap}," +
                $"\"timestamp\":\"{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ss.fffZ}\"" +
                $"}}";
            XAdd("positions:closed", payload);
            SendAccountSnapshot();
        }

        private void OnPositionModified(PositionModifiedEventArgs args)
        {
            var p = args.Position;
            var payload = $"{{" +
                $"\"type\":\"position_modified\"," +
                $"\"position_id\":\"{p.Id}\"," +
                $"\"symbol\":\"{p.SymbolName}\"," +
                $"\"sl\":{(p.StopLoss.HasValue ? p.StopLoss.Value.ToString() : \"null\")}," +
                $"\"tp\":{(p.TakeProfit.HasValue ? p.TakeProfit.Value.ToString() : \"null\")}," +
                $"\"timestamp\":\"{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ss.fffZ}\"" +
                $"}}";
            XAdd("positions:modified", payload);
        }

        private void SendAccountSnapshot()
        {
            var acc = Account;
            var payload = $"{{" +
                $"\"type\":\"account_snapshot\"," +
                $"\"balance\":{acc.Balance}," +
                $"\"equity\":{acc.Equity}," +
                $"\"margin\":{acc.Margin}," +
                $"\"free_margin\":{acc.FreeMargin}," +
                $"\"margin_level\":{acc.MarginLevel}," +
                $"\"unrealized_pnl\":{acc.UnrealizedNetProfit}," +
                $"\"timestamp\":\"{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ss.fffZ}\"" +
                $"}}";
            XAdd("account:snapshot", payload);
        }

        private void SendHeartbeat()
        {
            var payload = $"{{" +
                $"\"type\":\"heartbeat\"," +
                $"\"symbol\":\"{SymbolName}\"," +
                $"\"timestamp\":\"{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ss.fffZ}\"" +
                $"}}";
            XAdd("bridge:heartbeat", payload);
        }

        private void XAdd(string stream, string data)
        {
            try
            {
                if (_tcp == null || !_tcp.Connected)
                    ConnectRedis();

                var cmd = $"*5\r\n$4\r\nXADD\r\n${stream.Length}\r\n{stream}\r\n$1\r\n*\r\n$4\r\ndata\r\n${data.Length}\r\n{data}\r\n";
                SendRaw(cmd);
            }
            catch (Exception ex)
            {
                Print($"XAdd error: {ex.Message}");
                ConnectRedis();
            }
        }

        private void SendRaw(string cmd)
        {
            var bytes = Encoding.UTF8.GetBytes(cmd);
            _stream.Write(bytes, 0, bytes.Length);
        }

        protected override void OnStop()
        {
            if (_stream != null) _stream.Close();
            if (_tcp != null) _tcp.Close();
            Print("PropScholar Bridge stopped");
        }
    }
}
