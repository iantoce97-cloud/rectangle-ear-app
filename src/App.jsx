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

  const [curvedTop, setCurvedTop] = useState(false);
  const [arcRise, setArcRise] = useState(100);

  const [activeTool, setActiveTool] = useState(null);

  // MEASURE TOOL
  const [measurePoints, setMeasurePoints] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [hoverSnap, setHoverSnap] = useState(null);
  const [draggingMeasurement, setDraggingMeasurement] = useState(null);

  const earLength = 30;
  const earDepth = 10;
  const margin = 90;
  const scale = 0.35;
  const viewportPadding = 160;

  const MIN_SPACING = 240;
  const MAX_SPACING = 400;
  const INITIAL_DIMENSION_OFFSET = 25;
  const ARC_SEGMENTS = 64;
  const EAR_ARC_SEGMENTS = 12;

  const visibleCornerMargin = margin - earDepth; // 90 - 10 = visible 80mm

  const clearMeasureTool = () => {
    setActiveTool(null);
    setMeasurePoints([]);
    setMeasurements([]);
    setHoverSnap(null);
    setDraggingMeasurement(null);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === 'm') {
        setActiveTool(prev => {
          if (prev === 'measure') {
            setMeasurePoints([]);
            setMeasurements([]);
            setHoverSnap(null);
            setDraggingMeasurement(null);
            return null;
          }

          return 'measure';
        });
      }

      if (e.key === 'Escape') {
        clearMeasureTool();
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        setMeasurements(prev => prev.filter(m => !m.selected));
        setDraggingMeasurement(null);
      }
    };

    const handleMouseUp = () => {
      setDraggingMeasurement(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Clear measurements when geometry changes
  useEffect(() => {
    setMeasurePoints([]);
    setMeasurements([]);
    setHoverSnap(null);
    setDraggingMeasurement(null);
  }, [width, height, manualMode, hEars, vEars, curvedTop, arcRise]);

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
      if (!curvedTop) {
        addAutoSide(width, 'top');
      }

      addAutoSide(width, 'bottom');
      addAutoSide(height, 'left');
      addAutoSide(height, 'right');
    } else {
      if (!curvedTop) {
        addManualSide(width, 'top', hEars);
      }

      addManualSide(width, 'bottom', hEars);
      addManualSide(height, 'left', vEars);
      addManualSide(height, 'right', vEars);
    }

    return ears;
  }, [width, height, manualMode, hEars, vEars, curvedTop]);

  const grouped = useMemo(
    () => ({
      top: points.filter(e => e.orientation === 'top').sort((a, b) => a.pos - b.pos),
      right: points.filter(e => e.orientation === 'right').sort((a, b) => a.pos - b.pos),
      bottom: points.filter(e => e.orientation === 'bottom').sort((a, b) => b.pos - a.pos),
      left: points.filter(e => e.orientation === 'left').sort((a, b) => b.pos - a.pos),
    }),
    [points]
  );

  const getTopArcData = () => {
    const rise = Math.max(0, arcRise);

    if (!curvedTop || rise <= 0) return null;

    const x1 = earDepth;
    const x2 = width - earDepth;
    const yBase = earDepth;

    const chord = x2 - x1;
    if (chord <= 0) return null;

    const radius = (chord * chord) / (8 * rise) + rise / 2;
    const cx = (x1 + x2) / 2;
    const cy = yBase + radius - rise;

    const thetaStart = Math.atan2(yBase - cy, x1 - cx);
    const thetaEnd = Math.atan2(yBase - cy, x2 - cx);
    const angleSpan = thetaEnd - thetaStart;
    const arcLength = radius * angleSpan;

    const pointAt = (s, radialOffset = 0) => {
      const theta = thetaStart + s / radius;
      const r = radius + radialOffset;

      return [
        cx + r * Math.cos(theta),
        cy + r * Math.sin(theta)
      ];
    };

    return {
      radius,
      cx,
      cy,
      thetaStart,
      thetaEnd,
      angleSpan,
      arcLength,
      pointAt
    };
  };

  const getCurvedTopEarRanges = () => {
    const arc = getTopArcData();
    if (!arc) return [];

    const usable = arc.arcLength - 2 * visibleCornerMargin - earLength;
    if (usable < 0) return [];

    const ranges = [];

    if (manualMode) {
      const count = Math.max(1, hEars);

      if (count === 1) {
        const start = arc.arcLength / 2 - earLength / 2;
        ranges.push({ start, end: start + earLength });
        return ranges;
      }

      const spacing = usable / (count - 1);

      for (let i = 0; i < count; i++) {
        const start = visibleCornerMargin + i * spacing;
        ranges.push({ start, end: start + earLength });
      }

      return ranges;
    }

    let gaps = 1;
    while (usable / gaps > MAX_SPACING) gaps++;
    while (gaps > 1 && usable / gaps < MIN_SPACING) gaps--;

    const spacing = usable / gaps;

    for (let i = 0; i <= gaps; i++) {
      const start = visibleCornerMargin + i * spacing;
      ranges.push({ start, end: start + earLength });
    }

    return ranges;
  };

  const pushPoint = (verts, point) => {
    const last = verts[verts.length - 1];

    if (
      !last ||
      Math.abs(last[0] - point[0]) > 0.001 ||
      Math.abs(last[1] - point[1]) > 0.001
    ) {
      verts.push(point);
    }
  };

  const appendArcSegment = (verts, arc, startS, endS, radialOffset = 0, segmentCount = ARC_SEGMENTS) => {
    const length = Math.abs(endS - startS);
    if (length <= 0.001) return;

    const segments = Math.max(1, Math.ceil(segmentCount * (length / arc.arcLength)));

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const s = startS + (endS - startS) * t;
      pushPoint(verts, arc.pointAt(s, radialOffset));
    }
  };

  const buildCurvedTopVertices = (verts) => {
    const arc = getTopArcData();

    if (!arc) {
      pushPoint(verts, [width - earDepth, earDepth]);
      return;
    }

    const ears = getCurvedTopEarRanges();
    let currentS = 0;

    ears.forEach(ear => {
      appendArcSegment(verts, arc, currentS, ear.start, 0, ARC_SEGMENTS);

      const innerStart = arc.pointAt(ear.start, 0);
      const outerStart = arc.pointAt(ear.start, earDepth);
      const outerEnd = arc.pointAt(ear.end, earDepth);
      const innerEnd = arc.pointAt(ear.end, 0);

      pushPoint(verts, innerStart);
      pushPoint(verts, outerStart);

      appendArcSegment(
        verts,
        arc,
        ear.start,
        ear.end,
        earDepth,
        EAR_ARC_SEGMENTS
      );

      pushPoint(verts, outerEnd);
      pushPoint(verts, innerEnd);

      currentS = ear.end;
    });

    appendArcSegment(verts, arc, currentS, arc.arcLength, 0, ARC_SEGMENTS);
  };

  const buildVertices = () => {
    const verts = [[earDepth, earDepth]];

    if (curvedTop && arcRise > 0) {
      buildCurvedTopVertices(verts);
    } else {
      grouped.top.forEach(ear => {
        const p = ear.pos;
        verts.push([p, earDepth], [p, 0], [p + earLength, 0], [p + earLength, earDepth]);
      });

      verts.push([width - earDepth, earDepth]);
    }

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

  const buildSnapVertices = () => {
    const verts = [];

    verts.push([earDepth, earDepth]);

    if (curvedTop && arcRise > 0) {
      const arc = getTopArcData();

      if (arc) {
        getCurvedTopEarRanges().forEach(ear => {
          verts.push(
            arc.pointAt(ear.start, 0),
            arc.pointAt(ear.start, earDepth),
            arc.pointAt(ear.end, earDepth),
            arc.pointAt(ear.end, 0)
          );
        });
      }
    } else {
      grouped.top.forEach(ear => {
        const p = ear.pos;
        verts.push([p, earDepth], [p, 0], [p + earLength, 0], [p + earLength, earDepth]);
      });
    }

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

  const snapPoints = useMemo(
    () => buildSnapVertices(),
    [grouped, width, height, curvedTop, arcRise, manualMode, hEars]
  );

  const buildOutlinePath = () => {
    const verts = buildVertices();
    return verts
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${v[0] * scale} ${v[1] * scale}`)
      .join(' ') + ' Z';
  };

  const getSvgPoint = (e) => {
    const svg =
      e.currentTarget.ownerSVGElement ||
      e.target.ownerSVGElement ||
      e.currentTarget;

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

  const getMeasurementBaseData = (m) => {
    const dx = m.p2[0] - m.p1[0];
    const dy = m.p2[1] - m.p1[1];
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;

    const ux = dx / distance;
    const uy = dy / distance;

    const nx = -uy;
    const ny = ux;

    return { dx, dy, distance, ux, uy, nx, ny };
  };

  const getMeasurementGeometry = (m) => {
    const { distance, ux, uy, nx, ny } = getMeasurementBaseData(m);

    const offset = m.offset ?? 0;

    const d1 = [
      m.p1[0] + nx * offset,
      m.p1[1] + ny * offset
    ];

    const d2 = [
      m.p2[0] + nx * offset,
      m.p2[1] + ny * offset
    ];

    const mid = [
      (d1[0] + d2[0]) / 2,
      (d1[1] + d2[1]) / 2
    ];

    const offsetDirection = offset >= 0 ? 1 : -1;

    const labelGapPx = 22;
    const labelGapMm = labelGapPx / scale;

    const label = [
      mid[0] + nx * offsetDirection * labelGapMm,
      mid[1] + ny * offsetDirection * labelGapMm
    ];

    let angle = Math.atan2(uy, ux) * 180 / Math.PI;

    if (angle > 90 || angle < -90) {
      angle += 180;
    }

    const arrowLength = 10 / scale;
    const arrowWidth = 5 / scale;

    const leftArrow = [
      d1,
      [
        d1[0] + ux * arrowLength + nx * arrowWidth,
        d1[1] + uy * arrowLength + ny * arrowWidth
      ],
      [
        d1[0] + ux * arrowLength - nx * arrowWidth,
        d1[1] + uy * arrowLength - ny * arrowWidth
      ]
    ];

    const rightArrow = [
      d2,
      [
        d2[0] - ux * arrowLength + nx * arrowWidth,
        d2[1] - uy * arrowLength + ny * arrowWidth
      ],
      [
        d2[0] - ux * arrowLength - nx * arrowWidth,
        d2[1] - uy * arrowLength - ny * arrowWidth
      ]
    ];

    return {
      d1,
      d2,
      mid,
      label,
      angle,
      distance,
      nx,
      ny,
      leftArrow,
      rightArrow
    };
  };

  const polygonPoints = (pointsArray) => {
    return pointsArray
      .map(([x, y]) => `${x * scale},${y * scale}`)
      .join(' ');
  };

  const handlePreviewMouseMove = (e) => {
    if (activeTool !== 'measure') return;

    const { x, y } = getSvgPoint(e);

    if (draggingMeasurement) {
      const measurement = measurements.find(m => m.id === draggingMeasurement.id);
      if (!measurement) return;

      const { nx, ny } = getMeasurementBaseData(measurement);

      const dx = x - draggingMeasurement.startMouse[0];
      const dy = y - draggingMeasurement.startMouse[1];

      const projectedOffsetChange = dx * nx + dy * ny;
      const newOffset = draggingMeasurement.startOffset + projectedOffsetChange;

      setMeasurements(prev =>
        prev.map(m =>
          m.id === draggingMeasurement.id
            ? { ...m, offset: newOffset, selected: true }
            : m
        )
      );

      return;
    }

    const snapped = findNearestSnapPoint(x, y);
    setHoverSnap(snapped);
  };

  const handlePreviewMouseLeave = () => {
    if (!draggingMeasurement) {
      setHoverSnap(null);
    }
  };

  const createMeasurement = (p1, p2) => {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const distance = Math.sqrt(dx * dx + dy * dy);

    const mid = [
      (p1[0] + p2[0]) / 2,
      (p1[1] + p2[1]) / 2
    ];

    const ux = dx / distance;
    const uy = dy / distance;

    const nx = -uy;
    const ny = ux;

    const rectangleCenter = [width / 2, height / 2];
    const fromCenterToMeasurement = [
      mid[0] - rectangleCenter[0],
      mid[1] - rectangleCenter[1]
    ];

    const dot =
      fromCenterToMeasurement[0] * nx +
      fromCenterToMeasurement[1] * ny;

    let offset = INITIAL_DIMENSION_OFFSET;

    if (dot < 0) {
      offset = -INITIAL_DIMENSION_OFFSET;
    }

    return {
      id: crypto.randomUUID(),
      p1,
      p2,
      distance,
      offset,
      selected: false
    };
  };

  const handlePreviewClick = (e) => {
    if (activeTool !== 'measure') return;

    e.stopPropagation();

    if (draggingMeasurement) return;

    const { x, y } = getSvgPoint(e);
    const snapped = findNearestSnapPoint(x, y);

    if (!snapped) return;

    const nextPoints = [...measurePoints, snapped];

    if (nextPoints.length === 2) {
      const [p1, p2] = nextPoints;

      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance === 0) {
        setMeasurePoints([]);
        return;
      }

      setMeasurements(prev => [
        ...prev.map(m => ({ ...m, selected: false })),
        createMeasurement(p1, p2)
      ]);

      setMeasurePoints([]);
    } else {
      setMeasurements(prev => prev.map(m => ({ ...m, selected: false })));
      setMeasurePoints(nextPoints);
    }
  };

  const handleMeasurementMouseDown = (e, measurement) => {
    if (activeTool !== 'measure') return;

    e.stopPropagation();

    const { x, y } = getSvgPoint(e);

    setMeasurements(prev =>
      prev.map(m =>
        m.id === measurement.id
          ? { ...m, selected: true }
          : { ...m, selected: false }
      )
    );

    setDraggingMeasurement({
      id: measurement.id,
      startMouse: [x, y],
      startOffset: measurement.offset ?? 0
    });
  };

  const handleMeasurementClick = (e, measurement) => {
    if (activeTool !== 'measure') return;

    e.stopPropagation();

    setMeasurements(prev =>
      prev.map(m =>
        m.id === measurement.id
          ? { ...m, selected: true }
          : { ...m, selected: false }
      )
    );
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
    a.download = `rectangle-${width}x${height}${curvedTop ? '-curved-top-ears' : ''}.dxf`;
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

  const extraTopSpace = curvedTop ? arcRise + earDepth : 0;

  return (
    <div
      className="min-h-screen bg-slate-100 flex items-center justify-center p-6"
      onClick={() => {
        if (activeTool === 'measure') {
          setMeasurePoints([]);
          setMeasurements([]);
          setDraggingMeasurement(null);
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

          <div className="p-4 rounded-xl bg-slate-50 border space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={manualMode}
                onChange={e => setManualMode(e.target.checked)}
              />
              Manual Mode
            </label>

            <p className="text-xs text-slate-500">
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
                <p className="text-[11px] text-slate-400 mt-1">
                  Top + bottom. Top follows arc when curved top is active.
                </p>
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

          {/* CURVED TOP */}
          <div className="p-4 rounded-xl bg-slate-50 border space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={curvedTop}
                onChange={e => setCurvedTop(e.target.checked)}
              />
              Curved top
            </label>

            {curvedTop && (
              <div>
                <label className="text-xs text-slate-500">Arc rise (mm)</label>
                <input
                  type="number"
                  min="0"
                  value={arcRise}
                  onChange={e => setArcRise(Math.max(0, +e.target.value || 0))}
                  className="w-full mt-1 p-2 border rounded-lg"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Top ears follow the arc. Export is still segmented polyline for now.
                </p>
              </div>
            )}
          </div>

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
            <p>• Curved top: top ears follow the circular arc</p>
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
              width={width * scale + viewportPadding * 2}
              height={(height + extraTopSpace) * scale + viewportPadding * 2}
              viewBox={`${-viewportPadding} ${-viewportPadding - extraTopSpace * scale} ${width * scale + viewportPadding * 2} ${(height + extraTopSpace) * scale + viewportPadding * 2}`}
              className="mx-auto"
              onMouseMove={handlePreviewMouseMove}
              onMouseLeave={handlePreviewMouseLeave}
              onClick={handlePreviewClick}
              onMouseUp={() => setDraggingMeasurement(null)}
            >
              <path
                d={buildOutlinePath()}
                fill="none"
                stroke="#0f172a"
                strokeWidth="2"
              />

              {/* CAD-style measurements */}
              {measurements.map((m) => {
                const geometry = getMeasurementGeometry(m);
                const color = m.selected || draggingMeasurement?.id === m.id
                  ? '#2563eb'
                  : '#ef4444';

                return (
                  <g
                    key={m.id}
                    onMouseDown={(e) => handleMeasurementMouseDown(e, m)}
                    onClick={(e) => handleMeasurementClick(e, m)}
                    style={{
                      cursor:
                        activeTool === 'measure'
                          ? draggingMeasurement?.id === m.id
                            ? 'grabbing'
                            : 'grab'
                          : 'default'
                    }}
                  >
                    <line
                      x1={geometry.d1[0] * scale}
                      y1={geometry.d1[1] * scale}
                      x2={geometry.d2[0] * scale}
                      y2={geometry.d2[1] * scale}
                      stroke="transparent"
                      strokeWidth="14"
                    />

                    <line
                      x1={m.p1[0] * scale}
                      y1={m.p1[1] * scale}
                      x2={geometry.d1[0] * scale}
                      y2={geometry.d1[1] * scale}
                      stroke={color}
                      strokeWidth="1.5"
                    />

                    <line
                      x1={m.p2[0] * scale}
                      y1={m.p2[1] * scale}
                      x2={geometry.d2[0] * scale}
                      y2={geometry.d2[1] * scale}
                      stroke={color}
                      strokeWidth="1.5"
                    />

                    <line
                      x1={geometry.d1[0] * scale}
                      y1={geometry.d1[1] * scale}
                      x2={geometry.d2[0] * scale}
                      y2={geometry.d2[1] * scale}
                      stroke={color}
                      strokeWidth="2"
                    />

                    <polygon points={polygonPoints(geometry.leftArrow)} fill={color} />
                    <polygon points={polygonPoints(geometry.rightArrow)} fill={color} />

                    <text
                      x={geometry.label[0] * scale}
                      y={geometry.label[1] * scale}
                      fontSize="20"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="transparent"
                      stroke="transparent"
                      strokeWidth="12"
                      transform={`rotate(${geometry.angle} ${geometry.label[0] * scale} ${geometry.label[1] * scale})`}
                    >
                      {geometry.distance.toFixed(1)} mm
                    </text>

                    <text
                      x={geometry.label[0] * scale}
                      y={geometry.label[1] * scale}
                      fill={color}
                      fontSize="13"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${geometry.angle} ${geometry.label[0] * scale} ${geometry.label[1] * scale})`}
                    >
                      {geometry.distance.toFixed(1)} mm
                    </text>

                    {(m.selected || draggingMeasurement?.id === m.id) && (
                      <>
                        <rect
                          x={geometry.d1[0] * scale - 4}
                          y={geometry.d1[1] * scale - 4}
                          width="8"
                          height="8"
                          fill="#2563eb"
                          stroke="white"
                          strokeWidth="1"
                        />
                        <rect
                          x={geometry.d2[0] * scale - 4}
                          y={geometry.d2[1] * scale - 4}
                          width="8"
                          height="8"
                          fill="#2563eb"
                          stroke="white"
                          strokeWidth="1"
                        />
                      </>
                    )}
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
              {activeTool === 'measure' && hoverSnap && !draggingMeasurement && (
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
                <p>Click two snap points to create a CAD-style measurement.</p>
                <p className="mt-2">Drag the dimension line or text to move it away from the part.</p>
                <p className="mt-2">Select a dimension and press Delete to remove it.</p>
                <p className="mt-2 text-slate-400">Press M or Escape to clear and exit.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}