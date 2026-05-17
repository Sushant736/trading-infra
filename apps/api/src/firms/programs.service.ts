import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ProgramsService {
  constructor(@InjectDataSource() private db: DataSource) {}

  async getPrograms(firmId: string) {
    const programs = await this.db.query(
      `SELECT cp.*, (SELECT COUNT(*) FROM program_phases WHERE program_id=cp.id) as phase_count
       FROM challenge_programs cp WHERE cp.firm_id=$1 ORDER BY cp.created_at`, [firmId]);
    for (const p of programs) {
      p.phases = await this.db.query(
        `SELECT * FROM program_phases WHERE program_id=$1 ORDER BY phase_order`, [p.id]);
    }
    return programs;
  }

  async createProgram(firmId: string, data: any) {
    const [program] = await this.db.query(`
      INSERT INTO challenge_programs (firm_id, name, type, description)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [firmId, data.name, data.type, data.description||'']);
    return program;
  }

  async updateProgram(programId: string, firmId: string, data: any) {
    await this.db.query(`
      UPDATE challenge_programs SET name=$1, description=$2, is_active=$3, updated_at=NOW()
      WHERE id=$4 AND firm_id=$5
    `, [data.name, data.description||'', data.is_active!==false, programId, firmId]);
    return { success: true };
  }

  async deleteProgram(programId: string, firmId: string) {
    await this.db.query(`DELETE FROM challenge_programs WHERE id=$1 AND firm_id=$2`, [programId, firmId]);
    return { success: true };
  }

  async upsertPhase(programId: string, firmId: string, data: any) {
    const existing = await this.db.query(
      `SELECT id FROM program_phases WHERE program_id=$1 AND phase_order=$2`, [programId, data.phase_order]);
    const vals = [data.name, data.phase_type||'evaluation', data.balance||10000, data.price||0,
        data.profit_target_pct||10, data.max_daily_loss_pct||5, data.max_drawdown_pct||10,
        data.max_open_trades||5, data.max_lot_size||0, data.min_trading_days||10,
        data.min_trading_days_per_week||0, data.consistency_rule_enabled||false,
        data.consistency_pct||30, data.news_trading_allowed!==false,
        data.weekend_holding_allowed!==false, data.copy_trading_allowed||false,
        data.ea_trading_allowed!==false, data.leverage||100];
    if (existing.length) {
      await this.db.query(`
        UPDATE program_phases SET
          name=$1, phase_type=$2, balance=$3, price=$4,
          profit_target_pct=$5, max_daily_loss_pct=$6, max_drawdown_pct=$7,
          max_open_trades=$8, max_lot_size=$9, min_trading_days=$10,
          min_trading_days_per_week=$11, consistency_rule_enabled=$12, consistency_pct=$13,
          news_trading_allowed=$14, weekend_holding_allowed=$15,
          copy_trading_allowed=$16, ea_trading_allowed=$17, leverage=$18
        WHERE program_id=$19 AND phase_order=$20
      `, [...vals, programId, data.phase_order]);
    } else {
      await this.db.query(`
        INSERT INTO program_phases (program_id, firm_id, phase_order, name, phase_type,
          balance, price, profit_target_pct, max_daily_loss_pct, max_drawdown_pct,
          max_open_trades, max_lot_size, min_trading_days, min_trading_days_per_week,
          consistency_rule_enabled, consistency_pct, news_trading_allowed,
          weekend_holding_allowed, copy_trading_allowed, ea_trading_allowed, leverage)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      `, [programId, firmId, data.phase_order, ...vals]);
    }
    return { success: true };
  }

  async deletePhase(programId: string, phaseOrder: number) {
    await this.db.query(`DELETE FROM program_phases WHERE program_id=$1 AND phase_order=$2`, [programId, phaseOrder]);
    return { success: true };
  }

  async getProgramById(programId: string) {
    const [program] = await this.db.query(`SELECT * FROM challenge_programs WHERE id=$1`, [programId]);
    if (!program) return null;
    program.phases = await this.db.query(`SELECT * FROM program_phases WHERE program_id=$1 ORDER BY phase_order`, [programId]);
    return program;
  }
}
