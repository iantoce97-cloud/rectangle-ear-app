import React, { useEffect, useMemo, useState } from 'react';
import {
  Ruler,
  MousePointer2,
  Move,
  Plus,
  Trash2,
  Image,
  Type,
  Grid3X3,
  Upload,
  Wrench
} from 'lucide-react';

export default function App() {
  const [width, setWidth] = useState(1000);
  const [height, setHeight] = useState(600);

  const [manualMode, setManualMode] = useState(false);
  const [hEars, setHEars] = useState(3);
  const [vEars, setVEars] = useState(2);

  const [activeTool, setActiveTool] = useState(null);

  // MEASURE TOOL
  const [measurePoints, setMeasurePoints] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [hoverSnap, setHoverSnap] = useState(null);

  const earLength = 30;
  const earDepth = 10;
  const margin = 90;
  const scale = 0.35;

  const MIN_SPACING = 240;
  const MAX_SPACING = 400;

  const clearMeasureTool = () => {
    setActiveTool(null);
    setMeasurePoints([]);
    setMeasurements([]);
    setHoverSnap(null);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === 'm') {
        setActiveTool(prev => {
          if (prev === 'measure') {
            setMeasurePoints([]);
            setMeasurements([]);
            setHoverSnap(null);
            return null;
          }

          return 'measure';
        });
      }

      if (e.key === 'Escape') {
        clearMeasureTool();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const points = useMemo(() => {
    const ears = [];

    const addAutoSide = (sideLength, orientation) => {
      const usable = sideLength - 2 * margin - earLength;
      if (usable < 0) return;

      let gaps = 1;
      while (usable / gaps > MAX_SPACING) gaps++;
      while (gaps > 1 && usable / gaps < MIN_SPACING) gaps--;

      const spacing = usable / gaps;

      for (let i = 0; i <= gaps; i++) {
        ears.push({
          orientation,
          pos: margin + i * spacing
        });
      }
    };

    const addManualSide = (sideLength, orientation, count) => {
      const usable = sideLength - 2 * margin - earLength;
      if (usable < 0) return;

      if (count === 1) {
        const center = sideLength / 2;
        const pos = center - earLength / 2;
        ears.push({ orientation, pos });
        return;
      }

      const spacing = usable / (count - 1);

      for (let i = 0; i < count; i++) {
        ears.push({
          orientation,
          pos: margin + i * spacing
        });
      }
    };

    if (!manualMode) {
      addAutoSide(width, 'top');
      addAutoSide(width, 'bottom');
      addAutoSide(height, 'left');
      addAutoSide(height, 'right');
    } else {
      addManualSide(width, 'top', hEars);
      addManualSide(width, 'bottom', hEars);
      addManualSide(height, 'left', vEars);
      addManualSide(height, 'right', vEars);
    }

    return ears;
  }, [width, height, manualMode, hEars, vEars]);

  const grouped = useMemo(
    () => ({
      top: points.filter(e => e.orientation === 'top').sort((a, b) => a.pos - b.pos),
      right: points.filter(e => e.orientation === 'right').sort((a, b) => a.pos - b.pos),
      bottom: points.filter(e => e.orientation === 'bottom').sort((a, b) => b.pos - a.pos),
      left: points.filter(e => e.orientation === 'left').sort((a, b) => b.pos - a.pos),
    }),
    [points]
  );

  const buildVertices = () => {
    const verts = [[earDepth, earDepth]];

    grouped.top.forEach(ear => {
      const p = ear.pos;
      verts.push([p, earDepth], [p, 0], [p + earLength, 0], [p + earLength, earDepth]);
    });

    verts.push([width - earDepth, earDepth]);

    grouped.right.forEach(ear => {
      const p = ear.pos;
      verts.push([width - earDepth, p], [width, p], [width, p + earLength], [width - earDepth, p + earLength]);
    });

    verts.push([width - earDepth, height - earDepth]);

    grouped.bottom.forEach(ear => {
      const p = ear.pos;
      verts.push([p + earLength, height - earDepth], [p + earLength, height], [p, height], [p, height - earDepth]);
    });

    verts.push([earDepth, height - earDepth]);

    grouped.left.forEach(ear => {
      const p = ear.pos;
      verts.push([earDepth, p + earLength], [0, p + earLength], [0, p], [earDepth, p]);
    });

    return verts;
  };

  const snapPoints = useMemo(() => buildVertices(), [grouped, width, height]);

  const buildOutlinePath = () => {
    const verts = buildVertices();
    return verts
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${v[0] * scale} ${v[1] * scale}`)
      .join(' ') + ' Z';
  };

  const getSvgPoint = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();

    const viewBox = svg.viewBox.baseVal;

    const x =
      viewBox.x +
      ((e.clientX - rect.left) / rect.width) * viewBox.width;

    const y =
      viewBox.y +
      ((e.clientY - rect.top) / rect.height) * viewBox.height;

    return {
      x: x / scale,
      y: y / scale
    };
  };

  const findNearestSnapPoint = (x, y) => {
    let best = null;
    let bestDist = Infinity;

    snapPoints.forEach(([px, py]) => {
      const dx = px - x;
      const dy = py - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bestDist) {
        bestDist = dist;
        best = [px, py];
      }
    });

    const snapToleranceMm = 30;

    if (bestDist <= snapToleranceMm) {
      return best;
    }

    return null;
  };

  const handlePreviewMouseMove = (e) => {
    if (activeTool !== 'measure') return;

    const { x, y } = getSvgPoint(e);
    const snapped = findNearestSnapPoint(x, y);

    setHoverSnap(snapped);
  };

  const handlePreviewMouseLeave = () => {
    setHoverSnap(null);
  };

  const handlePreviewClick = (e) => {
    if (activeTool !== 'measure') return;

    e.stopPropagation();

    const { x, y } = getSvgPoint(e);
    const snapped = findNearestSnapPoint(x, y);

    if (!snapped) return;

    const nextPoints = [...measurePoints, snapped];

    if (nextPoints.length === 2) {
      const [p1, p2] = nextPoints;

      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const distance = Math.sqrt(dx * dx + dy * dy);

      const mid = [
        (p1[0] + p2[0]) / 2,
        (p1[1] + p2[1]) / 2
      ];

      setMeasurements(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          p1,
          p2,
          distance,
          mid,
          selected: false
        }
      ]);

      setMeasurePoints([]);
    } else {
      setMeasurePoints(nextPoints);
    }
  };

  const downloadDXF = () => {
    const raw = buildVertices();

    const verts = raw.map(([x, y]) => [
      Math.round(x * 1000) / 1000,
      Math.round((height - y) * 1000) / 1000
    ]);

    const cleaned = verts.filter((p, i, arr) => {
      if (i === 0) return true;
      const prev = arr[i - 1];
      return !(p[0] === prev[0] && p[1] === prev[1]);
    });

    let dxf = '';
    dxf += '0\nSECTION\n2\nENTITIES\n';
    dxf += '0\nPOLYLINE\n8\n0\n66\n1\n70\n1\n';

    cleaned.forEach(([x, y]) => {
      dxf += '0\nVERTEX\n8\n0\n';
      dxf += `10\n${x}\n20\n${y}\n30\n0\n`;
    });

    dxf += '0\nSEQEND\n0\nENDSEC\n0\nEOF';

    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `rectangle-${width}x${height}.dxf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };

  const ToolButton = ({ id, icon: Icon, label, shortcut, disabled = false }) => {
    const active = activeTool === id;

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;

          if (id === 'measure' && activeTool === 'measure') {
            clearMeasureTool();
            return;
          }

          setActiveTool(id);
        }}
        className={[
          'w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition border',
          active
            ? 'bg-slate-900 text-white border-slate-900 shadow-md'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
          disabled
            ? 'opacity-40 cursor-not-allowed hover:bg-white'
            : 'cursor-pointer'
        ].join(' ')}
      >
        <Icon size={18} />
        <span className="flex-1 text-left">{label}</span>
        {shortcut && (
          <span className={[
            'text-[10px] px-1.5 py-0.5 rounded border',
            active ? 'border-white/30 text-white/80' : 'border-slate-200 text-slate-400'
          ].join(' ')}>
            {shortcut}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      className="min-h-screen bg-slate-100 flex items-center justify-center p-6"
      onClick={() => {
        if (activeTool === 'measure') {
          setMeasurePoints([]);
          setMeasurements([]);
        }
      }}
    >
      <div
        className="w-full max-w-7xl grid lg:grid-cols-[420px_1fr] gap-6"
        onClick={(e) => e.stopPropagation()}
      >

        {/* LEFT PANEL - CONTROLS */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-6">

          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Ear Pattern Generator
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Parametric CAD DXF generator
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500">Width (mm)</label>
              <input
                type="number"
                value={width}
                onChange={e => setWidth(+e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">Height (mm)</label>
              <input
                type="number"
                value={height}
                onChange={e => setHeight(+e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={manualMode}
                onChange={e => setManualMode(e.target.checked)}
              />
              Manual Mode
            </label>

            <p className="text-xs text-slate-500 mt-1">
              Toggle between automatic optimization and fixed ear count
            </p>
          </div>

          {manualMode && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500">
                  Horizontal ears
                </label>
                <input
                  type="number"
                  min="1"
                  value={hEars}
                  onChange={e => setHEars(Math.max(1, +e.target.value || 1))}
                  className="w-full mt-1 p-2 border rounded-lg"
                />
                <p className="text-[11px] text-slate-400 mt-1">Top + bottom</p>
              </div>

              <div>
                <label className="text-xs text-slate-500">
                  Vertical ears
                </label>
                <input
                  type="number"
                  min="1"
                  value={vEars}
                  onChange={e => setVEars(Math.max(1, +e.target.value || 1))}
                  className="w-full mt-1 p-2 border rounded-lg"
                />
                <p className="text-[11px] text-slate-400 mt-1">Left + right</p>
              </div>
            </div>
          )}

          <button
            onClick={downloadDXF}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition shadow-md"
          >
            Export DXF
          </button>

          <div className="text-xs text-slate-500 leading-relaxed">
            <p>• Auto mode: optimized spacing 240–400mm</p>
            <p>• Manual mode: fixed ear count with 80mm visible margins</p>
            <p>• N=1 centers ear perfectly</p>
          </div>
        </div>

        {/* RIGHT AREA - PREVIEW + TOOL PANEL */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-4 flex gap-4 min-h-[520px]">

          {/* PREVIEW */}
          <div
            className={[
              'bg-slate-50 rounded-xl p-4 border flex-1 overflow-auto flex items-center justify-center',
              activeTool === 'measure' ? 'cursor-crosshair' : ''
            ].join(' ')}
          >
            <svg
              width={width * scale + 40}
              height={height * scale + 40}
              viewBox={`-20 -20 ${width * scale + 40} ${height * scale + 40}`}
              className="mx-auto"
              onMouseMove={handlePreviewMouseMove}
              onMouseLeave={handlePreviewMouseLeave}
              onClick={handlePreviewClick}
            >
              <path
                d={buildOutlinePath()}
                fill="none"
                stroke="#0f172a"
                strokeWidth="2"
              />

              {/* Existing measurements */}
              {measurements.map((m) => {
                const dx = m.p2[0] - m.p1[0];
const dy = m.p2[1] - m.p1[1];

let angle = Math.atan2(dy, dx) * 180 / Math.PI;

// Keep text readable: never upside down
if (angle > 90 || angle < -90) {
  angle += 180;
}

                return (
                  <g key={m.id}>
                    <line
                      x1={m.p1[0] * scale}
                      y1={m.p1[1] * scale}
                      x2={m.p2[0] * scale}
                      y2={m.p2[1] * scale}
                      stroke="#ef4444"
                      strokeWidth="2"
                    />

                    <text
                      x={m.mid[0] * scale}
                      y={(m.mid[1] - 8) * scale}
                      fill="#ef4444"
                      fontSize="13"
                      textAnchor="middle"
                      transform={`rotate(${angle} ${m.mid[0] * scale} ${(m.mid[1] - 8) * scale})`}
                    >
                      {m.distance.toFixed(1)} mm
                    </text>
                  </g>
                );
              })}

              {/* First selected measure point */}
              {measurePoints.map((p, i) => (
                <rect
                  key={i}
                  x={p[0] * scale - 4}
                  y={p[1] * scale - 4}
                  width="8"
                  height="8"
                  fill="#2563eb"
                  stroke="white"
                  strokeWidth="1"
                />
              ))}

              {/* Hover snap marker */}
              {activeTool === 'measure' && hoverSnap && (
                <rect
                  x={hoverSnap[0] * scale - 5}
                  y={hoverSnap[1] * scale - 5}
                  width="10"
                  height="10"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2"
                />
              )}
            </svg>
          </div>

          {/* TOOL PANEL */}
          <div
            className={[
              'rounded-xl border bg-slate-50 p-3 transition-all duration-200',
              activeTool ? 'w-64' : 'w-48'
            ].join(' ')}
          >
            <div className="flex items-center gap-2 mb-4">
              <Wrench size={18} className="text-slate-700" />
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Tools</h2>
                <p className="text-[11px] text-slate-500">
                  {activeTool ? `Active: ${activeTool}` : 'No tool selected'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <ToolButton
                id="measure"
                icon={Ruler}
                label="Measure"
                shortcut="M"
              />

              <ToolButton id="select" icon={MousePointer2} label="Select" disabled />
              <ToolButton id="move" icon={Move} label="Move" disabled />
              <ToolButton id="add-ear" icon={Plus} label="Add ear" disabled />
              <ToolButton id="delete-ear" icon={Trash2} label="Delete ear" disabled />
              <ToolButton id="trace" icon={Image} label="Import / Trace" disabled />
              <ToolButton id="text" icon={Type} label="Text / Label" disabled />
              <ToolButton id="grid" icon={Grid3X3} label="Grid / Snap" disabled />
              <ToolButton id="export" icon={Upload} label="Export tools" disabled />
            </div>

            {activeTool === 'measure' && (
              <div className="mt-4 rounded-lg bg-white border p-3 text-xs text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-700 mb-1">Measure tool</p>
                <p>Click two snap points to create a measurement.</p>
                <p className="mt-2 text-slate-400">Press M or Escape to clear and exit.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}