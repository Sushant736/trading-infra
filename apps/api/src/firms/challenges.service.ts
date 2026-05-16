import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ChallengesService {
  constructor(@InjectDataSource() private db: DataSource) {}

  async getPhases(firmId: string) {
    return this.db.query(
      `SELECT * FROM challenge_phases WHERE firm_id=$1 ORDER BY phase_number`, [firmId]);
  }

  async createPhase(firmId: string, data: any) {
    const [phase] = await this.db.query(`
      INSERT INTO challenge_phases (firm_id, phase_number, phase_name, balance, profit_target_pct, max_daily_loss_pct, max_drawdown_pct, max_open_trades, min_trading_days, news_trading_allowed, weekend_holding_allowed)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [firmId, data.phase_number, data.phase_name, data.balance||10000,
        data.profit_target_pct||10, data.max_daily_loss_pct||5,
        data.max_drawdown_pct||10, data.max_open_trades||5,
        data.min_trading_days||10, data.news_trading_allowed!==false,
        data.weekend_holding_allowed!==false]);
    return phase;
  }

  async updatePhase(phaseId: string, firmId: string, data: any) {
    await this.db.query(`
      UPDATE challenge_phases SET
        phase_name=$1, balance=$2, profit_target_pct=$3,
        max_daily_loss_pct=$4, max_drawdown_pct=$5, max_open_trades=$6,
        min_trading_days=$7, news_trading_allowed=$8, weekend_holding_allowed=$9,
        is_active=$10, updated_at=NOW()
      WHERE id=$11 AND firm_id=$12
    `, [data.phase_name, data.balance, data.profit_target_pct,
        data.max_daily_loss_pct, data.max_drawdown_pct, data.max_open_trades,
        data.min_trading_days, data.news_trading_allowed, data.weekend_holding_allowed,
        data.is_active, phaseId, firmId]);
    return { success: true };
  }

  async deletePhase(phaseId: string, firmId: string) {
    await this.db.query(`DELETE FROM challenge_phases WHERE id=$1 AND firm_id=$2`, [phaseId, firmId]);
    return { success: true };
  }

  async getTraderChallenges(firmId: string) {
    return this.db.query(`
      SELECT tc.*, t.full_name as trader_name, t.email as trader_email,
        cp.phase_name, ta.broker_account_id, ta.current_balance, ta.equity,
        ta.initial_balance,
        ROUND((ta.equity - ta.initial_balance) / ta.initial_balance * 100, 4) as actual_profit_pct
      FROM trader_challenges tc
      JOIN traders t ON t.id=tc.trader_id
      JOIN challenge_phases cp ON cp.id=tc.phase_id
      JOIN trading_accounts ta ON ta.id=tc.account_id
      WHERE tc.firm_id=$1
      ORDER BY tc.started_at DESC
    `, [firmId]);
  }

  async assignChallenge(firmId: string, data: any) {
    const { trader_id, phase_id, account_id } = data;
    const [phase] = await this.db.query(`SELECT * FROM challenge_phases WHERE id=$1 AND firm_id=$2`, [phase_id, firmId]);
    if (!phase) return { error: 'Phase not found' };
    const [challenge] = await this.db.query(`
      INSERT INTO trader_challenges (trader_id, account_id, firm_id, phase_id, phase_number, profit_target_pct, max_daily_loss_pct, max_drawdown_pct, min_trading_days)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [trader_id, account_id, firmId, phase_id, phase.phase_number,
        phase.profit_target_pct, phase.max_daily_loss_pct, phase.max_drawdown_pct, phase.min_trading_days]);
    return { success: true, challenge };
  }

  async checkChallengeProgress(firmId: string) {
    const challenges = await this.db.query(`
      SELECT tc.*, ta.equity, ta.initial_balance, ta.current_balance,
        cp.profit_target_pct as target_pct, cp.phase_number, cp.phase_name
      FROM trader_challenges tc
      JOIN trading_accounts ta ON ta.id=tc.account_id
      JOIN challenge_phases cp ON cp.id=tc.phase_id
      WHERE tc.firm_id=$1 AND tc.status='ACTIVE'
    `, [firmId]);

    const results: any[] = [];
    for (const ch of challenges) {
      const equity = parseFloat(ch.equity);
      const initial = parseFloat(ch.initial_balance);
      const profitPct = ((equity - initial) / initial) * 100;
      const targetPct = parseFloat(ch.target_pct);

      // Update profit pct
      await this.db.query(`UPDATE trader_challenges SET current_profit_pct=$1 WHERE id=$2`, [profitPct, ch.id]);

      // Check if passed
      if (targetPct > 0 && profitPct >= targetPct) {
        await this.db.query(`UPDATE trader_challenges SET status='PASSED', completed_at=NOW() WHERE id=$2`, [ch.id]);
        results.push({ challenge_id: ch.id, status: 'PASSED', trader: ch.trader_id, phase: ch.phase_name, profit: profitPct });
      }

      // Check if failed (drawdown breach)
      const balance = parseFloat(ch.current_balance);
      const drawdownPct = initial > 0 ? ((initial - equity) / initial) * 100 : 0;
      if (drawdownPct >= parseFloat(ch.max_drawdown_pct)) {
        await this.db.query(`UPDATE trader_challenges SET status='FAILED', failed_at=NOW() WHERE id=$2`, [ch.id]);
        results.push({ challenge_id: ch.id, status: 'FAILED', trader: ch.trader_id, phase: ch.phase_name, drawdown: drawdownPct });
      }
    }
    return results;
  }
}
