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

type Account struct {
	ID             string
	FirmID         string
	TraderID       string
	InitialBalance float64
	CurrentBalance float64
	Equity         float64
}

type RiskRules struct {
	MaxDailyLossPct  float64
	MaxDrawdownPct   float64
	MaxOpenTrades    int
}

type RiskEngine struct {
	db *sql.DB
}

func NewRiskEngine(db *sql.DB) *RiskEngine {
	return &RiskEngine{db: db}
}

func (r *RiskEngine) Run(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	log.Println("Risk engine running — checking every 30s")
	r.checkAll(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.checkAll(ctx)
		}
	}
}

func (r *RiskEngine) checkAll(ctx context.Context) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT ta.id, ta.firm_id, ta.trader_id, ta.initial_balance, ta.current_balance, ta.equity
		FROM trading_accounts ta
		WHERE ta.is_active = true
	`)
	if err != nil {
		log.Println("ERROR fetching accounts:", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var acc Account
		rows.Scan(&acc.ID, &acc.FirmID, &acc.TraderID, &acc.InitialBalance, &acc.CurrentBalance, &acc.Equity)
		r.checkAccount(ctx, acc)
	}
}

func (r *RiskEngine) checkAccount(ctx context.Context, acc Account) {
	var rules RiskRules
	err := r.db.QueryRowContext(ctx, `
		SELECT max_daily_loss_pct, max_drawdown_pct, max_open_trades
		FROM firm_risk_rules WHERE firm_id=$1
	`, acc.FirmID).Scan(&rules.MaxDailyLossPct, &rules.MaxDrawdownPct, &rules.MaxOpenTrades)
	if err != nil {
		return
	}

	// Get today's starting balance from first snapshot of day
	var dayStartBalance float64
	err = r.db.QueryRowContext(ctx, `
		SELECT COALESCE(balance, $1) FROM account_snapshots
		WHERE account_id=$2 AND snapshot_at >= NOW()::date
		ORDER BY snapshot_at ASC LIMIT 1
	`, acc.InitialBalance, acc.ID).Scan(&dayStartBalance)
	if err != nil || dayStartBalance == 0 {
		dayStartBalance = acc.CurrentBalance
	}

	// Calculate metrics
	dailyLossPct := 0.0
	if dayStartBalance > 0 {
		dailyLossPct = (dayStartBalance - acc.Equity) / dayStartBalance * 100
	}

	// Peak equity for drawdown
	var peakEquity float64
	r.db.QueryRowContext(ctx, `
		SELECT COALESCE(MAX(equity), $1) FROM account_snapshots WHERE account_id=$2
	`, acc.InitialBalance, acc.ID).Scan(&peakEquity)
	if peakEquity == 0 {
		peakEquity = acc.InitialBalance
	}

	drawdownPct := 0.0
	if peakEquity > 0 {
		drawdownPct = (peakEquity - acc.Equity) / peakEquity * 100
	}

	// Open trades count
	var openTrades int
	r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM positions WHERE account_id=$1 AND status='OPEN'`, acc.ID).Scan(&openTrades)

	log.Printf("ACCOUNT %s | daily_loss=%.2f%% (limit %.2f%%) | drawdown=%.2f%% (limit %.2f%%) | open=%d",
		acc.ID[:8], dailyLossPct, rules.MaxDailyLossPct, drawdownPct, rules.MaxDrawdownPct, openTrades)

	// Check breaches
	if dailyLossPct >= rules.MaxDailyLossPct {
		r.handleBreach(ctx, acc, "DAILY_LOSS_BREACH",
			fmt.Sprintf("Daily loss %.2f%% exceeded limit %.2f%%", dailyLossPct, rules.MaxDailyLossPct),
			dailyLossPct, rules.MaxDailyLossPct)
	}

	if drawdownPct >= rules.MaxDrawdownPct {
		r.handleBreach(ctx, acc, "MAX_DRAWDOWN_BREACH",
			fmt.Sprintf("Drawdown %.2f%% exceeded limit %.2f%%", drawdownPct, rules.MaxDrawdownPct),
			drawdownPct, rules.MaxDrawdownPct)
	}

	if openTrades > rules.MaxOpenTrades {
		r.handleBreach(ctx, acc, "MAX_TRADES_BREACH",
			fmt.Sprintf("Open trades %d exceeded limit %d", openTrades, rules.MaxOpenTrades),
			float64(openTrades), float64(rules.MaxOpenTrades))
	}

	// Save snapshot
	r.db.ExecContext(ctx, `
		INSERT INTO account_snapshots (account_id, balance, equity, floating_pnl, daily_drawdown_pct, peak_equity)
		SELECT $1, $2, $3,
			COALESCE((SELECT SUM(floating_pnl) FROM positions WHERE account_id=$1 AND status='OPEN'), 0),
			$4, $5
	`, acc.ID, acc.CurrentBalance, acc.Equity, dailyLossPct, peakEquity)
}

func (r *RiskEngine) handleBreach(ctx context.Context, acc Account, eventType, detail string, value, threshold float64) {
	// Check if already logged in last hour
	var count int
	r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM risk_events
		WHERE account_id=$1 AND event_type=$2 AND created_at > NOW() - INTERVAL '1 hour'
	`, acc.ID, eventType).Scan(&count)
	if count > 0 {
		return
	}

	severity := "BREACH"
	if value >= threshold*1.5 {
		severity = "CRITICAL"
	}

	r.db.ExecContext(ctx, `
		INSERT INTO risk_events (account_id, firm_id, event_type, severity, rule_triggered, value_at_trigger, threshold, action_taken)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, acc.ID, acc.FirmID, eventType, severity, eventType, value, threshold, "ACCOUNT_FLAGGED")

	log.Printf("🚨 BREACH: account=%s type=%s value=%.2f threshold=%.2f severity=%s",
		acc.ID[:8], eventType, value, threshold, severity)
}

func startRiskEngine() {
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

	engine := NewRiskEngine(db)
	go engine.Run(ctx)

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	log.Println("Risk engine shutting down...")
}
