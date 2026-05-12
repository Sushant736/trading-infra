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
	Symbol    string    `json:"symbol"`
	Bid       float64   `json:"bid"`
	Ask       float64   `json:"ask"`
	Spread    float64   `json:"spread"`
	Timestamp time.Time `json:"timestamp"`
	Source    string    `json:"source"`
}

type Logger struct {
	file *os.File
}

func NewLogger(path string) (*Logger, error) {
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, err
	}
	return &Logger{file: f}, nil
}

func (l *Logger) Log(msg string) {
	ts := time.Now().UTC().Format(time.RFC3339Nano)
	line := fmt.Sprintf("[%s] %s\n", ts, msg)
	l.file.WriteString(line)
	fmt.Print(line)
}

func main() {
	logger, err := NewLogger("logs/feed.log")
	if err != nil {
		log.Fatal("cannot open log file:", err)
	}
	logger.Log("Feed service starting...")

	rdb := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "changeme",
		DB:       0,
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Test redis connection
	if err := rdb.Ping(ctx).Err(); err != nil {
		logger.Log(fmt.Sprintf("ERROR redis ping failed: %v", err))
		log.Fatal(err)
	}
	logger.Log("Redis connected OK")

	// Test postgres connection
	dsn := "host=localhost port=5432 user=trading_user password=changeme dbname=trading_infra sslmode=disable"
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		logger.Log(fmt.Sprintf("ERROR postgres open failed: %v", err))
		log.Fatal(err)
	}
	defer db.Close()

	if err := db.PingContext(ctx); err != nil {
		logger.Log(fmt.Sprintf("ERROR postgres ping failed: %v", err))
		log.Fatal(err)
	}
	logger.Log("PostgreSQL connected OK")

	// Create test stream entries (simulating feed)
	symbols := []string{"EURUSD", "GBPUSD", "USDJPY", "XAUUSD"}
	for _, sym := range symbols {
		tick := TickEvent{
			Symbol:    sym,
			Bid:       1.08500,
			Ask:       1.08503,
			Spread:    0.3,
			Timestamp: time.Now().UTC(),
			Source:    "simulator",
		}
		data, _ := json.Marshal(tick)
		rdb.XAdd(ctx, &redis.XAddArgs{
			Stream: "feed:" + sym,
			Values: map[string]interface{}{
				"data": string(data),
			},
		})
		logger.Log(fmt.Sprintf("SIMULATED tick added → feed:%s", sym))
	}

	// Read from streams
	streams := make([]string, 0)
	ids := make([]string, 0)
	for _, sym := range symbols {
		streams = append(streams, "feed:"+sym)
		ids = append(ids, "0")
	}

	logger.Log("Starting stream reader loop...")

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				result, err := rdb.XRead(ctx, &redis.XReadArgs{
					Streams: append(streams, ids...),
					Count:   10,
					Block:   2000 * time.Millisecond,
				}).Result()

				if err != nil && err != redis.Nil {
					logger.Log(fmt.Sprintf("WARN stream read error: %v", err))
					continue
				}

				for _, stream := range result {
					for _, msg := range stream.Messages {
						recvAt := time.Now().UTC()
						data := msg.Values["data"]
						logger.Log(fmt.Sprintf(
							"TICK stream=%s id=%s recv_at=%s data=%v",
							stream.Stream, msg.ID,
							recvAt.Format(time.RFC3339Nano), data,
						))
					}
				}
				// Update IDs to latest
				for i, stream := range result {
					if len(stream.Messages) > 0 {
						ids[i] = stream.Messages[len(stream.Messages)-1].ID
					}
				}
			}
		}
	}()

	<-sigCh
	logger.Log("Shutting down feed service...")
	cancel()
	time.Sleep(500 * time.Millisecond)
	logger.Log("Feed service stopped.")
}
