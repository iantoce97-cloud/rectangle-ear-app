import React, { useMemo, useState } from 'react';

export default function App() {
  const [width, setWidth] = useState(1000);
  const [height, setHeight] = useState(600);

  const [manualMode, setManualMode] = useState(false);
  const [hEars, setHEars] = useState(3); // top/bottom
  const [vEars, setVEars] = useState(2); // left/right

  const earLength = 30;
  const earDepth = 10;
  const margin = 90;
  const scale = 0.35;

  const MIN_SPACING = 240;
  const MAX_SPACING = 400;

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

      // SPECIAL CASE: 1 ear → centered
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

  const buildOutlinePath = () => {
    const verts = buildVertices();
    return verts
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${v[0] * scale} ${v[1] * scale}`)
      .join(' ') + ' Z';
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

  return (
  <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
    <div className="w-full max-w-6xl grid md:grid-cols-2 gap-6">

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

        {/* SIZE */}
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

        {/* MODE */}
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

        {/* MANUAL INPUTS */}
        {manualMode && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500">
                Horizontal ears (top/bottom)
              </label>
              <input
                type="number"
                value={hEars}
                onChange={e => setHEars(+e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">
                Vertical ears (left/right)
              </label>
              <input
                type="number"
                value={vEars}
                onChange={e => setVEars(+e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg"
              />
            </div>
          </div>
        )}

        {/* ACTION */}
        <button
          onClick={downloadDXF}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition shadow-md"
        >
          Export DXF
        </button>

        {/* INFO */}
        <div className="text-xs text-slate-500 leading-relaxed">
          <p>• Auto mode: optimized spacing (240–400mm)</p>
          <p>• Manual mode: fixed ear count with 80mm margins</p>
          <p>• N=1 centers ear perfectly</p>
        </div>
      </div>

      {/* RIGHT PANEL - PREVIEW */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-4 flex items-center justify-center">
        <div className="bg-slate-50 rounded-xl p-4 border w-full overflow-auto">
          <svg
            width={width * scale + 40}
            height={height * scale + 40}
            viewBox={`-20 -20 ${width * scale + 40} ${height * scale + 40}`}
            className="mx-auto"
          >
            <path
              d={buildOutlinePath()}
              fill="none"
              stroke="#0f172a"
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>

    </div>
  </div>
);
}