import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import './RRTrendline.css';

const PAD = { top: 20, right: 14, bottom: 20, left: 36 };

function getTopFactor(match, avgs) {
  const kd = match.deaths > 0 ? match.kills / match.deaths : match.kills;
  const candidates = [
    { label: 'ACS', val: match.acs,  avg: avgs.acs, fmt: v => Math.round(v),  unit: '' },
    { label: 'K/D', val: kd,         avg: avgs.kd,  fmt: v => v.toFixed(2),   unit: '' },
    { label: 'ADR', val: match.adr,  avg: avgs.adr, fmt: v => Math.round(v),  unit: '' },
  ];
  let best = null, bestScore = 0;
  for (const c of candidates) {
    if (!c.avg || c.val == null) continue;
    const rel = Math.abs(c.val - c.avg) / (c.avg || 1);
    if (rel > bestScore) { bestScore = rel; best = c; }
  }
  if (!best || bestScore < 0.05) return null;
  const up = best.val >= best.avg;
  return { label: best.label, value: `${best.fmt(best.val)}${best.unit}`, up };
}

export default function RRTrendline({ matches }) {
  const chartRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [hoverIdx, setHoverIdx] = useState(null);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setDims({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { data, avgs } = useMemo(() => {
    const withRR = matches
      .filter(m => m.rr_change !== null && m.rr_change !== undefined)
      .slice(0, 10)
      .reverse();
    let cum = 0;
    const rows = withRR.map((m, i) => {
      cum += m.rr_change;
      return { i, cum, rr: m.rr_change, map: m.map, agent: m.agent, won: m.won,
               kills: m.kills, deaths: m.deaths, acs: m.acs, hsPct: m.hsPct, adr: m.adr };
    });
    const n = rows.length || 1;
    const avgAcs = rows.reduce((s, d) => s + (d.acs || 0), 0) / n;
    const avgKd  = rows.reduce((s, d) => s + (d.deaths > 0 ? d.kills / d.deaths : d.kills), 0) / n;
    const avgAdr = rows.reduce((s, d) => s + (d.adr || 0), 0) / n;
    return { data: rows, avgs: { acs: avgAcs, kd: avgKd, adr: avgAdr } };
  }, [matches]);

  const handleMouseMove = useCallback((e) => {
    if (data.length < 2 || dims.w === 0) return;
    const plotW = dims.w - PAD.left - PAD.right;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    let nearest = 0, minDist = Infinity;
    data.forEach((_, i) => {
      const x = PAD.left + (i / (data.length - 1)) * plotW;
      const dist = Math.abs(x - mouseX);
      if (dist < minDist) { minDist = dist; nearest = i; }
    });
    setHoverIdx(nearest);
  }, [data, dims.w]);

  const { w, h } = dims;
  const ready = data.length >= 2 && w > 0 && h > 0;

  const plotW = w - PAD.left - PAD.right;
  const plotH = h - PAD.top - PAD.bottom;
  const ys = ready ? data.map(d => d.cum) : [];
  const minY = ready ? Math.min(0, ...ys) : 0;
  const maxY = ready ? Math.max(0, ...ys) : 1;
  const rangeY = maxY - minY || 1;

  function px(i) { return PAD.left + (i / (data.length - 1)) * plotW; }
  function py(y)  { return PAD.top + plotH - ((y - minY) / rangeY) * plotH; }

  // Grid ticks: ~4 horizontal lines, snap to nice multiples
  const gridTicks = useMemo(() => {
    if (!ready) return [];
    const range = maxY - minY;
    const step = range <= 20 ? 5 : range <= 50 ? 10 : range <= 100 ? 20 : 30;
    const ticks = [];
    const start = Math.ceil(minY / step) * step;
    for (let v = start; v <= maxY; v += step) ticks.push(v);
    return ticks;
  }, [ready, minY, maxY]);

  const zeroY = ready ? py(0) : 0;
  const linePath = ready
    ? data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(d.cum).toFixed(1)}`).join(' ')
    : '';

  // Linear regression
  const n = data.length;
  const sumX = data.reduce((s, _, i) => s + i, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = data.reduce((s, d, i) => s + i * d.cum, 0);
  const sumX2 = data.reduce((s, _, i) => s + i * i, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = ready ? (sumY - slope * sumX) / n : 0;

  const trendColor = slope >= 0 ? 'var(--win)' : 'var(--accent)';
  const trendY1 = ready ? py(intercept) : 0;
  const trendY2 = ready ? py(slope * (n - 1) + intercept) : 0;

  const totalRR = ys.length ? ys[ys.length - 1] : 0;
  const totalLabel = totalRR > 0 ? `+${totalRR}` : `${totalRR}`;
  const hovered = hoverIdx !== null ? data[hoverIdx] : null;
  const hoveredFactor = hovered ? getTopFactor(hovered, avgs) : null;

  if (data.length < 2) return null;

  return (
    <div className="rr-trendline">
      <div className="rr-trendline__header">
        <span className="rr-trendline__label">RR / {data.length} games</span>
        <span className="rr-trendline__total" style={{ color: trendColor }}>
          {totalLabel}
        </span>
      </div>

      <div
        className="rr-trendline__chart"
        ref={chartRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {hovered && (
          <div className="rr-trendline__tooltip">
            <div className="rr-trendline__tooltip-row rr-trendline__tooltip-header">
              <span className="rr-trendline__tooltip-map">{hovered.map}</span>
              <span className={`rr-trendline__tooltip-result ${hovered.won ? 'rr-trendline__tooltip-result--win' : 'rr-trendline__tooltip-result--loss'}`}>
                {hovered.won ? 'W' : 'L'}
              </span>
            </div>
            <div className="rr-trendline__tooltip-row">
              <span className="rr-trendline__tooltip-key">RR</span>
              <span
                className="rr-trendline__tooltip-rr"
                style={{ color: hovered.rr >= 0 ? 'var(--win)' : 'var(--accent)' }}
              >
                {hovered.rr > 0 ? `+${hovered.rr}` : hovered.rr}
              </span>
            </div>
            <div className="rr-trendline__tooltip-row">
              <span className="rr-trendline__tooltip-key">Net</span>
              <span className="rr-trendline__tooltip-cum" style={{ color: hovered.cum >= 0 ? 'var(--win)' : 'var(--accent)' }}>
                {hovered.cum > 0 ? `+${hovered.cum}` : hovered.cum}
              </span>
            </div>
            {hoveredFactor && (
              <div className="rr-trendline__tooltip-row rr-trendline__tooltip-factor">
                <span className="rr-trendline__tooltip-key">{hoveredFactor.label}</span>
                <span style={{ color: hoveredFactor.up ? 'var(--win)' : 'var(--accent)' }}>
                  {hoveredFactor.up ? '▲' : '▼'} {hoveredFactor.value}
                </span>
              </div>
            )}
          </div>
        )}

        {ready && (
          <svg width={w} height={h} className="rr-trendline__svg">
            {/* Grid lines + labels */}
            {gridTicks.map(v => {
              const y = py(v);
              const isZero = v === 0;
              return (
                <g key={v}>
                  <line
                    x1={PAD.left} y1={y}
                    x2={w - PAD.right} y2={y}
                    stroke={isZero ? 'var(--border)' : 'var(--border)'}
                    strokeWidth={isZero ? 1 : 0.5}
                    strokeDasharray={isZero ? 'none' : '3 3'}
                    opacity={isZero ? 0.7 : 0.4}
                  />
                  <text
                    x={PAD.left - 4}
                    y={y + 3.5}
                    textAnchor="end"
                    className="rr-trendline__grid-label"
                  >
                    {v > 0 ? `+${v}` : v}
                  </text>
                </g>
              );
            })}

            {/* Vertical grid lines (one per data point) */}
            {data.map((_, i) => (
              <line
                key={i}
                x1={px(i)} y1={PAD.top}
                x2={px(i)} y2={h - PAD.bottom}
                stroke="var(--border)"
                strokeWidth="0.5"
                opacity="0.25"
              />
            ))}

            {/* Cumulative curve */}
            <path
              d={linePath}
              fill="none"
              stroke="var(--fg)"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.3"
            />

            {/* Trend line (dotted) */}
            <line
              x1={PAD.left} y1={trendY1}
              x2={w - PAD.right} y2={trendY2}
              stroke={trendColor}
              strokeWidth="1.5"
              strokeDasharray="5 4"
              strokeLinecap="round"
              opacity="0.9"
            />

            {/* Crosshair */}
            {hoverIdx !== null && (
              <line
                x1={px(hoverIdx)} y1={PAD.top}
                x2={px(hoverIdx)} y2={h - PAD.bottom}
                stroke="var(--muted)"
                strokeWidth="1"
                strokeDasharray="3 2"
                opacity="0.6"
              />
            )}

            {/* Data points */}
            {data.map((d, i) => (
              <circle
                key={i}
                cx={px(i)}
                cy={py(d.cum)}
                r={hoverIdx === i ? 5 : 2.5}
                fill={d.rr >= 0 ? 'var(--win)' : 'var(--accent)'}
                style={{ transition: 'r 0.1s ease' }}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
