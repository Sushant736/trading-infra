package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
	_ "github.com/lib/pq"
)

type TickEvent struct {
	Type      string    `json:"type"`
	Symbol    string    `json:"symbol"`
	Bid       float64   `json:"bid"`
	Ask       float64   `json:"ask"`
	Spread    float64   `json:"spread"`
	Timestamp time.Time `json:"timestamp"`
}

type PositionEvent struct {
	Type       string    `json:"type"`
	PositionID string    `json:"position_id"`
	Symbol     string    `json:"symbol"`
	Side       string    `json:"side"`
	Volume     float64   `json:"volume"`
	OpenPrice  float64   `json:"open_price"`
	ClosePrice float64   `json:"close_price"`
	PnL        float64   `json:"pnl"`
	Commission float64   `json:"commission"`
	Swap       float64   `json:"swap"`
	SL         *float64  `json:"sl"`
	TP         *float64  `json:"tp"`
	Timestamp  time.Time `json:"timestamp"`
}

type AccountSnapshot struct {
	Type          string    `json:"type"`
	Balance       float64   `json:"balance"`
	Equity        float64   `json:"equity"`
	Margin        float64   `json:"margin"`
	FreeMargin    float64   `json:"free_margin"`
	MarginLevel   float64   `json:"margin_level"`
	UnrealizedPnL float64   `json:"unrealized_pnl"`
	Timestamp     time.Time `json:"timestamp"`
}

var (
	rdb *redis.Client
	db  *sql.DB
)

func main() {
	log.Println("Execution engine starting...")

	// Redis
	rdb = redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "changeme",
		DB:       0,
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatal("Redis connect failed:", err)
	}
	log.Println("Redis connected OK")

	// Postgres
	dsn := "host=localhost port=5432 user=trading_user password=changeme dbname=trading_infra sslmode=disable"
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal("Postgres open failed:", err)
	}
	defer db.Close()
	if err := db.PingContext(ctx); err != nil {
		log.Fatal("Postgres ping failed:", err)
	}
	log.Println("PostgreSQL connected OK")

	// Start consumers
	go consumePositionsOpened(ctx)
	go consumePositionsClosed(ctx)
	go consumeAccountSnapshots(ctx)
	go consumeTicks(ctx)

	log.Println("All consumers running. Waiting for events...")

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	log.Println("Shutting down execution engine...")
	cancel()
	time.Sleep(500 * time.Millisecond)
}

func consumePositionsOpened(ctx context.Context) {
	stream := "positions:opened"
	id := "$"
	log.Printf("Consuming %s...", stream)
	for {
		select {
		case <-ctx.Done():
			return
		default:
			results, err := rdb.XRead(ctx, &redis.XReadArgs{
				Streams: []string{stream, id},
				Count:   10,
				Block:   2000 * time.Millisecond,
			}).Result()
			if err != nil && err != redis.Nil {
				continue
			}
			for _, s := range results {
				for _, msg := range s.Messages {
					id = msg.ID
					data := msg.Values["data"].(string)
					var ev PositionEvent
					if err := json.Unmarshal([]byte(data), &ev); err != nil {
						log.Println("parse error:", err)
						continue
					}
					savePositionOpened(ctx, ev, msg.ID)
				}
			}
		}
	}
}

func consumePositionsClosed(ctx context.Context) {
	stream := "positions:closed"
	id := "$"
	log.Printf("Consuming %s...", stream)
	for {
		select {
		case <-ctx.Done():
			return
		default:
			results, err := rdb.XRead(ctx, &redis.XReadArgs{
				Streams: []string{stream, id},
				Count:   10,
				Block:   2000 * time.Millisecond,
			}).Result()
			if err != nil && err != redis.Nil {
				continue
			}
			for _, s := range results {
				for _, msg := range s.Messages {
					id = msg.ID
					data := msg.Values["data"].(string)
					var ev PositionEvent
					if err := json.Unmarshal([]byte(data), &ev); err != nil {
						continue
					}
					savePositionClosed(ctx, ev)
				}
			}
		}
	}
}

