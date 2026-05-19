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
  Wrench,
  ArrowLeft,
  PenLine,
  DraftingCompass
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

  const [topEarLengthInput, setTopEarLengthInput] = useState(30);
  const [topEarDepthInput, setTopEarDepthInput] = useState(10);
  const [rightEarLengthInput, setRightEarLengthInput] = useState(30);
  const [rightEarDepthInput, setRightEarDepthInput] = useState(10);
  const [bottomEarLengthInput, setBottomEarLengthInput] = useState(30);
  const [bottomEarDepthInput, setBottomEarDepthInput] = useState(10);
  const [leftEarLengthInput, setLeftEarLengthInput] = useState(30);
  const [leftEarDepthInput, setLeftEarDepthInput] = useState(10);

  // straight | symmetric | asymmetric | double
  const [topShape, setTopShape] = useState('straight');
  const [arcRise, setArcRise] = useState(100); // symmetric curved / 3-arc crown rise
  const [transitionHeight, setTransitionHeight] = useState(50); // symmetric 3-arc transition height percent
  const [crownWidth, setCrownWidth] = useState(50); // symmetric 3-arc horizontal distance between merge points percent
  const [removeSideHorizontalConstraint, setRemoveSideHorizontalConstraint] = useState(false);
  const [cornerAngle, setCornerAngle] = useState(90);
  const [workspaceMode, setWorkspaceMode] = useState('frame');
  const [interiorDesigns, setInteriorDesigns] = useState([]);
  const [selectedInteriorDesignId, setSelectedInteriorDesignId] = useState(null);
  const [interiorDrag, setInteriorDrag] = useState(null);

  const [activeTool, setActiveTool] = useState(null);

  // VIEWPORT / CAD CAMERA
  const [viewZoom, setViewZoom] = useState(1);
  const [viewPosition, setViewPosition] = useState(null);
  const [panState, setPanState] = useState(null);
  const lastMiddleClickRef = useRef(0);
  const previewWheelBlockerRef = useRef(null);
  const designFileInputRef = useRef(null);

  // MEASURE TOOL
  const [measurePoints, setMeasurePoints] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [hoverSnap, setHoverSnap] = useState(null);
  const [draggingMeasurement, setDraggingMeasurement] = useState(null);
  const [focusedNumberField, setFocusedNumberField] = useState(null);

  const n = (value, fallback = 0) => {
    if (value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const topEarLength = Math.max(1, n(topEarLengthInput, 30));
  const topEarDepth = Math.max(0, n(topEarDepthInput, 10));
  const rightEarLength = Math.max(1, n(rightEarLengthInput, 30));
  const rightEarDepth = Math.max(0, n(rightEarDepthInput, 10));
  const bottomEarLength = Math.max(1, n(bottomEarLengthInput, 30));
  const bottomEarDepth = Math.max(0, n(bottomEarDepthInput, 10));
  const leftEarLength = Math.max(1, n(leftEarLengthInput, 30));
  const leftEarDepth = Math.max(0, n(leftEarDepthInput, 10));
  const minPanelSize = 1;
  const margin = 90;
  const scale = 0.35;
  const viewportPadding = 160;

  const MIN_SPACING = 240;
  const MAX_SPACING = 400;
  const INITIAL_DIMENSION_OFFSET = 25;
  const ARC_SEGMENTS = 64;
  const EAR_ARC_SEGMENTS = 12;

  const topVisibleCornerMargin = Math.max(0, margin - topEarDepth);
  const MIN_VIEW_ZOOM = 0.1;
  const MAX_VIEW_ZOOM = 8;

  const isSymmetricTop = topShape === 'symmetric';
  const isSymmetricThreeArcTop = topShape === 'symmetricThreeArc';
  const isAsymmetricTop = topShape === 'asymmetric';
  const isDoubleArcTop = topShape === 'double';
  const isSplitHeightTop = isAsymmetricTop || isDoubleArcTop;
  const hasArcTop = isSymmetricTop || isSymmetricThreeArcTop || isAsymmetricTop || isDoubleArcTop;

  const safeWidth = Math.max(minPanelSize, n(width, minPanelSize));
  const safeHeight = Math.max(minPanelSize, n(height, minPanelSize));
  const safeCornerAngle = clamp(n(cornerAngle, 90), 30, 150);
  const shearOffset = safeWidth * Math.tan((safeCornerAngle - 90) * Math.PI / 180);
  const minShearY = Math.min(0, shearOffset);
  const maxShearY = Math.max(0, shearOffset);
  const overallHeight = safeHeight + maxShearY - minShearY;
  const isAngledPanel = Math.abs(shearOffset) > 0.000001;
  const safeLeftHeight = clamp(n(leftHeight, safeHeight - 100), minPanelSize, Math.max(minPanelSize, safeHeight - 1));
  const safeMiddlePosition = clamp(n(middlePosition, 50), 1, 99);
  const safeTransitionHeight = clamp(n(transitionHeight, 50), 1, 99);
  const safeCrownWidth = clamp(n(crownWidth, 50), 1, 99);
  const autoMiddleHeight = clamp(
    Math.round((safeLeftHeight + safeHeight) / 2),
    Math.min(safeLeftHeight + 1, safeHeight - 1),
    Math.max(safeLeftHeight + 1, safeHeight - 1)
  );
  const safeMiddleHeight = autoMiddleHeight;

  // Base edges are inset by each side's ear depth so ears stay inside the outside dimensions.
  const splitLeftBaseY = safeHeight - safeLeftHeight + topEarDepth;
  const splitRightBaseY = topEarDepth;
  const splitMiddleBaseY = safeHeight - safeMiddleHeight + topEarDepth;
  const bottomBaseY = safeHeight - bottomEarDepth;

  const extraTopSpace = (isSymmetricTop || isSymmetricThreeArcTop) ? n(arcRise, 0) + topEarDepth : 0;

  const leftWallLimit = Math.max(leftEarDepth, 0);
  const rightWallLimit = safeWidth - Math.max(rightEarDepth, 0);
  const angledRun = Math.max(1, rightWallLimit - leftWallLimit);
  const angledEdgeLength = Math.hypot(angledRun, shearOffset) || 1;
  const angledLengthProjection = angledRun / angledEdgeLength;
  const topEdgeMarginForLayout = topVisibleCornerMargin * angledLengthProjection + topEarDepth;
  const bottomEdgeMarginForLayout = Math.max(0, margin - bottomEarDepth) * angledLengthProjection + bottomEarDepth;
  const topEarLengthForLayout = isAngledPanel && topShape === 'straight' ? topEarLength * angledLengthProjection : topEarLength;
  const bottomEarLengthForLayout = isAngledPanel ? bottomEarLength * angledLengthProjection : bottomEarLength;
  const topEdgeNormal = [shearOffset / angledEdgeLength, -angledRun / angledEdgeLength];
  const bottomEdgeNormal = [-shearOffset / angledEdgeLength, angledRun / angledEdgeLength];

  const transformPoint = ([x, y]) => {
    const onLeftWall = x <= leftWallLimit + 0.001;
    const onRightWall = x >= rightWallLimit - 0.001;

    if (!onLeftWall && !onRightWall && topShape === 'straight' && y <= topEarDepth + 0.001) {
      const t = clamp((x - leftWallLimit) / angledRun, 0, 1);
      const base = [x, topEarDepth + t * shearOffset];
      const outwardDepth = topEarDepth - y;
      return [base[0] + topEdgeNormal[0] * outwardDepth, base[1] + topEdgeNormal[1] * outwardDepth];
    }

    if (!onLeftWall && !onRightWall && y >= safeHeight - bottomEarDepth - 0.001) {
      const t = clamp((x - leftWallLimit) / angledRun, 0, 1);
      const base = [x, safeHeight - bottomEarDepth + t * shearOffset];
      const outwardDepth = y - (safeHeight - bottomEarDepth);
      return [base[0] + bottomEdgeNormal[0] * outwardDepth, base[1] + bottomEdgeNormal[1] * outwardDepth];
    }

    if (onLeftWall) return [x, y];
    if (onRightWall) return [x, y + shearOffset];

    const t = (x - leftWallLimit) / angledRun;
    return [x, y + t * shearOffset];
  };

  const transformPoints = (pointsArray) => pointsArray.map(transformPoint);

  const angleFromOffset = (offset) => clamp(90 + Math.atan(offset / safeWidth) * 180 / Math.PI, 30, 150);

  const offsetFromAngle = (angle) => safeWidth * Math.tan((clamp(angle, 30, 150) - 90) * Math.PI / 180);

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
      const next = clamp(n(prev, safeHeight - 100), minPanelSize, Math.max(minPanelSize, safeHeight - 1));
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
      setLeftHeight(prev => (prev === '' || n(prev, 0) >= safeHeight ? Math.max(minPanelSize, safeHeight - 100) : prev));
      setLeftVEars(prev => Math.max(1, n(prev, vEars)));
      setRightVEars(prev => Math.max(1, n(prev, vEars)));
    }

    if (topShape === 'double') {
      const nextLeft = leftHeight === '' || n(leftHeight, 0) >= safeHeight ? Math.max(minPanelSize, safeHeight - 100) : n(leftHeight, safeHeight - 100);
      setLeftHeight(nextLeft);
      setMiddlePosition(prev => prev === '' ? 50 : clamp(n(prev, 50), 1, 99));
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

      if (e.key.toLowerCase() === 'a') {
        setActiveTool(prev => {
          setMeasurePoints([]);
          setHoverSnap(null);
          setDraggingMeasurement(null);
          return prev === 'angle' ? null : 'angle';
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
      setInteriorDrag(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [workspaceMode]);

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
    arcRise,
    transitionHeight,
    crownWidth,
    removeSideHorizontalConstraint,
    cornerAngle,
    topEarLengthInput,
    topEarDepthInput,
    rightEarLengthInput,
    rightEarDepthInput,
    bottomEarLengthInput,
    bottomEarDepthInput,
    leftEarLengthInput,
    leftEarDepthInput
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

    const x1 = leftEarDepth;
    const x2 = safeWidth - rightEarDepth;
    const y = topEarDepth;
    const chord = x2 - x1;
    if (chord <= 0) return null;

    const radius = (chord * chord) / (8 * rise) + rise / 2;
    const cx = (x1 + x2) / 2;
    const cy = y + radius - rise;

    const segment = makeSegment(cx, cy, [x1, y], [x2, y]);
    return makeCompositeArc([segment]);
  };

  const getSymmetricThreeArcTopData = () => {
    if (!isSymmetricThreeArcTop) return null;

    const rise = Math.max(0, n(arcRise, 0));
    if (rise <= 0) return null;

    const p0 = [leftEarDepth, topEarDepth];
    const peak = [safeWidth / 2, topEarDepth - rise];
    const p4 = [safeWidth - rightEarDepth, topEarDepth];
    const yMeet = topEarDepth - rise * (safeTransitionHeight / 100);

    if (yMeet >= p0[1] || yMeet <= peak[1]) return null;

    const centerX = peak[0];
    const minX = p0[0] + 0.001;
    const maxX = peak[0] - 0.001;
    if (maxX <= minX) return null;

    const halfSpan = centerX - p0[0];
    const crownHalfWidth = halfSpan * (safeCrownWidth / 100);
    const bestX = clamp(centerX - crownHalfWidth, minX, maxX);

    const getCenters = (x) => {
      const leftDen = 2 * (yMeet - p0[1]);
      const crownDen = 2 * (yMeet - peak[1]);
      if (Math.abs(leftDen) < 0.000001 || Math.abs(crownDen) < 0.000001) return null;

      const leftCy = ((x - p0[0]) ** 2 + yMeet ** 2 - p0[1] ** 2) / leftDen;
      const crownCy = ((x - centerX) ** 2 + yMeet ** 2 - peak[1] ** 2) / crownDen;
      return { leftCy, crownCy };
    };

    const centers = getCenters(bestX);
    if (!centers) return null;

    const leftMeet = [bestX, yMeet];
    const rightMeet = [safeWidth - bestX, yMeet];

    let leftSideCenter = [p0[0], centers.leftCy];
    let rightSideCenter = [p4[0], centers.leftCy];

    if (removeSideHorizontalConstraint) {
      const crownCenter = [centerX, centers.crownCy];
      const normal = [leftMeet[0] - crownCenter[0], leftMeet[1] - crownCenter[1]];
      const chord = [leftMeet[0] - p0[0], leftMeet[1] - p0[1]];
      const denominator = 2 * (normal[0] * chord[0] + normal[1] * chord[1]);

      if (Math.abs(denominator) > 0.000001) {
        const chordLengthSq = chord[0] * chord[0] + chord[1] * chord[1];
        const t = -chordLengthSq / denominator;
        const sideCx = leftMeet[0] + t * normal[0];
        const sideCy = leftMeet[1] + t * normal[1];

        if (Number.isFinite(sideCx) && Number.isFinite(sideCy)) {
          leftSideCenter = [sideCx, sideCy];
          rightSideCenter = [safeWidth - sideCx, sideCy];
        }
      }
    }

    return makeCompositeArc([
      makeSegment(leftSideCenter[0], leftSideCenter[1], p0, leftMeet),
      makeSegment(centerX, centers.crownCy, leftMeet, peak),
      makeSegment(centerX, centers.crownCy, peak, rightMeet),
      makeSegment(rightSideCenter[0], rightSideCenter[1], rightMeet, p4)
    ]);
  };

  const getAsymmetricTopArcData = () => {
    if (!isAsymmetricTop) return null;

    const p0 = [leftEarDepth, splitLeftBaseY];
    const p1 = [safeWidth - rightEarDepth, splitRightBaseY];

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

    const p0 = [leftEarDepth, splitLeftBaseY];
    const p2 = [safeWidth - rightEarDepth, splitRightBaseY];
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
    if (isSymmetricThreeArcTop) return getSymmetricThreeArcTopData();
    if (isAsymmetricTop) return getAsymmetricTopArcData();
    if (isDoubleArcTop) return getDoubleTopArcData();
    return null;
  };

  const getStartPoint = () => {
    if (isSplitHeightTop) return [leftEarDepth, splitLeftBaseY];
    return [leftEarDepth, topEarDepth];
  };

  const getRightTopBasePoint = () => {
    if (isSplitHeightTop) return [safeWidth - rightEarDepth, splitRightBaseY];
    return [safeWidth - rightEarDepth, topEarDepth];
  };

  const getTopArcEarRanges = () => {
    const arc = getActiveTopArcData();
    if (!arc || topEarDepth <= 0) return [];

    const usable = arc.arcLength - 2 * topVisibleCornerMargin - topEarLength;
    if (usable < 0) return [];

    const ranges = [];

    if (manualMode) {
      const count = Math.max(1, n(hEars, 1));

      if (count === 1) {
        const start = arc.arcLength / 2 - topEarLength / 2;
        ranges.push({ start, end: start + topEarLength });
        return ranges;
      }

      const spacing = usable / (count - 1);

      for (let i = 0; i < count; i++) {
        const start = topVisibleCornerMargin + i * spacing;
        ranges.push({ start, end: start + topEarLength });
      }

      return ranges;
    }

    let gaps = 1;
    while (usable / gaps > MAX_SPACING) gaps++;
    while (gaps > 1 && usable / gaps < MIN_SPACING) gaps--;

    const spacing = usable / gaps;

    for (let i = 0; i <= gaps; i++) {
      const start = topVisibleCornerMargin + i * spacing;
      ranges.push({ start, end: start + topEarLength });
    }

    return ranges;
  };

  const points = useMemo(() => {
    const ears = [];

    const addAutoSide = (sideLength, orientation, length, depth, edgeMargin = margin) => {
      if (depth <= 0) return;
      const usable = sideLength - 2 * edgeMargin - length;
      if (usable < 0) return;

      let gaps = 1;
      while (usable / gaps > MAX_SPACING) gaps++;
      while (gaps > 1 && usable / gaps < MIN_SPACING) gaps--;

      const spacing = usable / gaps;

      for (let i = 0; i <= gaps; i++) {
        ears.push({ orientation, pos: edgeMargin + i * spacing });
      }
    };

    const addManualSide = (sideLength, orientation, count, length, depth, edgeMargin = margin) => {
      if (depth <= 0) return;
      const usable = sideLength - 2 * edgeMargin - length;
      if (usable < 0) return;

      if (count === 1) {
        ears.push({ orientation, pos: sideLength / 2 - length / 2 });
        return;
      }

      const spacing = usable / (count - 1);
      for (let i = 0; i < count; i++) {
        ears.push({ orientation, pos: edgeMargin + i * spacing });
      }
    };

    const addAutoVerticalSpan = (startY, endY, orientation, length, depth) => {
      if (depth <= 0) return;
      const sideLength = endY - startY;
      const visibleMargin = Math.max(0, margin - depth);
      const usable = sideLength - 2 * visibleMargin - length;
      if (usable < 0) return;

      let gaps = 1;
      while (usable / gaps > MAX_SPACING) gaps++;
      while (gaps > 1 && usable / gaps < MIN_SPACING) gaps--;

      const spacing = usable / gaps;
      for (let i = 0; i <= gaps; i++) {
        ears.push({ orientation, pos: startY + visibleMargin + i * spacing });
      }
    };

    const addManualVerticalSpan = (startY, endY, orientation, count, length, depth) => {
      if (depth <= 0) return;
      const sideLength = endY - startY;
      const visibleMargin = Math.max(0, margin - depth);
      const usable = sideLength - 2 * visibleMargin - length;
      if (usable < 0) return;

      if (count === 1) {
        ears.push({ orientation, pos: startY + sideLength / 2 - length / 2 });
        return;
      }

      const spacing = usable / (count - 1);
      for (let i = 0; i < count; i++) {
        ears.push({ orientation, pos: startY + visibleMargin + i * spacing });
      }
    };

    if (!manualMode) {
      if (topShape === 'straight') addAutoSide(safeWidth, 'top', topEarLengthForLayout, topEarDepth, topEdgeMarginForLayout);
      addAutoSide(safeWidth, 'bottom', bottomEarLengthForLayout, bottomEarDepth, bottomEdgeMarginForLayout);

      if (isSplitHeightTop) {
        addAutoVerticalSpan(splitLeftBaseY, bottomBaseY, 'left', leftEarLength, leftEarDepth);
        addAutoVerticalSpan(splitRightBaseY, bottomBaseY, 'right', rightEarLength, rightEarDepth);
      } else {
        addAutoSide(safeHeight, 'left', leftEarLength, leftEarDepth);
        addAutoSide(safeHeight, 'right', rightEarLength, rightEarDepth);
      }
    } else {
      if (topShape === 'straight') addManualSide(safeWidth, 'top', Math.max(1, n(hEars, 1)), topEarLengthForLayout, topEarDepth, topEdgeMarginForLayout);
      addManualSide(safeWidth, 'bottom', Math.max(1, n(hEars, 1)), bottomEarLengthForLayout, bottomEarDepth, bottomEdgeMarginForLayout);

      if (isSplitHeightTop) {
        addManualVerticalSpan(splitLeftBaseY, bottomBaseY, 'left', Math.max(1, n(leftVEars, 1)), leftEarLength, leftEarDepth);
        addManualVerticalSpan(splitRightBaseY, bottomBaseY, 'right', Math.max(1, n(rightVEars, 1)), rightEarLength, rightEarDepth);
      } else {
        addManualSide(safeHeight, 'left', Math.max(1, n(vEars, 1)), leftEarLength, leftEarDepth);
        addManualSide(safeHeight, 'right', Math.max(1, n(vEars, 1)), rightEarLength, rightEarDepth);
      }
    }

    return ears;
  }, [
    safeWidth,
    safeHeight,
    bottomBaseY,
    splitLeftBaseY,
    splitRightBaseY,
    isSplitHeightTop,
    topEarLength,
    topEarDepth,
    topEarLengthForLayout,
    topEdgeMarginForLayout,
    rightEarLength,
    rightEarDepth,
    bottomEarLength,
    bottomEarDepth,
    bottomEarLengthForLayout,
    bottomEdgeMarginForLayout,
    leftEarLength,
    leftEarDepth,
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
      const outerStart = arc.pointAt(ear.start, topEarDepth);
      const outerEnd = arc.pointAt(ear.end, topEarDepth);
      const innerEnd = arc.pointAt(ear.end, 0);

      pushPoint(verts, innerStart);
      pushPoint(verts, outerStart);
      appendArcSegment(verts, arc, ear.start, ear.end, topEarDepth, EAR_ARC_SEGMENTS);
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
        verts.push([p, topEarDepth], [p, 0], [p + topEarLengthForLayout, 0], [p + topEarLengthForLayout, topEarDepth]);
      });
      verts.push([safeWidth - rightEarDepth, topEarDepth]);
    }

    grouped.right.forEach(ear => {
      const p = ear.pos;
      verts.push([safeWidth - rightEarDepth, p], [safeWidth, p], [safeWidth, p + rightEarLength], [safeWidth - rightEarDepth, p + rightEarLength]);
    });

    verts.push([safeWidth - rightEarDepth, bottomBaseY]);

    grouped.bottom.forEach(ear => {
      const p = ear.pos;
      verts.push([p + bottomEarLengthForLayout, safeHeight - bottomEarDepth], [p + bottomEarLengthForLayout, safeHeight], [p, safeHeight], [p, safeHeight - bottomEarDepth]);
    });

    verts.push([leftEarDepth, bottomBaseY]);

    grouped.left.forEach(ear => {
      const p = ear.pos;
      verts.push([leftEarDepth, p + leftEarLength], [0, p + leftEarLength], [0, p], [leftEarDepth, p]);
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
            arc.pointAt(ear.start, topEarDepth),
            arc.pointAt(ear.end, topEarDepth),
            arc.pointAt(ear.end, 0)
          );
        });
      }
    } else {
      grouped.top.forEach(ear => {
        const p = ear.pos;
        verts.push([p, topEarDepth], [p, 0], [p + topEarLengthForLayout, 0], [p + topEarLengthForLayout, topEarDepth]);
      });
    }

    verts.push(getRightTopBasePoint());

    grouped.right.forEach(ear => {
      const p = ear.pos;
      verts.push([safeWidth - rightEarDepth, p], [safeWidth, p], [safeWidth, p + rightEarLength], [safeWidth - rightEarDepth, p + rightEarLength]);
    });

    verts.push([safeWidth - rightEarDepth, bottomBaseY]);

    grouped.bottom.forEach(ear => {
      const p = ear.pos;
      verts.push([p + bottomEarLengthForLayout, safeHeight - bottomEarDepth], [p + bottomEarLengthForLayout, safeHeight], [p, safeHeight], [p, safeHeight - bottomEarDepth]);
    });

    verts.push([leftEarDepth, bottomBaseY]);

    grouped.left.forEach(ear => {
      const p = ear.pos;
      verts.push([leftEarDepth, p + leftEarLength], [0, p + leftEarLength], [0, p], [leftEarDepth, p]);
    });

    if (isDoubleArcTop) {
      const p0 = [leftEarDepth, splitLeftBaseY];
      const p2 = [safeWidth - rightEarDepth, splitRightBaseY];
      const pm = [p0[0] + (p2[0] - p0[0]) * (safeMiddlePosition / 100), splitMiddleBaseY];
      verts.push(pm);
    }

    return verts;
  };

  const snapPoints = transformPoints(buildSnapVertices());

  const buildOutlinePath = () => {
    const verts = transformPoints(buildVertices());
    return verts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${v[0] * scale} ${v[1] * scale}`).join(' ') + ' Z';
  };

  const getBaseViewBox = () => ({
    x: -viewportPadding,
    y: (minShearY - extraTopSpace) * scale - viewportPadding,
    width: safeWidth * scale + viewportPadding * 2,
    height: (safeHeight + extraTopSpace + maxShearY - minShearY) * scale + viewportPadding * 2
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
  useEffect(() => {
    const preview = previewWheelBlockerRef.current;
    if (!preview) return;
    const stopPageScroll = (e) => {
      e.preventDefault();
    };
    preview.addEventListener('wheel', stopPageScroll, { passive: false });
    return () => {
      preview.removeEventListener('wheel', stopPageScroll);
    };
  }, []);

  useEffect(() => {
    const handleInteriorKeyDown = (e) => {
      if (workspaceMode !== 'interior') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedInteriorDesignId) {
        e.preventDefault();
        deleteSelectedInteriorDesign();
      }
    };

    window.addEventListener('keydown', handleInteriorKeyDown);
    return () => {
      window.removeEventListener('keydown', handleInteriorKeyDown);
    };
  }, [workspaceMode, selectedInteriorDesignId]);

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
    const ctm = typeof svg.getScreenCTM === 'function' ? svg.getScreenCTM() : null;

    if (ctm && typeof svg.createSVGPoint === 'function') {
      const point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      const svgPoint = point.matrixTransform(ctm.inverse());
      return { x: svgPoint.x / scale, y: svgPoint.y / scale };
    }

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

  const normalizeAngle = (angle) => {
    let next = angle;
    while (next <= -Math.PI) next += Math.PI * 2;
    while (next > Math.PI) next -= Math.PI * 2;
    return next;
  };

  const getAngleMeasurementGeometry = (m) => {
    const [p1, vertex, p3] = [m.p1, m.p2, m.p3];
    const a1 = Math.atan2(p1[1] - vertex[1], p1[0] - vertex[0]);
    const a2 = Math.atan2(p3[1] - vertex[1], p3[0] - vertex[0]);
    const delta = normalizeAngle(a2 - a1);
    const angle = Math.abs(delta) * 180 / Math.PI;
    const len1 = Math.hypot(p1[0] - vertex[0], p1[1] - vertex[1]);
    const len2 = Math.hypot(p3[0] - vertex[0], p3[1] - vertex[1]);
    const displayRadius = 42 / (scale * viewZoom);
    const radius = Math.max(12 / (scale * viewZoom), Math.min(displayRadius, len1 * 0.4, len2 * 0.4));
    const labelRadius = radius + 22 / (scale * viewZoom);
    const midAngle = a1 + delta / 2;
    const start = [vertex[0] + Math.cos(a1) * radius, vertex[1] + Math.sin(a1) * radius];
    const end = [vertex[0] + Math.cos(a1 + delta) * radius, vertex[1] + Math.sin(a1 + delta) * radius];
    const label = [vertex[0] + Math.cos(midAngle) * labelRadius, vertex[1] + Math.sin(midAngle) * labelRadius];
    const largeArc = Math.abs(delta) > Math.PI ? 1 : 0;
    const sweep = delta >= 0 ? 1 : 0;
    const arcPath = [
      `M ${start[0] * scale} ${start[1] * scale}`,
      `A ${radius * scale} ${radius * scale} 0 ${largeArc} ${sweep} ${end[0] * scale} ${end[1] * scale}`
    ].join(' ');

    return { angle, radius, start, end, label, arcPath };
  };

  const createAutomaticGapMeasurement = (id, p1, p2, outsidePoint) => {
    if (!p1 || !p2 || Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) <= 0.001) return null;

    const transformedP1 = transformPoint(p1);
    const transformedP2 = transformPoint(p2);
    const transformedOutsidePoint = transformPoint(outsidePoint);
    const { distance, nx, ny } = getMeasurementBaseData({ p1: transformedP1, p2: transformedP2 });
    const mid = [(transformedP1[0] + transformedP2[0]) / 2, (transformedP1[1] + transformedP2[1]) / 2];
    const outsideVector = [transformedOutsidePoint[0] - mid[0], transformedOutsidePoint[1] - mid[1]];
    const offsetSign = outsideVector[0] * nx + outsideVector[1] * ny >= 0 ? 1 : -1;

    return {
      id,
      p1: transformedP1,
      p2: transformedP2,
      distance,
      offset: offsetSign * 42,
      selected: false
    };
  };

  const automaticGapMeasurements = (() => {
    const result = [];

    const addMeasurement = (measurement) => {
      if (measurement) result.push(measurement);
    };

    const addHorizontalGap = (id, ears, y, outsideY, length, depth) => {
      if (depth <= 0) return;
      const sorted = [...ears].sort((a, b) => a.pos - b.pos);
      if (sorted.length < 2) return;

      const p1 = [sorted[0].pos + length, y];
      const p2 = [sorted[1].pos, y];
      addMeasurement(createAutomaticGapMeasurement(id, p1, p2, [(p1[0] + p2[0]) / 2, outsideY]));
    };

    const addVerticalGap = (id, ears, x, outsideX, length, depth) => {
      if (depth <= 0) return;
      const sorted = [...ears].sort((a, b) => a.pos - b.pos);
      if (sorted.length < 2) return;

      const p1 = [x, sorted[0].pos + length];
      const p2 = [x, sorted[1].pos];
      addMeasurement(createAutomaticGapMeasurement(id, p1, p2, [outsideX, (p1[1] + p2[1]) / 2]));
    };

    if (hasArcTop) {
      const arc = getActiveTopArcData();
      const ears = getTopArcEarRanges();

      if (arc && ears.length >= 2) {
        const p1 = arc.pointAt(ears[0].end, 0);
        const p2 = arc.pointAt(ears[1].start, 0);
        const outsideY = Math.min(p1[1], p2[1]) - 120;
        addMeasurement(createAutomaticGapMeasurement('auto-gap-top', p1, p2, [(p1[0] + p2[0]) / 2, outsideY]));
      }
    }

    addHorizontalGap('auto-gap-bottom', grouped.bottom, safeHeight - bottomEarDepth, safeHeight + 120, bottomEarLengthForLayout, bottomEarDepth);

    if (isAsymmetricTop || isDoubleArcTop) {
      addVerticalGap('auto-gap-left', grouped.left, leftEarDepth, -120, leftEarLength, leftEarDepth);
      addVerticalGap('auto-gap-right', grouped.right, safeWidth - rightEarDepth, safeWidth + 120, rightEarLength, rightEarDepth);
    } else {
      addVerticalGap('auto-gap-left', grouped.left, leftEarDepth, -120, leftEarLength, leftEarDepth);
    }

    return result;
  })();


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

    if (activeTool !== 'measure' && activeTool !== 'angle') return;

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

  const updateInteriorDesign = (id, changes) => {
    setInteriorDesigns(prev => prev.map(item => (
      item.id === id ? { ...item, ...changes } : item
    )));
  };

  const getSelectedInteriorDesign = () => (
    interiorDesigns.find(item => item.id === selectedInteriorDesignId) || null
  );

  const getInteriorDesignHandles = (design) => {
    if (!design) return [];
    const { x, y, width: itemWidth, height: itemHeight } = design;
    const cx = x + itemWidth / 2;
    const cy = y + itemHeight / 2;

    return [
      { id: 'nw', x, y, cursor: 'nwse-resize' },
      { id: 'n', x: cx, y, cursor: 'ns-resize' },
      { id: 'ne', x: x + itemWidth, y, cursor: 'nesw-resize' },
      { id: 'e', x: x + itemWidth, y: cy, cursor: 'ew-resize' },
      { id: 'se', x: x + itemWidth, y: y + itemHeight, cursor: 'nwse-resize' },
      { id: 's', x: cx, y: y + itemHeight, cursor: 'ns-resize' },
      { id: 'sw', x, y: y + itemHeight, cursor: 'nesw-resize' },
      { id: 'w', x, y: cy, cursor: 'ew-resize' }
    ];
  };

  const svgTextToDataUrl = (text) => {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return `data:image/svg+xml;base64,${btoa(binary)}`;
  };

  const handleInteriorDesignFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const svgText = String(reader.result || '');
      const defaultSize = Math.max(80, Math.min(safeWidth, safeHeight) * 0.25);
      const nextDesign = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.svg$/i, '') || 'SVG design',
        href: svgTextToDataUrl(svgText),
        svgText,
        color: 'white',
        x: safeWidth / 2 - defaultSize / 2,
        y: safeHeight / 2 - defaultSize / 2,
        width: defaultSize,
        height: defaultSize
      };

      setInteriorDesigns(prev => [...prev, nextDesign]);
      setSelectedInteriorDesignId(nextDesign.id);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const startInteriorDesignDrag = (e, design, mode, handle = null) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const point = getSvgPoint(e);
    setSelectedInteriorDesignId(design.id);
    setInteriorDrag({
      id: design.id,
      mode,
      handle,
      startMouse: [point.x, point.y],
      startDesign: { x: design.x, y: design.y, width: design.width, height: design.height }
    });
  };

  const handleInteriorPreviewMouseMove = (e) => {
    if (panState) {
      handlePreviewMouseMove(e);
      return;
    }

    if (!interiorDrag) return;

    const point = getSvgPoint(e);
    const dx = point.x - interiorDrag.startMouse[0];
    const dy = point.y - interiorDrag.startMouse[1];
    const start = interiorDrag.startDesign;
    const minSize = 10;

    if (interiorDrag.mode === 'move') {
      updateInteriorDesign(interiorDrag.id, {
        x: start.x + dx,
        y: start.y + dy
      });
      return;
    }

    const next = { ...start };
    const handle = interiorDrag.handle;

    if (handle.includes('e')) next.width = Math.max(minSize, start.width + dx);
    if (handle.includes('s')) next.height = Math.max(minSize, start.height + dy);
    if (handle.includes('w')) {
      const proposedWidth = Math.max(minSize, start.width - dx);
      next.x = start.x + start.width - proposedWidth;
      next.width = proposedWidth;
    }
    if (handle.includes('n')) {
      const proposedHeight = Math.max(minSize, start.height - dy);
      next.y = start.y + start.height - proposedHeight;
      next.height = proposedHeight;
    }

    updateInteriorDesign(interiorDrag.id, next);
  };

  const handleInteriorNumberChange = (field, value) => {
    const design = getSelectedInteriorDesign();
    if (!design) return;
    if (value === '') {
      updateInteriorDesign(design.id, { [field]: '' });
      return;
    }

    const min = field === 'width' || field === 'height' ? 10 : -Infinity;
    updateInteriorDesign(design.id, { [field]: Math.max(min, Number(value)) });
  };

  const handleInteriorNumberBlur = (field, fallback) => {
    const design = getSelectedInteriorDesign();
    if (!design) return;

    const min = field === 'width' || field === 'height' ? 10 : -Infinity;
    updateInteriorDesign(design.id, { [field]: Math.max(min, n(design[field], fallback)) });
  };

  const deleteSelectedInteriorDesign = () => {
    if (!selectedInteriorDesignId) return;
    setInteriorDesigns(prev => prev.filter(item => item.id !== selectedInteriorDesignId));
    setSelectedInteriorDesignId(null);
    setInteriorDrag(null);
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

    return { id: crypto.randomUUID(), type: 'distance', p1, p2, distance, offset, selected: false };
  };

  const createAngleMeasurement = (p1, p2, p3) => {
    const len1 = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
    const len2 = Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
    if (len1 <= 0.001 || len2 <= 0.001) return null;

    const a1 = Math.atan2(p1[1] - p2[1], p1[0] - p2[0]);
    const a2 = Math.atan2(p3[1] - p2[1], p3[0] - p2[0]);
    const angle = Math.abs(normalizeAngle(a2 - a1)) * 180 / Math.PI;

    return { id: crypto.randomUUID(), type: 'angle', p1, p2, p3, angle, selected: false };
  };

  const handlePreviewClick = (e) => {
    if (activeTool !== 'measure' && activeTool !== 'angle') return;
    e.stopPropagation();
    if (draggingMeasurement) return;

    const { x, y } = getSvgPoint(e);
    const snapped = findNearestSnapPoint(x, y);
    if (!snapped) return;

    const nextPoints = [...measurePoints, snapped];

    if (activeTool === 'angle') {
      if (nextPoints.length === 3) {
        const [p1, p2, p3] = nextPoints;
        const nextAngle = createAngleMeasurement(p1, p2, p3);

        if (!nextAngle) {
          setMeasurePoints([]);
          return;
        }

        setMeasurements(prev => [...prev.map(m => ({ ...m, selected: false })), nextAngle]);
        setMeasurePoints([]);
      } else {
        setMeasurements(prev => prev.map(m => ({ ...m, selected: false })));
        setMeasurePoints(nextPoints);
      }

      return;
    }

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
    if (activeTool !== 'measure' && activeTool !== 'angle') return;
    e.stopPropagation();
    setMeasurements(prev => prev.map(m => m.id === measurement.id ? { ...m, selected: true } : { ...m, selected: false }));
  };

  const roundDXF = (value) => Math.round(value * 1000000) / 1000000;
  const dxfLine = (...items) => `${items.join('\n')}\n`;

  const toDXFPoint = (point) => {
    const [x, y] = transformPoint(point);
    return [roundDXF(x), roundDXF(overallHeight - (y - minShearY))];
  };

  const toRawDXFPoint = ([x, y]) => [roundDXF(x), roundDXF(overallHeight - (y - minShearY))];

  const dxfPolylineEntity = (points, closed = true, layer = '0') => {
    const cleaned = points
      .map(point => toRawDXFPoint(point))
      .filter((point, index, arr) => {
        if (index === 0) return true;
        const prev = arr[index - 1];
        return Math.hypot(point[0] - prev[0], point[1] - prev[1]) > 0.000001;
      });

    if (cleaned.length < 2) return '';

    let entity = dxfLine('0', 'LWPOLYLINE', '8', layer, '90', cleaned.length, '70', closed ? '1' : '0');
    cleaned.forEach(([x, y]) => {
      entity += dxfLine('10', x, '20', y);
    });
    return entity;
  };

  const parseSvgNumberList = (value) => (value || '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter(Number.isFinite);

  const parseSvgPoints = (value) => {
    const nums = parseSvgNumberList(value);
    const points = [];
    for (let i = 0; i < nums.length - 1; i += 2) {
      points.push([nums[i], nums[i + 1]]);
    }
    return points;
  };

  const multiplyMatrix = (a, b) => ([
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5]
  ]);

  const applyMatrix = (matrix, [x, y]) => ([
    matrix[0] * x + matrix[2] * y + matrix[4],
    matrix[1] * x + matrix[3] * y + matrix[5]
  ]);

  const parseSvgTransform = (value) => {
    let matrix = [1, 0, 0, 1, 0, 0];
    const pattern = /(\w+)\(([^)]*)\)/g;
    let match;

    while ((match = pattern.exec(value || ''))) {
      const type = match[1];
      const nums = parseSvgNumberList(match[2]);
      let next = [1, 0, 0, 1, 0, 0];

      if (type === 'matrix' && nums.length >= 6) {
        next = nums.slice(0, 6);
      } else if (type === 'translate') {
        next = [1, 0, 0, 1, nums[0] || 0, nums[1] || 0];
      } else if (type === 'scale') {
        next = [nums[0] ?? 1, 0, 0, nums[1] ?? nums[0] ?? 1, 0, 0];
      } else if (type === 'rotate') {
        const angle = (nums[0] || 0) * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rotation = [cos, sin, -sin, cos, 0, 0];
        if (nums.length >= 3) {
          const [cx, cy] = [nums[1], nums[2]];
          next = multiplyMatrix(multiplyMatrix([1, 0, 0, 1, cx, cy], rotation), [1, 0, 0, 1, -cx, -cy]);
        } else {
          next = rotation;
        }
      }

      matrix = multiplyMatrix(matrix, next);
    }

    return matrix;
  };

  const isBlackSvgNode = (node) => {
    const value = `${node.getAttribute('fill') || ''} ${node.getAttribute('stroke') || ''} ${node.getAttribute('style') || ''}`.toLowerCase();
    if (value.includes('none')) return value.includes('stroke') && !value.includes('stroke:none');
    if (!value.trim()) return true;
    return value.includes('black') || value.includes('#000') || value.includes('rgb(0') || value.includes('currentcolor');
  };

  const getSvgRootBox = (svg) => {
    const viewBox = parseSvgNumberList(svg.getAttribute('viewBox'));
    if (viewBox.length >= 4) return { x: viewBox[0], y: viewBox[1], width: viewBox[2], height: viewBox[3] };
    const widthValue = parseFloat(svg.getAttribute('width')) || 100;
    const heightValue = parseFloat(svg.getAttribute('height')) || 100;
    return { x: 0, y: 0, width: widthValue, height: heightValue };
  };

  const buildInteriorDesignDXFEntities = () => {
    const entities = [];
    const parser = new DOMParser();

    interiorDesigns.forEach((design, designIndex) => {
      if (!design.svgText) return;

      const doc = parser.parseFromString(design.svgText, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg || doc.querySelector('parsererror')) return;

      const rootBox = getSvgRootBox(svg);
      const designWidth = Math.max(10, n(design.width, 10));
      const designHeight = Math.max(10, n(design.height, 10));
      const scaleX = designWidth / (rootBox.width || 1);
      const scaleY = designHeight / (rootBox.height || 1);
      const placePoint = ([x, y]) => [
        n(design.x, 0) + (x - rootBox.x) * scaleX,
        n(design.y, 0) + (y - rootBox.y) * scaleY
      ];
      const layer = `DESIGN_${designIndex + 1}`;

      const addPolyline = (points, closed = true) => {
        if (points.length < 2) return;
        entities.push(dxfPolylineEntity(points.map(placePoint), closed, layer));
      };

      const walk = (node, parentMatrix = [1, 0, 0, 1, 0, 0]) => {
        if (node.nodeType !== 1) return;
        const matrix = multiplyMatrix(parentMatrix, parseSvgTransform(node.getAttribute('transform')));
        const tag = node.tagName.toLowerCase();

        if (tag === 'path' && isBlackSvgNode(node)) {
          const d = node.getAttribute('d');
          if (d) {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            try {
              const length = path.getTotalLength();
              const steps = Math.max(8, Math.ceil(length / 4));
              const points = [];
              for (let i = 0; i <= steps; i++) {
                const point = path.getPointAtLength(length * (i / steps));
                points.push(applyMatrix(matrix, [point.x, point.y]));
              }
              addPolyline(points, true);
            } catch {
              // Unsupported path data is skipped.
            }
          }
        } else if (tag === 'rect' && isBlackSvgNode(node)) {
          const x = parseFloat(node.getAttribute('x')) || 0;
          const y = parseFloat(node.getAttribute('y')) || 0;
          const w = parseFloat(node.getAttribute('width')) || 0;
          const h = parseFloat(node.getAttribute('height')) || 0;
          addPolyline([[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(point => applyMatrix(matrix, point)), true);
        } else if ((tag === 'circle' || tag === 'ellipse') && isBlackSvgNode(node)) {
          const cx = parseFloat(node.getAttribute('cx')) || 0;
          const cy = parseFloat(node.getAttribute('cy')) || 0;
          const rx = tag === 'circle' ? parseFloat(node.getAttribute('r')) || 0 : parseFloat(node.getAttribute('rx')) || 0;
          const ry = tag === 'circle' ? rx : parseFloat(node.getAttribute('ry')) || 0;
          const points = [];
          for (let i = 0; i < 72; i++) {
            const angle = i * Math.PI * 2 / 72;
            points.push(applyMatrix(matrix, [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]));
          }
          addPolyline(points, true);
        } else if ((tag === 'polygon' || tag === 'polyline') && isBlackSvgNode(node)) {
          addPolyline(parseSvgPoints(node.getAttribute('points')).map(point => applyMatrix(matrix, point)), tag === 'polygon');
        } else if (tag === 'line' && isBlackSvgNode(node)) {
          const p1 = [parseFloat(node.getAttribute('x1')) || 0, parseFloat(node.getAttribute('y1')) || 0];
          const p2 = [parseFloat(node.getAttribute('x2')) || 0, parseFloat(node.getAttribute('y2')) || 0];
          addPolyline([applyMatrix(matrix, p1), applyMatrix(matrix, p2)], false);
        }

        Array.from(node.children).forEach(child => walk(child, matrix));
      };

      walk(svg);
    });

    return entities.join('');
  };

  const segmentBulge = (segment, startLocal, endLocal) => {
    const includedAngle = segment.direction * ((endLocal - startLocal) / segment.radius);
    return roundDXF(-Math.tan(includedAngle / 4));
  };

  const buildArcTopDXFLwPolyline = () => {
    if (isAngledPanel) return buildStraightDXFLwPolyline();

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
      const outerStart = arc.pointAt(ear.start, topEarDepth);
      const outerEnd = arc.pointAt(ear.end, topEarDepth);
      const innerEnd = arc.pointAt(ear.end, 0);

      currentPoint = innerStart;
      addLineTo(outerStart);
      addArcTo(ear.start, ear.end, topEarDepth);
      addLineTo(innerEnd);

      currentS = ear.end;
    });

    addArcTo(currentS, arc.arcLength, 0);

    grouped.right.forEach(ear => {
      const p = ear.pos;
      addLineTo([safeWidth - rightEarDepth, p]);
      addLineTo([safeWidth, p]);
      addLineTo([safeWidth, p + rightEarLength]);
      addLineTo([safeWidth - rightEarDepth, p + rightEarLength]);
    });

    addLineTo([safeWidth - rightEarDepth, bottomBaseY]);

    grouped.bottom.forEach(ear => {
      const p = ear.pos;
      addLineTo([p + bottomEarLengthForLayout, safeHeight - bottomEarDepth]);
      addLineTo([p + bottomEarLengthForLayout, safeHeight]);
      addLineTo([p, safeHeight]);
      addLineTo([p, safeHeight - bottomEarDepth]);
    });

    addLineTo([leftEarDepth, bottomBaseY]);

    grouped.left.forEach(ear => {
      const p = ear.pos;
      addLineTo([leftEarDepth, p + leftEarLength]);
      addLineTo([0, p + leftEarLength]);
      addLineTo([0, p]);
      addLineTo([leftEarDepth, p]);
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
    if (isAngledPanel) return buildFusionStraightEntities();

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
      const outerStart = arc.pointAt(ear.start, topEarDepth);
      const innerEnd = arc.pointAt(ear.end, 0);

      currentPoint = innerStart;
      addLine(outerStart);
      addArc(ear.start, ear.end, topEarDepth);
      addLine(innerEnd);

      currentS = ear.end;
    });

    addArc(currentS, arc.arcLength, 0);

    grouped.right.forEach(ear => {
      const p = ear.pos;
      addLine([safeWidth - rightEarDepth, p]);
      addLine([safeWidth, p]);
      addLine([safeWidth, p + rightEarLength]);
      addLine([safeWidth - rightEarDepth, p + rightEarLength]);
    });

    addLine([safeWidth - rightEarDepth, bottomBaseY]);

    grouped.bottom.forEach(ear => {
      const p = ear.pos;
      addLine([p + bottomEarLengthForLayout, safeHeight - bottomEarDepth]);
      addLine([p + bottomEarLengthForLayout, safeHeight]);
      addLine([p, safeHeight]);
      addLine([p, safeHeight - bottomEarDepth]);
    });

    addLine([leftEarDepth, bottomBaseY]);

    grouped.left.forEach(ear => {
      const p = ear.pos;
      addLine([leftEarDepth, p + leftEarLength]);
      addLine([0, p + leftEarLength]);
      addLine([0, p]);
      addLine([leftEarDepth, p]);
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
    dxf += buildInteriorDesignDXFEntities();
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
          if ((id === 'measure' || id === 'angle') && activeTool === id) {
            clearMeasureTool();
            return;
          }
          setMeasurePoints([]);
          setHoverSnap(null);
          setDraggingMeasurement(null);
          setActiveTool(id);
        }}
        className={[
          'w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition border',
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

  const handlePercentageChange = (setter) => (e) => {
    const value = e.target.value;
    if (value === '') {
      setter('');
      return;
    }
    setter(clamp(Number(value), 1, 99));
  };

  const handleCornerAngleChange = (e) => {
    const value = e.target.value;
    setCornerAngle(value === '' ? '' : +value);
  };

  const handleCornerOffsetChange = (e) => {
    const value = e.target.value;
    if (value === '') {
      setCornerAngle('');
      return;
    }

    const maxOffset = offsetFromAngle(150);
    const minOffset = offsetFromAngle(30);
    setCornerAngle(angleFromOffset(clamp(Number(value), minOffset, maxOffset)));
  };

  const handleNumberBlur = (setter, value, min, max = Infinity, fallback = min) => {
    const parsed = n(value, fallback);
    setter(clamp(parsed, min, max));
    setFocusedNumberField(null);
  };

  const handleHeightBlur = () => {
    const nextHeight = Math.max(minPanelSize, n(height, minPanelSize));
    setHeight(nextHeight);

    if (isSplitHeightTop) {
      const nextLeft = clamp(
        n(leftHeight, nextHeight - 100),
        minPanelSize,
        Math.max(minPanelSize, nextHeight - 1)
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
      minPanelSize,
      Math.max(minPanelSize, safeHeight - 1)
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
  const selectedInteriorDesign = getSelectedInteriorDesign();

  const openInteriorDesigner = () => {
    clearMeasureTool();
    resetView();
    setWorkspaceMode('interior');
  };

  if (workspaceMode === 'interior') {
    return (
      <div className="h-screen overflow-hidden bg-slate-100 p-3">
        <div className="h-full w-full bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col min-h-0">
          <div className="shrink-0 border-b border-slate-200 px-4 py-3 flex items-center gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setWorkspaceMode('frame')}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft size={16} />
                Back to frame
              </button>
              <div>
                <h1 className="text-lg font-bold text-slate-800">Interior Designer</h1>
                <p className="text-xs text-slate-500">{safeWidth} x {safeHeight} mm frame</p>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 p-3 flex gap-3">
            <div
              ref={previewWheelBlockerRef}
              className="relative flex-1 min-w-0 min-h-0 rounded-lg border bg-slate-50 overflow-hidden"
              onWheel={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <svg
                width="100%"
                height="100%"
                viewBox={`${currentViewBox.x} ${currentViewBox.y} ${currentViewBox.width} ${currentViewBox.height}`}
                className="h-full w-full"
              onWheel={handleViewportWheel}
              onMouseDown={handleViewportMouseDown}
                onMouseMove={handleInteriorPreviewMouseMove}
                onMouseUp={() => {
                  setPanState(null);
                  setInteriorDrag(null);
                }}
                onMouseLeave={() => {
                  setPanState(null);
                  setInteriorDrag(null);
                }}
                onClick={() => setSelectedInteriorDesignId(null)}
                style={{ cursor: panState ? 'grabbing' : 'default' }}
              >
                <path
                  d={buildOutlinePath()}
                  fill="#000000"
                  stroke="#0f172a"
                  strokeWidth={2 / viewZoom}
                />

                {interiorDesigns.map((design) => {
                  const selected = design.id === selectedInteriorDesignId;
                  const x = n(design.x, 0);
                  const y = n(design.y, 0);
                  const itemWidth = Math.max(10, n(design.width, 10));
                  const itemHeight = Math.max(10, n(design.height, 10));

                  return (
                    <g key={design.id}>
                      <image
                        href={design.href}
                        x={x * scale}
                        y={y * scale}
                        width={itemWidth * scale}
                        height={itemHeight * scale}
                        preserveAspectRatio="none"
                        onMouseDown={(e) => startInteriorDesignDrag(e, design, 'move')}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInteriorDesignId(design.id);
                        }}
                        style={{
                          cursor: interiorDrag?.id === design.id && interiorDrag.mode === 'move' ? 'grabbing' : 'move',
                          filter: design.color === 'black' ? 'brightness(0)' : 'brightness(0) invert(1)'
                        }}
                      />

                      {selected && (
                        <g>
                          <rect
                            x={x * scale}
                            y={y * scale}
                            width={itemWidth * scale}
                            height={itemHeight * scale}
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth={1.5 / viewZoom}
                            strokeDasharray={`${5 / viewZoom} ${4 / viewZoom}`}
                            pointerEvents="none"
                          />
                          {getInteriorDesignHandles({ ...design, x, y, width: itemWidth, height: itemHeight }).map(handle => (
                            <rect
                              key={handle.id}
                              x={handle.x * scale - 5 / viewZoom}
                              y={handle.y * scale - 5 / viewZoom}
                              width={10 / viewZoom}
                              height={10 / viewZoom}
                              fill="#2563eb"
                              stroke="white"
                              strokeWidth={1 / viewZoom}
                              onMouseDown={(e) => startInteriorDesignDrag(e, design, 'resize', handle.id)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ cursor: handle.cursor }}
                            />
                          ))}
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>

              <div
                className="absolute left-3 bottom-3 rounded-lg border border-slate-200 bg-white/95 p-2 shadow-sm"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  {[
                    ['white', 'White', 'bg-white border-slate-300'],
                    ['black', 'Black', 'bg-black border-black']
                  ].map(([value, label, swatchClass]) => {
                    const selected = selectedInteriorDesign?.color === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={!selectedInteriorDesign}
                        onClick={() => selectedInteriorDesign && updateInteriorDesign(selectedInteriorDesign.id, { color: value })}
                        className={[
                          'flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs font-medium transition',
                          selected
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                          !selectedInteriorDesign ? 'opacity-45 cursor-not-allowed hover:bg-white' : ''
                        ].join(' ')}
                      >
                        <span className={['h-4 w-4 rounded-sm border', swatchClass].join(' ')} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="w-56 shrink-0 rounded-lg border bg-slate-50 p-3">
              <div className="flex items-center gap-2 mb-3">
                <Wrench size={18} className="text-slate-700" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Design Tools</h2>
                  <p className="text-[11px] text-slate-500">No tool selected</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <input
                  ref={designFileInputRef}
                  type="file"
                  accept=".svg,image/svg+xml"
                  onChange={handleInteriorDesignFileChange}
                  className="hidden"
                />
                <button type="button" disabled className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm border bg-white text-slate-400 border-slate-200 cursor-not-allowed">
                  <Type size={17} />
                  <span className="flex-1 text-left">Text</span>
                </button>
                <button type="button" disabled className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm border bg-white text-slate-400 border-slate-200 cursor-not-allowed">
                  <Grid3X3 size={17} />
                  <span className="flex-1 text-left">Patterns</span>
                </button>
                <button
                  type="button"
                  onClick={() => designFileInputRef.current?.click()}
                  className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm border bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                >
                  <Upload size={17} />
                  <span className="flex-1 text-left">Insert SVG</span>
                </button>
                <button
                  type="button"
                  onClick={downloadDXF}
                  className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm border bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                >
                  <Upload size={17} />
                  <span className="flex-1 text-left">Export DXF</span>
                </button>
              </div>

              {selectedInteriorDesign && (
                <div className="mt-3 rounded-lg bg-white border p-3 text-xs text-slate-600">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="font-semibold text-slate-700 truncate">{selectedInteriorDesign.name}</p>
                    <button
                      type="button"
                      onClick={deleteSelectedInteriorDesign}
                      className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['X', 'x'],
                      ['Y', 'y'],
                      ['Width', 'width'],
                      ['Height', 'height']
                    ].map(([label, field]) => (
                      <div key={field}>
                        <label className="text-[11px] text-slate-500">{label}</label>
                        <input
                          type="number"
                          value={selectedInteriorDesign[field]}
                          onChange={e => handleInteriorNumberChange(field, e.target.value)}
                          onBlur={() => handleInteriorNumberBlur(field, field === 'width' || field === 'height' ? 100 : 0)}
                          className="w-full mt-1 p-1.5 border rounded-md"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen overflow-hidden bg-slate-100 p-3"
      onClick={() => {
        if (activeTool === 'measure' || activeTool === 'angle') {
          setMeasurePoints([]);
          setMeasurements([]);
          setDraggingMeasurement(null);
        }
      }}
    >
      <div className="h-full w-full grid lg:grid-cols-[minmax(340px,420px)_1fr] gap-3" onClick={(e) => e.stopPropagation()}>

        {/* LEFT PANEL - CONTROLS */}
        <div className="min-h-0 overflow-y-auto bg-white rounded-xl shadow-lg border border-slate-200 p-4 space-y-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Ear Pattern Generator</h1>
            <p className="text-slate-500 text-xs mt-0.5">Parametric CAD DXF generator</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Width (mm)</label>
              <input
                type="number"
                value={width}
                onFocus={() => setFocusedNumberField('width')}
                onChange={e => setWidth(e.target.value === '' ? '' : +e.target.value)}
                onBlur={() => handleNumberBlur(setWidth, width, minPanelSize)}
                className="w-full mt-1 p-2 border rounded-md text-sm"
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
                className="w-full mt-1 p-2 border rounded-md text-sm"
              />
            </div>
          </div>

          <details className="rounded-lg bg-slate-50 border px-3 py-2">
            <summary className="cursor-pointer select-none text-sm font-medium text-slate-700">Corner angle</summary>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div>
                <label className="text-xs text-slate-500">Angle (deg)</label>
                <input
                  type="number"
                  min="30"
                  max="150"
                  value={cornerAngle}
                  onFocus={() => setFocusedNumberField('cornerAngle')}
                  onChange={handleCornerAngleChange}
                  onBlur={() => handleNumberBlur(setCornerAngle, cornerAngle, 30, 150, 90)}
                  className="w-full mt-1 p-2 border rounded-md text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500">Offset (mm)</label>
                <input
                  type="number"
                  value={Number.isFinite(shearOffset) ? Math.round(shearOffset * 10) / 10 : ''}
                  onFocus={() => setFocusedNumberField('cornerOffset')}
                  onChange={handleCornerOffsetChange}
                  onBlur={() => setFocusedNumberField(null)}
                  className="w-full mt-1 p-2 border rounded-md text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500">Overall height</label>
                <input
                  type="number"
                  value={Math.round(overallHeight * 10) / 10}
                  readOnly
                  className="w-full mt-1 p-2 border rounded-md bg-slate-100 text-slate-600 text-sm"
                />
              </div>
            </div>
          </details>

          <div className="p-3 rounded-lg bg-slate-50 border space-y-2">
            <label className="text-xs text-slate-500">Top shape</label>
            <select
              value={topShape}
              onChange={e => setTopShape(e.target.value)}
              className="w-full p-2 border rounded-md bg-white text-sm"
            >
              <option value="straight">Straight</option>
              <option value="symmetric">Symmetric curved top</option>
              <option value="symmetricThreeArc">Symmetric 3-arc top</option>
              <option value="asymmetric">Asymmetric arc top</option>
              <option value="double">Double arc top</option>
            </select>

            {(isSymmetricTop || isSymmetricThreeArcTop) && (
              <div>
                <label className="text-xs text-slate-500">Arc rise (mm)</label>
                <input
                  type="number"
                  min="0"
                  value={arcRise}
                  onChange={e => setArcRise(e.target.value === '' ? '' : +e.target.value)}
                  onBlur={() => handleNumberBlur(setArcRise, arcRise, 0, Infinity, 0)}
                  className="w-full mt-1 p-2 border rounded-md text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">Top ears follow the selected symmetric arc shape.</p>

                {isSymmetricThreeArcTop && (
                  <div className="mt-3">
                    <label className="text-xs text-slate-500">Transition height (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={transitionHeight}
                      onFocus={() => setFocusedNumberField('transitionHeight')}
                      onChange={handlePercentageChange(setTransitionHeight)}
                      onBlur={() => handleNumberBlur(setTransitionHeight, transitionHeight, 1, 99, 50)}
                      className="w-full mt-1 p-2 border rounded-md text-sm"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">1% = just above side height. 99% = just below side height + arc rise.</p>

                    <label className="text-xs text-slate-500 mt-3 block">Crown width (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={crownWidth}
                      onFocus={() => setFocusedNumberField('crownWidth')}
                      onChange={handlePercentageChange(setCrownWidth)}
                      onBlur={() => handleNumberBlur(setCrownWidth, crownWidth, 1, 99, 50)}
                      className="w-full mt-1 p-2 border rounded-md text-sm"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Controls the horizontal distance between the two merge points. Smaller = narrower crown. Larger = wider crown.</p>

                    <label className="flex items-center gap-2 text-xs text-slate-600 mt-3">
                      <input
                        type="checkbox"
                        checked={removeSideHorizontalConstraint}
                        onChange={e => setRemoveSideHorizontalConstraint(e.target.checked)}
                      />
                      Remove side horizontal constraint
                    </label>
                    <p className="text-[11px] text-slate-400 mt-1">When enabled, the side arcs are allowed to leave the side walls at an angle, creating a smoother transition into the crown while keeping tangent joins.</p>
                  </div>
                )}
              </div>
            )}

            {isSplitHeightTop && (
              <div>
                <label className="text-xs text-slate-500">Left outside height (mm)</label>
                <input
                  type="number"
                  min={minPanelSize}
                  max={Math.max(minPanelSize, safeHeight - 1)}
                  value={leftHeight}
                  onFocus={() => setFocusedNumberField('leftHeight')}
                  onChange={e => setLeftHeight(e.target.value === '' ? '' : +e.target.value)}
                  onBlur={handleLeftHeightBlur}
                  className="w-full mt-1 p-2 border rounded-md text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">The base arc is lowered by ear depth so top ears stay inside the outside height.</p>
              </div>
            )}

            {isDoubleArcTop && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Middle position (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={middlePosition}
                    onFocus={() => setFocusedNumberField('middlePosition')}
                    onChange={handlePercentageChange(setMiddlePosition)}
                    onBlur={() => handleNumberBlur(setMiddlePosition, middlePosition, 1, 99, 50)}
                    className="w-full mt-1 p-2 border rounded-md text-sm"
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
                    className="w-full mt-1 p-2 border rounded-md bg-slate-100 text-slate-600 text-sm"
                  />
                </div>
                <p className="text-[11px] text-slate-400 col-span-2">
                  Middle outside height is automatically set to the midpoint between left outside height and right/max height. Top ears can cross the middle join.
                </p>
              </div>
            )}
          </div>

          <details className="rounded-lg bg-slate-50 border px-3 py-2">
            <summary className="cursor-pointer select-none text-sm font-medium text-slate-700">Ear sizes</summary>
            <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
              {[
                ['Top', topEarLengthInput, setTopEarLengthInput, topEarDepthInput, setTopEarDepthInput],
                ['Right', rightEarLengthInput, setRightEarLengthInput, rightEarDepthInput, setRightEarDepthInput],
                ['Bottom', bottomEarLengthInput, setBottomEarLengthInput, bottomEarDepthInput, setBottomEarDepthInput],
                ['Left', leftEarLengthInput, setLeftEarLengthInput, leftEarDepthInput, setLeftEarDepthInput]
              ].map(([label, lengthValue, setLength, depthValue, setDepth]) => (
                <div key={label} className="rounded-md bg-white border p-2">
                  <p className="font-semibold text-slate-600 mb-1">{label}</p>
                  <label className="text-[11px] text-slate-500">Length</label>
                  <input
                    type="number"
                    min="1"
                    value={lengthValue}
                    onChange={e => setLength(e.target.value === '' ? '' : +e.target.value)}
                    onBlur={() => handleNumberBlur(setLength, lengthValue, 1, Infinity, 30)}
                    className="w-full mt-1 mb-1.5 p-1.5 border rounded-md"
                  />
                  <label className="text-[11px] text-slate-500">Depth</label>
                  <input
                    type="number"
                    min="0"
                    value={depthValue}
                    onChange={e => setDepth(e.target.value === '' ? '' : +e.target.value)}
                    onBlur={() => handleNumberBlur(setDepth, depthValue, 0, Infinity, 10)}
                    className="w-full mt-1 p-1.5 border rounded-md"
                  />
                </div>
              ))}
            </div>
          </details>

          <div className="p-3 rounded-lg bg-slate-50 border space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={manualMode} onChange={e => setManualMode(e.target.checked)} />
              Manual Mode
            </label>
            <p className="text-xs text-slate-500">Toggle between automatic optimization and fixed ear count</p>
          </div>

          {manualMode && (
            <div className="space-y-1.5">
              <div>
                <label className="text-xs text-slate-500">Horizontal ears</label>
                <input
                  type="number"
                  min="1"
                  value={hEars}
                  onChange={e => setHEars(e.target.value === '' ? '' : +e.target.value)}
                  onBlur={() => handleNumberBlur(setHEars, hEars, 1, Infinity, 1)}
                  className="w-full mt-1 p-2 border rounded-md text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">Bottom ears plus top ears when an arc top is active.</p>
              </div>

              {isSplitHeightTop ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">Left side ears</label>
                    <input
                      type="number"
                      min="1"
                      value={leftVEars}
                      onChange={e => setLeftVEars(e.target.value === '' ? '' : +e.target.value)}
                      onBlur={() => handleNumberBlur(setLeftVEars, leftVEars, 1, Infinity, 1)}
                      className="w-full mt-1 p-2 border rounded-md text-sm"
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
                      className="w-full mt-1 p-2 border rounded-md text-sm"
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
                    className="w-full mt-1 p-2 border rounded-md text-sm"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Left + right</p>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={openInteriorDesigner}
            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-lg transition shadow-sm"
          >
            <PenLine size={17} />
            Interior design
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={downloadDXF} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg transition shadow-sm">
              Export DXF
            </button>
            <button onClick={downloadFusionDXF} className="w-full bg-blue-700 hover:bg-blue-600 text-white font-semibold py-2.5 rounded-lg transition shadow-sm">
              Export Fusion DXF
            </button>
          </div>

          <details className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"><summary className="cursor-pointer select-none font-medium text-slate-600">Notes</summary><div className="mt-2 leading-relaxed">
            <p>• Auto mode: optimized spacing 240–400mm</p>
            <p>• Manual mode: fixed ear count with 80mm visible margins</p>
            <p>• N=1 centers ear perfectly</p>
            <p>• Asymmetric top: low left side, max right side, circular arc ends flat on the right</p>
            <p>• Double arc top: two connected circular arcs with editable middle point</p>
            <p>• Symmetric 3-arc top: transition height + crown width controls with optional side horizontal constraint</p>
          </div></details>
        </div>

        {/* RIGHT AREA - PREVIEW + TOOL PANEL */}
        <div className="min-h-0 bg-white rounded-xl shadow-lg border border-slate-200 p-3 flex gap-3">
          <div
            ref={previewWheelBlockerRef}
            className={[
      'bg-slate-50 rounded-lg p-2 border flex-1 min-w-0 min-h-0 overflow-hidden flex items-center justify-center',
      activeTool === 'measure' || activeTool === 'angle' ? 'cursor-crosshair' : ''
            ].join(' ')}
            onWheel={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`${currentViewBox.x} ${currentViewBox.y} ${currentViewBox.width} ${currentViewBox.height}`}
              className="h-full w-full"
              onWheel={handleViewportWheel}
              onMouseDown={handleViewportMouseDown}
              onMouseMove={handlePreviewMouseMove}
              onMouseLeave={handlePreviewMouseLeave}
              onClick={handlePreviewClick}
              onMouseUp={() => {
                setDraggingMeasurement(null);
                setPanState(null);
              }}
              style={{ cursor: panState ? 'grabbing' : activeTool === 'measure' || activeTool === 'angle' ? 'crosshair' : 'default' }}
            >
              <path d={buildOutlinePath()} fill="none" stroke="#0f172a" strokeWidth={2 / viewZoom} />

              {isDoubleArcTop && (
                <circle
                  cx={transformPoint([leftEarDepth + (safeWidth - leftEarDepth - rightEarDepth) * (safeMiddlePosition / 100), splitMiddleBaseY])[0] * scale}
                  cy={transformPoint([leftEarDepth + (safeWidth - leftEarDepth - rightEarDepth) * (safeMiddlePosition / 100), splitMiddleBaseY])[1] * scale}
                  r={3 / viewZoom}
                  fill="#64748b"
                />
              )}

              {/* Automatic ear gap dimensions */}
              <g pointerEvents="none">
                {automaticGapMeasurements.map((m) => {
                  const geometry = getMeasurementGeometry(m);
                  const color = '#475569';

                  return (
                    <g key={m.id}>
                      <line x1={m.p1[0] * scale} y1={m.p1[1] * scale} x2={geometry.d1[0] * scale} y2={geometry.d1[1] * scale} stroke={color} strokeWidth={1 / viewZoom} strokeDasharray={`${4 / viewZoom} ${4 / viewZoom}`} />
                      <line x1={m.p2[0] * scale} y1={m.p2[1] * scale} x2={geometry.d2[0] * scale} y2={geometry.d2[1] * scale} stroke={color} strokeWidth={1 / viewZoom} strokeDasharray={`${4 / viewZoom} ${4 / viewZoom}`} />
                      <line x1={geometry.d1[0] * scale} y1={geometry.d1[1] * scale} x2={geometry.d2[0] * scale} y2={geometry.d2[1] * scale} stroke={color} strokeWidth={1.5 / viewZoom} />
                      <polygon points={polygonPoints(geometry.leftArrow)} fill={color} />
                      <polygon points={polygonPoints(geometry.rightArrow)} fill={color} />

                      <text
                        x={geometry.label[0] * scale}
                        y={geometry.label[1] * scale}
                        fontSize={20 / viewZoom}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="none"
                        stroke="white"
                        strokeWidth={6 / viewZoom}
                        transform={`rotate(${geometry.angle} ${geometry.label[0] * scale} ${geometry.label[1] * scale})`}
                      >
                        {geometry.distance.toFixed(1)} mm
                      </text>

                      <text
                        x={geometry.label[0] * scale}
                        y={geometry.label[1] * scale}
                        fill={color}
                        fontSize={12 / viewZoom}
                        fontWeight="600"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${geometry.angle} ${geometry.label[0] * scale} ${geometry.label[1] * scale})`}
                      >
                        {geometry.distance.toFixed(1)} mm
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* CAD-style measurements */}
              {measurements.map((m) => {
                if (m.type === 'angle') {
                  const geometry = getAngleMeasurementGeometry(m);
                  const color = m.selected ? '#2563eb' : '#7c3aed';

                  return (
                    <g
                      key={m.id}
                      onClick={(e) => handleMeasurementClick(e, m)}
                      style={{ cursor: activeTool === 'angle' ? 'pointer' : 'default' }}
                    >
                      <line x1={m.p2[0] * scale} y1={m.p2[1] * scale} x2={m.p1[0] * scale} y2={m.p1[1] * scale} stroke={color} strokeWidth={1.5 / viewZoom} strokeDasharray={`${5 / viewZoom} ${4 / viewZoom}`} />
                      <line x1={m.p2[0] * scale} y1={m.p2[1] * scale} x2={m.p3[0] * scale} y2={m.p3[1] * scale} stroke={color} strokeWidth={1.5 / viewZoom} strokeDasharray={`${5 / viewZoom} ${4 / viewZoom}`} />
                      <path d={geometry.arcPath} fill="none" stroke="transparent" strokeWidth={14 / viewZoom} />
                      <path d={geometry.arcPath} fill="none" stroke={color} strokeWidth={2 / viewZoom} />
                      <circle cx={m.p2[0] * scale} cy={m.p2[1] * scale} r={3.5 / viewZoom} fill={color} stroke="white" strokeWidth={1 / viewZoom} />

                      <text
                        x={geometry.label[0] * scale}
                        y={geometry.label[1] * scale}
                        fontSize={20 / viewZoom}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="none"
                        stroke="white"
                        strokeWidth={6 / viewZoom}
                      >
                        {geometry.angle.toFixed(1)} deg
                      </text>

                      <text
                        x={geometry.label[0] * scale}
                        y={geometry.label[1] * scale}
                        fill={color}
                        fontSize={12 / viewZoom}
                        fontWeight="600"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {geometry.angle.toFixed(1)} deg
                      </text>

                      {m.selected && (
                        <>
                          <rect x={m.p1[0] * scale - 4 / viewZoom} y={m.p1[1] * scale - 4 / viewZoom} width={8 / viewZoom} height={8 / viewZoom} fill="#2563eb" stroke="white" strokeWidth={1 / viewZoom} />
                          <rect x={m.p2[0] * scale - 4 / viewZoom} y={m.p2[1] * scale - 4 / viewZoom} width={8 / viewZoom} height={8 / viewZoom} fill="#2563eb" stroke="white" strokeWidth={1 / viewZoom} />
                          <rect x={m.p3[0] * scale - 4 / viewZoom} y={m.p3[1] * scale - 4 / viewZoom} width={8 / viewZoom} height={8 / viewZoom} fill="#2563eb" stroke="white" strokeWidth={1 / viewZoom} />
                        </>
                      )}
                    </g>
                  );
                }

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

              {(activeTool === 'measure' || activeTool === 'angle') && hoverSnap && !draggingMeasurement && (
                <rect x={hoverSnap[0] * scale - 5 / viewZoom} y={hoverSnap[1] * scale - 5 / viewZoom} width={10 / viewZoom} height={10 / viewZoom} fill="none" stroke="#2563eb" strokeWidth={2 / viewZoom} />
              )}
            </svg>
          </div>

          {/* TOOL PANEL */}
          <div className={['rounded-lg border bg-slate-50 p-2 transition-all duration-200 shrink-0', activeTool ? 'w-52' : 'w-40'].join(' ')}>
            <div className="flex items-center gap-2 mb-2">
              <Wrench size={18} className="text-slate-700" />
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Tools</h2>
                <p className="text-[11px] text-slate-500">{activeTool ? `Active: ${activeTool}` : 'No tool selected'}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <ToolButton id="measure" icon={Ruler} label="Measure" shortcut="M" />
              <ToolButton id="angle" icon={DraftingCompass} label="Angle" shortcut="A" />
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
              <div className="mt-3 rounded-lg bg-white border p-2 text-xs text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-700 mb-1">Measure tool</p>
                <p>Click two snap points to create a CAD-style measurement.</p>
                <p className="mt-2">Drag the dimension line or text to move it away from the part.</p>
                <p className="mt-2">Select a dimension and press Delete to remove it.</p>
                <p className="mt-2 text-slate-400">Press M or Escape to clear and exit.</p>
              </div>
            )}

            {activeTool === 'angle' && (
              <div className="mt-3 rounded-lg bg-white border p-2 text-xs text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-700 mb-1">Angle tool</p>
                <p>Click three snap points to create an angle measurement.</p>
                <p className="mt-2">The second point is the corner of the angle.</p>
                <p className="mt-2">Select an angle and press Delete to remove it.</p>
                <p className="mt-2 text-slate-400">Press A or Escape to clear and exit.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
