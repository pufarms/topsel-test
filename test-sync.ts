import { Pool } from "@neondatabase/serverless";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  console.log("=== 동기화 전 회원 예치금 ===");
  const before = await pool.query("SELECT id, member_name, company_name, deposit FROM members ORDER BY company_name");
  for (const r of before.rows) {
    console.log(`  ${r.company_name} (${r.member_name || '이름없음'}): ${r.deposit}원`);
  }
  
  const now = new Date();
  const kst = new Date(now.getTime() + 9*60*60*1000);
  const ds = kst.toISOString().slice(0,10).replace(/-/g,'');
  const ts = Date.now().toString().slice(-6);

  const entries = [
    { bkcode: `TEST${ds}${ts}000`, name: '홍길동', amount: 50000 },
    { bkcode: `TEST${ds}${ts}001`, name: '테스트동명', amount: 30000 },
    { bkcode: `TEST${ds}${ts}002`, name: '존재하지않는사람', amount: 20000 },
  ];

  for (const e of entries) {
    const existing = await pool.query("SELECT id FROM bankda_transactions WHERE bkcode=$1", [e.bkcode]);
    if (existing.rows.length > 0) { console.log(`  SKIP ${e.bkcode} already exists`); continue; }

    const matches = await pool.query("SELECT id, member_name, deposit FROM members WHERE REPLACE(member_name,' ','')=$1", [e.name]);
    
    if (matches.rows.length === 1) {
      const m = matches.rows[0];
      const newDep = m.deposit + e.amount;
      await pool.query("UPDATE members SET deposit=$1, updated_at=NOW() WHERE id=$2", [newDep, m.id]);
      await pool.query("INSERT INTO deposit_history(member_id, type, amount, balance_after, description) VALUES($1,'charge',$2,$3,$4)",
        [m.id, e.amount, newDep, `뱅크다 자동입금 (입금자: ${e.name})`]);
      await pool.query("INSERT INTO bankda_transactions(bkcode, bkjukyo, bkinput, bkoutput, match_status, matched_member_id, deposit_charged) VALUES($1,$2,$3,0,'matched',$4,true)",
        [e.bkcode, e.name, e.amount, m.id]);
      console.log(`\n✅ [자동매칭 성공] 입금자: ${e.name} → ${m.member_name}(${m.id})`);
      console.log(`   금액: ${e.amount}원 충전, 잔액: ${m.deposit}원 → ${newDep}원`);
      
    } else if (matches.rows.length > 1) {
      await pool.query("INSERT INTO bankda_transactions(bkcode, bkjukyo, bkinput, bkoutput, match_status, deposit_charged) VALUES($1,$2,$3,0,'duplicate_name',false)",
        [e.bkcode, e.name, e.amount]);
      console.log(`\n⚠️ [동명이인] 입금자: ${e.name} → ${matches.rows.length}명 매칭, 자동충전 안함`);
      for (const dup of matches.rows) {
        console.log(`   - ${dup.member_name} (${dup.id})`);
      }
      
    } else {
      await pool.query("INSERT INTO bankda_transactions(bkcode, bkjukyo, bkinput, bkoutput, match_status, deposit_charged) VALUES($1,$2,$3,0,'unmatched',false)",
        [e.bkcode, e.name, e.amount]);
      console.log(`\n❌ [미매칭] 입금자: ${e.name} → 일치하는 회원 없음`);
    }
  }

  console.log("\n=== 동기화 후 회원 예치금 ===");
  const after = await pool.query("SELECT id, member_name, company_name, deposit FROM members ORDER BY company_name");
  for (const r of after.rows) {
    console.log(`  ${r.company_name} (${r.member_name || '이름없음'}): ${r.deposit}원`);
  }

  console.log("\n=== bankda_transactions 결과 ===");
  const txns = await pool.query("SELECT bkjukyo, bkinput, match_status, matched_member_id, deposit_charged FROM bankda_transactions ORDER BY created_at DESC");
  for (const t of txns.rows) {
    const statusLabel = t.match_status === 'matched' ? '매칭완료' : t.match_status === 'duplicate_name' ? '동명이인' : t.match_status === 'unmatched' ? '미매칭' : t.match_status;
    console.log(`  [${statusLabel}] 입금자: ${t.bkjukyo}, 금액: ${t.bkinput}원, 충전여부: ${t.deposit_charged ? '✅' : '❌'}`);
  }

  console.log("\n=== deposit_history (뱅크다 자동입금) ===");
  const dh = await pool.query("SELECT dh.member_id, m.company_name, m.member_name, dh.amount, dh.balance_after, dh.description FROM deposit_history dh JOIN members m ON dh.member_id=m.id WHERE dh.description LIKE '%뱅크다%' ORDER BY dh.created_at DESC");
  for (const d of dh.rows) {
    console.log(`  ${d.company_name}(${d.member_name}): ${d.amount}원, 잔액: ${d.balance_after}원 - ${d.description}`);
  }

  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
