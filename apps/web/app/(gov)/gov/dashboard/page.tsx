import { getGovKpis, getCoverage, getDeptPerformance, getTrend } from '@/lib/queries/dashboard';
import { OFFICER } from '@/components/gov/fixtures';
import { GovNav } from '../_components/GovNav';

export const metadata = { title: 'Dashboard — Swaram Gov' };

const KPI_LABELS: [key: 'open' | 'in_progress' | 'overdue' | 'awaiting_verify' | 'resolved_30d', label: string, hint: string][] = [
  ['open', 'OPEN', 'not yet in progress'],
  ['in_progress', 'IN PROGRESS', 'actively worked'],
  ['overdue', 'OVERDUE', 'Tier 1 · SLA breached'],
  ['awaiting_verify', 'AWAITING VERIFY', 'citizens are judging it'],
  ['resolved_30d', 'RESOLVED · 30D', 'closed loop, last 30 days'],
];

export default async function DashboardPage() {
  const [kpis, coverage, depts, trend] = await Promise.all([
    getGovKpis(),
    getCoverage(),
    getDeptPerformance(),
    getTrend(14),
  ]);

  const isFixtureMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const totalIssues = coverage.reduce((a, c) => a + c.issues, 0);

  return (
    <div className="sw-shell" data-panes="2">
      <GovNav officerName={OFFICER.name} jurisdiction={OFFICER.jurisdiction} />
      <main className="sw-pane sw-scroll">
      <div className="sw-head">
        <div>
          <h1>Dashboard</h1>
          <div className="sw-sub">{OFFICER.department} · {OFFICER.jurisdiction}</div>
        </div>
        {isFixtureMode && <span className="sw-fixture">SAMPLE DATA · SUPABASE NOT CONFIGURED</span>}
      </div>

      <div className="sw-kpis">
        {KPI_LABELS.map(([key, label, hint]) => (
          <div key={key}>
            <div className="n sw-tnum">{kpis[key]}</div>
            <div className="k">{label}</div>
            <div className="h">{hint}</div>
          </div>
        ))}
      </div>

      <section className="sw-sect">
        <div className="sw-label" style={{ marginBottom: 8 }}>
          ISSUES BY DISTRICT · {coverage.length} JURISDICTIONS · {totalIssues} ISSUES
        </div>
        <p className="sw-note" style={{ marginBottom: 12 }}>
          <strong>Reading this table</strong>
          "Level" is inferred from the jurisdiction name (e.g. a "· District" suffix), not a verified
          administrative boundary — there is no ward/district polygon data in this repo yet, so this is
          "issues by named place," not point-in-polygon routing. Tier 1/2/3 mirror routing_tier:
          onboarded officer, contactable-but-unonboarded authority, or no mapped authority at all.
        </p>
        <table className="sw-table">
          <thead>
            <tr>
              <th>District / jurisdiction</th>
              <th>Level</th>
              <th className="num">Issues</th>
              <th className="num">Tier 1</th>
              <th className="num">Tier 2</th>
              <th className="num">Tier 3</th>
              <th style={{ width: 140 }}>Onboarded coverage</th>
            </tr>
          </thead>
          <tbody>
            {coverage.map((row) => {
              const pct = row.issues ? Math.round((row.tier1 / row.issues) * 100) : 0;
              const tone = pct >= 70 ? 'ok' : pct >= 30 ? 'mid' : 'rage';
              return (
                <tr key={row.id}>
                  <td className="name">{row.name}</td>
                  <td>
                    <span className="sw-pill" data-tone={row.level === 'DISTRICT' ? 'gov' : 'muted'}>
                      {row.level}
                    </span>
                  </td>
                  <td className="num sw-tnum">{row.issues}</td>
                  <td className="num sw-tnum">{row.tier1}</td>
                  <td className="num sw-tnum">{row.tier2}</td>
                  <td className="num sw-tnum">{row.tier3}</td>
                  <td>
                    <span className="sw-meter" data-tone={tone}>
                      <i style={{ width: `${pct}%` }} />
                    </span>
                    <div className="sw-micro" style={{ marginTop: 3 }}>{pct}% onboarded</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="sw-sect">
        <div className="sw-label" style={{ marginBottom: 8 }}>DEPARTMENT PERFORMANCE</div>
        <table className="sw-table">
          <thead>
            <tr>
              <th>Department</th>
              <th className="num">Total</th>
              <th className="num">Resolved</th>
              <th style={{ width: 130 }}>Resolution rate</th>
              <th className="num">SLA compliance</th>
              <th className="num">Median resolve</th>
              <th className="num">Reopened</th>
            </tr>
          </thead>
          <tbody>
            {depts.map((row) => (
              <tr key={row.id}>
                <td className="name">{row.name}</td>
                <td className="num sw-tnum">{row.total}</td>
                <td className="num sw-tnum">{row.resolved}</td>
                <td>
                  <span className="sw-meter" data-tone={row.resolution_rate >= 60 ? 'ok' : row.resolution_rate >= 30 ? 'mid' : 'rage'}>
                    <i style={{ width: `${row.resolution_rate}%` }} />
                  </span>
                  <div className="sw-micro" style={{ marginTop: 3 }}>{row.resolution_rate}%</div>
                </td>
                <td className="num sw-tnum">
                  {row.sla_compliance === null ? <span className="sw-faded">no SLA</span> : `${row.sla_compliance}%`}
                </td>
                <td className="num sw-tnum">
                  {row.median_resolve_days === null ? <span className="sw-faded">—</span> : `${row.median_resolve_days}d`}
                </td>
                <td className="num sw-tnum">{row.reopened}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="sw-sect">
        <div className="sw-label" style={{ marginBottom: 8 }}>14-DAY TREND · CREATED VS RESOLVED</div>
        <TrendChart points={trend} />
      </section>
      </main>
    </div>
  );
}

function TrendChart({ points }: { points: { day: string; created: number; resolved: number }[] }) {
  if (points.length === 0) return <p className="sw-empty">No trend data.</p>;
  const W = 640;
  const H = 140;
  const PAD = 24;
  const max = Math.max(1, ...points.map((p) => Math.max(p.created, p.resolved)));
  const x = (i: number) => PAD + (i / Math.max(1, points.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const line = (key: 'created' | 'resolved') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');

  return (
    <>
      <svg className="sw-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="14-day created vs resolved trend">
        {[0, 0.5, 1].map((t) => (
          <line key={t} className="grid" x1={PAD} x2={W - PAD} y1={PAD + t * (H - PAD * 2)} y2={PAD + t * (H - PAD * 2)} />
        ))}
        <line className="axis" x1={PAD} x2={PAD} y1={PAD} y2={H - PAD} />
        <line className="axis" x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} />
        <path d={line('created')} fill="none" stroke="#9E351B" strokeWidth={1.6} />
        <path d={line('resolved')} fill="none" stroke="#52613A" strokeWidth={1.6} />
        <text x={PAD} y={H - 8}>{points[0]?.day}</text>
        <text x={W - PAD} y={H - 8} textAnchor="end">{points[points.length - 1]?.day}</text>
      </svg>
      <div className="sw-legend">
        <span><i style={{ background: '#9E351B' }} />Created</span>
        <span><i style={{ background: '#52613A' }} />Resolved</span>
      </div>
    </>
  );
}
