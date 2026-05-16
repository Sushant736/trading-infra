package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/lib/pq"
)

func main() {
	log.Println("PropScholar Risk Engine starting...")

	dsn := "host=localhost port=5432 user=trading_user password=changeme dbname=trading_infra sslmode=disable"
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal("DB open failed:", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal("DB ping failed:", err)
	}
	log.Println("PostgreSQL connected")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		check(ctx, db)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				check(ctx, db)
			}
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	log.Println("Shutting down...")
}

func check(ctx context.Context, db *sql.DB) {
	log.Println("Running risk check...")

	rows, err := db.QueryContext(ctx,
		`SELECT id, firm_id, initial_balance, current_balance, equity FROM trading_accounts WHERE is_active=true`)
	if err != nil {
		log.Println("Query error:", err)
		return
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		count++
		var id, firmID string
		var initialBal, currentBal, equity float64
		if err := rows.Scan(&id, &firmID, &initialBal, &currentBal, &equity); err != nil {
			log.Println("Scan error:", err)
			continue
		}

		var maxDailyLoss, maxDrawdown float64
		var maxOpenTrades int
		err := db.QueryRowContext(ctx,
			`SELECT max_daily_loss_pct, max_drawdown_pct, max_open_trades FROM firm_risk_rules WHERE firm_id=$1`,
			firmID).Scan(&maxDailyLoss, &maxDrawdown, &maxOpenTrades)
		if err != nil {
			log.Println("Rules fetch error:", err)
			continue
		}

		var peakEquity float64
		db.QueryRowContext(ctx,
			`SELECT COALESCE(MAX(equity),$1) FROM account_snapshots WHERE account_id=$2`,
			initialBal, id).Scan(&peakEquity)
		if peakEquity < equity {
			peakEquity = equity
		}

		dailyLossPct := 0.0
		if currentBal > 0 {
			dailyLossPct = (currentBal - equity) / currentBal * 100
		}
		drawdownPct := 0.0
		if peakEquity > 0 {
			drawdownPct = (peakEquity - equity) / peakEquity * 100
		}

		var openTrades int
		db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM positions WHERE account_id=$1 AND status='OPEN'`, id).Scan(&openTrades)

		log.Printf("ACCOUNT %s | daily_loss=%.4f%% / %.2f%% | drawdown=%.4f%% / %.2f%% | open=%d / %d",
			id[:8], dailyLossPct, maxDailyLoss, drawdownPct, maxDrawdown, openTrades, maxOpenTrades)

		// Save snapshot
		db.ExecContext(ctx, `
			INSERT INTO account_snapshots (account_id, balance, equity, floating_pnl, daily_drawdown_pct, peak_equity)
			VALUES ($1, $2, $3,
				COALESCE((SELECT SUM(floating_pnl) FROM positions WHERE account_id=$1 AND status='OPEN'),0),
				$4, $5)
		`, id, currentBal, equity, dailyLossPct, peakEquity)

		// Breach checks
		if dailyLossPct >= maxDailyLoss && maxDailyLoss > 0 {
			logBreach(ctx, db, id, firmID, "DAILY_LOSS_BREACH", dailyLossPct, maxDailyLoss)
		}
		if drawdownPct >= maxDrawdown && maxDrawdown > 0 {
			logBreach(ctx, db, id, firmID, "MAX_DRAWDOWN_BREACH", drawdownPct, maxDrawdown)
		}
		if openTrades > maxOpenTrades && maxOpenTrades > 0 {
			logBreach(ctx, db, id, firmID, "MAX_TRADES_BREACH", float64(openTrades), float64(maxOpenTrades))
		}
	}
	log.Printf("Risk check done — %d accounts checked", count)
}

func logBreach(ctx context.Context, db *sql.DB, accountID, firmID, eventType string, value, threshold float64) {
	var count int
	db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM risk_events WHERE account_id=$1 AND event_type=$2 AND created_at > NOW() - INTERVAL '1 hour'`,
		accountID, eventType).Scan(&count)
	if count > 0 {
		return
	}
	severity := "BREACH"
	if value >= threshold*1.5 {
		severity = "CRITICAL"
	}
	db.ExecContext(ctx, `
		INSERT INTO risk_events (account_id, firm_id, event_type, severity, rule_triggered, value_at_trigger, threshold, action_taken)
		VALUES ($1,$2,$3,$4,$5,$6,$7,'ACCOUNT_FLAGGED')
	`, accountID, firmID, eventType, severity, eventType, value, threshold)
	log.Printf("BREACH: %s | %s | value=%.2f threshold=%.2f", accountID[:8], eventType, value, threshold)
	fmt.Printf("🚨 BREACH DETECTED: %s on account %s\n", eventType, accountID[:8])
}