func consumeAccountSnapshots(ctx context.Context) {
	stream := "account:snapshot"
	id := "$"
	log.Printf("Consuming %s...", stream)
	for {
		select {
		case <-ctx.Done():
			return
		default:
			results, err := rdb.XRead(ctx, &redis.XReadArgs{
				Streams: []string{stream, id},
				Count:   10,
				Block:   2000 * time.Millisecond,
			}).Result()
			if err != nil && err != redis.Nil {
				continue
			}
			for _, s := range results {
				for _, msg := range s.Messages {
					id = msg.ID
					data := msg.Values["data"].(string)
					var ev AccountSnapshot
					if err := json.Unmarshal([]byte(data), &ev); err != nil {
						continue
					}
					saveAccountSnapshot(ctx, ev)
				}
			}
		}
	}
}

func consumeTicks(ctx context.Context) {
	stream := "feed:EURUSD"
	id := "$"
	count := 0
	for {
		select {
		case <-ctx.Done():
			return
		default:
			results, err := rdb.XRead(ctx, &redis.XReadArgs{
				Streams: []string{stream, id},
				Count:   100,
				Block:   1000 * time.Millisecond,
			}).Result()
			if err != nil && err != redis.Nil {
				continue
			}
			for _, s := range results {
				for _, msg := range s.Messages {
					id = msg.ID
					count++
					if count%100 == 0 {
						data := msg.Values["data"].(string)
						var tick TickEvent
						json.Unmarshal([]byte(data), &tick)
						log.Printf("TICK #%d %s bid=%.5f ask=%.5f", count, tick.Symbol, tick.Bid, tick.Ask)
					}
				}
			}
		}
	}
}

func savePositionOpened(ctx context.Context, ev PositionEvent, streamID string) {
	query := `
		INSERT INTO signals (symbol, side, volume, sl_price, tp_price, redis_stream_id, status, received_at, processed_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'filled', $7, NOW())
		ON CONFLICT DO NOTHING
	`
	side := "BUY"
	if ev.Side == "Sell" {
		side = "SELL"
	}
	_, err := db.ExecContext(ctx, query,
		ev.Symbol, side, ev.Volume, ev.SL, ev.TP,
		streamID, ev.Timestamp,
	)
	if err != nil {
		log.Println("savePositionOpened error:", err)
		return
	}
	log.Printf("POSITION OPENED: %s %s %.2f @ %.5f", side, ev.Symbol, ev.Volume, ev.OpenPrice)
}

func savePositionClosed(ctx context.Context, ev PositionEvent) {
	pnl := ev.PnL
	log.Printf("POSITION CLOSED: %s %s PnL=%.2f commission=%.2f swap=%.2f",
		ev.Symbol, ev.Side, pnl, ev.Commission, ev.Swap)
	log.Printf("NET PnL: %.2f", pnl-ev.Commission+ev.Swap)
}

func saveAccountSnapshot(ctx context.Context, ev AccountSnapshot) {
	drawdown := 0.0
	if ev.Balance > 0 {
		drawdown = ((ev.Balance - ev.Equity) / ev.Balance) * 100
	}
	log.Printf("ACCOUNT: balance=%.2f equity=%.2f floating_pnl=%.2f drawdown=%.2f%%",
		ev.Balance, ev.Equity, ev.UnrealizedPnL, drawdown)

	query := `
		INSERT INTO account_snapshots 
		(account_id, balance, equity, floating_pnl, daily_pnl, daily_drawdown_pct, snapshot_at)
		VALUES (
			(SELECT id FROM trading_accounts LIMIT 1),
			$1, $2, $3, 0, $4, NOW()
		)
	`
	db.ExecContext(ctx, query, ev.Balance, ev.Equity, ev.UnrealizedPnL, fmt.Sprintf("%.4f", drawdown))
}
