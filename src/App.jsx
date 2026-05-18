import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const [height, setHeight] = useState(600); // right / maximum outside height for asymmetric + double arc modes
  const [leftHeight, setLeftHeight] = useState(500);
  const [middlePosition, setMiddlePosition] = useState(50);
  const [middleHeight, setMiddleHeight] = useState(550);

  const [manualMode, setManualMode] = useState(false);
  const [hEars, setHEars] = useState(3);
  const [vEars, setVEars] = useState(2);
  const [leftVEars, setLeftVEars] = useState(2);
  const [rightVEars, setRightVEars] = useState(2);

  // straight | symmetric | asymmetric | double
  const [topShape, setTopShape] = useState('straight');
  const [arcRise, setArcRise] = useState(100); // symmetric curved top only

  const [activeTool, setActiveTool] = useState(null);

  // VIEWPORT / CAD CAMERA
  const [viewZoom, setViewZoom] = useState(1);
  const [viewPosition, setViewPosition] = useState(null);
  const [panState, setPanState] = useState(null);
  const lastMiddleClickRef = useRef(0);

  // MEASURE TOOL
  const [measurePoints, setMeasurePoints] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [hoverSnap, setHoverSnap] = useState(null);
  const [draggingMeasurement, setDraggingMeasurement] = useState(null);
  const [focusedNumberField, setFocusedNumberField] = useState(null);

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

  const visibleCornerMargin = margin - earDepth;
  const MIN_VIEW_ZOOM = 0.1;
  const MAX_VIEW_ZOOM = 8;

  const n = (value, fallback = 0) => {
    if (value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const isSymmetricTop = topShape === 'symmetric';
  const isAsymmetricTop = topShape === 'asymmetric';
  const isDoubleArcTop = topShape === 'double';
  const isSplitHeightTop = isAsymmetricTop || isDoubleArcTop;
  const hasArcTop = isSymmetricTop || isAsymmetricTop || isDoubleArcTop;

  const safeWidth = Math.max(earDepth * 4, n(width, earDepth * 4));
  const safeHeight = Math.max(earDepth * 4, n(height, earDepth * 4));
  const safeLeftHeight = clamp(n(leftHeight, safeHeight - 100), earDepth * 4, Math.max(earDepth * 4, safeHeight - 1));
  const safeMiddlePosition = clamp(n(middlePosition, 50), 5, 95);
  const autoMiddleHeight = clamp(
    Math.round((safeLeftHeight + safeHeight) / 2),
    Math.min(safeLeftHeight + 1, safeHeight - 1),
    Math.max(safeLeftHeight + 1, safeHeight - 1)
  );
  const safeMiddleHeight = autoMiddleHeight;

  // Base top edge is lowered by earDepth so the outward top ears do not exceed outside heights.
  const splitLeftBaseY = safeHeight - safeLeftHeight + earDepth;
  const splitRightBaseY = earDepth;
  const splitMiddleBaseY = safeHeight - safeMiddleHeight + earDepth;
  const bottomBaseY = safeHeight - earDepth;

  const extraTopSpace = isSymmetricTop ? n(arcRise, 0) + earDepth : 0;

  const clearMeasureTool = () => {
    setActiveTool(null);
    setMeasurePoints([]);
    setMeasurements([]);
    setHoverSnap(null);
    setDraggingMeasurement(null);
  };

  useEffect(() => {
    if (focusedNumberField) return;
    if (!isSplitHeightTop) return;

    if (leftHeight === '' || height === '') return;

    setLeftHeight(prev => {
      if (prev === '') return prev;
      const next = clamp(n(prev, safeHeight - 100), earDepth * 4, Math.max(earDepth * 4, safeHeight - 1));
      return next === prev ? prev : next;
    });

    if (isDoubleArcTop) {
      setMiddleHeight(prev => {
        const next = clamp(
          Math.round((safeLeftHeight + safeHeight) / 2),
          safeLeftHeight + 1,
          safeHeight - 1
        );
        return prev === next ? prev : next;
      });
    }
  }, [topShape, height, leftHeight, focusedNumberField, safeLeftHeight, safeHeight, isSplitHeightTop, isDoubleArcTop]);

  useEffect(() => {
    if (focusedNumberField) return;
    if (topShape === 'asymmetric') {
      setLeftHeight(prev => (prev === '' || n(prev, 0) >= safeHeight ? Math.max(earDepth * 4, safeHeight - 100) : prev));
      setLeftVEars(prev => Math.max(1, n(prev, vEars)));
      setRightVEars(prev => Math.max(1, n(prev, vEars)));
    }

    if (topShape === 'double') {
      const nextLeft = leftHeight === '' || n(leftHeight, 0) >= safeHeight ? Math.max(earDepth * 4, safeHeight - 100) : n(leftHeight, safeHeight - 100);
      setLeftHeight(nextLeft);
      setMiddlePosition(prev => prev === '' ? 50 : clamp(n(prev, 50), 5, 95));
      setMiddleHeight(clamp(Math.round((nextLeft + safeHeight) / 2), nextLeft + 1, safeHeight - 1));
      setLeftVEars(prev => Math.max(1, n(prev, vEars)));
      setRightVEars(prev => Math.max(1, n(prev, vEars)));
    }
  }, [topShape, focusedNumberField, leftHeight, safeHeight, vEars]);

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
      setPanState(null);
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
  }, [
    width,
    height,
    leftHeight,
    middlePosition,
    middleHeight,
    manualMode,
    hEars,
    vEars,
    leftVEars,
    rightVEars,
    topShape,
    arcRise
  ]);

  const makeSegment = (cx, cy, p0, p1) => {
    const thetaStart = Math.atan2(p0[1] - cy, p0[0] - cx);
    const thetaEndRaw = Math.atan2(p1[1] - cy, p1[0] - cx);

    let angleSpan = thetaEndRaw - thetaStart;
    while (angleSpan > Math.PI) angleSpan -= Math.PI * 2;
    while (angleSpan < -Math.PI) angleSpan += Math.PI * 2;

    const radius = Math.hypot(p0[0] - cx, p0[1] - cy);
    const direction = angleSpan >= 0 ? 1 : -1;
    const arcLength = Math.abs(radius * angleSpan);

    const rawPointAt = (s, radialOffset = 0, offsetSign = 1) => {
      const theta = thetaStart + direction * (s / radius);
      const r = radius + offsetSign * radialOffset;
      return [cx + r * Math.cos(theta), cy + r * Math.sin(theta)];
    };

    // Choose the radial offset direction that moves the arc outward/upward in SVG coordinates.
    const midS = arcLength / 2;
    const baseMid = rawPointAt(midS, 0, 1);
    const plusMid = rawPointAt(midS, 1, 1);
    const offsetSign = plusMid[1] < baseMid[1] ? 1 : -1;

    const segment = {
      cx,
      cy,
      radius,
      thetaStart,
      angleSpan,
      direction,
      arcLength,
      offsetSign,
      pointAtLocal: (s, radialOffset = 0) => rawPointAt(s, radialOffset, offsetSign)
    };

    return segment;
  };

  const makeCompositeArc = (segments) => {
    let total = 0;
    const prepared = segments.map(seg => {
      const withGlobal = { ...seg, globalStart: total, globalEnd: total + seg.arcLength };
      total += seg.arcLength;
      return withGlobal;
    });

    return {
      segments: prepared,
      arcLength: total,
      pointAt: (s, radialOffset = 0) => {
        const safeS = clamp(s, 0, total);
        const seg = prepared.find(item => safeS <= item.globalEnd + 0.000001) || prepared[prepared.length - 1];
        return seg.pointAtLocal(safeS - seg.globalStart, radialOffset);
      },
      getParts: (startS, endS) => {
        const a = clamp(Math.min(startS, endS), 0, total);
        const b = clamp(Math.max(startS, endS), 0, total);
        const parts = [];

        prepared.forEach(seg => {
          const start = Math.max(a, seg.globalStart);
          const end = Math.min(b, seg.globalEnd);

          if (end - start > 0.001) {
            parts.push({
              segment: seg,
              startLocal: start - seg.globalStart,
              endLocal: end - seg.globalStart,
              startGlobal: start,
              endGlobal: end
            });
          }
        });

        return parts;
      }
    };
  };

  const getSymmetricTopArcData = () => {
    if (!isSymmetricTop) return null;

    const rise = Math.max(0, n(arcRise, 0));
    if (rise <= 0) return null;

    const x1 = earDepth;
    const x2 = safeWidth - earDepth;
    const y = earDepth;
    const chord = x2 - x1;
    if (chord <= 0) return null;

    const radius = (chord * chord) / (8 * rise) + rise / 2;
    const cx = (x1 + x2) / 2;
    const cy = y + radius - rise;

    const segment = makeSegment(cx, cy, [x1, y], [x2, y]);
    return makeCompositeArc([segment]);
  };

  const getAsymmetricTopArcData = () => {
    if (!isAsymmetricTop) return null;

    const p0 = [earDepth, splitLeftBaseY];
    const p1 = [safeWidth - earDepth, splitRightBaseY];

    const dx = p0[0] - p1[0];
    const denominator = 2 * (p0[1] - p1[1]);
    if (Math.abs(denominator) < 0.000001) return null;

    // Horizontal tangent at the right endpoint: circle center is vertically aligned with the right endpoint.
    const cx = p1[0];
    const cy = (dx * dx + p0[1] * p0[1] - p1[1] * p1[1]) / denominator;

    const segment = makeSegment(cx, cy, p0, p1);
    return makeCompositeArc([segment]);
  };

  const getDoubleTopArcData = () => {
    if (!isDoubleArcTop) return null;

    const p0 = [earDepth, splitLeftBaseY];
    const p2 = [safeWidth - earDepth, splitRightBaseY];
    const usableWidth = Math.max(1, p2[0] - p0[0]);
    const pm = [p0[0] + usableWidth * (safeMiddlePosition / 100), splitMiddleBaseY];

    if (pm[0] <= p0[0] || pm[0] >= p2[0]) return null;
    if (pm[1] >= p0[1] || pm[1] <= p2[1]) return null;

    // Left arc: horizontal tangent at the left endpoint, passing through the middle point.
    const leftCx = p0[0];
    const leftDen = 2 * (pm[1] - p0[1]);
    if (Math.abs(leftDen) < 0.000001) return null;
    const leftCy = ((pm[0] - leftCx) ** 2 + pm[1] ** 2 - p0[1] ** 2) / leftDen;

    // Right arc: horizontal tangent at the right endpoint, passing through the middle point.
    const rightCx = p2[0];
    const rightDen = 2 * (pm[1] - p2[1]);
    if (Math.abs(rightDen) < 0.000001) return null;
    const rightCy = ((pm[0] - rightCx) ** 2 + pm[1] ** 2 - p2[1] ** 2) / rightDen;

    const leftSegment = makeSegment(leftCx, leftCy, p0, pm);
    const rightSegment = makeSegment(rightCx, rightCy, pm, p2);

    return makeCompositeArc([leftSegment, rightSegment]);
  };

  const getActiveTopArcData = () => {
    if (isSymmetricTop) return getSymmetricTopArcData();
    if (isAsymmetricTop) return getAsymmetricTopArcData();
    if (isDoubleArcTop) return getDoubleTopArcData();
    return null;
  };

  const getStartPoint = () => {
    if (isSplitHeightTop) return [earDepth, splitLeftBaseY];
    return [earDepth, earDepth];
  };

  const getRightTopBasePoint = () => {
    if (isSplitHeightTop) return [safeWidth - earDepth, splitRightBaseY];
    return [safeWidth - earDepth, earDepth];
  };

  const getTopArcEarRanges = () => {
    const arc = getActiveTopArcData();
    if (!arc) return [];

    const usable = arc.arcLength - 2 * visibleCornerMargin - earLength;
    if (usable < 0) return [];

    const ranges = [];

    if (manualMode) {
      const count = Math.max(1, n(hEars, 1));

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
        ears.push({ orientation, pos: margin + i * spacing });
      }
    };

    const addManualSide = (sideLength, orientation, count) => {
      const usable = sideLength - 2 * margin - earLength;
      if (usable < 0) return;

      if (count === 1) {
        ears.push({ orientation, pos: sideLength / 2 - earLength / 2 });
        return;
      }

      const spacing = usable / (count - 1);
      for (let i = 0; i < count; i++) {
        ears.push({ orientation, pos: margin + i * spacing });
      }
    };

    const addAutoVerticalSpan = (startY, endY, orientation) => {
      const sideLength = endY - startY;
      const usable = sideLength - 2 * visibleCornerMargin - earLength;
      if (usable < 0) return;

      let gaps = 1;
      while (usable / gaps > MAX_SPACING) gaps++;
      while (gaps > 1 && usable / gaps < MIN_SPACING) gaps--;

      const spacing = usable / gaps;
      for (let i = 0; i <= gaps; i++) {
        ears.push({ orientation, pos: startY + visibleCornerMargin + i * spacing });
      }
    };

    const addManualVerticalSpan = (startY, endY, orientation, count) => {
      const sideLength = endY - startY;
      const usable = sideLength - 2 * visibleCornerMargin - earLength;
      if (usable < 0) return;

      if (count === 1) {
        ears.push({ orientation, pos: startY + sideLength / 2 - earLength / 2 });
        return;
      }

      const spacing = usable / (count - 1);
      for (let i = 0; i < count; i++) {
        ears.push({ orientation, pos: startY + visibleCornerMargin + i * spacing });
      }
    };

    if (!manualMode) {
      if (topShape === 'straight') addAutoSide(safeWidth, 'top');
      addAutoSide(safeWidth, 'bottom');

      if (isSplitHeightTop) {
        addAutoVerticalSpan(splitLeftBaseY, bottomBaseY, 'left');
        addAutoVerticalSpan(splitRightBaseY, bottomBaseY, 'right');
      } else {
        addAutoSide(safeHeight, 'left');
        addAutoSide(safeHeight, 'right');
      }
    } else {
      if (topShape === 'straight') addManualSide(safeWidth, 'top', Math.max(1, n(hEars, 1)));
      addManualSide(safeWidth, 'bottom', Math.max(1, n(hEars, 1)));

      if (isSplitHeightTop) {
        addManualVerticalSpan(splitLeftBaseY, bottomBaseY, 'left', Math.max(1, n(leftVEars, 1)));
        addManualVerticalSpan(splitRightBaseY, bottomBaseY, 'right', Math.max(1, n(rightVEars, 1)));
      } else {
        addManualSide(safeHeight, 'left', Math.max(1, n(vEars, 1)));
        addManualSide(safeHeight, 'right', Math.max(1, n(vEars, 1)));
      }
    }

    return ears;
  }, [
    safeWidth,
    safeHeight,
    safeLeftHeight,
    safeMiddleHeight,
    safeMiddlePosition,
    manualMode,
    hEars,
    vEars,
    leftVEars,
    rightVEars,
    topShape
  ]);

  const grouped = useMemo(
    () => ({
      top: points.filter(e => e.orientation === 'top').sort((a, b) => a.pos - b.pos),
      right: points.filter(e => e.orientation === 'right').sort((a, b) => a.pos - b.pos),
      bottom: points.filter(e => e.orientation === 'bottom').sort((a, b) => b.pos - a.pos),
      left: points.filter(e => e.orientation === 'left').sort((a, b) => b.pos - a.pos),
    }),
    [points]
  );

  const pushPoint = (verts, point) => {
    const last = verts[verts.length - 1];
    if (!last || Math.abs(last[0] - point[0]) > 0.001 || Math.abs(last[1] - point[1]) > 0.001) {
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

  const buildArcTopVertices = (verts) => {
    const arc = getActiveTopArcData();
    if (!arc) {
      pushPoint(verts, getRightTopBasePoint());
      return;
    }

    const ears = getTopArcEarRanges();
    let currentS = 0;

    ears.forEach(ear => {
      appendArcSegment(verts, arc, currentS, ear.start, 0, ARC_SEGMENTS);

      const innerStart = arc.pointAt(ear.start, 0);
      const outerStart = arc.pointAt(ear.start, earDepth);
      const outerEnd = arc.pointAt(ear.end, earDepth);
      const innerEnd = arc.pointAt(ear.end, 0);

      pushPoint(verts, innerStart);
      pushPoint(verts, outerStart);
      appendArcSegment(verts, arc, ear.start, ear.end, earDepth, EAR_ARC_SEGMENTS);
      pushPoint(verts, outerEnd);
      pushPoint(verts, innerEnd);

      currentS = ear.end;
    });

    appendArcSegment(verts, arc, currentS, arc.arcLength, 0, ARC_SEGMENTS);
  };

  const buildVertices = () => {
    const verts = [getStartPoint()];

    if (hasArcTop) {
      buildArcTopVertices(verts);
    } else {
      grouped.top.forEach(ear => {
        const p = ear.pos;
        verts.push([p, earDepth], [p, 0], [p + earLength, 0], [p + earLength, earDepth]);
      });
      verts.push([safeWidth - earDepth, earDepth]);
    }

    grouped.right.forEach(ear => {
      const p = ear.pos;
      verts.push([safeWidth - earDepth, p], [safeWidth, p], [safeWidth, p + earLength], [safeWidth - earDepth, p + earLength]);
    });

    verts.push([safeWidth - earDepth, bottomBaseY]);

    grouped.bottom.forEach(ear => {
      const p = ear.pos;
      verts.push([p + earLength, safeHeight - earDepth], [p + earLength, safeHeight], [p, safeHeight], [p, safeHeight - earDepth]);
    });

    verts.push([earDepth, bottomBaseY]);

    grouped.left.forEach(ear => {
      const p = ear.pos;
      verts.push([earDepth, p + earLength], [0, p + earLength], [0, p], [earDepth, p]);
    });

    return verts;
  };

  const buildSnapVertices = () => {
    const verts = [getStartPoint()];

    if (hasArcTop) {
      const arc = getActiveTopArcData();
      if (arc) {
        getTopArcEarRanges().forEach(ear => {
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

    verts.push(getRightTopBasePoint());

    grouped.right.forEach(ear => {
      const p = ear.pos;
      verts.push([safeWidth - earDepth, p], [safeWidth, p], [safeWidth, p + earLength], [safeWidth - earDepth, p + earLength]);
    });

    verts.push([safeWidth - earDepth, bottomBaseY]);

    grouped.bottom.forEach(ear => {
      const p = ear.pos;
      verts.push([p + earLength, safeHeight - earDepth], [p + earLength, safeHeight], [p, safeHeight], [p, safeHeight - earDepth]);
    });

    verts.push([earDepth, bottomBaseY]);

    grouped.left.forEach(ear => {
      const p = ear.pos;
      verts.push([earDepth, p + earLength], [0, p + earLength], [0, p], [earDepth, p]);
    });

    if (isDoubleArcTop) {
      const p0 = [earDepth, splitLeftBaseY];
      const p2 = [safeWidth - earDepth, splitRightBaseY];
      const pm = [p0[0] + (p2[0] - p0[0]) * (safeMiddlePosition / 100), splitMiddleBaseY];
      verts.push(pm);
    }

    return verts;
  };

  const snapPoints = useMemo(
    () => buildSnapVertices(),
    [grouped, safeWidth, safeHeight, safeLeftHeight, safeMiddleHeight, safeMiddlePosition, topShape, arcRise, manualMode, hEars, leftVEars, rightVEars]
  );

  const buildOutlinePath = () => {
    const verts = buildVertices();
    return verts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${v[0] * scale} ${v[1] * scale}`).join(' ') + ' Z';
  };

  const getBaseViewBox = () => ({
    x: -viewportPadding,
    y: -viewportPadding - extraTopSpace * scale,
    width: safeWidth * scale + viewportPadding * 2,
    height: (safeHeight + extraTopSpace) * scale + viewportPadding * 2
  });

  const getCurrentViewBox = () => {
    const base = getBaseViewBox();
    return {
      x: viewPosition?.x ?? base.x,
      y: viewPosition?.y ?? base.y,
      width: base.width / viewZoom,
      height: base.height / viewZoom
    };
  };

  const resetView = () => {
    setViewZoom(1);
    setViewPosition(null);
    setPanState(null);
  };

  const handleViewportWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const current = getCurrentViewBox();
    const base = getBaseViewBox();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mouseSvgX = current.x + (mouseX / rect.width) * current.width;
    const mouseSvgY = current.y + (mouseY / rect.height) * current.height;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextZoom = clamp(viewZoom * zoomFactor, MIN_VIEW_ZOOM, MAX_VIEW_ZOOM);
    const nextWidth = base.width / nextZoom;
    const nextHeight = base.height / nextZoom;

    setViewZoom(nextZoom);
    setViewPosition({
      x: mouseSvgX - (mouseX / rect.width) * nextWidth,
      y: mouseSvgY - (mouseY / rect.height) * nextHeight
    });
  };

  const handleViewportMouseDown = (e) => {
    if (e.button !== 1) return;

    e.preventDefault();
    e.stopPropagation();

    const now = Date.now();
    if (now - lastMiddleClickRef.current < 300) {
      resetView();
      lastMiddleClickRef.current = 0;
      return;
    }

    lastMiddleClickRef.current = now;
    setPanState({ startClientX: e.clientX, startClientY: e.clientY, startView: getCurrentViewBox() });
  };

  const getSvgPoint = (e) => {
    const svg = e.currentTarget.ownerSVGElement || e.target.ownerSVGElement || e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;

    const x = viewBox.x + ((e.clientX - rect.left) / rect.width) * viewBox.width;
    const y = viewBox.y + ((e.clientY - rect.top) / rect.height) * viewBox.height;

    return { x: x / scale, y: y / scale };
  };

  const findNearestSnapPoint = (x, y) => {
    let best = null;
    let bestDist = Infinity;

    snapPoints.forEach(([px, py]) => {
      const dist = Math.hypot(px - x, py - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = [px, py];
      }
    });

    const snapTolerancePx = 14;
    const snapToleranceMm = snapTolerancePx / (scale * viewZoom);
    return bestDist <= snapToleranceMm ? best : null;
  };

  const getMeasurementBaseData = (m) => {
    const dx = m.p2[0] - m.p1[0];
    const dy = m.p2[1] - m.p1[1];
    const distance = Math.hypot(dx, dy) || 1;
    const ux = dx / distance;
    const uy = dy / distance;
    const nx = -uy;
    const ny = ux;
    return { dx, dy, distance, ux, uy, nx, ny };
  };

  const getMeasurementGeometry = (m) => {
    const { distance, ux, uy, nx, ny } = getMeasurementBaseData(m);
    const offset = m.offset ?? 0;

    const d1 = [m.p1[0] + nx * offset, m.p1[1] + ny * offset];
    const d2 = [m.p2[0] + nx * offset, m.p2[1] + ny * offset];
    const mid = [(d1[0] + d2[0]) / 2, (d1[1] + d2[1]) / 2];
    const offsetDirection = offset >= 0 ? 1 : -1;
    const labelGapMm = 22 / (scale * viewZoom);
    const label = [mid[0] + nx * offsetDirection * labelGapMm, mid[1] + ny * offsetDirection * labelGapMm];

    let angle = Math.atan2(uy, ux) * 180 / Math.PI;
    if (angle > 90 || angle < -90) angle += 180;

    const arrowLength = 10 / (scale * viewZoom);
    const arrowWidth = 5 / (scale * viewZoom);

    const leftArrow = [
      d1,
      [d1[0] + ux * arrowLength + nx * arrowWidth, d1[1] + uy * arrowLength + ny * arrowWidth],
      [d1[0] + ux * arrowLength - nx * arrowWidth, d1[1] + uy * arrowLength - ny * arrowWidth]
    ];

    const rightArrow = [
      d2,
      [d2[0] - ux * arrowLength + nx * arrowWidth, d2[1] - uy * arrowLength + ny * arrowWidth],
      [d2[0] - ux * arrowLength - nx * arrowWidth, d2[1] - uy * arrowLength - ny * arrowWidth]
    ];

    return { d1, d2, mid, label, angle, distance, nx, ny, leftArrow, rightArrow };
  };

  const polygonPoints = (pointsArray) => pointsArray.map(([x, y]) => `${x * scale},${y * scale}`).join(' ');

  const handlePreviewMouseMove = (e) => {
    if (panState) {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const dxPx = e.clientX - panState.startClientX;
      const dyPx = e.clientY - panState.startClientY;
      const dxSvg = (dxPx / rect.width) * panState.startView.width;
      const dySvg = (dyPx / rect.height) * panState.startView.height;
      setViewPosition({ x: panState.startView.x - dxSvg, y: panState.startView.y - dySvg });
      return;
    }

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

      setMeasurements(prev => prev.map(m => m.id === draggingMeasurement.id ? { ...m, offset: newOffset, selected: true } : m));
      return;
    }

    setHoverSnap(findNearestSnapPoint(x, y));
  };

  const handlePreviewMouseLeave = () => {
    if (!draggingMeasurement) setHoverSnap(null);
  };

  const createMeasurement = (p1, p2) => {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const distance = Math.hypot(dx, dy);
    const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    const ux = dx / distance;
    const uy = dy / distance;
    const nx = -uy;
    const ny = ux;
    const rectangleCenter = [safeWidth / 2, safeHeight / 2];
    const fromCenterToMeasurement = [mid[0] - rectangleCenter[0], mid[1] - rectangleCenter[1]];
    const dot = fromCenterToMeasurement[0] * nx + fromCenterToMeasurement[1] * ny;
    const offset = dot < 0 ? -INITIAL_DIMENSION_OFFSET : INITIAL_DIMENSION_OFFSET;

    return { id: crypto.randomUUID(), p1, p2, distance, offset, selected: false };
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
      if (Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) === 0) {
        setMeasurePoints([]);
        return;
      }

      setMeasurements(prev => [...prev.map(m => ({ ...m, selected: false })), createMeasurement(p1, p2)]);
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
    setMeasurements(prev => prev.map(m => m.id === measurement.id ? { ...m, selected: true } : { ...m, selected: false }));
    setDraggingMeasurement({ id: measurement.id, startMouse: [x, y], startOffset: measurement.offset ?? 0 });
  };

  const handleMeasurementClick = (e, measurement) => {
    if (activeTool !== 'measure') return;
    e.stopPropagation();
    setMeasurements(prev => prev.map(m => m.id === measurement.id ? { ...m, selected: true } : { ...m, selected: false }));
  };

  const roundDXF = (value) => Math.round(value * 1000000) / 1000000;
  const dxfLine = (...items) => `${items.join('\n')}\n`;

  const toDXFPoint = ([x, y]) => [roundDXF(x), roundDXF(safeHeight - y)];

  const segmentBulge = (segment, startLocal, endLocal) => {
    const includedAngle = segment.direction * ((endLocal - startLocal) / segment.radius);
    return roundDXF(-Math.tan(includedAngle / 4));
  };

  const buildArcTopDXFLwPolyline = () => {
    const arc = getActiveTopArcData();
    if (!arc) return '';

    const vertices = [];
    const startPoint = getStartPoint();
    let currentPoint = startPoint;

    const pushVertex = (point, bulge = 0) => {
      const [x, y] = toDXFPoint(point);
      const last = vertices[vertices.length - 1];

      if (last && Math.abs(last.x - x) < 0.000001 && Math.abs(last.y - y) < 0.000001) {
        last.bulge = roundDXF(bulge);
        return;
      }

      vertices.push({ x, y, bulge: roundDXF(bulge) });
    };

    const addLineTo = (nextPoint) => {
      pushVertex(currentPoint, 0);
      currentPoint = nextPoint;
    };

    const addArcTo = (startS, endS, radialOffset = 0) => {
      arc.getParts(startS, endS).forEach(part => {
        const startPointOnArc = part.segment.pointAtLocal(part.startLocal, radialOffset);
        const endPointOnArc = part.segment.pointAtLocal(part.endLocal, radialOffset);
        currentPoint = startPointOnArc;
        pushVertex(currentPoint, segmentBulge(part.segment, part.startLocal, part.endLocal));
        currentPoint = endPointOnArc;
      });
    };

    const ears = getTopArcEarRanges();
    let currentS = 0;

    ears.forEach(ear => {
      addArcTo(currentS, ear.start, 0);

      const innerStart = arc.pointAt(ear.start, 0);
      const outerStart = arc.pointAt(ear.start, earDepth);
      const outerEnd = arc.pointAt(ear.end, earDepth);
      const innerEnd = arc.pointAt(ear.end, 0);

      currentPoint = innerStart;
      addLineTo(outerStart);
      addArcTo(ear.start, ear.end, earDepth);
      addLineTo(innerEnd);

      currentS = ear.end;
    });

    addArcTo(currentS, arc.arcLength, 0);

    grouped.right.forEach(ear => {
      const p = ear.pos;
      addLineTo([safeWidth - earDepth, p]);
      addLineTo([safeWidth, p]);
      addLineTo([safeWidth, p + earLength]);
      addLineTo([safeWidth - earDepth, p + earLength]);
    });

    addLineTo([safeWidth - earDepth, bottomBaseY]);

    grouped.bottom.forEach(ear => {
      const p = ear.pos;
      addLineTo([p + earLength, safeHeight - earDepth]);
      addLineTo([p + earLength, safeHeight]);
      addLineTo([p, safeHeight]);
      addLineTo([p, safeHeight - earDepth]);
    });

    addLineTo([earDepth, bottomBaseY]);

    grouped.left.forEach(ear => {
      const p = ear.pos;
      addLineTo([earDepth, p + earLength]);
      addLineTo([0, p + earLength]);
      addLineTo([0, p]);
      addLineTo([earDepth, p]);
    });

    addLineTo(startPoint);

    let entity = dxfLine('0', 'LWPOLYLINE', '8', '0', '90', vertices.length, '70', '1');

    vertices.forEach(v => {
      entity += dxfLine('10', v.x, '20', v.y);
      if (Math.abs(v.bulge) > 0.0000001) entity += dxfLine('42', v.bulge);
    });

    return entity;
  };

  const buildStraightDXFLwPolyline = () => {
    const raw = buildVertices();
    const vertices = raw.map(point => {
      const [x, y] = toDXFPoint(point);
      return { x, y, bulge: 0 };
    });

    const cleaned = vertices.filter((p, i, arr) => {
      if (i === 0) return true;
      const prev = arr[i - 1];
      return !(Math.abs(p.x - prev.x) < 0.000001 && Math.abs(p.y - prev.y) < 0.000001);
    });

    let entity = dxfLine('0', 'LWPOLYLINE', '8', '0', '90', cleaned.length, '70', '1');

    cleaned.forEach(v => {
      entity += dxfLine('10', v.x, '20', v.y);
      if (Math.abs(v.bulge) > 0.0000001) entity += dxfLine('42', v.bulge);
    });

    return entity;
  };

  const fusionLineEntity = (p1, p2) => {
    const [x1, y1] = toDXFPoint(p1);
    const [x2, y2] = toDXFPoint(p2);
    return dxfLine('0', 'LINE', '8', '0', '10', x1, '20', y1, '11', x2, '21', y2);
  };

  const fusionArcEntity = (segment, startLocal, endLocal, radialOffset = 0) => {
    if (Math.abs(endLocal - startLocal) < 0.001) return '';

    const startPoint = segment.pointAtLocal(startLocal, radialOffset);
    const endPoint = segment.pointAtLocal(endLocal, radialOffset);
    const radius = segment.radius + segment.offsetSign * radialOffset;
    const [cx, cy] = toDXFPoint([segment.cx, segment.cy]);

    const angleDeg = (point) => {
      const [px, py] = toDXFPoint(point);
      let angle = Math.atan2(py - cy, px - cx) * 180 / Math.PI;
      if (angle < 0) angle += 360;
      return roundDXF(angle);
    };

    // SVG Y is flipped compared with DXF, so swap start/end angles.
    const startAngle = angleDeg(endPoint);
    const endAngle = angleDeg(startPoint);

    return dxfLine(
      '0', 'ARC',
      '8', '0',
      '10', cx,
      '20', cy,
      '40', roundDXF(Math.abs(radius)),
      '50', startAngle,
      '51', endAngle
    );
  };

  const buildFusionStraightEntities = () => {
    const raw = buildVertices();
    const entities = [];

    for (let i = 0; i < raw.length; i++) {
      const p1 = raw[i];
      const p2 = raw[(i + 1) % raw.length];
      if (Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) > 0.000001) {
        entities.push(fusionLineEntity(p1, p2));
      }
    }

    return entities;
  };

  const buildFusionArcTopEntities = () => {
    const arc = getActiveTopArcData();
    if (!arc) return buildFusionStraightEntities();

    const entities = [];
    const startPoint = getStartPoint();
    let currentPoint = startPoint;

    const addLine = (nextPoint) => {
      if (Math.hypot(nextPoint[0] - currentPoint[0], nextPoint[1] - currentPoint[1]) > 0.000001) {
        entities.push(fusionLineEntity(currentPoint, nextPoint));
      }
      currentPoint = nextPoint;
    };

    const addArc = (startS, endS, radialOffset = 0) => {
      arc.getParts(startS, endS).forEach(part => {
        entities.push(fusionArcEntity(part.segment, part.startLocal, part.endLocal, radialOffset));
        currentPoint = part.segment.pointAtLocal(part.endLocal, radialOffset);
      });
    };

    const ears = getTopArcEarRanges();
    let currentS = 0;

    ears.forEach(ear => {
      addArc(currentS, ear.start, 0);

      const innerStart = arc.pointAt(ear.start, 0);
      const outerStart = arc.pointAt(ear.start, earDepth);
      const innerEnd = arc.pointAt(ear.end, 0);

      currentPoint = innerStart;
      addLine(outerStart);
      addArc(ear.start, ear.end, earDepth);
      addLine(innerEnd);

      currentS = ear.end;
    });

    addArc(currentS, arc.arcLength, 0);

    grouped.right.forEach(ear => {
      const p = ear.pos;
      addLine([safeWidth - earDepth, p]);
      addLine([safeWidth, p]);
      addLine([safeWidth, p + earLength]);
      addLine([safeWidth - earDepth, p + earLength]);
    });

    addLine([safeWidth - earDepth, bottomBaseY]);

    grouped.bottom.forEach(ear => {
      const p = ear.pos;
      addLine([p + earLength, safeHeight - earDepth]);
      addLine([p + earLength, safeHeight]);
      addLine([p, safeHeight]);
      addLine([p, safeHeight - earDepth]);
    });

    addLine([earDepth, bottomBaseY]);

    grouped.left.forEach(ear => {
      const p = ear.pos;
      addLine([earDepth, p + earLength]);
      addLine([0, p + earLength]);
      addLine([0, p]);
      addLine([earDepth, p]);
    });

    addLine(startPoint);
    return entities;
  };

  const downloadFusionDXF = () => {
    let dxf = '';
    dxf += dxfLine('0', 'SECTION', '2', 'HEADER');
    dxf += dxfLine('9', '$ACADVER', '1', 'AC1009');
    dxf += dxfLine('9', '$INSUNITS', '70', '4');
    dxf += dxfLine('0', 'ENDSEC');
    dxf += dxfLine('0', 'SECTION', '2', 'ENTITIES');
    dxf += (hasArcTop ? buildFusionArcTopEntities() : buildFusionStraightEntities()).join('');
    dxf += dxfLine('0', 'ENDSEC', '0', 'EOF');

    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `panel-${safeWidth}x${safeHeight}-${topShape}-fusion.dxf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadDXF = () => {
    let dxf = '';
    dxf += dxfLine('0', 'SECTION', '2', 'HEADER');
    dxf += dxfLine('9', '$ACADVER', '1', 'AC1015');
    dxf += dxfLine('9', '$INSUNITS', '70', '4');
    dxf += dxfLine('0', 'ENDSEC');
    dxf += dxfLine('0', 'SECTION', '2', 'ENTITIES');
    dxf += hasArcTop ? buildArcTopDXFLwPolyline() : buildStraightDXFLwPolyline();
    dxf += dxfLine('0', 'ENDSEC', '0', 'EOF');

    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `panel-${safeWidth}x${safeHeight}-${topShape}.dxf`;
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
          active ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
          disabled ? 'opacity-40 cursor-not-allowed hover:bg-white' : 'cursor-pointer'
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

  const handleNumberBlur = (setter, value, min, max = Infinity, fallback = min) => {
    const parsed = n(value, fallback);
    setter(clamp(parsed, min, max));
    setFocusedNumberField(null);
  };

  const handleHeightBlur = () => {
    const nextHeight = Math.max(earDepth * 4, n(height, earDepth * 4));
    setHeight(nextHeight);

    if (isSplitHeightTop) {
      const nextLeft = clamp(
        n(leftHeight, nextHeight - 100),
        earDepth * 4,
        Math.max(earDepth * 4, nextHeight - 1)
      );
      setLeftHeight(nextLeft);

      if (isDoubleArcTop) {
        setMiddleHeight(clamp(
          Math.round((nextLeft + nextHeight) / 2),
          nextLeft + 1,
          nextHeight - 1
        ));
      }
    }

    setFocusedNumberField(null);
  };

  const handleLeftHeightBlur = () => {
    const nextLeft = clamp(
      n(leftHeight, safeHeight - 100),
      earDepth * 4,
      Math.max(earDepth * 4, safeHeight - 1)
    );
    setLeftHeight(nextLeft);

    if (isDoubleArcTop) {
      setMiddleHeight(clamp(
        Math.round((nextLeft + safeHeight) / 2),
        nextLeft + 1,
        safeHeight - 1
      ));
    }

    setFocusedNumberField(null);
  };

  const currentViewBox = getCurrentViewBox();

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
      <div className="w-full max-w-7xl grid lg:grid-cols-[420px_1fr] gap-6" onClick={(e) => e.stopPropagation()}>

        {/* LEFT PANEL - CONTROLS */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Ear Pattern Generator</h1>
            <p className="text-slate-500 text-sm mt-1">Parametric CAD DXF generator</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500">Width (mm)</label>
              <input
                type="number"
                value={width}
                onFocus={() => setFocusedNumberField('width')}
                onChange={e => setWidth(e.target.value === '' ? '' : +e.target.value)}
                onBlur={() => handleNumberBlur(setWidth, width, earDepth * 4)}
                className="w-full mt-1 p-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500">{isSplitHeightTop ? 'Right / max height (mm)' : 'Height (mm)'}</label>
              <input
                type="number"
                value={height}
                onFocus={() => setFocusedNumberField('height')}
                onChange={e => setHeight(e.target.value === '' ? '' : +e.target.value)}
                onBlur={handleHeightBlur}
                className="w-full mt-1 p-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border space-y-3">
            <label className="text-xs text-slate-500">Top shape</label>
            <select
              value={topShape}
              onChange={e => setTopShape(e.target.value)}
              className="w-full p-2 border rounded-lg bg-white"
            >
              <option value="straight">Straight</option>
              <option value="symmetric">Symmetric curved top</option>
              <option value="asymmetric">Asymmetric arc top</option>
              <option value="double">Double arc top</option>
            </select>

            {isSymmetricTop && (
              <div>
                <label className="text-xs text-slate-500">Arc rise (mm)</label>
                <input
                  type="number"
                  min="0"
                  value={arcRise}
                  onChange={e => setArcRise(e.target.value === '' ? '' : +e.target.value)}
                  onBlur={() => handleNumberBlur(setArcRise, arcRise, 0, Infinity, 0)}
                  className="w-full mt-1 p-2 border rounded-lg"
                />
                <p className="text-[11px] text-slate-400 mt-1">Top ears follow a symmetric circular arc.</p>
              </div>
            )}

            {isSplitHeightTop && (
              <div>
                <label className="text-xs text-slate-500">Left outside height (mm)</label>
                <input
                  type="number"
                  min={earDepth * 4}
                  max={Math.max(earDepth * 4, safeHeight - 1)}
                  value={leftHeight}
                  onFocus={() => setFocusedNumberField('leftHeight')}
                  onChange={e => setLeftHeight(e.target.value === '' ? '' : +e.target.value)}
                  onBlur={handleLeftHeightBlur}
                  className="w-full mt-1 p-2 border rounded-lg"
                />
                <p className="text-[11px] text-slate-400 mt-1">The base arc is lowered by ear depth so top ears stay inside the outside height.</p>
              </div>
            )}

            {isDoubleArcTop && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500">Middle position (%)</label>
                  <input
                    type="number"
                    min="5"
                    max="95"
                    value={middlePosition}
                    onFocus={() => setFocusedNumberField('middlePosition')}
                    onChange={e => setMiddlePosition(e.target.value === '' ? '' : +e.target.value)}
                    onBlur={() => handleNumberBlur(setMiddlePosition, middlePosition, 5, 95, 50)}
                    className="w-full mt-1 p-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500">Middle outside height</label>
                  <input
                    type="number"
                    min={safeLeftHeight + 1}
                    max={safeHeight - 1}
                    value={autoMiddleHeight}
                    readOnly
                    className="w-full mt-1 p-2 border rounded-lg bg-slate-100 text-slate-600"
                  />
                </div>
                <p className="text-[11px] text-slate-400 col-span-2">
                  Middle outside height is automatically set to the midpoint between left outside height and right/max height. Top ears can cross the middle join.
                </p>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={manualMode} onChange={e => setManualMode(e.target.checked)} />
              Manual Mode
            </label>
            <p className="text-xs text-slate-500">Toggle between automatic optimization and fixed ear count</p>
          </div>

          {manualMode && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500">Horizontal ears</label>
                <input
                  type="number"
                  min="1"
                  value={hEars}
                  onChange={e => setHEars(e.target.value === '' ? '' : +e.target.value)}
                  onBlur={() => handleNumberBlur(setHEars, hEars, 1, Infinity, 1)}
                  className="w-full mt-1 p-2 border rounded-lg"
                />
                <p className="text-[11px] text-slate-400 mt-1">Bottom ears plus top ears when an arc top is active.</p>
              </div>

              {isSplitHeightTop ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500">Left side ears</label>
                    <input
                      type="number"
                      min="1"
                      value={leftVEars}
                      onChange={e => setLeftVEars(e.target.value === '' ? '' : +e.target.value)}
                      onBlur={() => handleNumberBlur(setLeftVEars, leftVEars, 1, Infinity, 1)}
                      className="w-full mt-1 p-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500">Right side ears</label>
                    <input
                      type="number"
                      min="1"
                      value={rightVEars}
                      onChange={e => setRightVEars(e.target.value === '' ? '' : +e.target.value)}
                      onBlur={() => handleNumberBlur(setRightVEars, rightVEars, 1, Infinity, 1)}
                      className="w-full mt-1 p-2 border rounded-lg"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-slate-500">Vertical ears</label>
                  <input
                    type="number"
                    min="1"
                    value={vEars}
                    onChange={e => setVEars(e.target.value === '' ? '' : +e.target.value)}
                    onBlur={() => handleNumberBlur(setVEars, vEars, 1, Infinity, 1)}
                    className="w-full mt-1 p-2 border rounded-lg"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Left + right</p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <button onClick={downloadDXF} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition shadow-md">
              Export DXF
            </button>
            <button onClick={downloadFusionDXF} className="w-full bg-blue-700 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition shadow-md">
              Export Fusion DXF
            </button>
          </div>

          <div className="text-xs text-slate-500 leading-relaxed">
            <p>• Auto mode: optimized spacing 240–400mm</p>
            <p>• Manual mode: fixed ear count with 80mm visible margins</p>
            <p>• N=1 centers ear perfectly</p>
            <p>• Asymmetric top: low left side, max right side, circular arc ends flat on the right</p>
            <p>• Double arc top: two connected circular arcs with editable middle point</p>
          </div>
        </div>

        {/* RIGHT AREA - PREVIEW + TOOL PANEL */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-4 flex gap-4 min-h-[520px]">
          <div
            className={[
              'bg-slate-50 rounded-xl p-4 border flex-1 overflow-hidden flex items-center justify-center',
              activeTool === 'measure' ? 'cursor-crosshair' : ''
            ].join(' ')}
            onWheel={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <svg
              width={safeWidth * scale + viewportPadding * 2}
              height={(safeHeight + extraTopSpace) * scale + viewportPadding * 2}
              viewBox={`${currentViewBox.x} ${currentViewBox.y} ${currentViewBox.width} ${currentViewBox.height}`}
              className="mx-auto"
              onWheel={handleViewportWheel}
              onMouseDown={handleViewportMouseDown}
              onMouseMove={handlePreviewMouseMove}
              onMouseLeave={handlePreviewMouseLeave}
              onClick={handlePreviewClick}
              onMouseUp={() => {
                setDraggingMeasurement(null);
                setPanState(null);
              }}
              style={{ cursor: panState ? 'grabbing' : activeTool === 'measure' ? 'crosshair' : 'default' }}
            >
              <path d={buildOutlinePath()} fill="none" stroke="#0f172a" strokeWidth={2 / viewZoom} />

              {isDoubleArcTop && (
                <circle
                  cx={(earDepth + (safeWidth - 2 * earDepth) * (safeMiddlePosition / 100)) * scale}
                  cy={splitMiddleBaseY * scale}
                  r={3 / viewZoom}
                  fill="#64748b"
                />
              )}

              {/* CAD-style measurements */}
              {measurements.map((m) => {
                const geometry = getMeasurementGeometry(m);
                const color = m.selected || draggingMeasurement?.id === m.id ? '#2563eb' : '#ef4444';

                return (
                  <g
                    key={m.id}
                    onMouseDown={(e) => handleMeasurementMouseDown(e, m)}
                    onClick={(e) => handleMeasurementClick(e, m)}
                    style={{ cursor: activeTool === 'measure' ? draggingMeasurement?.id === m.id ? 'grabbing' : 'grab' : 'default' }}
                  >
                    <line x1={geometry.d1[0] * scale} y1={geometry.d1[1] * scale} x2={geometry.d2[0] * scale} y2={geometry.d2[1] * scale} stroke="transparent" strokeWidth={14 / viewZoom} />
                    <line x1={m.p1[0] * scale} y1={m.p1[1] * scale} x2={geometry.d1[0] * scale} y2={geometry.d1[1] * scale} stroke={color} strokeWidth={1.5 / viewZoom} />
                    <line x1={m.p2[0] * scale} y1={m.p2[1] * scale} x2={geometry.d2[0] * scale} y2={geometry.d2[1] * scale} stroke={color} strokeWidth={1.5 / viewZoom} />
                    <line x1={geometry.d1[0] * scale} y1={geometry.d1[1] * scale} x2={geometry.d2[0] * scale} y2={geometry.d2[1] * scale} stroke={color} strokeWidth={2 / viewZoom} />
                    <polygon points={polygonPoints(geometry.leftArrow)} fill={color} />
                    <polygon points={polygonPoints(geometry.rightArrow)} fill={color} />

                    <text
                      x={geometry.label[0] * scale}
                      y={geometry.label[1] * scale}
                      fontSize={20 / viewZoom}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="transparent"
                      stroke="transparent"
                      strokeWidth={12 / viewZoom}
                      transform={`rotate(${geometry.angle} ${geometry.label[0] * scale} ${geometry.label[1] * scale})`}
                    >
                      {geometry.distance.toFixed(1)} mm
                    </text>

                    <text
                      x={geometry.label[0] * scale}
                      y={geometry.label[1] * scale}
                      fill={color}
                      fontSize={13 / viewZoom}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${geometry.angle} ${geometry.label[0] * scale} ${geometry.label[1] * scale})`}
                    >
                      {geometry.distance.toFixed(1)} mm
                    </text>

                    {(m.selected || draggingMeasurement?.id === m.id) && (
                      <>
                        <rect x={geometry.d1[0] * scale - 4 / viewZoom} y={geometry.d1[1] * scale - 4 / viewZoom} width={8 / viewZoom} height={8 / viewZoom} fill="#2563eb" stroke="white" strokeWidth={1 / viewZoom} />
                        <rect x={geometry.d2[0] * scale - 4 / viewZoom} y={geometry.d2[1] * scale - 4 / viewZoom} width={8 / viewZoom} height={8 / viewZoom} fill="#2563eb" stroke="white" strokeWidth={1 / viewZoom} />
                      </>
                    )}
                  </g>
                );
              })}

              {measurePoints.map((p, i) => (
                <rect key={i} x={p[0] * scale - 4 / viewZoom} y={p[1] * scale - 4 / viewZoom} width={8 / viewZoom} height={8 / viewZoom} fill="#2563eb" stroke="white" strokeWidth="1" />
              ))}

              {activeTool === 'measure' && hoverSnap && !draggingMeasurement && (
                <rect x={hoverSnap[0] * scale - 5 / viewZoom} y={hoverSnap[1] * scale - 5 / viewZoom} width={10 / viewZoom} height={10 / viewZoom} fill="none" stroke="#2563eb" strokeWidth={2 / viewZoom} />
              )}
            </svg>
          </div>

          {/* TOOL PANEL */}
          <div className={['rounded-xl border bg-slate-50 p-3 transition-all duration-200', activeTool ? 'w-64' : 'w-48'].join(' ')}>
            <div className="flex items-center gap-2 mb-4">
              <Wrench size={18} className="text-slate-700" />
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Tools</h2>
                <p className="text-[11px] text-slate-500">{activeTool ? `Active: ${activeTool}` : 'No tool selected'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <ToolButton id="measure" icon={Ruler} label="Measure" shortcut="M" />
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
