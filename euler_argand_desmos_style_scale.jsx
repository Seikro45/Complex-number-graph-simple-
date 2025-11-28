import React, { useMemo, useRef, useEffect, useState } from "react";

// Euler on the Argand Plane — scalable like Desmos
// Tweaks:
// 1) Smart grid stepping (1–2–5 × 10^k) so ticks unclutter as you zoom out.
// 2) Huge magnitudes via scientific input for r (mantissa × 10^exp), up to ~1e+300.
// 3) Zoom control (pixels per unit).

export default function EulerArgandDesmos() {
  // math state
  const [theta, setTheta] = useState(0); // radians (unbounded)
  const [mantissa, setMantissa] = useState(1); // 0 <= m < 10 (we allow 0)
  const [exp, setExp] = useState(0); // integer exponent
  const [auto, setAuto] = useState(false);
  const [showProjections, setShowProjections] = useState(true);
  const [showArc, setShowArc] = useState(true);

  // view state
  const [zoom, setZoom] = useState(100); // pixels per unit

  const width = 760;
  const height = 560;
  const center = { x: width / 2, y: height / 2 };

  // derive r safely using Number with scientific form; stay inside JS range (~1e308)
  const r = useMemo(() => {
    const clampedMantissa = Number.isFinite(mantissa) ? mantissa : 0;
    const clampedExp = Number.isFinite(exp) ? Math.max(-300, Math.min(300, Math.trunc(exp))) : 0;
    return clampedMantissa * Math.pow(10, clampedExp);
  }, [mantissa, exp]);

  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!auto) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      setTheta((prev) => prev + dt * 0.8);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [auto]);

  // complex point
  const cos = useMemo(() => Math.cos(theta), [theta]);
  const sin = useMemo(() => Math.sin(theta), [theta]);
  const point = useMemo(() => ({ x: r * cos, y: r * sin }), [r, cos, sin]);

  // world<->screen
  const unit = zoom; // px per world unit
  const toPx = (x: number, y: number) => ({ x: center.x + x * unit, y: center.y - y * unit });
  const pPx = toPx(point.x, point.y);

  // DESMOS-LIKE GRID: pick 1–2–5×10^k step so ~10 lines across half-span
  function niceStep(spanUnits: number, targetLines = 10) {
    const raw = spanUnits / targetLines;
    const pow10 = Math.pow(10, Math.floor(Math.log10(Math.max(1e-30, raw))));
    const norm = raw / pow10;
    let nice;
    if (norm < 1.5) nice = 1;
    else if (norm < 3.5) nice = 2;
    else if (norm < 7.5) nice = 5;
    else nice = 10;
    return nice * pow10;
  }

  // visible world ranges
  const xHalfSpan = center.x / unit; // units from 0 to edge
  const yHalfSpan = center.y / unit;
  const xStep = niceStep(xHalfSpan);
  const yStep = niceStep(yHalfSpan);

  // build tick arrays centered at 0
  function ticks(step: number, half: number) {
    const out: number[] = [];
    const start = -Math.ceil(half / step) * step;
    const end = Math.ceil(half / step) * step;
    for (let v = start; v <= end + 1e-12; v += step) out.push(+(v.toFixed(12)));
    return out;
  }
  const xTicks = ticks(xStep, xHalfSpan);
  const yTicks = ticks(yStep, yHalfSpan);

  // Angle arc (trim to unit circle radius for clarity)
  const arcRadius = unit * Math.min(1, r);
  const arcEnd = toPx(Math.cos(theta) * Math.min(1, r), Math.sin(theta) * Math.min(1, r));
  const largeArc = Math.abs(theta) > Math.PI ? 1 : 0;
  const sweep = theta >= 0 ? 0 : 1; // SVG y-down
  const arcPath = `M ${center.x + arcRadius} ${center.y} A ${arcRadius} ${arcRadius} 0 ${largeArc} ${sweep} ${arcEnd.x} ${arcEnd.y}`;

  // formatting helpers
  const fmt = (v: number) => {
    if (!Number.isFinite(v)) return "∞";
    const a = Math.abs(v);
    if (a === 0) return "0";
    if (a >= 1e6 || a < 1e-3) return v.toExponential(2);
    return v.toFixed(3).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  };

  // Avoid rendering a massive dashed circle that would choke the SVG
  const radiusPx = unit * Math.abs(r);
  const showRCircle = Number.isFinite(radiusPx) && radiusPx < Math.max(width, height) * 3;

  return (
    <div className="w-full h-full flex flex-col gap-4 p-6 text-gray-900">
      <h1 className="text-2xl font-semibold">Euler on the Argand Plane — Desmos-Style</h1>
      <p className="text-sm text-gray-600">Smart grid + huge magnitudes. Type <span className="font-mono">r = m × 10^exp</span>, tweak zoom, and rotate.</p>

      <div className="grid grid-cols-1 lg:grid-cols-[760px_1fr] gap-6 items-start">
        {/* GRAPH */}
        <div className="rounded-2xl shadow-sm border border-gray-200 bg-white overflow-hidden">
          <svg width={width} height={height} className="block">
            {/* defs */}
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-gray-500" />
              </marker>
            </defs>

            {/* grid */}
            {xTicks.map((x) => {
              const xPx = toPx(x, 0).x;
              return <line key={`gx-${x}`} x1={xPx} y1={0} x2={xPx} y2={height} stroke="#f1f5f9" />;
            })}
            {yTicks.map((y) => {
              const yPx = toPx(0, y).y;
              return <line key={`gy-${y}`} x1={0} y1={yPx} x2={width} y2={yPx} stroke="#f1f5f9" />;
            })}

            {/* axes */}
            <line x1={0} y1={center.y} x2={width} y2={center.y} stroke="#334155" strokeWidth={2} />
            <line x1={center.x} y1={0} x2={center.x} y2={height} stroke="#334155" strokeWidth={2} />
            <text x={width - 14} y={center.y - 8} textAnchor="end" fontSize={12} className="fill-gray-600">Re</text>
            <text x={center.x + 10} y={14} textAnchor="start" fontSize={12} className="fill-gray-600">Im</text>

            {/* tick labels (sparse due to nice step) */}
            {xTicks.filter((v) => Math.abs(v) > 1e-12).map((x) => (
              <text key={`lx-${x}`} x={toPx(x, 0).x} y={center.y + 16} textAnchor="middle" fontSize={11} className="fill-gray-700">{fmt(x)}</text>
            ))}
            {yTicks.filter((v) => Math.abs(v) > 1e-12).map((y) => (
              <text key={`ly-${y}`} x={center.x - 8} y={toPx(0, y).y + 4} textAnchor="end" fontSize={11} className="fill-gray-700">{fmt(y)}</text>
            ))}

            {/* unit circle */}
            <circle cx={center.x} cy={center.y} r={unit} className="stroke-sky-400 fill-transparent" strokeWidth={2} />
            <text x={center.x + unit + 8} y={center.y - 8} fontSize={11} className="fill-sky-600">|z| = 1</text>

            {/* r circle (dashed) if reasonable */}
            {showRCircle && Math.abs(r - 1) > 1e-12 && (
              <>
                <circle cx={center.x} cy={center.y} r={radiusPx} className="stroke-purple-400 fill-transparent" strokeDasharray="6 6" strokeWidth={2} />
                <text x={center.x + radiusPx + 8} y={center.y - 8} fontSize={11} className="fill-purple-700">|z| = {fmt(r)}</text>
              </>
            )}

            {/* angle arc */}
            {showArc && (
              <path d={arcPath} className="fill-transparent stroke-amber-500" strokeWidth={3} markerEnd="url(#arrow)" />
            )}

            {/* projections */}
            {showProjections && Number.isFinite(pPx.x) && Number.isFinite(pPx.y) && (
              <>
                <line x1={pPx.x} y1={pPx.y} x2={pPx.x} y2={center.y} stroke="#94a3b8" strokeDasharray="6 6" />
                <line x1={pPx.x} y1={pPx.y} x2={center.x} y2={pPx.y} stroke="#94a3b8" strokeDasharray="6 6" />
                <rect x={pPx.x - 10} y={center.y - 10} width={10} height={10} className="fill-transparent" stroke="#cbd5e1" />
              </>
            )}

            {/* vector + point (only if finite) */}
            {Number.isFinite(pPx.x) && Number.isFinite(pPx.y) && (
              <>
                <line x1={center.x} y1={center.y} x2={pPx.x} y2={pPx.y} stroke="#0f766e" strokeWidth={3} />
                <circle cx={pPx.x} cy={pPx.y} r={5} className="fill-emerald-600" />
                <text x={pPx.x + 8} y={pPx.y - 8} fontSize={12} className="fill-emerald-700">
                  z = {fmt(point.x)} + {fmt(point.y)}i
                </text>
              </>
            )}
          </svg>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-gray-200 p-4 bg-white shadow-sm">
            <div className="grid grid-cols-1 gap-4">
              {/* θ controls */}
              <div>
                <label className="text-sm font-medium">Rotation θ (radians)</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={-Math.PI} max={Math.PI} step={0.001} value={theta % (2*Math.PI)} onChange={(e) => setTheta(parseFloat(e.target.value))} className="w-full" />
                  <input type="number" step={0.001} value={theta} onChange={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) setTheta(v); }} className="w-28 border rounded-md px-2 py-1 text-sm font-mono" title="θ in radians" />
                </div>
                <div className="mt-1 text-xs text-gray-600">Slider wraps to [−π, π]; numeric box is unbounded.</div>
              </div>

              {/* r controls (scientific) */}
              <div>
                <label className="text-sm font-medium">Magnitude r = m × 10^exp</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">m</span>
                    <input type="number" step={0.001} value={mantissa} onChange={(e) => setMantissa(parseFloat(e.target.value))} className="w-24 border rounded-md px-2 py-1 text-sm font-mono" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">exp</span>
                    <input type="number" step={1} value={exp} onChange={(e) => setExp(parseInt(e.target.value || '0', 10))} className="w-24 border rounded-md px-2 py-1 text-sm font-mono" />
                  </div>
                </div>
                <div className="mt-2 text-sm font-mono text-gray-700">r = {fmt(r)}</div>
              </div>

              {/* zoom */}
              <div>
                <label className="text-sm font-medium">Zoom (pixels per unit)</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={5} max={300} step={1} value={zoom} onChange={(e) => setZoom(parseInt(e.target.value))} className="w-full" />
                  <input type="number" min={1} max={600} step={1} value={zoom} onChange={(e) => { const v = parseInt(e.target.value || '0', 10); if (!Number.isNaN(v) && v > 0) setZoom(v); }} className="w-24 border rounded-md px-2 py-1 text-sm font-mono" />
                </div>
                <div className="mt-1 text-xs text-gray-600">Grid auto-scales (1–2–5×10^k). Increase zoom to see detail; decrease to fit huge values.</div>
              </div>

              {/* toggles + auto */}
              <div className="flex gap-3 items-center flex-wrap">
                <button onClick={() => setAuto((v) => !v)} className={`px-3 py-1.5 rounded-xl text-sm font-medium shadow-sm border ${auto ? "bg-emerald-600 text-white border-emerald-700" : "bg-white text-gray-800 border-gray-300"}`}>{auto ? "Pause" : "Rotate"}</button>
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={showProjections} onChange={(e) => setShowProjections(e.target.checked)} /> Show projections</label>
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={showArc} onChange={(e) => setShowArc(e.target.checked)} /> Show angle arc</label>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 p-4 bg-white shadow-sm text-sm">
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div>cos θ = {fmt(cos)}</div>
              <div>sin θ = {fmt(sin)}</div>
              <div>Re(z) = r·cos θ = {fmt(r * cos)}</div>
              <div>Im(z) = r·sin θ = {fmt(r * sin)}i</div>
            </div>
            <p className="mt-2 text-gray-600">For astronomical r (e.g., 1e60), keep zoom modest so the point stays in-frame. Labels switch to scientific notation when needed.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
