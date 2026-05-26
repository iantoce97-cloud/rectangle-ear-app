import { useEffect, useMemo, useRef, useState } from 'react';
import { svgPathProperties } from 'svg-path-properties';
import { SVGPathData, SVGPathDataTransformer, encodeSVGPath } from 'svg-pathdata';
import ClipperLib from 'clipper-lib';
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
  ArrowUp,
  ArrowDown,
  PenLine,
  DraftingCompass,
  Lock,
  Unlock,
  Square,
  Circle,
  Minus,
  Eraser
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
  const [splitPanelEnabled, setSplitPanelEnabled] = useState(false);
  const [splitPositionInput, setSplitPositionInput] = useState(500);
  const [splitGapInput, setSplitGapInput] = useState(20);
  const [splitEarLengthInput, setSplitEarLengthInput] = useState(30);
  const [splitEarDepthInput, setSplitEarDepthInput] = useState(10);
  const [splitManualMode, setSplitManualMode] = useState(false);
  const [splitLeftCutEars, setSplitLeftCutEars] = useState(2);
  const [splitRightCutEars, setSplitRightCutEars] = useState(2);
  const [syncSplitEars, setSyncSplitEars] = useState(false);
  const [splitLeftTopEars, setSplitLeftTopEars] = useState(2);
  const [splitLeftBottomEars, setSplitLeftBottomEars] = useState(2);
  const [splitRightTopEars, setSplitRightTopEars] = useState(2);
  const [splitRightBottomEars, setSplitRightBottomEars] = useState(2);
  const [bottomPanelEnabled, setBottomPanelEnabled] = useState(false);
  const [bottomPanelHeightInput, setBottomPanelHeightInput] = useState(400);
  const [bottomPanelVEars, setBottomPanelVEars] = useState(1);

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
  const [selectedInteriorDesignIds, setSelectedInteriorDesignIds] = useState([]);
  const [interiorDrag, setInteriorDrag] = useState(null);
  const [interiorSelectionBox, setInteriorSelectionBox] = useState(null);
  const [isInteriorPointerOnBody, setIsInteriorPointerOnBody] = useState(false);
  const [isInteriorPointerOnWhiteSurface, setIsInteriorPointerOnWhiteSurface] = useState(false);
  const [activeInteriorShapeTool, setActiveInteriorShapeTool] = useState(null);
  const [interiorShapeDraft, setInteriorShapeDraft] = useState(null);
  const [eraserSizeInput, setEraserSizeInput] = useState(20);
  const [positionDistanceInputs, setPositionDistanceInputs] = useState({ left: '', right: '', top: '', bottom: '' });
  const [interiorPositionMessage, setInteriorPositionMessage] = useState('');
  const [showInteriorExportPreview, setShowInteriorExportPreview] = useState(false);
  const [interiorClipEnabled, setInteriorClipEnabled] = useState(false);
  const [interiorMarginInput, setInteriorMarginInput] = useState(30);
  const [showInteriorMarginGuide, setShowInteriorMarginGuide] = useState(false);
  const [patternEnabled, setPatternEnabled] = useState(false);
  const [patternMode, setPatternMode] = useState('random');
  const [patternThickness, setPatternThickness] = useState(15);
  const [patternMinLength, setPatternMinLength] = useState(80);
  const [patternMaxLength, setPatternMaxLength] = useState(260);
  const [patternRowSpacing, setPatternRowSpacing] = useState(90);
  const [patternGap, setPatternGap] = useState(90);
  const [patternSeed, setPatternSeed] = useState(1);
  const [patternRoundedEnds, setPatternRoundedEnds] = useState(false);
  const [patternRandomRowSpacing, setPatternRandomRowSpacing] = useState(false);
  const [patternRandomGap, setPatternRandomGap] = useState(false);
  const [alignedSlotRows, setAlignedSlotRows] = useState(6);
  const [alignedSlotBottomRows, setAlignedSlotBottomRows] = useState(2);
  const [alignedSlotBreakWidth, setAlignedSlotBreakWidth] = useState(30);
  const [alignedSlotLeftInset, setAlignedSlotLeftInset] = useState(30);
  const [alignedSlotRightInset, setAlignedSlotRightInset] = useState(30);
  const [alignedSlotMinLength, setAlignedSlotMinLength] = useState(150);
  const [alignedSlotUseRowSpacing, setAlignedSlotUseRowSpacing] = useState(false);
  const [alignedSlotRowSpacing, setAlignedSlotRowSpacing] = useState(80);
  const [alignedSlotStaggerBreaks, setAlignedSlotStaggerBreaks] = useState(false);

  const [activeTool, setActiveTool] = useState(null);

  // VIEWPORT / CAD CAMERA
  const [viewZoom, setViewZoom] = useState(1);
  const [viewPosition, setViewPosition] = useState(null);
  const [panState, setPanState] = useState(null);
  const lastMiddleClickRef = useRef(0);
  const previewWheelBlockerRef = useRef(null);
  const designFileInputRef = useRef(null);
  const interiorDesignsRef = useRef([]);
  const selectedInteriorDesignIdRef = useRef(null);
  const selectedInteriorDesignIdsRef = useRef([]);
  const interiorUndoStackRef = useRef([]);
  const interiorRedoStackRef = useRef([]);
  const interiorDragStartSnapshotRef = useRef(null);
  const interiorClipboardRef = useRef(null);
  const interiorMousePointRef = useRef(null);
  const interiorSelectionJustFinishedRef = useRef(false);
  const interiorSuppressNextObjectClickRef = useRef(false);
  const positionMessageTimeoutRef = useRef(null);

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

  const interiorFontOptions = [
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Impact', value: 'Impact, Haettenschweiler, sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
    { label: 'Courier New', value: '"Courier New", Courier, monospace' }
  ];

  const cloneInteriorDesigns = (designs) => designs.map(design => ({ ...design }));

  const sameInteriorDesigns = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const recordInteriorHistory = (snapshot = interiorDesignsRef.current) => {
    const cloned = cloneInteriorDesigns(snapshot);
    const stack = interiorUndoStackRef.current;
    const last = stack[stack.length - 1];
    if (last && sameInteriorDesigns(last, cloned)) return;

    stack.push(cloned);
    if (stack.length > 80) stack.shift();
    interiorRedoStackRef.current = [];
  };

  const applyInteriorDesigns = (updater, { history = true, selectedId } = {}) => {
    setInteriorDesigns(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (history && !sameInteriorDesigns(prev, next)) recordInteriorHistory(prev);
      return next;
    });

    if (selectedId !== undefined) {
      setSelectedInteriorDesignId(selectedId);
      setSelectedInteriorDesignIds(selectedId ? [selectedId] : []);
    }
  };

  const restoreInteriorHistorySnapshot = (snapshot) => {
    const selectedStillExists = snapshot.some(design => design.id === selectedInteriorDesignIdRef.current);
    const remainingSelection = selectedInteriorDesignIdsRef.current.filter(id => snapshot.some(design => design.id === id));
    setInteriorDesigns(cloneInteriorDesigns(snapshot));
    if (!selectedStillExists) setSelectedInteriorDesignId(null);
    setSelectedInteriorDesignIds(remainingSelection);
    setInteriorDrag(null);
    setInteriorShapeDraft(null);
  };

  const undoInteriorDesignAction = () => {
    const previous = interiorUndoStackRef.current.pop();
    if (!previous) return;

    interiorRedoStackRef.current.push(cloneInteriorDesigns(interiorDesignsRef.current));
    restoreInteriorHistorySnapshot(previous);
  };

  const redoInteriorDesignAction = () => {
    const next = interiorRedoStackRef.current.pop();
    if (!next) return;

    interiorUndoStackRef.current.push(cloneInteriorDesigns(interiorDesignsRef.current));
    restoreInteriorHistorySnapshot(next);
  };

  const copySelectedInteriorDesign = () => {
    const ids = selectedInteriorDesignIdsRef.current.length ? selectedInteriorDesignIdsRef.current : [selectedInteriorDesignIdRef.current].filter(Boolean);
    const selected = interiorDesignsRef.current.filter(design => ids.includes(design.id));
    if (!selected.length) return;
    interiorClipboardRef.current = selected.map(design => ({ ...design }));
  };

  const pasteInteriorDesign = () => {
    const copied = interiorClipboardRef.current;
    if (!copied) return;
    const copiedItems = Array.isArray(copied) ? copied : [copied];

    const offset = 20;
    const copiedBounds = getInteriorSelectionBounds(copiedItems);
    const pastePoint = interiorMousePointRef.current;
    const dx = pastePoint ? pastePoint.x - (copiedBounds.x + copiedBounds.width / 2) : offset;
    const dy = pastePoint ? pastePoint.y - (copiedBounds.y + copiedBounds.height / 2) : offset;
    const nextDesigns = copiedItems.map(copiedItem => ({
      ...copiedItem,
      id: crypto.randomUUID(),
      name: `${copiedItem.name || 'Design'} copy`,
      x: copiedItem.x !== undefined ? n(copiedItem.x, 0) + dx : copiedItem.x,
      y: copiedItem.y !== undefined ? n(copiedItem.y, 0) + dy : copiedItem.y,
      x1: copiedItem.x1 !== undefined ? n(copiedItem.x1, 0) + dx : copiedItem.x1,
      y1: copiedItem.y1 !== undefined ? n(copiedItem.y1, 0) + dy : copiedItem.y1,
      x2: copiedItem.x2 !== undefined ? n(copiedItem.x2, 0) + dx : copiedItem.x2,
      y2: copiedItem.y2 !== undefined ? n(copiedItem.y2, 0) + dy : copiedItem.y2,
      x3: copiedItem.x3 !== undefined ? n(copiedItem.x3, 0) + dx : copiedItem.x3,
      y3: copiedItem.y3 !== undefined ? n(copiedItem.y3, 0) + dy : copiedItem.y3
    }));

    applyInteriorDesigns(prev => [...prev, ...nextDesigns], { selectedId: nextDesigns[nextDesigns.length - 1].id });
    setSelectedInteriorDesignIds(nextDesigns.map(design => design.id));
    interiorClipboardRef.current = nextDesigns.map(design => ({ ...design }));
  };

  const showInteriorPositionMessage = (message) => {
    setInteriorPositionMessage(message);
    window.clearTimeout(positionMessageTimeoutRef.current);
    positionMessageTimeoutRef.current = window.setTimeout(() => {
      setInteriorPositionMessage('');
    }, 2400);
  };

  const isTextEditingTarget = (target) => {
    const tagName = target?.tagName?.toLowerCase();
    return target?.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
  };

  const topEarLength = Math.max(1, n(topEarLengthInput, 30));
  const topEarDepth = Math.max(0, n(topEarDepthInput, 10));
  const rightEarLength = Math.max(1, n(rightEarLengthInput, 30));
  const rightEarDepth = Math.max(0, n(rightEarDepthInput, 10));
  const bottomEarLength = Math.max(1, n(bottomEarLengthInput, 30));
  const bottomEarDepth = Math.max(0, n(bottomEarDepthInput, 10));
  const leftEarLength = Math.max(1, n(leftEarLengthInput, 30));
  const leftEarDepth = Math.max(0, n(leftEarDepthInput, 10));
  const splitGap = Math.max(0, n(splitGapInput, 20));
  const splitEarLength = Math.max(1, n(splitEarLengthInput, 30));
  const splitEarDepth = Math.max(0, n(splitEarDepthInput, 10));
  const minPanelSize = 1;
  const bottomPanelGap = 40;
  const bottomPanelHeight = Math.max(minPanelSize, n(bottomPanelHeightInput, 400));
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
  const minSplitPanelWidth = leftEarDepth + splitEarDepth + 1;
  const maxSplitPanelWidth = Math.max(minSplitPanelWidth, safeWidth - rightEarDepth - splitGap - splitEarDepth - 1);
  const safeSplitPanelWidth = clamp(n(splitPositionInput, safeWidth / 2), minSplitPanelWidth, maxSplitPanelWidth);
  const safeSplitPosition = safeSplitPanelWidth - splitEarDepth;
  const safeRightSplitPosition = safeSplitPanelWidth + splitGap + splitEarDepth;
  const hasPanelSplit = splitPanelEnabled && safeWidth - leftEarDepth - rightEarDepth > 2 && safeSplitPosition > leftEarDepth && safeRightSplitPosition < safeWidth - rightEarDepth;
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
  const drawingMinY = minShearY - extraTopSpace;
  const drawingMaxY = Math.max(safeHeight + maxShearY, bottomPanelEnabled ? safeHeight + bottomPanelGap + bottomPanelHeight : safeHeight + maxShearY);

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
    if (bottomPanelEnabled && y >= safeHeight + bottomPanelGap - 0.001) {
      return [x, y];
    }

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
  const interiorMargin = Math.max(0, n(interiorMarginInput, 30));
  const eraserSize = Math.max(1, n(eraserSizeInput, 20));

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
    interiorDesignsRef.current = interiorDesigns;
  }, [interiorDesigns]);

  useEffect(() => {
    selectedInteriorDesignIdRef.current = selectedInteriorDesignId;
  }, [selectedInteriorDesignId]);

  useEffect(() => {
    selectedInteriorDesignIdsRef.current = selectedInteriorDesignIds;
  }, [selectedInteriorDesignIds]);

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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !isTextEditingTarget(e.target)) {
        e.preventDefault();
        if (e.shiftKey) {
          redoInteriorDesignAction();
        } else {
          undoInteriorDesignAction();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !isTextEditingTarget(e.target)) {
        if (workspaceMode === 'interior') {
          e.preventDefault();
          copySelectedInteriorDesign();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !isTextEditingTarget(e.target)) {
        if (workspaceMode === 'interior') {
          e.preventDefault();
          pasteInteriorDesign();
        }
        return;
      }

      if (!isTextEditingTarget(e.target) && e.key.toLowerCase() === 'm') {
        if (workspaceMode === 'interior') {
          setActiveInteriorShapeTool(null);
          setInteriorShapeDraft(null);
        }
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

      if (!isTextEditingTarget(e.target) && e.key.toLowerCase() === 'a') {
        setActiveTool(prev => {
          setMeasurePoints([]);
          setHoverSnap(null);
          setDraggingMeasurement(null);
          return prev === 'angle' ? null : 'angle';
        });
      }

      if (e.key === 'Escape') {
        clearMeasureTool();
        setActiveInteriorShapeTool(null);
        setInteriorShapeDraft(null);
      }

      if (!isTextEditingTarget(e.target) && (e.key === 'Delete' || e.key === 'Backspace')) {
        setMeasurements(prev => prev.filter(m => !m.selected));
        setDraggingMeasurement(null);
      }
    };

    const handleMouseUp = () => {
      finishInteriorInteraction();
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
    leftEarDepthInput,
    splitPanelEnabled,
    splitPositionInput,
    splitGapInput,
    splitEarLengthInput,
    splitEarDepthInput,
    splitManualMode,
    splitLeftCutEars,
    splitRightCutEars,
    syncSplitEars,
    splitLeftTopEars,
    splitLeftBottomEars,
    splitRightTopEars,
    splitRightBottomEars,
    bottomPanelEnabled,
    bottomPanelHeightInput,
    bottomPanelVEars
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

  const getVerticalEarRanges = (startY, endY, length, depth, useManual, countValue) => {
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);
    const sideLength = maxY - minY;

    if (depth <= 0 || length <= 0 || sideLength <= 0) {
      return [];
    }

    const visibleMargin = Math.max(0, margin - depth);
    const usable = sideLength - 2 * visibleMargin - length;
    if (usable < 0) {
      return [];
    }

    const ranges = [];
    if (useManual) {
      const count = Math.max(1, n(countValue, 1));
      if (count === 1) {
        const start = minY + sideLength / 2 - length / 2;
        ranges.push({ start, end: start + length });
      } else {
        const spacing = usable / (count - 1);
        for (let i = 0; i < count; i++) {
          const start = minY + visibleMargin + i * spacing;
          ranges.push({ start, end: start + length });
        }
      }
    } else {
      let gaps = 1;
      while (usable / gaps > MAX_SPACING) gaps++;
      while (gaps > 1 && usable / gaps < MIN_SPACING) gaps--;
      const spacing = usable / gaps;
      for (let i = 0; i <= gaps; i++) {
        const start = minY + visibleMargin + i * spacing;
        ranges.push({ start, end: start + length });
      }
    }

    return ranges;
  };

  const addVerticalEarsToEdge = (verts, x, startY, endY, side, length, depth, useManual, countValue, fixedRanges = null) => {
    const direction = endY >= startY ? 1 : -1;

    if (depth <= 0 || length <= 0 || Math.abs(endY - startY) <= 0.001) {
      pushPoint(verts, [x, endY]);
      return;
    }

    const ranges = fixedRanges || getVerticalEarRanges(startY, endY, length, depth, useManual, countValue);
    if (ranges.length === 0) {
      pushPoint(verts, [x, endY]);
      return;
    }

    const ordered = direction > 0 ? ranges : [...ranges].reverse();
    let cursor = startY;
    const outwardX = side === 'right' ? x + depth : x - depth;

    ordered.forEach(range => {
      const entryY = direction > 0 ? range.start : range.end;
      const exitY = direction > 0 ? range.end : range.start;
      pushPoint(verts, [x, entryY]);
      pushPoint(verts, [outwardX, entryY]);
      pushPoint(verts, [outwardX, exitY]);
      pushPoint(verts, [x, exitY]);
      cursor = exitY;
    });

    if (Math.abs(cursor - endY) > 0.001) {
      pushPoint(verts, [x, endY]);
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

  const getHorizontalEarRanges = (startX, endX, length, depth, edgeMargin, useManual, countValue) => {
    if (depth <= 0 || length <= 0) return [];

    const sideLength = endX - startX;
    const usable = sideLength - 2 * edgeMargin - length;
    if (usable < 0) return [];

    const ranges = [];

    if (useManual) {
      const count = Math.max(1, n(countValue, 1));
      if (count === 1) {
        const start = startX + sideLength / 2 - length / 2;
        ranges.push({ start, end: start + length });
        return ranges;
      }

      const spacing = usable / (count - 1);
      for (let i = 0; i < count; i++) {
        const start = startX + edgeMargin + i * spacing;
        ranges.push({ start, end: start + length });
      }

      return ranges;
    }

    let gaps = 1;
    while (usable / gaps > MAX_SPACING) gaps++;
    while (gaps > 1 && usable / gaps < MIN_SPACING) gaps--;

    const spacing = usable / gaps;
    for (let i = 0; i <= gaps; i++) {
      const start = startX + edgeMargin + i * spacing;
      ranges.push({ start, end: start + length });
    }

    return ranges;
  };

  const getArcEarRangesForSpan = (startS, endS, useManual = manualMode, countValue = hEars) => {
    if (topEarDepth <= 0 || topEarLength <= 0) return [];

    const spanLength = endS - startS;
    const usable = spanLength - 2 * topVisibleCornerMargin - topEarLength;
    if (usable < 0) return [];

    const ranges = [];

    if (useManual) {
      const count = Math.max(1, n(countValue, 1));
      if (count === 1) {
        const start = startS + spanLength / 2 - topEarLength / 2;
        ranges.push({ start, end: start + topEarLength });
        return ranges;
      }

      const spacing = usable / (count - 1);
      for (let i = 0; i < count; i++) {
        const start = startS + topVisibleCornerMargin + i * spacing;
        ranges.push({ start, end: start + topEarLength });
      }

      return ranges;
    }

    let gaps = 1;
    while (usable / gaps > MAX_SPACING) gaps++;
    while (gaps > 1 && usable / gaps < MIN_SPACING) gaps--;

    const spacing = usable / gaps;
    for (let i = 0; i <= gaps; i++) {
      const start = startS + topVisibleCornerMargin + i * spacing;
      ranges.push({ start, end: start + topEarLength });
    }

    return ranges;
  };

  const getArcSAtX = (arc, x) => {
    const samples = 256;
    let bestS = 0;
    let bestDistance = Infinity;
    let previous = arc.pointAt(0, 0);
    let previousS = 0;

    for (let i = 1; i <= samples; i++) {
      const s = arc.arcLength * (i / samples);
      const point = arc.pointAt(s, 0);
      const distance = Math.abs(point[0] - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestS = s;
      }

      if ((previous[0] - x) * (point[0] - x) <= 0 && Math.abs(point[0] - previous[0]) > 0.000001) {
        let low = previousS;
        let high = s;
        for (let j = 0; j < 24; j++) {
          const mid = (low + high) / 2;
          const midPoint = arc.pointAt(mid, 0);
          if ((previous[0] - x) * (midPoint[0] - x) <= 0) high = mid;
          else low = mid;
        }
        return (low + high) / 2;
      }

      previous = point;
      previousS = s;
    }

    return bestS;
  };

  const getArcTopSpanVertices = (arc, startS, endS, countValue = hEars) => {
    const verts = [arc.pointAt(startS, 0)];
    const ears = getArcEarRangesForSpan(startS, endS, true, countValue);
    let currentS = startS;

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

    appendArcSegment(verts, arc, currentS, endS, 0, ARC_SEGMENTS);
    pushPoint(verts, arc.pointAt(endS, 0));
    return verts;
  };

  const getStraightTopEdgeVertices = (startX, endX, countValue = hEars) => {
    const verts = [[startX, topEarDepth]];
    const ears = getHorizontalEarRanges(
      startX,
      endX,
      topEarLengthForLayout,
      topEarDepth,
      topEdgeMarginForLayout,
      true,
      countValue
    );

    ears.forEach(ear => {
      verts.push(
        [ear.start, topEarDepth],
        [ear.start, 0],
        [ear.end, 0],
        [ear.end, topEarDepth]
      );
    });

    verts.push([endX, topEarDepth]);
    return verts;
  };

  const getBottomEdgeVerticesLeftToRightForSpan = (startX, endX, countValue = hEars) => {
    const verts = [[startX, bottomBaseY]];
    const ears = getHorizontalEarRanges(
      startX,
      endX,
      bottomEarLengthForLayout,
      bottomEarDepth,
      bottomEdgeMarginForLayout,
      true,
      countValue
    );

    ears.forEach(ear => {
      verts.push(
        [ear.start, safeHeight - bottomEarDepth],
        [ear.start, safeHeight],
        [ear.end, safeHeight],
        [ear.end, safeHeight - bottomEarDepth]
      );
    });

    verts.push([endX, bottomBaseY]);
    return verts;
  };

  const getTopEdgeVertices = () => {
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
    return verts;
  };

  const splitPolylineAtX = (verts, x) => {
    const left = [];
    const right = [];
    let intersection = null;

    const pushSide = (target, point) => {
      const last = target[target.length - 1];
      if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > 0.001) {
        target.push(point);
      }
    };

    for (let i = 0; i < verts.length - 1; i++) {
      const a = verts[i];
      const b = verts[i + 1];
      if (i === 0) {
        if (a[0] <= x + 0.001) pushSide(left, a);
        if (a[0] >= x - 0.001) pushSide(right, a);
      }

      const crosses = (a[0] - x) * (b[0] - x) <= 0 && Math.abs(a[0] - b[0]) > 0.000001;
      if (crosses) {
        const t = clamp((x - a[0]) / (b[0] - a[0]), 0, 1);
        intersection = [x, a[1] + (b[1] - a[1]) * t];
        pushSide(left, intersection);
        pushSide(right, intersection);
      }

      if (b[0] <= x + 0.001) pushSide(left, b);
      if (b[0] >= x - 0.001) pushSide(right, b);
    }

    if (!intersection) {
      const nearest = verts.reduce((best, point) => (
        Math.abs(point[0] - x) < Math.abs(best[0] - x) ? point : best
      ), verts[0]);
      intersection = [x, nearest[1]];
    }

    return { left, right, intersection };
  };

  const getBottomEdgeVerticesLeftToRight = () => {
    return getBottomEdgeVerticesLeftToRightForSpan(leftEarDepth, safeWidth - rightEarDepth);
  };

  const getSplitPanelVertexSets = () => {
    if (!hasPanelSplit) return [buildVertices()];

    const splitX = safeSplitPosition;
    const rightSplitX = safeRightSplitPosition;
    const arc = getActiveTopArcData();
    const splitS = arc ? getArcSAtX(arc, splitX) : null;
    const rightSplitS = arc ? getArcSAtX(arc, rightSplitX) : null;
    const leftTop = arc
      ? getArcTopSpanVertices(arc, 0, splitS, splitLeftTopEars)
      : getStraightTopEdgeVertices(leftEarDepth, splitX, splitLeftTopEars);
    const rightTop = arc
      ? getArcTopSpanVertices(arc, rightSplitS, arc.arcLength, splitRightTopEars)
      : getStraightTopEdgeVertices(rightSplitX, safeWidth - rightEarDepth, splitRightTopEars);
    const bottomLeftToRight = getBottomEdgeVerticesLeftToRightForSpan(leftEarDepth, splitX, splitLeftBottomEars);
    const bottomRightToLeft = getBottomEdgeVerticesLeftToRightForSpan(rightSplitX, safeWidth - rightEarDepth, splitRightBottomEars).reverse();
    const splitTop = arc ? arc.pointAt(splitS, 0) : [splitX, topEarDepth];
    const splitBottom = [splitX, bottomBaseY];
    const rightSplitTop = arc ? arc.pointAt(rightSplitS, 0) : [rightSplitX, topEarDepth];
    const rightSplitBottom = [rightSplitX, bottomBaseY];
    const syncedSplitEarRanges = syncSplitEars
      ? getVerticalEarRanges(splitTop[1], splitBottom[1], splitEarLength, splitEarDepth, splitManualMode, splitLeftCutEars)
      : null;

    const leftVerts = [...leftTop];
    addVerticalEarsToEdge(leftVerts, splitX, splitTop[1], splitBottom[1], 'right', splitEarLength, splitEarDepth, splitManualMode, splitLeftCutEars, syncedSplitEarRanges);
    bottomLeftToRight.slice().reverse().forEach(point => pushPoint(leftVerts, point));
    grouped.left.forEach(ear => {
      const p = ear.pos;
      leftVerts.push([leftEarDepth, p + leftEarLength], [0, p + leftEarLength], [0, p], [leftEarDepth, p]);
    });

    const rightVerts = [...rightTop];
    grouped.right.forEach(ear => {
      const p = ear.pos;
      rightVerts.push(
        [safeWidth - rightEarDepth, p],
        [safeWidth, p],
        [safeWidth, p + rightEarLength],
        [safeWidth - rightEarDepth, p + rightEarLength]
      );
    });
    bottomRightToLeft.forEach(point => pushPoint(rightVerts, point));
    addVerticalEarsToEdge(rightVerts, rightSplitX, rightSplitBottom[1], rightSplitTop[1], 'left', splitEarLength, splitEarDepth, splitManualMode, splitRightCutEars, syncedSplitEarRanges);

    return [leftVerts, rightVerts];
  };

  const buildBottomPanelVertices = () => {
    const yOffset = safeHeight + bottomPanelGap;
    const topY = yOffset + topEarDepth;
    const bottomY = yOffset + bottomPanelHeight - bottomEarDepth;
    const verts = [[leftEarDepth, topY]];
    const topRanges = getHorizontalEarRanges(leftEarDepth, safeWidth - rightEarDepth, topEarLength, topEarDepth, topVisibleCornerMargin, manualMode, hEars);
    const bottomRanges = getHorizontalEarRanges(leftEarDepth, safeWidth - rightEarDepth, bottomEarLength, bottomEarDepth, Math.max(0, margin - bottomEarDepth), manualMode, hEars);
    const leftRanges = getVerticalEarRanges(topY, bottomY, leftEarLength, leftEarDepth, manualMode, bottomPanelVEars);
    const rightRanges = getVerticalEarRanges(topY, bottomY, rightEarLength, rightEarDepth, manualMode, bottomPanelVEars);

    topRanges.forEach(ear => {
      pushPoint(verts, [ear.start, topY]);
      pushPoint(verts, [ear.start, yOffset]);
      pushPoint(verts, [ear.end, yOffset]);
      pushPoint(verts, [ear.end, topY]);
    });

    pushPoint(verts, [safeWidth - rightEarDepth, topY]);

    rightRanges.forEach(ear => {
      pushPoint(verts, [safeWidth - rightEarDepth, ear.start]);
      pushPoint(verts, [safeWidth, ear.start]);
      pushPoint(verts, [safeWidth, ear.end]);
      pushPoint(verts, [safeWidth - rightEarDepth, ear.end]);
    });

    pushPoint(verts, [safeWidth - rightEarDepth, bottomY]);

    [...bottomRanges].reverse().forEach(ear => {
      pushPoint(verts, [ear.end, bottomY]);
      pushPoint(verts, [ear.end, yOffset + bottomPanelHeight]);
      pushPoint(verts, [ear.start, yOffset + bottomPanelHeight]);
      pushPoint(verts, [ear.start, bottomY]);
    });

    pushPoint(verts, [leftEarDepth, bottomY]);

    [...leftRanges].reverse().forEach(ear => {
      pushPoint(verts, [leftEarDepth, ear.end]);
      pushPoint(verts, [0, ear.end]);
      pushPoint(verts, [0, ear.start]);
      pushPoint(verts, [leftEarDepth, ear.start]);
    });

    return verts;
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

  const getPrimaryPanelVertexSets = () => (hasPanelSplit ? getSplitPanelVertexSets() : [buildVertices()]);

  const getPanelVertexSets = () => {
    const panels = getPrimaryPanelVertexSets();
    return bottomPanelEnabled ? [...panels, buildBottomPanelVertices()] : panels;
  };

  const snapPoints = hasPanelSplit || bottomPanelEnabled
    ? transformPoints(getPanelVertexSets().flat())
    : transformPoints(buildSnapVertices());

  const appendCleanArcSpan = (verts, arc, startS, endS) => {
    const length = Math.abs(endS - startS);
    const segments = Math.max(1, Math.ceil(ARC_SEGMENTS * (length / arc.arcLength)));
    for (let i = 1; i <= segments; i++) {
      const s = startS + (endS - startS) * (i / segments);
      pushPoint(verts, arc.pointAt(s, 0));
    }
  };

  const getCleanTopSpanVertices = (startX, endX) => {
    const arc = getActiveTopArcData();
    if (!arc) {
      const y1 = isSplitHeightTop
        ? safeHeight - (safeLeftHeight + (safeHeight - safeLeftHeight) * ((startX - leftEarDepth) / Math.max(1, safeWidth - leftEarDepth - rightEarDepth))) + topEarDepth
        : topEarDepth;
      const y2 = isSplitHeightTop
        ? safeHeight - (safeLeftHeight + (safeHeight - safeLeftHeight) * ((endX - leftEarDepth) / Math.max(1, safeWidth - leftEarDepth - rightEarDepth))) + topEarDepth
        : topEarDepth;
      return [[startX, y1], [endX, y2]];
    }

    const startS = getArcSAtX(arc, startX);
    const endS = getArcSAtX(arc, endX);
    const verts = [arc.pointAt(startS, 0)];
    appendCleanArcSpan(verts, arc, startS, endS);
    return verts;
  };

  const getCleanMainBodyPanelVertexSets = () => {
    const primaryPanels = (() => {
      if (!hasPanelSplit) {
        const top = getCleanTopSpanVertices(leftEarDepth, safeWidth - rightEarDepth);
        return [[
          ...top,
          [safeWidth - rightEarDepth, bottomBaseY],
          [leftEarDepth, bottomBaseY]
        ]];
      }

      const splitX = safeSplitPosition;
      const rightSplitX = safeRightSplitPosition;
      const leftTop = getCleanTopSpanVertices(leftEarDepth, splitX);
      const rightTop = getCleanTopSpanVertices(rightSplitX, safeWidth - rightEarDepth);

      return [
        [
          ...leftTop,
          [splitX, bottomBaseY],
          [leftEarDepth, bottomBaseY]
        ],
        [
          ...rightTop,
          [safeWidth - rightEarDepth, bottomBaseY],
          [rightSplitX, bottomBaseY]
        ].filter((point, index, arr) => index === 0 || Math.hypot(point[0] - arr[index - 1][0], point[1] - arr[index - 1][1]) > 0.001)
      ].map(panel => panel.filter(Boolean));
    })();

    if (!bottomPanelEnabled) return primaryPanels;

    const yOffset = safeHeight + bottomPanelGap;
    return [
      ...primaryPanels,
      [
        [leftEarDepth, yOffset + topEarDepth],
        [safeWidth - rightEarDepth, yOffset + topEarDepth],
        [safeWidth - rightEarDepth, yOffset + bottomPanelHeight - bottomEarDepth],
        [leftEarDepth, yOffset + bottomPanelHeight - bottomEarDepth]
      ]
    ];
  };

  const polygonArea = (pointsArray) => {
    let area = 0;
    for (let i = 0; i < pointsArray.length; i++) {
      const a = pointsArray[i];
      const b = pointsArray[(i + 1) % pointsArray.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    return area / 2;
  };

  const offsetPolygonInward = (pointsArray, distance) => {
    if (distance <= 0) return [pointsArray];

    const scaleFactor = 1000;
    const source = pointsArray.map(([x, y]) => ({
      X: Math.round(x * scaleFactor),
      Y: Math.round(y * scaleFactor)
    }));
    const sourceArea = Math.abs(polygonArea(pointsArray));

    const solve = (delta) => {
      const offsetter = new ClipperLib.ClipperOffset(2, 0.25 * scaleFactor);
      offsetter.AddPath(source, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
      const solution = new ClipperLib.Paths();
      offsetter.Execute(solution, delta * scaleFactor);
      return solution
        .map(path => path.map(point => [point.X / scaleFactor, point.Y / scaleFactor]))
        .filter(path => path.length >= 3);
    };

    const negative = solve(-distance);
    const negativeArea = negative.reduce((sum, path) => sum + Math.abs(polygonArea(path)), 0);
    if (negative.length && negativeArea < sourceArea) return negative;

    const positive = solve(distance);
    const positiveArea = positive.reduce((sum, path) => sum + Math.abs(polygonArea(path)), 0);
    if (positive.length && positiveArea < sourceArea) return positive;

    return [];
  };

  const interiorMarginBoundarySets = getCleanMainBodyPanelVertexSets()
    .flatMap(panel => offsetPolygonInward(transformPoints(panel), interiorMargin));

  const getActivePatternCleanPanelVertexSets = () => getCleanMainBodyPanelVertexSets();

  const getActivePatternMarginBoundarySets = () => (
    getActivePatternCleanPanelVertexSets()
      .flatMap(panel => offsetPolygonInward(transformPoints(panel), interiorMargin))
  );

  const buildInteriorMarginPath = () => (
    interiorMarginBoundarySets
      .map(panel => panel.map((v, i) => `${i === 0 ? 'M' : 'L'} ${v[0] * scale} ${v[1] * scale}`).join(' ') + ' Z')
      .join(' ')
  );

  const seededRandom = (seed) => {
    let value = Math.max(1, Math.floor(n(seed, 1))) % 2147483647;
    return () => {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  };

  const makeSlotPolygon = (cx, cy, length, thickness, angle) => {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const nx = -uy;
    const ny = ux;
    const halfLength = length / 2;
    const halfThickness = thickness / 2;
    return [
      [cx - ux * halfLength - nx * halfThickness, cy - uy * halfLength - ny * halfThickness],
      [cx + ux * halfLength - nx * halfThickness, cy + uy * halfLength - ny * halfThickness],
      [cx + ux * halfLength + nx * halfThickness, cy + uy * halfLength + ny * halfThickness],
      [cx - ux * halfLength + nx * halfThickness, cy - uy * halfLength + ny * halfThickness]
    ];
  };

  const makeRoundedSlotPolygon = (cx, cy, length, thickness, angle) => {
    const safeLength = Math.max(thickness, length);
    const radius = thickness / 2;
    const straightHalf = Math.max(0, safeLength / 2 - radius);
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const leftCenter = [cx - ux * straightHalf, cy - uy * straightHalf];
    const rightCenter = [cx + ux * straightHalf, cy + uy * straightHalf];
    const points = [];
    const segments = 10;

    for (let i = 0; i <= segments; i++) {
      const theta = angle - Math.PI / 2 + (Math.PI * i) / segments;
      points.push([rightCenter[0] + Math.cos(theta) * radius, rightCenter[1] + Math.sin(theta) * radius]);
    }

    for (let i = 0; i <= segments; i++) {
      const theta = angle + Math.PI / 2 + (Math.PI * i) / segments;
      points.push([leftCenter[0] + Math.cos(theta) * radius, leftCenter[1] + Math.sin(theta) * radius]);
    }

    return points;
  };

  const clipPatternSlotToMargin = (points) => {
    const patternMarginBoundarySets = getActivePatternMarginBoundarySets();
    if (!patternMarginBoundarySets.length) return [];

    const subject = cleanClipperPaths([toClipperPath(points)]);
    const clips = cleanClipperPaths(patternMarginBoundarySets.map(toClipperPath));
    if (!subject.length || !clips.length) return [];

    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(clips, ClipperLib.PolyType.ptClip, true);

    const solution = new ClipperLib.Paths();
    clipper.Execute(
      ClipperLib.ClipType.ctIntersection,
      solution,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero
    );

    return cleanClipperPaths(solution).map(fromClipperPath);
  };

  const getPatternContourProjectedLength = (points, angle) => {
    if (points.length < 2) return 0;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const projections = points.map(point => point[0] * ux + point[1] * uy);
    return Math.max(...projections) - Math.min(...projections);
  };

  const roundClippedPatternContour = (points, thickness, angle) => {
    if (points.length < 3) return points;

    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const nx = -uy;
    const ny = ux;
    const projections = points.map(point => point[0] * ux + point[1] * uy);
    const normals = points.map(point => point[0] * nx + point[1] * ny);
    const minProjection = Math.min(...projections);
    const maxProjection = Math.max(...projections);
    const centerProjection = (minProjection + maxProjection) / 2;
    const centerNormal = normals.reduce((sum, value) => sum + value, 0) / normals.length;
    const center = [
      ux * centerProjection + nx * centerNormal,
      uy * centerProjection + ny * centerNormal
    ];

    return makeRoundedSlotPolygon(
      center[0],
      center[1],
      maxProjection - minProjection,
      thickness,
      angle
    );
  };

  const getCleanPanelProjectionBounds = (panel, angle) => {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const nx = -uy;
    const ny = ux;
    const points = transformPoints(panel);
    const projections = points.map(point => point[0] * ux + point[1] * uy);
    const normals = points.map(point => point[0] * nx + point[1] * ny);

    return {
      minProjection: Math.min(...projections),
      maxProjection: Math.max(...projections),
      minNormal: Math.min(...normals),
      maxNormal: Math.max(...normals)
    };
  };

  const makeAlignedSlotPanelReferences = () => {
    const angle = Math.atan2(shearOffset, Math.max(1, safeWidth));
    return getCleanMainBodyPanelVertexSets().map((panel, index) => ({
      panel,
      index,
      bounds: getCleanPanelProjectionBounds(panel, angle)
    }));
  };

  const getAlignedSlotBreakProjectionsForPanel = (panelIndex, angle, staggered) => {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    let ranges = [];
    const isBottomExtraPanel = bottomPanelEnabled && panelIndex === getCleanMainBodyPanelVertexSets().length - 1;

    if (isBottomExtraPanel) {
      ranges = getHorizontalEarRanges(leftEarDepth, safeWidth - rightEarDepth, bottomEarLength, bottomEarDepth, Math.max(0, margin - bottomEarDepth), manualMode, hEars);
    } else if (hasPanelSplit) {
      ranges = panelIndex === 0
        ? getHorizontalEarRanges(leftEarDepth, safeSplitPosition, bottomEarLengthForLayout, bottomEarDepth, bottomEdgeMarginForLayout, true, splitLeftBottomEars)
        : getHorizontalEarRanges(safeRightSplitPosition, safeWidth - rightEarDepth, bottomEarLengthForLayout, bottomEarDepth, bottomEdgeMarginForLayout, true, splitRightBottomEars);
    } else {
      ranges = [...grouped.bottom]
        .sort((a, b) => a.pos - b.pos)
        .map(ear => ({ start: ear.pos, end: ear.pos + bottomEarLengthForLayout }));
    }

    const breakY = isBottomExtraPanel
      ? safeHeight + bottomPanelGap + bottomPanelHeight - bottomEarDepth
      : safeHeight - bottomEarDepth;
    const earCenterProjections = ranges
      .sort((a, b) => a.start - b.start)
      .map(range => {
      const centerX = (range.start + range.end) / 2;
      const transformed = transformPoint([centerX, breakY]);
      return transformed[0] * ux + transformed[1] * uy;
    });

    if (!staggered) return earCenterProjections.slice(1, -1);

    return earCenterProjections
      .slice(0, -1)
      .map((projection, index) => (projection + earCenterProjections[index + 1]) / 2);
  };

  const buildAlignedSlotSegments = (startProjection, endProjection, breakProjections, breakWidth, minLength) => {
    if (endProjection - startProjection < minLength) return [];

    const halfBreak = breakWidth / 2;
    const safeBreaks = [...new Set(
      breakProjections
        .filter(projection => projection - halfBreak > startProjection && projection + halfBreak < endProjection)
        .map(projection => Math.round(projection * 1000) / 1000)
    )].sort((a, b) => a - b);

    const acceptedBreaks = [];
    let cursor = startProjection;

    safeBreaks.forEach(projection => {
      const segmentEnd = projection - halfBreak;
      const nextStart = projection + halfBreak;
      if (segmentEnd - cursor < minLength) return;
      if (endProjection - nextStart < minLength) return;
      acceptedBreaks.push(projection);
      cursor = nextStart;
    });

    const segments = [];
    cursor = startProjection;
    acceptedBreaks.forEach(projection => {
      const segmentEnd = projection - halfBreak;
      if (segmentEnd - cursor >= minLength) segments.push([cursor, segmentEnd]);
      cursor = projection + halfBreak;
    });

    if (endProjection - cursor >= minLength) segments.push([cursor, endProjection]);
    return segments;
  };

  const pointFromProjectionNormal = (projection, normal, angle) => {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const nx = -uy;
    const ny = ux;
    return [
      ux * projection + nx * normal,
      uy * projection + ny * normal
    ];
  };

  const getAlignedSlotLayoutData = () => {
    const panelRefs = makeAlignedSlotPanelReferences();
    if (!panelRefs.length) return null;

    const thickness = Math.max(1, n(patternThickness, 15));
    const breakWidth = Math.max(0, n(alignedSlotBreakWidth, 30));
    const leftInset = Math.max(0, n(alignedSlotLeftInset, 30));
    const rightInset = Math.max(0, n(alignedSlotRightInset, 30));
    const fixedRowSpacing = Math.max(0, n(alignedSlotRowSpacing, 80));
    const angle = Math.atan2(shearOffset, Math.max(1, safeWidth));
    const bottomPanelIndex = bottomPanelEnabled ? getCleanMainBodyPanelVertexSets().length - 1 : -1;
    const topPanelRefs = panelRefs.filter(ref => ref.index !== bottomPanelIndex);
    const bottomPanelRefs = panelRefs.filter(ref => ref.index === bottomPanelIndex);
    const makeGroup = (refs, rowCountValue) => {
      if (!refs.length) return null;

      const rowCount = Math.max(1, Math.floor(n(rowCountValue, 1)));
      const minNormal = Math.min(...refs.map(ref => ref.bounds.minNormal));
      const maxNormal = Math.max(...refs.map(ref => ref.bounds.maxNormal));
      const usableNormal = maxNormal - minNormal;
      const emptySpace = usableNormal - rowCount * thickness;
      if (emptySpace < 0) return null;

      const rowSpace = alignedSlotUseRowSpacing
        ? fixedRowSpacing
        : emptySpace / (rowCount + 1);
      const rowNormals = [];
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
        rowNormals.push(alignedSlotUseRowSpacing
          ? minNormal + rowSpace + thickness / 2 + rowIndex * (thickness + fixedRowSpacing)
          : minNormal + rowSpace * (rowIndex + 1) + thickness * (rowIndex + 0.5));
      }

      return {
        panelRefs: refs,
        rowCount,
        minNormal,
        maxNormal,
        rowSpace,
        firstRowTop: minNormal + rowSpace,
        lastRowBottom: alignedSlotUseRowSpacing
          ? minNormal + fixedRowSpacing + rowCount * thickness + Math.max(0, rowCount - 1) * fixedRowSpacing
          : maxNormal - rowSpace,
        rowNormals
      };
    };

    const groups = [
      makeGroup(topPanelRefs, alignedSlotRows),
      makeGroup(bottomPanelRefs, alignedSlotBottomRows)
    ].filter(Boolean);

    if (!groups.length) return null;

    return {
      panelRefs,
      thickness,
      breakWidth,
      leftInset,
      rightInset,
      fixedRowSpacing,
      angle,
      groups
    };
  };

  const clipPolygonToPanel = (points, panel) => {
    const subject = cleanClipperPaths([toClipperPath(points)]);
    const clips = cleanClipperPaths([toClipperPath(transformPoints(panel))]);
    if (!subject.length || !clips.length) return [];

    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(clips, ClipperLib.PolyType.ptClip, true);

    const solution = new ClipperLib.Paths();
    clipper.Execute(
      ClipperLib.ClipType.ctIntersection,
      solution,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero
    );

    return cleanClipperPaths(solution).map(fromClipperPath);
  };

  const getAlignedSlotClearanceContours = () => {
    if (!patternEnabled || patternMode !== 'alignedSlots') return [];

    const layout = getAlignedSlotLayoutData();
    if (!layout || layout.breakWidth <= 0) return [];

    const contours = [];
    layout.groups.forEach(group => {
      group.panelRefs.forEach(ref => {
        const startProjection = ref.bounds.minProjection + layout.leftInset;
        const endProjection = ref.bounds.maxProjection - layout.rightInset;
        const stripRanges = [
          [startProjection - layout.breakWidth, startProjection],
          [endProjection, endProjection + layout.breakWidth]
        ];

        stripRanges.forEach(([a, b], stripIndex) => {
          const rawStrip = [
            pointFromProjectionNormal(a, group.minNormal, layout.angle),
            pointFromProjectionNormal(b, group.minNormal, layout.angle),
            pointFromProjectionNormal(b, group.maxNormal, layout.angle),
            pointFromProjectionNormal(a, group.maxNormal, layout.angle)
          ];

          clipPolygonToPanel(rawStrip, ref.panel).forEach(points => {
            if (points.length < 3) return;
            contours.push({
              points,
              closed: true,
              source: 'knockout',
              fillRule: 'nonzero',
              layer: 'PATTERN_CLEARANCE',
              designId: `aligned-clearance-${ref.index}-${stripIndex}`,
              designName: 'Aligned slot clearance',
              materialColor: 'black',
              role: 'outer',
              area: Math.abs(signedPolygonArea(points)),
              depth: 0
            });
          });
        });
      });
    });

    return contours;
  };

  const getAlignedSlotPatternContours = () => {
    if (!patternEnabled) return [];

    const layout = getAlignedSlotLayoutData();
    if (!layout) return [];

    const { thickness, breakWidth, leftInset, rightInset, angle } = layout;
    const minLength = Math.max(1, n(alignedSlotMinLength, 150));
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const nx = -uy;
    const ny = ux;
    const contours = [];

    layout.groups.forEach(group => {
      group.rowNormals.forEach((centerNormal, rowIndex) => {
        const shiftedRow = alignedSlotStaggerBreaks && rowIndex % 2 === 0;

        group.panelRefs.forEach(ref => {
          const startProjection = ref.bounds.minProjection + leftInset;
          const endProjection = ref.bounds.maxProjection - rightInset;
          const breaks = getAlignedSlotBreakProjectionsForPanel(ref.index, angle, shiftedRow);
          const segments = buildAlignedSlotSegments(startProjection, endProjection, breaks, breakWidth, minLength);

          segments.forEach(([segmentStart, segmentEnd]) => {
            const length = segmentEnd - segmentStart;
            const centerProjection = (segmentStart + segmentEnd) / 2;
            const cx = ux * centerProjection + nx * centerNormal;
            const cy = uy * centerProjection + ny * centerNormal;
            const rawSlot = patternRoundedEnds
              ? makeRoundedSlotPolygon(cx, cy, length, thickness, angle)
              : makeSlotPolygon(cx, cy, length, thickness, angle);

            clipPolygonToPanel(rawSlot, ref.panel).forEach(points => {
              const projectedLength = getPatternContourProjectedLength(points, angle);
              const finalPoints = patternRoundedEnds
                ? roundClippedPatternContour(points, thickness, angle)
                : points;

              if (finalPoints.length >= 3 && projectedLength >= minLength / 2) {
                contours.push({
                  points: finalPoints,
                  closed: true,
                  source: 'pattern',
                  fillRule: 'nonzero',
                  layer: 'PATTERN',
                  designId: `aligned-pattern-${ref.index}-${rowIndex}-${contours.length}`,
                  designName: 'Aligned slots',
                  role: 'outer',
                  area: Math.abs(signedPolygonArea(points)),
                  depth: 0
                });
              }
            });
          });
        });
      });
    });

    return contours;
  };

  const getAlignedSlotEqualRowSpacing = () => {
    const layout = getAlignedSlotLayoutData();
    if (!layout?.groups?.length) return 0;

    return Math.max(0, layout.groups[0].rowSpace);
  };

  const getRandomSlotPatternContours = () => {
    const patternMarginBoundarySets = getActivePatternMarginBoundarySets();
    if (!patternEnabled || patternMarginBoundarySets.length === 0) return [];

    const thickness = Math.max(1, n(patternThickness, 15));
    const minLength = Math.max(1, n(patternMinLength, 80));
    const maxLength = Math.max(minLength, n(patternMaxLength, 260));
    const rowSpacing = Math.max(thickness + 1, n(patternRowSpacing, 90));
    const gap = Math.max(0, n(patternGap, 90));
    const random = seededRandom(patternSeed);
    const angle = Math.atan2(shearOffset, Math.max(1, safeWidth));
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const nx = -uy;
    const ny = ux;
    const allPoints = patternMarginBoundarySets.flat();
    const projections = allPoints.map(point => point[0] * ux + point[1] * uy);
    const normals = allPoints.map(point => point[0] * nx + point[1] * ny);
    const minProjection = Math.min(...projections) - maxLength;
    const maxProjection = Math.max(...projections) + maxLength;
    const minNormal = Math.min(...normals) + thickness / 2;
    const maxNormal = Math.max(...normals) - thickness / 2;
    const contours = [];

    if (maxNormal < minNormal) return [];

    const getNextGap = () => (
      patternRandomGap ? gap * (0.55 + random() * 0.9) : gap
    );

    const minRandomRowSpacing = Math.max(thickness + 1, rowSpacing - 40);
    const maxRandomRowSpacing = Math.max(minRandomRowSpacing, rowSpacing + 40);
    const rowJitter = 20;
    const rows = [];
    let normalCursor = minNormal;
    while (normalCursor <= maxNormal) {
      rows.push(normalCursor);
      normalCursor += rowSpacing;
    }
    if (rows.length === 0 || maxNormal - rows[rows.length - 1] >= minRandomRowSpacing) rows.push(maxNormal);

    const placedSlots = [];
    let rowIndex = 0;
    rows.forEach(normal => {
      let projection = minProjection + (patternRandomGap ? random() * Math.max(1, gap) : 0);
      while (projection <= maxProjection) {
        const length = minLength + random() * (maxLength - minLength);
        const centerProjection = projection + length / 2;
        let lineNormal = normal;

        if (patternRandomRowSpacing) {
          const slotStart = projection;
          const slotEnd = projection + length;
          const overlapsTooClose = (candidate) => placedSlots.some(slot => (
            Math.max(slotStart, slot.startProjection) <= Math.min(slotEnd, slot.endProjection)
            && Math.abs(candidate - slot.normal) < minRandomRowSpacing
          ));

          for (let attempt = 0; attempt < 12; attempt++) {
            const candidate = clamp(normal + (random() - 0.5) * rowJitter * 2, minNormal, maxNormal);
            if (!overlapsTooClose(candidate)) {
              lineNormal = candidate;
              break;
            }
          }
        }

        const cx = ux * centerProjection + nx * lineNormal;
        const cy = uy * centerProjection + ny * lineNormal;
        const rawSlot = patternRoundedEnds
          ? makeRoundedSlotPolygon(cx, cy, length, thickness, angle)
          : makeSlotPolygon(cx, cy, length, thickness, angle);

        clipPatternSlotToMargin(rawSlot).forEach(points => {
          const projectedLength = getPatternContourProjectedLength(points, angle);
          const finalPoints = patternRoundedEnds
            ? roundClippedPatternContour(points, thickness, angle)
            : points;

          if (finalPoints.length >= 3 && projectedLength >= minLength / 2) {
            contours.push({
              points: finalPoints,
              closed: true,
              source: 'pattern',
              fillRule: 'nonzero',
              layer: 'PATTERN',
              designId: `pattern-${rowIndex}-${contours.length}`,
              designName: 'Horizontal line pattern',
              role: 'outer',
              area: Math.abs(signedPolygonArea(points)),
              depth: 0
            });
          }
        });

        placedSlots.push({
          startProjection: projection,
          endProjection: projection + length,
          normal: lineNormal
        });

        projection += length + getNextGap();
      }
      rowIndex++;
    });

    return contours;
  };

  const getPatternContours = () => {
    if (patternMode === 'alignedSlots') return getAlignedSlotPatternContours();
    return getRandomSlotPatternContours();
  };

  const buildOutlinePath = () => {
    return getPanelVertexSets()
      .map(vertexSet => {
        const verts = transformPoints(vertexSet);
        return verts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${v[0] * scale} ${v[1] * scale}`).join(' ') + ' Z';
      })
      .join(' ');
  };

  const getBaseViewBox = () => ({
    x: -viewportPadding,
    y: drawingMinY * scale - viewportPadding,
    width: safeWidth * scale + viewportPadding * 2,
    height: (drawingMaxY - drawingMinY) * scale + viewportPadding * 2
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
      if (!isTextEditingTarget(e.target) && (e.key === 'Delete' || e.key === 'Backspace') && selectedInteriorDesignId) {
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

  const getInteriorMeasureSnapPoints = () => {
    const points = [];
    const addPoint = (point) => {
      if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return;
      points.push(point);
    };

    getCleanMainBodyPanelVertexSets().forEach(panel => {
      transformPoints(panel).forEach(addPoint);
    });

    interiorDesigns.forEach(design => {
      const bounds = getInteriorObjectBounds(design);
      [
        [bounds.x, bounds.y],
        [bounds.x + bounds.width, bounds.y],
        [bounds.x + bounds.width, bounds.y + bounds.height],
        [bounds.x, bounds.y + bounds.height],
        [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2]
      ].forEach(addPoint);

      getInteriorPointHandles(design).forEach(handle => addPoint([handle.x, handle.y]));
    });

    return points;
  };

  const findNearestInteriorSnapPoint = (x, y) => {
    let best = null;
    let bestDist = Infinity;

    getInteriorMeasureSnapPoints().forEach(([px, py]) => {
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

    const addHorizontalRangeGap = (id, ranges, y, outsideY) => {
      if (ranges.length < 2) return;
      const sorted = [...ranges].sort((a, b) => a.start - b.start);
      const p1 = [sorted[0].end, y];
      const p2 = [sorted[1].start, y];
      addMeasurement(createAutomaticGapMeasurement(id, p1, p2, [(p1[0] + p2[0]) / 2, outsideY]));
    };

    const addArcRangeGap = (id, arc, ranges) => {
      if (!arc || ranges.length < 2) return;
      const sorted = [...ranges].sort((a, b) => a.start - b.start);
      const p1 = arc.pointAt(sorted[0].end, 0);
      const p2 = arc.pointAt(sorted[1].start, 0);
      const outsideY = Math.min(p1[1], p2[1]) - 120;
      addMeasurement(createAutomaticGapMeasurement(id, p1, p2, [(p1[0] + p2[0]) / 2, outsideY]));
    };

    const getVerticalEarRangesForSpan = (startY, endY, length, depth, useManual, countValue) => {
      if (depth <= 0 || length <= 0) return [];

      const minY = Math.min(startY, endY);
      const maxY = Math.max(startY, endY);
      const sideLength = maxY - minY;
      const visibleMargin = Math.max(0, margin - depth);
      const usable = sideLength - 2 * visibleMargin - length;
      if (usable < 0) return [];

      const ranges = [];
      if (useManual) {
        const count = Math.max(1, n(countValue, 1));
        if (count === 1) {
          const start = minY + sideLength / 2 - length / 2;
          ranges.push({ start, end: start + length });
          return ranges;
        }

        const spacing = usable / (count - 1);
        for (let i = 0; i < count; i++) {
          const start = minY + visibleMargin + i * spacing;
          ranges.push({ start, end: start + length });
        }
        return ranges;
      }

      let gaps = 1;
      while (usable / gaps > MAX_SPACING) gaps++;
      while (gaps > 1 && usable / gaps < MIN_SPACING) gaps--;

      const spacing = usable / gaps;
      for (let i = 0; i <= gaps; i++) {
        const start = minY + visibleMargin + i * spacing;
        ranges.push({ start, end: start + length });
      }
      return ranges;
    };

    const addVerticalRangeGap = (id, ranges, x, outsideX) => {
      if (ranges.length < 2) return;
      const sorted = [...ranges].sort((a, b) => a.start - b.start);
      const p1 = [x, sorted[0].end];
      const p2 = [x, sorted[1].start];
      addMeasurement(createAutomaticGapMeasurement(id, p1, p2, [outsideX, (p1[1] + p2[1]) / 2]));
    };

    if (hasPanelSplit) {
      const splitX = safeSplitPosition;
      const rightSplitX = safeRightSplitPosition;
      const arc = getActiveTopArcData();

      if (arc) {
        const splitS = getArcSAtX(arc, splitX);
        const rightSplitS = getArcSAtX(arc, rightSplitX);
        addArcRangeGap('auto-gap-left-panel-top', arc, getArcEarRangesForSpan(0, splitS, true, splitLeftTopEars));
        addArcRangeGap('auto-gap-right-panel-top', arc, getArcEarRangesForSpan(rightSplitS, arc.arcLength, true, splitRightTopEars));
      } else {
        addHorizontalRangeGap(
          'auto-gap-left-panel-top',
          getHorizontalEarRanges(leftEarDepth, splitX, topEarLengthForLayout, topEarDepth, topEdgeMarginForLayout, true, splitLeftTopEars),
          topEarDepth,
          -120
        );
        addHorizontalRangeGap(
          'auto-gap-right-panel-top',
          getHorizontalEarRanges(rightSplitX, safeWidth - rightEarDepth, topEarLengthForLayout, topEarDepth, topEdgeMarginForLayout, true, splitRightTopEars),
          topEarDepth,
          -120
        );
      }

      addHorizontalRangeGap(
        'auto-gap-left-panel-bottom',
        getHorizontalEarRanges(leftEarDepth, splitX, bottomEarLengthForLayout, bottomEarDepth, bottomEdgeMarginForLayout, true, splitLeftBottomEars),
        safeHeight - bottomEarDepth,
        safeHeight + 120
      );
      addHorizontalRangeGap(
        'auto-gap-right-panel-bottom',
        getHorizontalEarRanges(rightSplitX, safeWidth - rightEarDepth, bottomEarLengthForLayout, bottomEarDepth, bottomEdgeMarginForLayout, true, splitRightBottomEars),
        safeHeight - bottomEarDepth,
        safeHeight + 120
      );

      const splitTop = arc ? arc.pointAt(getArcSAtX(arc, splitX), 0) : [splitX, topEarDepth];
      const rightSplitTop = arc ? arc.pointAt(getArcSAtX(arc, rightSplitX), 0) : [rightSplitX, topEarDepth];
      const leftSplitRanges = getVerticalEarRangesForSpan(splitTop[1], bottomBaseY, splitEarLength, splitEarDepth, splitManualMode, splitLeftCutEars);
      const rightSplitRanges = syncSplitEars
        ? leftSplitRanges
        : getVerticalEarRangesForSpan(rightSplitTop[1], bottomBaseY, splitEarLength, splitEarDepth, splitManualMode, splitRightCutEars);
      addVerticalRangeGap('auto-gap-left-panel-split', leftSplitRanges, splitX, splitX + 120);
      addVerticalRangeGap('auto-gap-right-panel-split', rightSplitRanges, rightSplitX, rightSplitX - 120);

      addVerticalGap('auto-gap-left-panel-left', grouped.left, leftEarDepth, -120, leftEarLength, leftEarDepth);
      addVerticalGap('auto-gap-right-panel-right', grouped.right, safeWidth - rightEarDepth, safeWidth + 120, rightEarLength, rightEarDepth);

      return result;
    }

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

  const updateInteriorDesign = (id, changes, options = {}) => {
    applyInteriorDesigns(prev => prev.map(item => (
      item.id === id ? { ...item, ...changes } : item
    )), options);
  };

  const isImportedInteriorSvg = (design) => !design?.kind || design.kind === 'svg';
  const isPointEditedInteriorShape = (design) => design?.kind === 'line' || design?.kind === 'arc';
  const isInteriorGroup = (design) => design?.kind === 'group';
  const flattenInteriorDesigns = (designs) => (
    designs.flatMap(design => isInteriorGroup(design) ? flattenInteriorDesigns(design.children || []) : [design])
  );

  const getInteriorObjectBounds = (design) => {
    if (!design) return { x: 0, y: 0, width: 10, height: 10 };

    if (isInteriorGroup(design)) return getInteriorSelectionBounds(design.children || []);

    if (design.kind === 'line') {
      const x1 = n(design.x1, n(design.x, 0));
      const y1 = n(design.y1, n(design.y, 0));
      const x2 = n(design.x2, x1 + n(design.width, 10));
      const y2 = n(design.y2, y1);
      return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.max(10, Math.abs(x2 - x1)),
        height: Math.max(10, Math.abs(y2 - y1))
      };
    }

    if (design.kind === 'arc') {
      const points = [
        [n(design.x1, n(design.x, 0)), n(design.y1, n(design.y, 0))],
        [n(design.x2, n(design.x, 0) + n(design.width, 10) / 2), n(design.y2, n(design.y, 0) - 60)],
        [n(design.x3, n(design.x, 0) + n(design.width, 10)), n(design.y3, n(design.y, 0))]
      ];
      const xs = points.map(point => point[0]);
      const ys = points.map(point => point[1]);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(10, Math.max(...xs) - Math.min(...xs)),
        height: Math.max(10, Math.max(...ys) - Math.min(...ys))
      };
    }

    if (design.kind === 'eraser') {
      const points = (design.points || []).filter(point => Array.isArray(point) && point.length >= 2);
      if (!points.length) return { x: 0, y: 0, width: 10, height: 10 };

      const half = Math.max(0.5, n(design.thickness, eraserSize)) / 2;
      const xs = points.map(point => point[0]);
      const ys = points.map(point => point[1]);
      const minX = Math.min(...xs) - half;
      const minY = Math.min(...ys) - half;
      const maxX = Math.max(...xs) + half;
      const maxY = Math.max(...ys) + half;

      return {
        x: minX,
        y: minY,
        width: Math.max(10, maxX - minX),
        height: Math.max(10, maxY - minY)
      };
    }

    return {
      x: n(design.x, 0),
      y: n(design.y, 0),
      width: Math.max(10, n(design.width, 10)),
      height: Math.max(10, n(design.height, 10))
    };
  };

  const getInteriorSelectionBounds = (designs) => {
    const bounds = designs.map(getInteriorObjectBounds).filter(Boolean);
    if (!bounds.length) return { x: 0, y: 0, width: 10, height: 10 };
    const minX = Math.min(...bounds.map(item => item.x));
    const minY = Math.min(...bounds.map(item => item.y));
    const maxX = Math.max(...bounds.map(item => item.x + item.width));
    const maxY = Math.max(...bounds.map(item => item.y + item.height));
    return { x: minX, y: minY, width: Math.max(10, maxX - minX), height: Math.max(10, maxY - minY) };
  };

  const applyInteriorObjectBounds = (design, nextBounds) => {
    const current = getInteriorObjectBounds(design);
    const next = {
      x: n(nextBounds.x, current.x),
      y: n(nextBounds.y, current.y),
      width: Math.max(10, n(nextBounds.width, current.width)),
      height: Math.max(10, n(nextBounds.height, current.height))
    };

    const scaleX = next.width / Math.max(0.0001, current.width);
    const scaleY = next.height / Math.max(0.0001, current.height);
    const transformPoint = (px, py) => [
      next.x + (px - current.x) * scaleX,
      next.y + (py - current.y) * scaleY
    ];

    if (isInteriorGroup(design)) {
      return {
        ...design,
        ...next,
        children: (design.children || []).map(child => {
          const childBounds = getInteriorObjectBounds(child);
          return {
            ...child,
            ...applyInteriorObjectBounds(child, {
              x: next.x + (childBounds.x - current.x) * scaleX,
              y: next.y + (childBounds.y - current.y) * scaleY,
              width: childBounds.width * scaleX,
              height: childBounds.height * scaleY
            })
          };
        })
      };
    }

    if (design.kind === 'eraser') {
      return {
        ...next,
        points: (design.points || []).map(point => transformPoint(point[0], point[1]))
      };
    }

    if (!isPointEditedInteriorShape(design)) return next;

    if (design.kind === 'line') {
      const p1 = transformPoint(n(design.x1, current.x), n(design.y1, current.y));
      const p2 = transformPoint(n(design.x2, current.x + current.width), n(design.y2, current.y));
      return { ...next, x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] };
    }

    const p1 = transformPoint(n(design.x1, current.x), n(design.y1, current.y + current.height));
    const p2 = transformPoint(n(design.x2, current.x + current.width / 2), n(design.y2, current.y));
    const p3 = transformPoint(n(design.x3, current.x + current.width), n(design.y3, current.y + current.height));
    return { ...next, x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], x3: p3[0], y3: p3[1] };
  };

  const getInteriorAspectRatio = (design) => (
    getInteriorObjectBounds(design).width / getInteriorObjectBounds(design).height
  );

  const toggleInteriorAspectLock = (design) => {
    const nextLocked = !design.aspectLocked;
    updateInteriorDesign(design.id, {
      aspectLocked: nextLocked,
      aspectRatio: nextLocked ? getInteriorAspectRatio(design) : design.aspectRatio
    });
  };

  const getSelectedInteriorDesign = () => (
    interiorDesigns.find(item => item.id === selectedInteriorDesignId) || null
  );

  const getInteriorDesignHandles = (design) => {
    if (!design) return [];
    if (isPointEditedInteriorShape(design)) return [];
    const { x, y, width: itemWidth, height: itemHeight } = getInteriorObjectBounds(design);
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

  const getInteriorPointHandles = (design) => {
    if (design?.kind === 'line') {
      return [
        { id: 'p1', x: n(design.x1, 0), y: n(design.y1, 0), cursor: 'move' },
        { id: 'p2', x: n(design.x2, 0), y: n(design.y2, 0), cursor: 'move' }
      ];
    }

    if (design?.kind === 'arc') {
      return [
        { id: 'p1', x: n(design.x1, 0), y: n(design.y1, 0), cursor: 'move' },
        { id: 'p2', x: n(design.x2, 0), y: n(design.y2, 0), cursor: 'move' },
        { id: 'p3', x: n(design.x3, 0), y: n(design.y3, 0), cursor: 'move' }
      ];
    }

    return [];
  };

  const getInteriorShapeName = (kind) => ({
    rect: 'Rectangle',
    ellipse: 'Ellipse',
    line: 'Line',
    arc: '3-point arc',
    text: 'Text',
    eraser: 'Eraser'
  }[kind] || 'Shape');

  const createInteriorShapeFromDraft = (draft) => {
    if (!draft) return null;
    const base = {
      id: crypto.randomUUID(),
      kind: draft.kind,
      name: getInteriorShapeName(draft.kind),
      color: 'white',
      exportable: true,
      warnings: [],
      aspectLocked: draft.kind === 'rect' || draft.kind === 'ellipse' || draft.kind === 'text',
      aspectRatio: draft.kind === 'rect' || draft.kind === 'ellipse' || draft.kind === 'text'
        ? Math.max(10, Math.abs(draft.x2 - draft.x1)) / Math.max(10, Math.abs(draft.y2 - draft.y1))
        : 1
    };

    if (draft.kind === 'text') {
      const x = Math.min(draft.x1, draft.x2);
      const y = Math.min(draft.y1, draft.y2);
      const itemWidth = Math.max(10, Math.abs(draft.x2 - draft.x1));
      const itemHeight = Math.max(10, Math.abs(draft.y2 - draft.y1));
      return {
        ...base,
        x,
        y,
        width: itemWidth,
        height: itemHeight,
        text: 'Text',
        fontSize: itemHeight,
        fontFamily: 'Arial, sans-serif',
        letterSpacing: 0,
        exportable: false,
        warnings: ['Text is visual only for now. Convert text to paths before DXF export.'],
        aspectRatio: itemWidth / itemHeight
      };
    }

    if (draft.kind === 'rect' || draft.kind === 'ellipse') {
      const x = Math.min(draft.x1, draft.x2);
      const y = Math.min(draft.y1, draft.y2);
      const itemWidth = Math.max(10, Math.abs(draft.x2 - draft.x1));
      const itemHeight = Math.max(10, Math.abs(draft.y2 - draft.y1));
      return { ...base, x, y, width: itemWidth, height: itemHeight };
    }

    if (draft.kind === 'line') {
      const shape = {
        ...base,
        x1: draft.x1,
        y1: draft.y1,
        x2: draft.x2,
        y2: draft.y2,
        thickness: 8,
        aspectLocked: false
      };
      return { ...shape, ...getInteriorObjectBounds(shape) };
    }

    if (draft.kind === 'arc') {
      const shape = {
        ...base,
        x1: draft.points[0][0],
        y1: draft.points[0][1],
        x2: draft.points[2][0],
        y2: draft.points[2][1],
        x3: draft.points[1][0],
        y3: draft.points[1][1],
        thickness: 8,
        aspectLocked: false
      };
      return { ...shape, ...getInteriorObjectBounds(shape) };
    }

    if (draft.kind === 'eraser') {
      const points = (draft.points || []).filter(point => Array.isArray(point) && point.length >= 2);
      if (points.length < 2) return null;

      const shape = {
        ...base,
        name: 'Eraser stroke',
        color: 'black',
        points,
        thickness: eraserSize,
        aspectLocked: false
      };
      return { ...shape, ...getInteriorObjectBounds(shape) };
    }

    return null;
  };

  const addInteriorShape = (shape) => {
    if (!shape) return;
    applyInteriorDesigns(prev => [...prev, shape], { selectedId: shape.id });
  };

  const setInteriorSelection = (ids) => {
    const cleanIds = Array.from(new Set(ids.filter(Boolean)));
    setSelectedInteriorDesignIds(cleanIds);
    setSelectedInteriorDesignId(cleanIds[cleanIds.length - 1] || null);
  };

  const toggleInteriorSelection = (id) => {
    const current = selectedInteriorDesignIdsRef.current;
    setInteriorSelection(current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const getSvgChildBBox = (svg, child) => {
    const serializer = new XMLSerializer();
    const testSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Array.from(svg.attributes).forEach(attr => testSvg.setAttribute(attr.name, attr.value));
    testSvg.style.position = 'fixed';
    testSvg.style.left = '-10000px';
    testSvg.style.top = '-10000px';
    testSvg.style.width = '1px';
    testSvg.style.height = '1px';
    testSvg.style.opacity = '0';
    testSvg.style.pointerEvents = 'none';
    testSvg.setAttribute('aria-hidden', 'true');

    Array.from(svg.children)
      .filter(node => ['defs', 'style'].includes(node.tagName?.toLowerCase()))
      .forEach(node => testSvg.appendChild(node.cloneNode(true)));
    testSvg.appendChild(child.cloneNode(true));
    document.body.appendChild(testSvg);

    try {
      const box = testSvg.getBBox();
      if (box.width > 0.0001 && box.height > 0.0001) {
        const pad = 0.001;
        return {
          x: box.x - pad,
          y: box.y - pad,
          width: box.width + pad * 2,
          height: box.height + pad * 2
        };
      }
    } catch {
      // Some SVG nodes cannot be measured by the browser; fall back to the root box.
    } finally {
      document.body.removeChild(testSvg);
    }

    return null;
  };

  const createSvgChildObject = (design, child, childIndex, svg) => {
    const serializer = new XMLSerializer();
    const defs = Array.from(svg.children)
      .filter(node => ['defs', 'style'].includes(node.tagName?.toLowerCase()))
      .map(node => serializer.serializeToString(node))
      .join('');
    const rootBox = getSvgRootBox(svg);
    const childBox = getSvgChildBBox(svg, child) || rootBox;
    const designWidth = Math.max(10, n(design.width, 10));
    const designHeight = Math.max(10, n(design.height, 10));
    const scaleX = designWidth / (rootBox.width || 1);
    const scaleY = designHeight / (rootBox.height || 1);
    const attrs = Array.from(svg.attributes)
      .filter(attr => !['viewBox', 'width', 'height'].includes(attr.name))
      .map(attr => `${attr.name}="${attr.value.replace(/"/g, '&quot;')}"`)
      .join(' ');
    const fittedAttrs = [
      attrs,
      `viewBox="${childBox.x} ${childBox.y} ${childBox.width} ${childBox.height}"`,
      `width="${childBox.width}"`,
      `height="${childBox.height}"`
    ].filter(Boolean).join(' ');
    const svgText = `<svg ${fittedAttrs}>${defs}${serializer.serializeToString(child)}</svg>`;
    const validation = validateInteriorSvg(svgText);
    return {
      ...design,
      id: crypto.randomUUID(),
      name: `${design.name || 'SVG'} part ${childIndex + 1}`,
      x: n(design.x, 0) + (childBox.x - rootBox.x) * scaleX,
      y: n(design.y, 0) + (childBox.y - rootBox.y) * scaleY,
      width: Math.max(1, childBox.width * scaleX),
      height: Math.max(1, childBox.height * scaleY),
      svgText,
      href: svgTextToDataUrl(svgText),
      exportable: validation.exportable,
      warnings: validation.warnings,
      fittedUngroupPart: true
    };
  };

  const ignoredSvgUngroupTags = new Set(['defs', 'style', 'title', 'desc', 'metadata', 'namedview', 'sodipodi:namedview']);
  const drawableSvgUngroupTags = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'image', 'use']);

  const splitUngroupPathElement = (pathElement) => {
    const d = pathElement.getAttribute('d');
    if (!d) return [pathElement];

    try {
      const subpaths = splitSvgPathSubpaths(d);
      if (subpaths.length <= 1) return [pathElement];

      return subpaths
        .map(subpath => {
          const clone = pathElement.cloneNode(false);
          clone.setAttribute('d', encodeSVGPath(subpath.commands));
          return clone;
        })
        .filter(clone => (clone.getAttribute('d') || '').trim());
    } catch {
      return [pathElement];
    }
  };

  const collectDrawableSvgUngroupParts = (node) => {
    const parts = [];
    const walk = (current, inheritedTransform = '') => {
      const tag = current.tagName?.toLowerCase();
      if (!tag || ignoredSvgUngroupTags.has(tag)) return;
      const ownTransform = current.getAttribute('transform') || '';
      const combinedTransform = [inheritedTransform, ownTransform].filter(Boolean).join(' ');

      if (drawableSvgUngroupTags.has(tag)) {
        const clone = current.cloneNode(true);
        if (combinedTransform) clone.setAttribute('transform', combinedTransform);
        splitUngroupPathElement(clone).forEach(part => parts.push(part));
        return;
      }

      Array.from(current.children || []).forEach(child => walk(child, combinedTransform));
    };

    walk(node);
    return parts;
  };

  const getUngroupedSvgParts = (svg) => {
    const topLevelChildren = Array.from(svg.children)
      .filter(child => !ignoredSvgUngroupTags.has(child.tagName.toLowerCase()));
    const onlyChild = topLevelChildren.length === 1 ? topLevelChildren[0] : null;
    const onlyChildTag = onlyChild?.tagName?.toLowerCase();

    if (onlyChild && ['g', 'svg', 'symbol'].includes(onlyChildTag)) {
      const wrappedDrawableParts = collectDrawableSvgUngroupParts(onlyChild);
      if (wrappedDrawableParts.length > 1) return wrappedDrawableParts;
    }

    const hasTopLevelGroup = topLevelChildren.some(child => child.tagName.toLowerCase() === 'g');

    if (hasTopLevelGroup) return topLevelChildren;

    const topLevelParts = topLevelChildren.flatMap(child => (
      child.tagName.toLowerCase() === 'path' ? splitUngroupPathElement(child) : [child]
    ));

    if (topLevelParts.length > 1) return topLevelParts;

    const leafParts = topLevelChildren.flatMap(collectDrawableSvgUngroupParts);
    return leafParts.length > 1 ? leafParts : topLevelParts;
  };

  const ungroupSelectedInteriorDesign = () => {
    const selected = getSelectedInteriorDesign();
    if (!selected) return;

    if (isInteriorGroup(selected)) {
      const children = (selected.children || []).map(child => ({ ...child, id: crypto.randomUUID() }));
      applyInteriorDesigns(prev => {
        const index = prev.findIndex(item => item.id === selected.id);
        if (index < 0) return prev;
        const next = [...prev];
        next.splice(index, 1, ...children);
        return next;
      }, { selectedId: children[children.length - 1]?.id || null });
      setSelectedInteriorDesignIds(children.map(child => child.id));
      return;
    }

    if (isImportedInteriorSvg(selected) && selected.svgText) {
      if (selected.fittedUngroupPart) return;

      const parser = new DOMParser();
      const doc = parser.parseFromString(selected.svgText, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg || doc.querySelector('parsererror')) return;

      const parts = getUngroupedSvgParts(svg);
      if (parts.length <= 1) return;

      const children = parts.map((child, index) => createSvgChildObject(selected, child, index, svg));
      if (children.length <= 1) return;

      applyInteriorDesigns(prev => {
        const index = prev.findIndex(item => item.id === selected.id);
        if (index < 0) return prev;
        const next = [...prev];
        next.splice(index, 1, ...children);
        return next;
      }, { selectedId: children[children.length - 1].id });
      setSelectedInteriorDesignIds(children.map(child => child.id));
    }
  };

  const groupSelectedInteriorDesigns = () => {
    const ids = selectedInteriorDesignIdsRef.current;
    if (ids.length < 2) return;
    const selected = interiorDesignsRef.current.filter(design => ids.includes(design.id));
    if (selected.length < 2) return;
    const group = {
      id: crypto.randomUUID(),
      kind: 'group',
      name: 'Group',
      color: 'white',
      exportable: selected.every(design => design.exportable !== false),
      warnings: selected.flatMap(design => design.warnings || []),
      aspectLocked: false,
      children: selected.map(design => ({ ...design }))
    };

    applyInteriorDesigns(prev => {
      const firstIndex = prev.findIndex(design => ids.includes(design.id));
      const next = prev.filter(design => !ids.includes(design.id));
      next.splice(Math.max(0, firstIndex), 0, group);
      return next;
    }, { selectedId: group.id });
  };

  const applyInteriorColor = (design, color) => (
    isInteriorGroup(design)
      ? { ...design, color, children: (design.children || []).map(child => applyInteriorColor(child, color)) }
      : { ...design, color }
  );

  const selectInteriorShapeTool = (kind) => {
    clearMeasureTool();
    setActiveInteriorShapeTool(prev => prev === kind ? null : kind);
    setInteriorShapeDraft(null);
    setInteriorSelection([]);
    setInteriorDrag(null);
  };

  const getInteriorDraftBounds = (draft) => {
    if (!draft) return null;

    if (draft.kind === 'eraser') {
      const points = draft.points || [];
      if (!points.length) return null;
      const half = eraserSize / 2;
      const xs = points.map(point => point[0]);
      const ys = points.map(point => point[1]);
      const minX = Math.min(...xs) - half;
      const minY = Math.min(...ys) - half;
      const maxX = Math.max(...xs) + half;
      const maxY = Math.max(...ys) + half;
      return {
        x: minX,
        y: minY,
        width: Math.max(10, maxX - minX),
        height: Math.max(10, maxY - minY)
      };
    }

    if (draft.kind === 'arc') {
      const xs = draft.points.map(point => point[0]);
      const ys = draft.points.map(point => point[1]);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(10, Math.max(...xs) - Math.min(...xs)),
        height: Math.max(10, Math.max(...ys) - Math.min(...ys))
      };
    }

    return {
      x: Math.min(draft.x1, draft.x2),
      y: Math.min(draft.y1, draft.y2),
      width: Math.max(0, Math.abs(draft.x2 - draft.x1)),
      height: Math.max(0, Math.abs(draft.y2 - draft.y1))
    };
  };

  const isInteriorPointOnBody = (point) => (
    getCleanMainBodyPanelVertexSets()
      .map(panel => transformPoints(panel))
      .some(panel => pointInPolygon([point.x, point.y], panel))
  );

  const isInteriorPointOnWhiteDesignSurface = (point) => {
    const px = point.x;
    const py = point.y;

    return flattenInteriorDesigns(interiorDesignsRef.current).some(design => {
      if ((design.color || 'white') !== 'white') return false;

      const bounds = getInteriorObjectBounds(design);
      const inBounds = px >= bounds.x
        && px <= bounds.x + bounds.width
        && py >= bounds.y
        && py <= bounds.y + bounds.height;
      if (!inBounds) return false;

      if (design.kind === 'rect' || design.kind === 'text' || isImportedInteriorSvg(design)) return true;

      if (design.kind === 'ellipse') {
        const rx = bounds.width / 2;
        const ry = bounds.height / 2;
        const cx = bounds.x + rx;
        const cy = bounds.y + ry;
        return (((px - cx) ** 2) / ((rx || 1) ** 2)) + (((py - cy) ** 2) / ((ry || 1) ** 2)) <= 1;
      }

      if (design.kind === 'line' || design.kind === 'arc') {
        return getInteriorShapeContours(design).some(contour => pointInPolygon([px, py], contour));
      }

      return false;
    });
  };

  const getInteriorPanelReferences = () => (
    getCleanMainBodyPanelVertexSets().map((panel, index) => {
      const points = transformPoints(panel);
      const xs = points.map(point => point[0]);
      const ys = points.map(point => point[1]);
      const isBottomPanel = bottomPanelEnabled && index === getCleanMainBodyPanelVertexSets().length - 1;
      return {
        id: `panel-${index}`,
        name: isBottomPanel ? 'Bottom panel' : hasPanelSplit ? `${index === 0 ? 'Left' : 'Right'} panel` : 'Main panel',
        points,
        bounds: {
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(0, Math.max(...xs) - Math.min(...xs)),
          height: Math.max(0, Math.max(...ys) - Math.min(...ys))
        }
      };
    })
  );

  const getInteriorPanelSelectionBounds = () => {
    const panels = getInteriorPanelReferences();
    if (!panels.length) return null;

    const minX = Math.min(...panels.map(panel => panel.bounds.x));
    const minY = Math.min(...panels.map(panel => panel.bounds.y));
    const maxX = Math.max(...panels.map(panel => panel.bounds.x + panel.bounds.width));
    const maxY = Math.max(...panels.map(panel => panel.bounds.y + panel.bounds.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  const getSelectedInteriorMovableDesigns = () => (
    interiorDesignsRef.current.filter(design => selectedInteriorDesignIdsRef.current.includes(design.id))
  );

  const moveSelectedInteriorDesignsBy = (dx, dy) => {
    const selected = getSelectedInteriorMovableDesigns();
    if (!selected.length) {
      showInteriorPositionMessage('Select a design first.');
      return false;
    }

    applyInteriorDesigns(prev => prev.map(item => {
      if (!selectedInteriorDesignIdsRef.current.includes(item.id)) return item;
      const bounds = getInteriorObjectBounds(item);
      return {
        ...item,
        ...applyInteriorObjectBounds(item, {
          x: bounds.x + dx,
          y: bounds.y + dy,
          width: bounds.width,
          height: bounds.height
        })
      };
    }), { history: true });
    return true;
  };

  const getInteriorPositionReferenceBounds = () => {
    const referenceBounds = getInteriorPanelSelectionBounds();
    if (referenceBounds) return referenceBounds;
    showInteriorPositionMessage('Select a design first.');
    return null;
  };

  const formatPositionDistance = (value) => {
    const rounded = Math.round(value * 1000) / 1000;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
  };

  useEffect(() => {
    const selected = interiorDesigns.filter(design => selectedInteriorDesignIds.includes(design.id));
    const reference = getInteriorPanelSelectionBounds();

    if (!selected.length || !reference) {
      setPositionDistanceInputs(prev => (
        prev.left === '' && prev.right === '' && prev.top === '' && prev.bottom === ''
          ? prev
          : { left: '', right: '', top: '', bottom: '' }
      ));
      return;
    }

    const bounds = getInteriorSelectionBounds(selected);
    const next = {
      left: formatPositionDistance(bounds.x - reference.x),
      right: formatPositionDistance(reference.x + reference.width - (bounds.x + bounds.width)),
      top: formatPositionDistance(bounds.y - reference.y),
      bottom: formatPositionDistance(reference.y + reference.height - (bounds.y + bounds.height))
    };

    setPositionDistanceInputs(prev => (
      prev.left === next.left && prev.right === next.right && prev.top === next.top && prev.bottom === next.bottom
        ? prev
        : next
    ));
  }, [
    interiorDesigns,
    selectedInteriorDesignIds,
    width,
    height,
    leftHeight,
    middlePosition,
    middleHeight,
    topShape,
    arcRise,
    transitionHeight,
    crownWidth,
    removeSideHorizontalConstraint,
    cornerAngle,
    splitPanelEnabled,
    splitPositionInput,
    splitGapInput,
    topEarDepthInput,
    rightEarDepthInput,
    bottomEarDepthInput,
    leftEarDepthInput
  ]);

  const alignInteriorSelectionToPanel = (mode) => {
    const selected = getSelectedInteriorMovableDesigns();
    if (!selected.length) {
      showInteriorPositionMessage('Select a design first.');
      return;
    }

    const reference = getInteriorPositionReferenceBounds();
    if (!reference) return;

    const selectedBounds = getInteriorSelectionBounds(selected);
    let dx = 0;
    let dy = 0;

    if (mode === 'center-x') dx = reference.x + reference.width / 2 - (selectedBounds.x + selectedBounds.width / 2);
    if (mode === 'center-y') dy = reference.y + reference.height / 2 - (selectedBounds.y + selectedBounds.height / 2);
    if (mode === 'left') dx = reference.x - selectedBounds.x;
    if (mode === 'right') dx = reference.x + reference.width - (selectedBounds.x + selectedBounds.width);
    if (mode === 'top') dy = reference.y - selectedBounds.y;
    if (mode === 'bottom') dy = reference.y + reference.height - (selectedBounds.y + selectedBounds.height);

    moveSelectedInteriorDesignsBy(dx, dy);
  };

  const applyInteriorDistanceToPanel = (side, rawValue) => {
    const value = n(rawValue, NaN);
    if (!Number.isFinite(value)) return;

    const selected = getSelectedInteriorMovableDesigns();
    if (!selected.length) {
      showInteriorPositionMessage('Select a design first.');
      return;
    }

    const reference = getInteriorPositionReferenceBounds();
    if (!reference) return;

    const selectedBounds = getInteriorSelectionBounds(selected);
    let dx = 0;
    let dy = 0;

    if (side === 'left') dx = reference.x + value - selectedBounds.x;
    if (side === 'right') dx = reference.x + reference.width - value - (selectedBounds.x + selectedBounds.width);
    if (side === 'top') dy = reference.y + value - selectedBounds.y;
    if (side === 'bottom') dy = reference.y + reference.height - value - (selectedBounds.y + selectedBounds.height);

    moveSelectedInteriorDesignsBy(dx, dy);
  };

  const handleInteriorCanvasMouseDown = (e) => {
    handleViewportMouseDown(e);
    if (e.button !== 0 || panState) return;

    if (activeTool === 'measure') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const point = getSvgPoint(e);
    const onBody = isInteriorPointOnBody(point);
    const onWhiteSurface = isInteriorPointOnWhiteDesignSurface(point);
    interiorMousePointRef.current = point;
    setIsInteriorPointerOnBody(onBody);
    setIsInteriorPointerOnWhiteSurface(onWhiteSurface);

    if (activeInteriorShapeTool && !onBody) {
      return;
    }

    if (!activeInteriorShapeTool) {
      setInteriorSelection([]);
      setInteriorSelectionBox({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      return;
    }

    if (activeInteriorShapeTool === 'arc') return;

    e.preventDefault();
    e.stopPropagation();
    setInteriorSelection([]);
    if (activeInteriorShapeTool === 'eraser') {
      setInteriorShapeDraft({
        kind: 'eraser',
        points: [[point.x, point.y]],
        drawing: true
      });
      return;
    }

    setInteriorShapeDraft({
      kind: activeInteriorShapeTool,
      x1: point.x,
      y1: point.y,
      x2: point.x,
      y2: point.y,
      drawing: true
    });
  };

  const finishInteriorSelectionBox = () => {
    if (!interiorSelectionBox) return;
    const box = {
      x: Math.min(interiorSelectionBox.x1, interiorSelectionBox.x2),
      y: Math.min(interiorSelectionBox.y1, interiorSelectionBox.y2),
      width: Math.abs(interiorSelectionBox.x2 - interiorSelectionBox.x1),
      height: Math.abs(interiorSelectionBox.y2 - interiorSelectionBox.y1)
    };
    const leftToRight = interiorSelectionBox.x2 >= interiorSelectionBox.x1;
    const selectedIds = interiorDesignsRef.current.filter(design => {
      const bounds = getInteriorObjectBounds(design);
      const touches = bounds.x <= box.x + box.width
        && bounds.x + bounds.width >= box.x
        && bounds.y <= box.y + box.height
        && bounds.y + bounds.height >= box.y;
      const inside = bounds.x >= box.x
        && bounds.y >= box.y
        && bounds.x + bounds.width <= box.x + box.width
        && bounds.y + bounds.height <= box.y + box.height;
      return leftToRight ? inside : touches;
    }).map(design => design.id);

    setInteriorSelection(selectedIds);
    interiorSelectionJustFinishedRef.current = true;
    setInteriorSelectionBox(null);
  };

  const handleInteriorCanvasClick = (e) => {
    if (activeTool === 'measure') {
      handleInteriorMeasureClick(e);
      return;
    }

    if (interiorSelectionJustFinishedRef.current) {
      interiorSelectionJustFinishedRef.current = false;
      return;
    }

    if (!activeInteriorShapeTool) {
      if (!interiorSelectionBox) setInteriorSelection([]);
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (activeInteriorShapeTool !== 'arc') return;

    const point = getSvgPoint(e);
    interiorMousePointRef.current = point;
    const onBody = isInteriorPointOnBody(point);
    const onWhiteSurface = isInteriorPointOnWhiteDesignSurface(point);
    setIsInteriorPointerOnBody(onBody);
    setIsInteriorPointerOnWhiteSurface(onWhiteSurface);
    if (!onBody) return;

    const points = [...(interiorShapeDraft?.points || []), [point.x, point.y]];

    if (points.length === 3) {
      const shape = createInteriorShapeFromDraft({ kind: 'arc', points });
      addInteriorShape(shape);
      setInteriorShapeDraft(null);
      return;
    }

    setInteriorSelection([]);
    setInteriorShapeDraft({ kind: 'arc', points, preview: [point.x, point.y] });
  };

  const finishInteriorShapeDraft = () => {
    if (!interiorShapeDraft || interiorShapeDraft.kind === 'arc') return;

    if (interiorShapeDraft.kind === 'eraser') {
      const points = interiorShapeDraft.points || [];
      if (points.length >= 2) addInteriorShape(createInteriorShapeFromDraft(interiorShapeDraft));
      setInteriorShapeDraft(null);
      return;
    }

    const bounds = getInteriorDraftBounds(interiorShapeDraft);
    const isLine = interiorShapeDraft.kind === 'line';
    const length = isLine
      ? Math.hypot(interiorShapeDraft.x2 - interiorShapeDraft.x1, interiorShapeDraft.y2 - interiorShapeDraft.y1)
      : Math.min(bounds.width, bounds.height);

    if (length >= 2) addInteriorShape(createInteriorShapeFromDraft(interiorShapeDraft));
    setInteriorShapeDraft(null);
  };

  const svgTextToDataUrl = (text) => {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return `data:image/svg+xml;base64,${btoa(binary)}`;
  };

  const validateInteriorSvg = (svgText) => {
    const warnings = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');

    if (!svg || doc.querySelector('parsererror')) {
      return {
        exportable: false,
        warnings: ['This file is not a valid SVG.']
      };
    }

    const supportedTags = new Set([
      'svg',
      'g',
      'path',
      'rect',
      'circle',
      'ellipse',
      'line',
      'polyline',
      'polygon',
      'title',
      'desc',
      'defs',
      'symbol',
      'style',
      'use',
      'metadata',
      'namedview',
      'sodipodi:namedview',
      'rdf:rdf',
      'rdf:RDF',
      'cc:work',
      'dc:format',
      'dc:type',
      'dc:title',
      'dc:creator',
      'dc:description'
    ]);
    const unsupportedTags = new Set();
    const riskyAttributes = new Set();

    Array.from(svg.querySelectorAll('*')).forEach(node => {
      const tag = node.tagName.toLowerCase();
      if (!supportedTags.has(tag)) unsupportedTags.add(tag);

      ['clip-path', 'mask', 'filter'].forEach(attr => {
        if (node.hasAttribute(attr)) riskyAttributes.add(attr);
      });

      const style = (node.getAttribute('style') || '').toLowerCase();
      if (style.includes('clip-path')) riskyAttributes.add('clip-path');
      if (style.includes('mask')) riskyAttributes.add('mask');
      if (style.includes('filter')) riskyAttributes.add('filter');
    });

    // Inkscape and CAD-exported SVGs often include metadata, markers, symbols, and
    // helper definitions that do not participate in the visible cutting geometry.
    // Those are ignored during DXF conversion instead of blocking a valid import.

    if (riskyAttributes.size) {
      warnings.push(`Unsupported SVG effects: ${Array.from(riskyAttributes).join(', ')}.`);
    }

    if (svg.querySelector('text')) {
      warnings.push('Text must be converted to paths before import.');
    }

    if (svg.querySelector('image')) {
      warnings.push('Embedded images/photos cannot be exported as DXF geometry yet.');
    }

    if (svg.querySelector('linearGradient, radialGradient, pattern')) {
      warnings.push('Gradient/pattern paint will export as plain vector outlines.');
    }

    return {
      exportable: !svg.querySelector('text, image') && !doc.querySelector('parsererror'),
      warnings
    };
  };

  const handleInteriorDesignFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const svgText = String(reader.result || '');
      const validation = validateInteriorSvg(svgText);
      const defaultSize = Math.max(80, Math.min(safeWidth, safeHeight) * 0.25);
      const nextDesign = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.svg$/i, '') || 'SVG design',
        href: svgTextToDataUrl(svgText),
        svgText,
        exportable: validation.exportable,
        warnings: validation.warnings,
        color: 'white',
        x: safeWidth / 2 - defaultSize / 2,
        y: safeHeight / 2 - defaultSize / 2,
        width: defaultSize,
        height: defaultSize,
        aspectLocked: true,
        aspectRatio: 1
      };

      applyInteriorDesigns(prev => [...prev, nextDesign], { selectedId: nextDesign.id });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const startInteriorDesignDrag = (e, design, mode, handle = null) => {
    if (activeInteriorShapeTool) return;
    if (e.button !== 0) return;
    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const point = getSvgPoint(e);
    if (mode === 'move' && (design.color || 'white') === 'white' && !isInteriorPointOnWhiteDesignSurface(point)) {
      return;
    }

    const bounds = getInteriorObjectBounds(design);
    const selectedIds = selectedInteriorDesignIdsRef.current;
    if (!(selectedIds.includes(design.id) && selectedIds.length > 1)) setInteriorSelection([design.id]);
    interiorDragStartSnapshotRef.current = cloneInteriorDesigns(interiorDesignsRef.current);
    if (mode === 'move' && selectedIds.includes(design.id) && selectedIds.length > 1) {
      setInteriorDrag({
        id: design.id,
        ids: selectedIds,
        mode: 'multi-move',
        startMouse: [point.x, point.y],
        startDesigns: interiorDesignsRef.current.filter(item => selectedIds.includes(item.id)).map(item => ({ ...item, ...getInteriorObjectBounds(item) }))
      });
      return;
    }

    setInteriorDrag({
      id: design.id,
      mode,
      handle,
      startMouse: [point.x, point.y],
      startDesign: {
        ...design,
        ...bounds,
        aspectLocked: design.aspectLocked,
        aspectRatio: design.aspectRatio || (bounds.width / bounds.height)
      }
    });
  };

  const handleInteriorPreviewMouseMove = (e) => {
    const point = getSvgPoint(e);
    interiorMousePointRef.current = point;
    const onBody = isInteriorPointOnBody(point);
    const onWhiteSurface = isInteriorPointOnWhiteDesignSurface(point);
    setIsInteriorPointerOnBody(prev => prev === onBody ? prev : onBody);
    setIsInteriorPointerOnWhiteSurface(prev => prev === onWhiteSurface ? prev : onWhiteSurface);

    if (panState) {
      handlePreviewMouseMove(e);
      return;
    }

    if (activeTool === 'measure') {
      if (draggingMeasurement) {
        const measurement = measurements.find(m => m.id === draggingMeasurement.id);
        if (!measurement) return;

        const { nx, ny } = getMeasurementBaseData(measurement);
        const dx = point.x - draggingMeasurement.startMouse[0];
        const dy = point.y - draggingMeasurement.startMouse[1];
        const projectedOffsetChange = dx * nx + dy * ny;
        const newOffset = draggingMeasurement.startOffset + projectedOffsetChange;

        setMeasurements(prev => prev.map(m => m.id === draggingMeasurement.id ? { ...m, offset: newOffset, selected: true } : m));
        return;
      }

      setHoverSnap(findNearestInteriorSnapPoint(point.x, point.y));
      return;
    }

    if (interiorSelectionBox) {
      setInteriorSelectionBox(prev => prev ? { ...prev, x2: point.x, y2: point.y } : prev);
      return;
    }

    if (interiorShapeDraft) {
      if (interiorShapeDraft.kind === 'arc') {
        setInteriorShapeDraft(prev => prev ? { ...prev, preview: [point.x, point.y] } : prev);
        return;
      }

      if (interiorShapeDraft.kind === 'eraser') {
        setInteriorShapeDraft(prev => {
          if (!prev) return prev;
          const points = prev.points || [];
          const last = points[points.length - 1];
          if (last && Math.hypot(point.x - last[0], point.y - last[1]) < 2) return prev;
          return { ...prev, points: [...points, [point.x, point.y]] };
        });
        return;
      }

      if (interiorShapeDraft.drawing) {
        setInteriorShapeDraft(prev => prev ? { ...prev, x2: point.x, y2: point.y } : prev);
        return;
      }
    }

    if (!interiorDrag) return;

    const dx = point.x - interiorDrag.startMouse[0];
    const dy = point.y - interiorDrag.startMouse[1];
    const start = interiorDrag.startDesign;
    const minSize = 10;

    if (interiorDrag.mode === 'multi-move') {
      applyInteriorDesigns(prev => prev.map(item => {
        const startItem = interiorDrag.startDesigns.find(design => design.id === item.id);
        if (!startItem) return item;
        return {
          ...item,
          ...applyInteriorObjectBounds(startItem, {
            x: startItem.x + dx,
            y: startItem.y + dy,
            width: startItem.width,
            height: startItem.height
          })
        };
      }), { history: false });
      return;
    }

    if (interiorDrag.mode === 'multi-resize') {
      const group = interiorDrag.startGroup;
      const nextGroup = { ...group };
      const handle = interiorDrag.handle;

      if (handle.includes('e')) nextGroup.width = Math.max(minSize, group.width + dx);
      if (handle.includes('s')) nextGroup.height = Math.max(minSize, group.height + dy);
      if (handle.includes('w')) {
        const proposedWidth = Math.max(minSize, group.width - dx);
        nextGroup.x = group.x + group.width - proposedWidth;
        nextGroup.width = proposedWidth;
      }
      if (handle.includes('n')) {
        const proposedHeight = Math.max(minSize, group.height - dy);
        nextGroup.y = group.y + group.height - proposedHeight;
        nextGroup.height = proposedHeight;
      }

      const scaleX = nextGroup.width / Math.max(0.0001, group.width);
      const scaleY = nextGroup.height / Math.max(0.0001, group.height);
      applyInteriorDesigns(prev => prev.map(item => {
        const startItem = interiorDrag.startDesigns.find(design => design.id === item.id);
        if (!startItem) return item;
        return {
          ...item,
          ...applyInteriorObjectBounds(startItem, {
            x: nextGroup.x + (startItem.x - group.x) * scaleX,
            y: nextGroup.y + (startItem.y - group.y) * scaleY,
            width: startItem.width * scaleX,
            height: startItem.height * scaleY
          })
        };
      }), { history: false });
      return;
    }

    if (interiorDrag.mode === 'move') {
      updateInteriorDesign(interiorDrag.id, applyInteriorObjectBounds(start, {
        x: start.x + dx,
        y: start.y + dy,
        width: start.width,
        height: start.height
      }), { history: false });
      return;
    }

    if (interiorDrag.mode === 'point') {
      const next = { ...start };
      if (interiorDrag.handle === 'p1') {
        next.x1 = n(start.x1, 0) + dx;
        next.y1 = n(start.y1, 0) + dy;
      } else if (interiorDrag.handle === 'p2') {
        next.x2 = n(start.x2, 0) + dx;
        next.y2 = n(start.y2, 0) + dy;
      } else if (interiorDrag.handle === 'p3') {
        next.x3 = n(start.x3, 0) + dx;
        next.y3 = n(start.y3, 0) + dy;
      }

      updateInteriorDesign(interiorDrag.id, { ...next, ...getInteriorObjectBounds(next) }, { history: false });
      return;
    }

    const next = { ...start };
    const handle = interiorDrag.handle;
    const ratio = Math.max(0.0001, n(start.aspectRatio, start.width / start.height || 1));

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

    if (start.aspectLocked) {
      const widthDriven = handle.includes('e') || handle.includes('w');
      const heightDriven = handle.includes('n') || handle.includes('s');

      if (widthDriven && (!heightDriven || Math.abs(dx) >= Math.abs(dy))) {
        next.height = Math.max(minSize, next.width / ratio);
        if (handle.includes('n')) next.y = start.y + start.height - next.height;
      } else {
        next.width = Math.max(minSize, next.height * ratio);
        if (handle.includes('w')) next.x = start.x + start.width - next.width;
      }
    }

    updateInteriorDesign(interiorDrag.id, applyInteriorObjectBounds(start, next), { history: false });
  };

  const handleInteriorNumberChange = (field, value) => {
    if (selectedInteriorDesignIds.length > 1 && ['x', 'y', 'width', 'height'].includes(field)) {
      if (value === '') return;
      const bounds = getInteriorSelectionBounds(interiorDesigns.filter(item => selectedInteriorDesignIds.includes(item.id)));
      const nextBounds = { ...bounds, [field]: field === 'width' || field === 'height' ? Math.max(10, Number(value)) : Number(value) };
      const scaleX = nextBounds.width / Math.max(0.0001, bounds.width);
      const scaleY = nextBounds.height / Math.max(0.0001, bounds.height);
      applyInteriorDesigns(prev => prev.map(item => {
        if (!selectedInteriorDesignIds.includes(item.id)) return item;
        const itemBounds = getInteriorObjectBounds(item);
        return {
          ...item,
          ...applyInteriorObjectBounds(item, {
            x: nextBounds.x + (itemBounds.x - bounds.x) * scaleX,
            y: nextBounds.y + (itemBounds.y - bounds.y) * scaleY,
            width: itemBounds.width * scaleX,
            height: itemBounds.height * scaleY
          })
        };
      }));
      return;
    }

    const design = getSelectedInteriorDesign();
    if (!design) return;
    if (value === '') {
      updateInteriorDesign(design.id, { [field]: '' });
      return;
    }

    const min = field === 'width' || field === 'height' ? 10 : -Infinity;
    const numericValue = Math.max(min, Number(value));
    const ratio = Math.max(0.0001, n(design.aspectRatio, getInteriorAspectRatio(design)));
    const bounds = getInteriorObjectBounds(design);
    const isBoundsField = ['x', 'y', 'width', 'height'].includes(field);

    if (design.aspectLocked && field === 'width') {
      updateInteriorDesign(design.id, applyInteriorObjectBounds(design, { ...bounds, width: numericValue, height: Math.max(10, numericValue / ratio) }));
      return;
    }

    if (design.aspectLocked && field === 'height') {
      updateInteriorDesign(design.id, applyInteriorObjectBounds(design, { ...bounds, height: numericValue, width: Math.max(10, numericValue * ratio) }));
      return;
    }

    if (isBoundsField) {
      updateInteriorDesign(design.id, applyInteriorObjectBounds(design, { ...bounds, [field]: numericValue }));
      return;
    }

    updateInteriorDesign(design.id, { [field]: numericValue });
  };

  const handleInteriorNumberBlur = (field, fallback) => {
    const design = getSelectedInteriorDesign();
    if (!design) return;

    const min = field === 'width' || field === 'height' ? 10 : -Infinity;
    const numericValue = Math.max(min, n(design[field], fallback));
    const ratio = Math.max(0.0001, n(design.aspectRatio, getInteriorAspectRatio(design)));
    const bounds = getInteriorObjectBounds(design);
    const isBoundsField = ['x', 'y', 'width', 'height'].includes(field);

    if (design.aspectLocked && field === 'width') {
      updateInteriorDesign(design.id, applyInteriorObjectBounds(design, { ...bounds, width: numericValue, height: Math.max(10, numericValue / ratio) }));
      return;
    }

    if (design.aspectLocked && field === 'height') {
      updateInteriorDesign(design.id, applyInteriorObjectBounds(design, { ...bounds, height: numericValue, width: Math.max(10, numericValue * ratio) }));
      return;
    }

    if (isBoundsField) {
      updateInteriorDesign(design.id, applyInteriorObjectBounds(design, { ...bounds, [field]: numericValue }));
      return;
    }

    updateInteriorDesign(design.id, { [field]: numericValue });
  };

  const handleInteriorMarginBlur = () => {
    const panelBounds = getCleanMainBodyPanelVertexSets().map(panel => {
      const transformed = transformPoints(panel);
      const xs = transformed.map(point => point[0]);
      const ys = transformed.map(point => point[1]);
      return {
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
      };
    });
    const maxMargin = Math.max(0, Math.min(...panelBounds.map(bounds => Math.min(bounds.width, bounds.height) / 2 - 1)));
    setInteriorMarginInput(clamp(n(interiorMarginInput, 30), 0, maxMargin));
    setShowInteriorMarginGuide(false);
  };

  const deleteSelectedInteriorDesign = () => {
    const ids = selectedInteriorDesignIds.length ? selectedInteriorDesignIds : [selectedInteriorDesignId].filter(Boolean);
    if (!ids.length) return;
    applyInteriorDesigns(prev => prev.filter(item => !ids.includes(item.id)), { selectedId: null });
    setInteriorDrag(null);
  };

  const startInteriorSelectionTransform = (e, mode, handle = null) => {
    if (e.button !== 0 || selectedInteriorDesignIdsRef.current.length < 2) return;
    e.preventDefault();
    e.stopPropagation();
    const point = getSvgPoint(e);
    const selected = interiorDesignsRef.current.filter(item => selectedInteriorDesignIdsRef.current.includes(item.id));
    const bounds = getInteriorSelectionBounds(selected);
    interiorDragStartSnapshotRef.current = cloneInteriorDesigns(interiorDesignsRef.current);
    setInteriorDrag({
      mode,
      handle,
      ids: selectedInteriorDesignIdsRef.current,
      startMouse: [point.x, point.y],
      startGroup: bounds,
      startDesigns: selected.map(item => ({ ...item, ...getInteriorObjectBounds(item) }))
    });
  };

  const moveSelectedInteriorDesignLayer = (mode) => {
    if (!selectedInteriorDesignId) return;

    applyInteriorDesigns(prev => {
      const index = prev.findIndex(item => item.id === selectedInteriorDesignId);
      if (index < 0) return prev;

      const next = [...prev];
      const [item] = next.splice(index, 1);

      if (mode === 'front') {
        next.push(item);
      } else if (mode === 'back') {
        next.unshift(item);
      } else if (mode === 'up') {
        next.splice(Math.min(next.length, index + 1), 0, item);
      } else if (mode === 'down') {
        next.splice(Math.max(0, index - 1), 0, item);
      }

      return next;
    }, { selectedId: selectedInteriorDesignId });
  };

  const selectInteriorDesignFromCanvas = (e, designId) => {
    e.stopPropagation();
    if (interiorSuppressNextObjectClickRef.current) {
      interiorSuppressNextObjectClickRef.current = false;
      return;
    }
    if (activeInteriorShapeTool) return;
    if (e.shiftKey) {
      toggleInteriorSelection(designId);
    } else {
      setInteriorSelection([designId]);
    }
  };

  const cancelInteriorShapeTool = () => {
    setActiveInteriorShapeTool(null);
    setInteriorShapeDraft(null);
  };

  const finishInteriorInteraction = () => {
    if (interiorDrag?.mode === 'multi-move' || interiorDrag?.mode === 'multi-resize') {
      interiorSuppressNextObjectClickRef.current = true;
    }

    if (interiorDragStartSnapshotRef.current && !sameInteriorDesigns(interiorDragStartSnapshotRef.current, interiorDesignsRef.current)) {
      recordInteriorHistory(interiorDragStartSnapshotRef.current);
    }
    interiorDragStartSnapshotRef.current = null;
    setDraggingMeasurement(null);
    setPanState(null);
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

  const handleInteriorMeasureClick = (e) => {
    if (activeTool !== 'measure') return;
    e.preventDefault();
    e.stopPropagation();
    if (draggingMeasurement) return;

    const { x, y } = getSvgPoint(e);
    const snapped = findNearestInteriorSnapPoint(x, y);
    const point = snapped || [x, y];
    const nextPoints = [...measurePoints, point];

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
  let dxfHandleCounter = 0x100;
  const nextDxfHandle = () => (dxfHandleCounter++).toString(16).toUpperCase();
  const resetDxfHandles = () => {
    dxfHandleCounter = 0x100;
  };
  const dxfLine = (...items) => {
    let line = '';
    for (let i = 0; i < items.length; i += 2) {
      const group = String(items[i]).padStart(3, ' ');
      line += `${group}\n${items[i + 1]}\n`;
    }
    return line;
  };
  const dxfLwPolylineHeader = (layer, vertexCount, closed = true) => (
    dxfLine(
      '0', 'LWPOLYLINE',
      '5', nextDxfHandle(),
      '100', 'AcDbEntity',
      '8', layer,
      '62', '7',
      '100', 'AcDbPolyline',
      '90', vertexCount,
      '70', closed ? '1' : '0'
    )
  );

  const buildDxfTablesSection = (layers) => {
    const uniqueLayers = Array.from(new Set(['0', ...layers])).filter(Boolean);
    let section = dxfLine('0', 'SECTION', '2', 'TABLES');

    section += dxfLine('0', 'TABLE', '2', 'LTYPE', '5', nextDxfHandle(), '100', 'AcDbSymbolTable', '70', '3');
    [
      ['BYBLOCK', ''],
      ['BYLAYER', ''],
      ['CONTINUOUS', 'Solid line']
    ].forEach(([name, description]) => {
      section += dxfLine(
        '0', 'LTYPE',
        '5', nextDxfHandle(),
        '100', 'AcDbSymbolTableRecord',
        '100', 'AcDbLinetypeTableRecord',
        '2', name,
        '70', '0',
        '3', description,
        '72', '65',
        '73', '0',
        '40', '0.0'
      );
    });
    section += dxfLine('0', 'ENDTAB');

    section += dxfLine('0', 'TABLE', '2', 'LAYER', '5', nextDxfHandle(), '100', 'AcDbSymbolTable', '70', uniqueLayers.length);
    uniqueLayers.forEach(layer => {
      section += dxfLine(
        '0', 'LAYER',
        '5', nextDxfHandle(),
        '100', 'AcDbSymbolTableRecord',
        '100', 'AcDbLayerTableRecord',
        '2', layer,
        '70', '0',
        '62', '7',
        '6', 'CONTINUOUS'
      );
    });
    section += dxfLine('0', 'ENDTAB');

    section += dxfLine('0', 'TABLE', '2', 'STYLE', '5', nextDxfHandle(), '100', 'AcDbSymbolTable', '70', '1');
    section += dxfLine(
      '0', 'STYLE',
      '5', nextDxfHandle(),
      '100', 'AcDbSymbolTableRecord',
      '100', 'AcDbTextStyleTableRecord',
      '2', 'STANDARD',
      '70', '0',
      '40', '0.0',
      '41', '1.0',
      '50', '0.0',
      '71', '0',
      '42', '1.0',
      '3', 'txt',
      '4', ''
    );
    section += dxfLine('0', 'ENDTAB');

    section += dxfLine('0', 'TABLE', '2', 'APPID', '5', nextDxfHandle(), '100', 'AcDbSymbolTable', '70', '1');
    section += dxfLine(
      '0', 'APPID',
      '5', nextDxfHandle(),
      '100', 'AcDbSymbolTableRecord',
      '100', 'AcDbRegAppTableRecord',
      '2', 'ACAD',
      '70', '0'
    );
    section += dxfLine('0', 'ENDTAB');

    section += dxfLine('0', 'TABLE', '2', 'BLOCK_RECORD', '5', nextDxfHandle(), '100', 'AcDbSymbolTable', '70', '2');
    ['*MODEL_SPACE', '*PAPER_SPACE'].forEach(name => {
      section += dxfLine(
        '0', 'BLOCK_RECORD',
        '5', nextDxfHandle(),
        '100', 'AcDbSymbolTableRecord',
        '100', 'AcDbBlockTableRecord',
        '2', name
      );
    });
    section += dxfLine('0', 'ENDTAB');

    section += dxfLine('0', 'ENDSEC');
    return section;
  };

  const buildDxfBlocksSection = () => (
    dxfLine('0', 'SECTION', '2', 'BLOCKS') +
    dxfLine('0', 'BLOCK', '5', nextDxfHandle(), '100', 'AcDbEntity', '8', '0', '100', 'AcDbBlockBegin', '2', '*MODEL_SPACE', '70', '0', '10', '0.0', '20', '0.0', '30', '0.0', '3', '*MODEL_SPACE', '1', '') +
    dxfLine('0', 'ENDBLK', '5', nextDxfHandle(), '100', 'AcDbEntity', '8', '0', '100', 'AcDbBlockEnd') +
    dxfLine('0', 'BLOCK', '5', nextDxfHandle(), '100', 'AcDbEntity', '8', '0', '100', 'AcDbBlockBegin', '2', '*PAPER_SPACE', '70', '0', '10', '0.0', '20', '0.0', '30', '0.0', '3', '*PAPER_SPACE', '1', '') +
    dxfLine('0', 'ENDBLK', '5', nextDxfHandle(), '100', 'AcDbEntity', '8', '0', '100', 'AcDbBlockEnd') +
    dxfLine('0', 'ENDSEC')
  );

  const buildDxfObjectsSection = () => (
    dxfLine('0', 'SECTION', '2', 'OBJECTS') +
    dxfLine('0', 'DICTIONARY', '5', nextDxfHandle(), '100', 'AcDbDictionary', '281', '1') +
    dxfLine('0', 'ENDSEC')
  );

  const toDXFPoint = (point) => {
    const [x, y] = transformPoint(point);
    return [roundDXF(x), roundDXF(drawingMaxY - y)];
  };

  const toRawDXFPoint = ([x, y]) => [roundDXF(x), roundDXF(drawingMaxY - y)];

  const cleanDxfPoints = (points, closed) => {
    const cleaned = [];

    points.forEach(point => {
      const last = cleaned[cleaned.length - 1];
      if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > 0.01) {
        cleaned.push(point);
      }
    });

    if (closed && cleaned.length > 2) {
      const first = cleaned[0];
      const last = cleaned[cleaned.length - 1];
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= 0.01) {
        cleaned.pop();
      }
    }

    let changed = true;
    while (changed && cleaned.length > (closed ? 3 : 2)) {
      changed = false;
      for (let i = 0; i < cleaned.length; i++) {
        if (!closed && (i === 0 || i === cleaned.length - 1)) continue;

        const prev = cleaned[(i - 1 + cleaned.length) % cleaned.length];
        const current = cleaned[i];
        const next = cleaned[(i + 1) % cleaned.length];
        const ax = current[0] - prev[0];
        const ay = current[1] - prev[1];
        const bx = next[0] - current[0];
        const by = next[1] - current[1];
        const cross = Math.abs(ax * by - ay * bx);
        const base = Math.hypot(next[0] - prev[0], next[1] - prev[1]) || 1;

        if (cross / base < 0.005) {
          cleaned.splice(i, 1);
          changed = true;
          break;
        }
      }
    }

    return cleaned;
  };

  const dxfPolylineEntity = (points, closed = true, layer = '0') => {
    const cleaned = cleanDxfPoints(points.map(point => toRawDXFPoint(point)), closed);

    if (cleaned.length < 2) return '';

    let entity = dxfLwPolylineHeader(layer, cleaned.length, closed);
    cleaned.forEach(([x, y]) => {
      entity += dxfLine('10', x, '20', y, '30', '0.0');
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
      } else if (type === 'skewX') {
        next = [1, 0, Math.tan((nums[0] || 0) * Math.PI / 180), 1, 0, 0];
      } else if (type === 'skewY') {
        next = [1, Math.tan((nums[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
      }

      matrix = multiplyMatrix(matrix, next);
    }

    return matrix;
  };

  const parseStyleDeclaration = (value = '') => (
    value
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .reduce((styles, part) => {
        const separator = part.indexOf(':');
        if (separator === -1) return styles;
        const property = part.slice(0, separator).trim().toLowerCase();
        const propertyValue = part.slice(separator + 1).trim();
        if (property) styles[property] = propertyValue;
        return styles;
      }, {})
  );

  const parseSvgCssRules = (svg) => {
    const rules = [];
    Array.from(svg.querySelectorAll('style')).forEach(styleNode => {
      const css = (styleNode.textContent || '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/@[^{}]+{[^{}]*}/g, '');

      const pattern = /([^{}]+)\{([^{}]+)\}/g;
      let match;
      while ((match = pattern.exec(css))) {
        const styles = parseStyleDeclaration(match[2]);
        match[1]
          .split(',')
          .map(selector => selector.trim())
          .filter(Boolean)
          .forEach(selector => {
            rules.push({ selector, styles });
          });
      }
    });
    return rules;
  };

  const getSelectorSpecificity = (selector) => {
    const idCount = (selector.match(/#/g) || []).length;
    const classCount = (selector.match(/\./g) || []).length;
    const tagCount = /^[a-z][\w-]*/i.test(selector.trim()) ? 1 : 0;
    return idCount * 100 + classCount * 10 + tagCount;
  };

  const matchesSimpleSvgSelector = (node, selector) => {
    const clean = selector.trim();
    if (!clean || /[\s>+~:[\][]/.test(clean)) return false;

    const tag = node.tagName.toLowerCase();
    const id = node.getAttribute('id') || '';
    const classes = (node.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    const tagMatch = clean.match(/^[a-z][\w-]*/i);
    const idMatch = clean.match(/#([\w-]+)/);
    const classMatches = Array.from(clean.matchAll(/\.([\w-]+)/g)).map(match => match[1]);

    if (tagMatch && tagMatch[0].toLowerCase() !== tag) return false;
    if (idMatch && idMatch[1] !== id) return false;
    return classMatches.every(className => classes.includes(className));
  };

  const getDefaultSvgStyle = () => ({
    fill: 'black',
    stroke: 'none',
    'stroke-width': '1',
    'fill-rule': 'nonzero',
    color: 'black',
    opacity: '1',
    'fill-opacity': '1',
    'stroke-opacity': '1',
    display: 'inline',
    visibility: 'visible'
  });

  const SVG_PRESENTATION_PROPS = [
    'fill',
    'stroke',
    'stroke-width',
    'fill-rule',
    'color',
    'opacity',
    'fill-opacity',
    'stroke-opacity',
    'display',
    'visibility',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-miterlimit'
  ];

  const resolveSvgNodeStyle = (node, parentStyle, cssRules) => {
    const resolved = { ...parentStyle };

    SVG_PRESENTATION_PROPS.forEach(prop => {
      if (node.hasAttribute(prop)) resolved[prop] = node.getAttribute(prop);
    });

    cssRules
      .filter(rule => matchesSimpleSvgSelector(node, rule.selector))
      .sort((a, b) => getSelectorSpecificity(a.selector) - getSelectorSpecificity(b.selector))
      .forEach(rule => {
        Object.assign(resolved, rule.styles);
      });

    Object.assign(resolved, parseStyleDeclaration(node.getAttribute('style') || ''));

    if ((resolved.fill || '').trim().toLowerCase() === 'currentcolor') resolved.fill = resolved.color || 'black';
    if ((resolved.stroke || '').trim().toLowerCase() === 'currentcolor') resolved.stroke = resolved.color || 'black';

    return resolved;
  };

  const isHiddenSvgStyle = (style) => (
    (style.display || '').trim().toLowerCase() === 'none'
    || (style.visibility || '').trim().toLowerCase() === 'hidden'
    || parseFloat(style.opacity ?? '1') <= 0
  );

  const hasVisibleFill = (style, tag) => (
    tag !== 'line'
    && tag !== 'polyline'
    && (style.fill || '').trim().toLowerCase() !== 'none'
    && parseFloat(style['fill-opacity'] ?? '1') > 0
  );

  const hasBlackFill = (style, tag) => {
    return hasVisibleFill(style, tag);
  };

  const hasWhiteKnockoutFill = (style, tag) => (
    false
  );

  const hasBlackStroke = (style) => {
    if (parseFloat(style['stroke-opacity'] ?? '1') <= 0) return false;
    const stroke = (style.stroke || '').trim().toLowerCase();
    return Boolean(stroke) && stroke !== 'none';
  };

  const getStrokeWidth = (style, matrix) => {
    const width = parseFloat(style['stroke-width'] ?? '1');
    if (!Number.isFinite(width) || width <= 0) return 0;

    const sx = Math.hypot(matrix[0], matrix[1]) || 1;
    const sy = Math.hypot(matrix[2], matrix[3]) || 1;
    return width * ((sx + sy) / 2);
  };

  const shouldClosePathSubpath = (style, subpathClosed) => (
    subpathClosed || ((style.fill || '').trim().toLowerCase() !== 'none' && parseFloat(style['fill-opacity'] ?? '1') > 0)
  );

  const getSvgRootBox = (svg) => {
    const viewBox = parseSvgNumberList(svg.getAttribute('viewBox'));
    if (viewBox.length >= 4) return { x: viewBox[0], y: viewBox[1], width: viewBox[2], height: viewBox[3] };
    const widthValue = parseFloat(svg.getAttribute('width')) || 100;
    const heightValue = parseFloat(svg.getAttribute('height')) || 100;
    return { x: 0, y: 0, width: widthValue, height: heightValue };
  };

  const splitSvgPathSubpaths = (d) => {
    const parsed = new SVGPathData(d).transform(SVGPathDataTransformer.TO_ABS());
    const subpaths = [];
    let current = [];

    parsed.commands.forEach(command => {
      if (command.type === SVGPathData.MOVE_TO && current.length > 0) {
        subpaths.push(current);
        current = [command];
        return;
      }

      current.push(command);
    });

    if (current.length > 0) subpaths.push(current);

    return subpaths.map(commands => ({
      commands,
      closed: commands.some(command => command.type === SVGPathData.CLOSE_PATH)
    }));
  };

  const distancePointToLine = (point, start, end) => {
    const lineLength = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (lineLength <= 0.000001) return Math.hypot(point[0] - start[0], point[1] - start[1]);
    return Math.abs(
      (end[0] - start[0]) * (start[1] - point[1])
      - (start[0] - point[0]) * (end[1] - start[1])
    ) / lineLength;
  };

  const addFlattenedCubic = (points, p0, p1, p2, p3, tolerance, depth = 0) => {
    const flatness = Math.max(distancePointToLine(p1, p0, p3), distancePointToLine(p2, p0, p3));
    if (flatness <= tolerance || depth >= 14) {
      points.push(p3);
      return;
    }

    const p01 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    const p12 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    const p23 = [(p2[0] + p3[0]) / 2, (p2[1] + p3[1]) / 2];
    const p012 = [(p01[0] + p12[0]) / 2, (p01[1] + p12[1]) / 2];
    const p123 = [(p12[0] + p23[0]) / 2, (p12[1] + p23[1]) / 2];
    const p0123 = [(p012[0] + p123[0]) / 2, (p012[1] + p123[1]) / 2];

    addFlattenedCubic(points, p0, p01, p012, p0123, tolerance, depth + 1);
    addFlattenedCubic(points, p0123, p123, p23, p3, tolerance, depth + 1);
  };

  const sampleSvgPathCommands = (commands, matrix, tolerance = 0.12) => {
    const points = [];
    let current = [0, 0];
    let subpathStart = [0, 0];
    let previousCubicControl = null;
    let previousQuadraticControl = null;

    const pushTransformed = (point) => {
      const transformed = applyMatrix(matrix, point);
      const last = points[points.length - 1];
      if (!last || Math.hypot(transformed[0] - last[0], transformed[1] - last[1]) > 0.0001) {
        points.push(transformed);
      }
    };

    commands.forEach(command => {
      if (command.type === SVGPathData.MOVE_TO) {
        current = [command.x, command.y];
        subpathStart = current;
        pushTransformed(current);
        previousCubicControl = null;
        previousQuadraticControl = null;
        return;
      }

      if (command.type === SVGPathData.LINE_TO) {
        current = [command.x, command.y];
        pushTransformed(current);
        previousCubicControl = null;
        previousQuadraticControl = null;
        return;
      }

      if (command.type === SVGPathData.HORIZ_LINE_TO) {
        current = [command.x, current[1]];
        pushTransformed(current);
        previousCubicControl = null;
        previousQuadraticControl = null;
        return;
      }

      if (command.type === SVGPathData.VERT_LINE_TO) {
        current = [current[0], command.y];
        pushTransformed(current);
        previousCubicControl = null;
        previousQuadraticControl = null;
        return;
      }

      if (command.type === SVGPathData.CURVE_TO || command.type === SVGPathData.SMOOTH_CURVE_TO) {
        const p0 = current;
        const p1 = command.type === SVGPathData.SMOOTH_CURVE_TO && previousCubicControl
          ? [2 * current[0] - previousCubicControl[0], 2 * current[1] - previousCubicControl[1]]
          : [command.x1, command.y1];
        const p2 = [command.x2, command.y2];
        const p3 = [command.x, command.y];
        const curvePoints = [];
        addFlattenedCubic(curvePoints, p0, p1, p2, p3, tolerance);
        curvePoints.forEach(pushTransformed);
        current = p3;
        previousCubicControl = p2;
        previousQuadraticControl = null;
        return;
      }

      if (command.type === SVGPathData.QUAD_TO || command.type === SVGPathData.SMOOTH_QUAD_TO) {
        const control = command.type === SVGPathData.SMOOTH_QUAD_TO && previousQuadraticControl
          ? [2 * current[0] - previousQuadraticControl[0], 2 * current[1] - previousQuadraticControl[1]]
          : [command.x1, command.y1];
        const end = [command.x, command.y];
        const cubic1 = [
          current[0] + (2 / 3) * (control[0] - current[0]),
          current[1] + (2 / 3) * (control[1] - current[1])
        ];
        const cubic2 = [
          end[0] + (2 / 3) * (control[0] - end[0]),
          end[1] + (2 / 3) * (control[1] - end[1])
        ];
        const curvePoints = [];
        addFlattenedCubic(curvePoints, current, cubic1, cubic2, end, tolerance);
        curvePoints.forEach(pushTransformed);
        current = end;
        previousCubicControl = null;
        previousQuadraticControl = control;
        return;
      }

      if (command.type === SVGPathData.ARC) {
        const arcCommands = [
          { type: SVGPathData.MOVE_TO, relative: false, x: current[0], y: current[1] },
          command
        ];
        try {
          const d = encodeSVGPath(arcCommands);
          const properties = new svgPathProperties(d);
          const length = properties.getTotalLength();
          const steps = Math.max(8, Math.ceil(length / Math.max(0.1, tolerance)));
          for (let i = 1; i <= steps; i++) {
            const point = properties.getPointAtLength(length * (i / steps));
            pushTransformed([point.x, point.y]);
          }
        } catch {
          pushTransformed([command.x, command.y]);
        }
        current = [command.x, command.y];
        previousCubicControl = null;
        previousQuadraticControl = null;
        return;
      }

      if (command.type === SVGPathData.CLOSE_PATH) {
        current = subpathStart;
        pushTransformed(current);
        previousCubicControl = null;
        previousQuadraticControl = null;
      }
    });

    return points;
  };

  const getSvgElementById = (svg, id) => {
    if (!id) return null;
    return Array.from(svg.querySelectorAll('[id]')).find(node => node.getAttribute('id') === id) || null;
  };

  const buildRoundedRectPoints = (x, y, widthValue, heightValue, rxValue, ryValue, matrix) => {
    const rx = clamp(rxValue || 0, 0, Math.abs(widthValue) / 2);
    const ry = clamp(ryValue || 0, 0, Math.abs(heightValue) / 2);

    if (rx <= 0 || ry <= 0) {
      return [[x, y], [x + widthValue, y], [x + widthValue, y + heightValue], [x, y + heightValue]]
        .map(point => applyMatrix(matrix, point));
    }

    const points = [];
    const corners = [
      { cx: x + widthValue - rx, cy: y + ry, start: -Math.PI / 2, end: 0 },
      { cx: x + widthValue - rx, cy: y + heightValue - ry, start: 0, end: Math.PI / 2 },
      { cx: x + rx, cy: y + heightValue - ry, start: Math.PI / 2, end: Math.PI },
      { cx: x + rx, cy: y + ry, start: Math.PI, end: Math.PI * 1.5 }
    ];

    corners.forEach(corner => {
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const angle = corner.start + (corner.end - corner.start) * t;
        points.push(applyMatrix(matrix, [
          corner.cx + Math.cos(angle) * rx,
          corner.cy + Math.sin(angle) * ry
        ]));
      }
    });

    return points;
  };

  const vectorLength = ([x, y]) => Math.hypot(x, y);

  const normalizeVector = ([x, y]) => {
    const length = vectorLength([x, y]) || 1;
    return [x / length, y / length];
  };

  const buildOpenStrokeOutline = (points, strokeWidth, linecap = 'butt') => {
    const cleaned = cleanDxfPoints(points, false);
    if (cleaned.length < 2 || strokeWidth <= 0) return [];

    const half = strokeWidth / 2;
    const cap = (linecap || 'butt').trim().toLowerCase();
    const startDirection = normalizeVector([cleaned[1][0] - cleaned[0][0], cleaned[1][1] - cleaned[0][1]]);
    const endDirection = normalizeVector([
      cleaned[cleaned.length - 1][0] - cleaned[cleaned.length - 2][0],
      cleaned[cleaned.length - 1][1] - cleaned[cleaned.length - 2][1]
    ]);
    const working = cleaned.map(point => [...point]);

    if (cap === 'square') {
      working[0] = [working[0][0] - startDirection[0] * half, working[0][1] - startDirection[1] * half];
      const lastIndex = working.length - 1;
      working[lastIndex] = [working[lastIndex][0] + endDirection[0] * half, working[lastIndex][1] + endDirection[1] * half];
    }

    const left = [];
    const right = [];

    working.forEach((point, index) => {
      const prev = working[Math.max(0, index - 1)];
      const next = working[Math.min(working.length - 1, index + 1)];
      const direction = normalizeVector([next[0] - prev[0], next[1] - prev[1]]);
      const normal = [-direction[1], direction[0]];
      left.push([point[0] + normal[0] * half, point[1] + normal[1] * half]);
      right.push([point[0] - normal[0] * half, point[1] - normal[1] * half]);
    });

    if (cap !== 'round') return [...left, ...right.reverse()];

    const endCap = [];
    const startCap = [];
    const makeCap = (center, fromAngle, toAngle) => {
      const capPoints = [];
      const span = normalizeAngle(toAngle - fromAngle);
      const steps = 10;
      for (let i = 1; i < steps; i++) {
        const angle = fromAngle + span * (i / steps);
        capPoints.push([center[0] + Math.cos(angle) * half, center[1] + Math.sin(angle) * half]);
      }
      return capPoints;
    };

    const endCenter = cleaned[cleaned.length - 1];
    const startCenter = cleaned[0];
    const endNormal = [-endDirection[1], endDirection[0]];
    const startNormal = [-startDirection[1], startDirection[0]];
    endCap.push(...makeCap(
      endCenter,
      Math.atan2(endNormal[1], endNormal[0]),
      Math.atan2(-endNormal[1], -endNormal[0])
    ));
    startCap.push(...makeCap(
      startCenter,
      Math.atan2(-startNormal[1], -startNormal[0]),
      Math.atan2(startNormal[1], startNormal[0])
    ));

    return [...left, ...endCap, ...right.reverse(), ...startCap];
  };

  const offsetClosedStrokeContours = (points, strokeWidth) => {
    const cleaned = cleanDxfPoints(points, true);
    if (cleaned.length < 3 || strokeWidth <= 0) return [];

    const scaleFactor = 1000;
    const clipperPath = cleaned.map(([x, y]) => ({
      X: Math.round(x * scaleFactor),
      Y: Math.round(y * scaleFactor)
    }));

    const runOffset = (delta) => {
      const offsetter = new ClipperLib.ClipperOffset(2, 0.25 * scaleFactor);
      offsetter.AddPath(clipperPath, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
      const solution = [];
      offsetter.Execute(solution, delta * scaleFactor);
      return solution.map(path => path.map(point => [point.X / scaleFactor, point.Y / scaleFactor]));
    };

    const half = strokeWidth / 2;
    return [
      ...runOffset(half),
      ...runOffset(-half)
    ].filter(path => path.length >= 3);
  };

  const clipperScale = 1000;

  const toClipperPath = (points) => (
    cleanDxfPoints(points, true).map(([x, y]) => ({
      X: Math.round(x * clipperScale),
      Y: Math.round(y * clipperScale)
    }))
  );

  const fromClipperPath = (path) => (
    cleanDxfPoints(path.map(point => [point.X / clipperScale, point.Y / clipperScale]), true)
  );

  const cleanClipperPaths = (paths, tolerance = 0.05) => (
    ClipperLib.Clipper.CleanPolygons(paths, tolerance * clipperScale).filter(path => path.length >= 3)
  );

  const orientClipperPaths = (paths) => (
    paths.map(path => (ClipperLib.Clipper.Orientation(path) ? path : [...path].reverse()))
  );

  const offsetOpenStrokeContours = (points, strokeWidth, linecap = 'butt') => {
    const cleaned = cleanDxfPoints(points, false);
    if (cleaned.length < 2 || strokeWidth <= 0) return [];

    const endType = {
      round: ClipperLib.EndType.etOpenRound,
      square: ClipperLib.EndType.etOpenSquare,
      butt: ClipperLib.EndType.etOpenButt
    }[(linecap || 'butt').trim().toLowerCase()] || ClipperLib.EndType.etOpenButt;

    const clipperPath = cleaned.map(([x, y]) => ({
      X: Math.round(x * clipperScale),
      Y: Math.round(y * clipperScale)
    }));
    const offsetter = new ClipperLib.ClipperOffset(2, 0.25 * clipperScale);
    offsetter.AddPath(clipperPath, ClipperLib.JoinType.jtRound, endType);
    const solution = [];
    offsetter.Execute(solution, (strokeWidth / 2) * clipperScale);

    return cleanClipperPaths(solution).map(fromClipperPath);
  };

  const intersectClosedContourWithMargin = (points) => {
    if (!interiorClipEnabled || interiorMarginBoundarySets.length === 0 || points.length < 3) return [points];

    const subject = cleanClipperPaths([toClipperPath(points)]);
    const clips = cleanClipperPaths(interiorMarginBoundarySets.map(toClipperPath));
    if (!subject.length || !clips.length) return [];

    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(clips, ClipperLib.PolyType.ptClip, true);

    const solution = new ClipperLib.Paths();
    clipper.Execute(
      ClipperLib.ClipType.ctIntersection,
      solution,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero
    );

    return cleanClipperPaths(solution).map(fromClipperPath);
  };

  const simplifyClosedContours = (contours) => (
    contours.map(contour => {
      if (!contour.closed || contour.points.length < 3) return contour;

      const cleanedPath = cleanClipperPaths([toClipperPath(contour.points)])[0];
      if (!cleanedPath) return contour;

      return {
        ...contour,
        points: fromClipperPath(cleanedPath)
      };
    })
  );

  const signedPolygonArea = (points) => {
    if (points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      area += x1 * y2 - x2 * y1;
    }
    return area / 2;
  };

  const pointInPolygon = (point, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];
      const intersects = ((yi > point[1]) !== (yj > point[1]))
        && (point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || 1) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  };

  const analyzeInteriorContours = (contours) => {
    const closedContours = contours
      .map((contour, index) => ({
        ...contour,
        contourIndex: index,
        signedArea: signedPolygonArea(contour.points)
      }))
      .filter(contour => contour.closed && contour.points.length >= 3)
      .map(contour => ({ ...contour, area: Math.abs(contour.signedArea) }));

    return closedContours.map(contour => {
      const samplePoint = contour.points[0];
      const parentCount = closedContours.filter(candidate => (
        candidate !== contour
        && candidate.area > contour.area
        && pointInPolygon(samplePoint, candidate.points)
      )).length;

      return {
        ...contour,
        depth: parentCount,
        role: parentCount % 2 === 0 ? 'outer' : 'hole'
      };
    });
  };

  const unionClipperPaths = (paths) => {
    const subject = cleanClipperPaths(paths);
    if (!subject.length) return [];
    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
    const solution = new ClipperLib.Paths();
    clipper.Execute(
      ClipperLib.ClipType.ctUnion,
      solution,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero
    );
    return cleanClipperPaths(solution);
  };

  const differenceClipperPaths = (subjectPaths, clipPaths) => {
    const subject = cleanClipperPaths(subjectPaths);
    const clips = cleanClipperPaths(clipPaths);
    if (!subject.length) return [];
    if (!clips.length) return subject;

    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(clips, ClipperLib.PolyType.ptClip, true);
    const solution = new ClipperLib.Paths();
    clipper.Execute(
      ClipperLib.ClipType.ctDifference,
      solution,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero
    );
    return cleanClipperPaths(solution);
  };

  const buildBooleanInteriorContours = (contours) => {
    const passthrough = contours.filter(contour => !contour.closed || contour.points.length < 3);
    const orderedClosed = contours
      .filter(contour => contour.closed && contour.points.length >= 3)
      .sort((a, b) => (
        (a.zIndex ?? 0) - (b.zIndex ?? 0)
        || (a.contourOrder ?? 0) - (b.contourOrder ?? 0)
      ));

    let accumulatedWhite = [];
    orderedClosed.forEach(contour => {
      const paths = unionClipperPaths(orientClipperPaths([toClipperPath(contour.points)]));
      if (!paths.length) return;

      if (contour.materialColor === 'black' || contour.source === 'knockout') {
        accumulatedWhite = differenceClipperPaths(accumulatedWhite, paths);
        return;
      }

      accumulatedWhite = unionClipperPaths([...accumulatedWhite, ...paths]);
    });

    const resultContours = accumulatedWhite
      .map((path, index) => ({ path, points: fromClipperPath(path), index }))
      .filter(({ points }) => points.length >= 3)
      .map(({ path, points, index }) => ({
        points,
        closed: true,
        source: 'boolean',
        fillRule: 'nonzero',
        layer: `WHITE_RESULT_${index + 1}`,
        designId: `white-result-${index + 1}`,
        designName: 'Boolean white result',
        materialColor: 'white',
        role: ClipperLib.Clipper.Orientation(path) ? 'outer' : 'hole',
        depth: ClipperLib.Clipper.Orientation(path) ? 0 : 1,
        area: Math.abs(signedPolygonArea(points))
      }));

    return [...resultContours, ...passthrough];
  };

  const sampleInteriorThreePointArc = (design, segments = 72) => {
    const p1 = [n(design.x1, 0), n(design.y1, 0)];
    const pm = [n(design.x2, 0), n(design.y2, 0)];
    const p2 = [n(design.x3, 0), n(design.y3, 0)];
    const d = 2 * (
      p1[0] * (pm[1] - p2[1])
      + pm[0] * (p2[1] - p1[1])
      + p2[0] * (p1[1] - pm[1])
    );

    if (Math.abs(d) < 0.000001) return [p1, p2];

    const p1Sq = p1[0] * p1[0] + p1[1] * p1[1];
    const pmSq = pm[0] * pm[0] + pm[1] * pm[1];
    const p2Sq = p2[0] * p2[0] + p2[1] * p2[1];
    const cx = (
      p1Sq * (pm[1] - p2[1])
      + pmSq * (p2[1] - p1[1])
      + p2Sq * (p1[1] - pm[1])
    ) / d;
    const cy = (
      p1Sq * (p2[0] - pm[0])
      + pmSq * (p1[0] - p2[0])
      + p2Sq * (pm[0] - p1[0])
    ) / d;
    const radius = Math.hypot(p1[0] - cx, p1[1] - cy);
    const a1 = Math.atan2(p1[1] - cy, p1[0] - cx);
    const am = Math.atan2(pm[1] - cy, pm[0] - cx);
    const a2 = Math.atan2(p2[1] - cy, p2[0] - cx);
    const twoPi = Math.PI * 2;
    const ccwEnd = (a2 - a1 + twoPi) % twoPi;
    const ccwMid = (am - a1 + twoPi) % twoPi;
    const useCcw = ccwMid <= ccwEnd;
    const span = useCcw ? ccwEnd : -((a1 - a2 + twoPi) % twoPi);
    const pointCount = Math.max(8, segments);

    return Array.from({ length: pointCount + 1 }, (_, index) => {
      const angle = a1 + span * (index / pointCount);
      return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
    });
  };

  const getInteriorShapeContours = (design) => {
    const bounds = getInteriorObjectBounds(design);
    const thickness = Math.max(0.5, n(design.thickness, 8));

    if (design.kind === 'rect') {
      return [[
        [bounds.x, bounds.y],
        [bounds.x + bounds.width, bounds.y],
        [bounds.x + bounds.width, bounds.y + bounds.height],
        [bounds.x, bounds.y + bounds.height]
      ]];
    }

    if (design.kind === 'ellipse') {
      return [Array.from({ length: 160 }, (_, index) => {
        const angle = index * Math.PI * 2 / 160;
        return [
          bounds.x + bounds.width / 2 + Math.cos(angle) * bounds.width / 2,
          bounds.y + bounds.height / 2 + Math.sin(angle) * bounds.height / 2
        ];
      })];
    }

    if (design.kind === 'line') {
      return offsetOpenStrokeContours(
        [[n(design.x1, 0), n(design.y1, 0)], [n(design.x2, 0), n(design.y2, 0)]],
        thickness,
        'butt'
      );
    }

    if (design.kind === 'arc') {
      return offsetOpenStrokeContours(sampleInteriorThreePointArc(design), thickness, 'butt');
    }

    if (design.kind === 'eraser') {
      return offsetOpenStrokeContours(design.points || [], thickness, 'round');
    }

    return [];
  };

  const collectInteriorDesignContours = () => {
    const contours = [];
    const skipped = [];
    const parser = new DOMParser();

    flattenInteriorDesigns(interiorDesigns).forEach((design, designIndex) => {
      if (design.exportable === false) {
        skipped.push(design.name);
        return;
      }

      if (!isImportedInteriorSvg(design)) {
        const layer = `SHAPE_${designIndex + 1}`;
        getInteriorShapeContours(design).forEach(points => {
          const cleaned = cleanDxfPoints(points, true);
          if (cleaned.length < 3) return;
          const contourSets = design.color === 'white'
            ? intersectClosedContourWithMargin(cleaned)
            : [cleaned];
          contourSets.forEach(clipped => {
            if (clipped.length < 3) return;
            contours.push({
              points: clipped,
              closed: true,
              source: design.kind === 'line' || design.kind === 'arc' ? 'stroke' : 'fill',
              fillRule: 'nonzero',
              layer,
              designId: design.id,
              designName: design.name,
              materialColor: design.color || 'white',
              zIndex: designIndex,
              contourOrder: contours.length
            });
          });
        });
        return;
      }

      if (!design.svgText) return;

      const doc = parser.parseFromString(design.svgText, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg || doc.querySelector('parsererror')) {
        skipped.push(design.name);
        return;
      }

      const rootBox = getSvgRootBox(svg);
      const designWidth = Math.max(10, n(design.width, 10));
      const designHeight = Math.max(10, n(design.height, 10));
      const scaleX = designWidth / (rootBox.width || 1);
      const scaleY = designHeight / (rootBox.height || 1);
      const pathTolerance = Math.max(0.02, 0.08 / Math.max(scaleX, scaleY));
      const placePoint = ([x, y]) => [
        n(design.x, 0) + (x - rootBox.x) * scaleX,
        n(design.y, 0) + (y - rootBox.y) * scaleY
      ];
      const layer = `DESIGN_${designIndex + 1}`;
      const cssRules = parseSvgCssRules(svg);

      const addContour = (points, closed = true, source = 'fill', fillRule = 'nonzero') => {
        if (points.length < 2) return;
        const placed = cleanDxfPoints(points.map(placePoint), closed);
        if (placed.length < (closed ? 3 : 2)) return;
        const clippedSets = closed
          ? (design.color === 'white' ? intersectClosedContourWithMargin(placed) : [placed])
          : (interiorClipEnabled ? [] : [placed]);

        clippedSets.forEach(clipped => {
          if (clipped.length < (closed ? 3 : 2)) return;
          contours.push({
            points: clipped,
            closed,
            source,
            fillRule,
            layer,
            designId: design.id,
            designName: design.name,
            materialColor: design.color || 'white',
            zIndex: designIndex,
            contourOrder: contours.length
          });
        });
      };

      const walk = (node, parentMatrix = [1, 0, 0, 1, 0, 0], parentStyle = getDefaultSvgStyle(), visitedUses = new Set()) => {
        if (node.nodeType !== 1) return;
        const matrix = multiplyMatrix(parentMatrix, parseSvgTransform(node.getAttribute('transform')));
        const tag = node.tagName.toLowerCase();
        const style = resolveSvgNodeStyle(node, parentStyle, cssRules);

        if (isHiddenSvgStyle(style) || tag === 'defs' || tag === 'style' || tag === 'title' || tag === 'desc') return;

        if (tag === 'use') {
          const rawHref = node.getAttribute('href') || node.getAttribute('xlink:href') || '';
          const id = rawHref.startsWith('#') ? rawHref.slice(1) : '';
          const target = getSvgElementById(svg, id);
          if (target && !visitedUses.has(id)) {
            const x = parseFloat(node.getAttribute('x')) || 0;
            const y = parseFloat(node.getAttribute('y')) || 0;
            const useMatrix = multiplyMatrix(matrix, [1, 0, 0, 1, x, y]);
            walk(target, useMatrix, style, new Set([...visitedUses, id]));
          }
          return;
        }

        const fillBlack = hasBlackFill(style, tag);
        const knockoutFill = hasWhiteKnockoutFill(style, tag);
        const strokeBlack = hasBlackStroke(style);
        const strokeWidth = getStrokeWidth(style, matrix);
        const fillRule = (style['fill-rule'] || 'nonzero').trim().toLowerCase() === 'evenodd' ? 'evenodd' : 'nonzero';

        if (tag === 'path' && (fillBlack || knockoutFill || strokeBlack)) {
          const d = node.getAttribute('d');
          if (d) {
            try {
              splitSvgPathSubpaths(d).forEach(subpath => {
                const points = sampleSvgPathCommands(subpath.commands, matrix, pathTolerance);
                if (fillBlack) {
                  addContour(points, shouldClosePathSubpath(style, subpath.closed), 'fill', fillRule);
                } else if (knockoutFill) {
                  addContour(points, shouldClosePathSubpath(style, subpath.closed), 'knockout', fillRule);
                } else if (strokeBlack && strokeWidth > 0) {
                  if (subpath.closed) {
                    offsetClosedStrokeContours(points, strokeWidth).forEach(outline => addContour(outline, true, 'stroke'));
                  } else {
                    offsetOpenStrokeContours(points, strokeWidth, style['stroke-linecap']).forEach(outline => addContour(outline, true, 'stroke'));
                  }
                }
              });
            } catch {
              // Unsupported path data is skipped.
            }
          }
        } else if (tag === 'rect' && (fillBlack || knockoutFill || strokeBlack)) {
          const x = parseFloat(node.getAttribute('x')) || 0;
          const y = parseFloat(node.getAttribute('y')) || 0;
          const w = parseFloat(node.getAttribute('width')) || 0;
          const h = parseFloat(node.getAttribute('height')) || 0;
          const rawRx = node.hasAttribute('rx') ? parseFloat(node.getAttribute('rx')) : parseFloat(node.getAttribute('ry')) || 0;
          const rawRy = node.hasAttribute('ry') ? parseFloat(node.getAttribute('ry')) : rawRx;
          const points = buildRoundedRectPoints(x, y, w, h, rawRx, rawRy, matrix);
          if (fillBlack) {
            addContour(points, true, 'fill', fillRule);
          } else if (knockoutFill) {
            addContour(points, true, 'knockout', fillRule);
          } else if (strokeBlack) {
            offsetClosedStrokeContours(points, strokeWidth).forEach(outline => addContour(outline, true, 'stroke'));
          }
        } else if ((tag === 'circle' || tag === 'ellipse') && (fillBlack || knockoutFill || strokeBlack)) {
          const cx = parseFloat(node.getAttribute('cx')) || 0;
          const cy = parseFloat(node.getAttribute('cy')) || 0;
          const rx = tag === 'circle' ? parseFloat(node.getAttribute('r')) || 0 : parseFloat(node.getAttribute('rx')) || 0;
          const ry = tag === 'circle' ? rx : parseFloat(node.getAttribute('ry')) || 0;
          const points = [];
          for (let i = 0; i < 160; i++) {
            const angle = i * Math.PI * 2 / 160;
            points.push(applyMatrix(matrix, [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]));
          }
          if (fillBlack) {
            addContour(points, true, 'fill', fillRule);
          } else if (knockoutFill) {
            addContour(points, true, 'knockout', fillRule);
          } else if (strokeBlack) {
            offsetClosedStrokeContours(points, strokeWidth).forEach(outline => addContour(outline, true, 'stroke'));
          }
        } else if ((tag === 'polygon' || tag === 'polyline') && (fillBlack || knockoutFill || strokeBlack)) {
          const points = parseSvgPoints(node.getAttribute('points')).map(point => applyMatrix(matrix, point));
          if (tag === 'polyline' && !fillBlack && strokeBlack) {
            offsetOpenStrokeContours(points, strokeWidth, style['stroke-linecap']).forEach(outline => addContour(outline, true, 'stroke'));
          } else if (tag === 'polygon' && !fillBlack && strokeBlack) {
            offsetClosedStrokeContours(points, strokeWidth).forEach(outline => addContour(outline, true, 'stroke'));
          } else if (knockoutFill) {
            addContour(points, tag === 'polygon', 'knockout', fillRule);
          } else {
            addContour(points, tag === 'polygon', fillBlack ? 'fill' : 'stroke', fillRule);
          }
        } else if (tag === 'line' && strokeBlack) {
          const p1 = [parseFloat(node.getAttribute('x1')) || 0, parseFloat(node.getAttribute('y1')) || 0];
          const p2 = [parseFloat(node.getAttribute('x2')) || 0, parseFloat(node.getAttribute('y2')) || 0];
          if (strokeBlack) {
            offsetOpenStrokeContours([applyMatrix(matrix, p1), applyMatrix(matrix, p2)], strokeWidth, style['stroke-linecap']).forEach(outline => addContour(outline, true, 'stroke'));
          }
        }

        Array.from(node.children).forEach(child => walk(child, matrix, style, visitedUses));
      };

      walk(svg);
    });

    const normalizedContours = simplifyClosedContours(contours);
    const analyzed = analyzeInteriorContours(normalizedContours);
    const byKey = new Map(analyzed.map(contour => [`${contour.designId}-${contour.contourIndex}`, contour]));
    const withAnalysis = normalizedContours.map((contour, index) => ({
      ...contour,
      ...(byKey.get(`${contour.designId}-${index}`) || { area: 0, depth: 0, role: contour.closed ? 'outer' : 'open' })
    }));
    const clearanceContours = getAlignedSlotClearanceContours().map((contour, index) => ({
      ...contour,
      zIndex: interiorDesigns.length + 0.25,
      contourOrder: contours.length + index
    }));
    const patternContours = getPatternContours().map((contour, index) => ({
      ...contour,
      materialColor: 'white',
      zIndex: interiorDesigns.length + 0.5,
      contourOrder: contours.length + clearanceContours.length + index
    }));

    const booleanContours = buildBooleanInteriorContours([...withAnalysis, ...clearanceContours, ...patternContours]);

    return {
      contours: booleanContours,
      skipped
    };
  };

  const getInteriorExportDiagnostics = (exportData = null) => {
    if (!exportData) {
      return {
        designCount: interiorDesigns.length,
        contourCount: 0,
        closedCount: 0,
        openCount: 0,
        holeCount: 0,
        expandedStrokeCount: 0,
        centerlineStrokeCount: 0,
        skippedCount: interiorDesigns.filter(design => design.exportable === false).length,
        skipped: []
      };
    }

    const { contours, skipped } = exportData;
    const closed = contours.filter(contour => contour.closed);
    const open = contours.length - closed.length;
    const holes = contours.filter(contour => contour.role === 'hole').length;
    const expandedStrokes = contours.filter(contour => contour.source === 'stroke').length;
    const centerlineStrokes = contours.filter(contour => contour.source === 'stroke-center').length;

    return {
      designCount: interiorDesigns.length,
      contourCount: contours.length,
      closedCount: closed.length,
      openCount: open,
      holeCount: holes,
      expandedStrokeCount: expandedStrokes,
      centerlineStrokeCount: centerlineStrokes,
      skippedCount: skipped.length,
      skipped
    };
  };

  const buildInteriorDesignDXFEntities = (exportData = collectInteriorDesignContours()) => {
    const { contours } = exportData;
    return contours
      .sort((a, b) => (a.depth - b.depth) || (b.area - a.area))
      .map(contour => dxfPolylineEntity(contour.points, contour.closed, contour.layer))
      .join('');
  };

  const getInteriorDesignDXFLayers = (exportData = collectInteriorDesignContours()) => (
    exportData.contours.map(contour => contour.layer)
  );

  const segmentBulge = (segment, startLocal, endLocal) => {
    const includedAngle = segment.direction * ((endLocal - startLocal) / segment.radius);
    return roundDXF(-Math.tan(includedAngle / 4));
  };

  const dxfPolylineFromRawVertices = (raw, layer = '0') => {
    const vertices = raw.map(point => {
      const [x, y] = toDXFPoint(point);
      return { x, y, bulge: 0 };
    });

    const cleaned = vertices.filter((p, i, arr) => {
      if (i === 0) return true;
      const prev = arr[i - 1];
      return !(Math.abs(p.x - prev.x) < 0.000001 && Math.abs(p.y - prev.y) < 0.000001);
    });

    let entity = dxfLwPolylineHeader(layer, cleaned.length, true);

    cleaned.forEach(v => {
      entity += dxfLine('10', v.x, '20', v.y, '30', '0.0');
      if (Math.abs(v.bulge) > 0.0000001) entity += dxfLine('42', v.bulge);
    });

    return entity;
  };

  const buildArcTopDXFLwPolyline = () => {
    if (isAngledPanel || hasPanelSplit || bottomPanelEnabled) return buildStraightDXFLwPolyline();

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

    let entity = dxfLwPolylineHeader('0', vertices.length, true);

    vertices.forEach(v => {
      entity += dxfLine('10', v.x, '20', v.y, '30', '0.0');
      if (Math.abs(v.bulge) > 0.0000001) entity += dxfLine('42', v.bulge);
    });

    return entity;
  };

  const buildStraightDXFLwPolyline = () => {
    return getPanelVertexSets().map(vertexSet => dxfPolylineFromRawVertices(vertexSet)).join('');
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
    const entities = [];

    getPanelVertexSets().forEach(raw => {
      for (let i = 0; i < raw.length; i++) {
        const p1 = raw[i];
        const p2 = raw[(i + 1) % raw.length];
        if (Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) > 0.000001) {
          entities.push(fusionLineEntity(p1, p2));
        }
      }
    });

    return entities;
  };

  const buildFusionArcTopEntities = () => {
    if (isAngledPanel || hasPanelSplit || bottomPanelEnabled) return buildFusionStraightEntities();

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
    const blockedDesigns = interiorDesigns.filter(design => design.exportable === false);
    if (blockedDesigns.length > 0) {
      const names = blockedDesigns.map(design => design.name).join(', ');
      window.alert(`Some designs cannot be exported cleanly yet: ${names}. Remove or convert them before exporting DXF.`);
      return;
    }

    resetDxfHandles();

    let dxf = '';
    const interiorExportForDownload = collectInteriorDesignContours();
    const designLayers = getInteriorDesignDXFLayers(interiorExportForDownload);

    dxf += dxfLine('0', 'SECTION', '2', 'HEADER');
    dxf += dxfLine('9', '$ACADVER', '1', 'AC1014');
    dxf += dxfLine('9', '$HANDSEED', '5', 'FFFF');
    dxf += dxfLine('9', '$INSUNITS', '70', '4');
    dxf += dxfLine('9', '$MEASUREMENT', '70', '1');
    dxf += dxfLine('0', 'ENDSEC');
    dxf += buildDxfTablesSection(designLayers);
    dxf += buildDxfBlocksSection();
    dxf += dxfLine('0', 'SECTION', '2', 'ENTITIES');
    dxf += hasArcTop ? buildArcTopDXFLwPolyline() : buildStraightDXFLwPolyline();
    dxf += buildInteriorDesignDXFEntities(interiorExportForDownload);
    dxf += dxfLine('0', 'ENDSEC');
    dxf += buildDxfObjectsSection();
    dxf += dxfLine('0', 'EOF');

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
  const selectedInteriorDesignItems = interiorDesigns.filter(design => selectedInteriorDesignIds.includes(design.id));
  const selectedInteriorBounds = selectedInteriorDesignItems.length > 1
    ? getInteriorSelectionBounds(selectedInteriorDesignItems)
    : selectedInteriorDesign ? getInteriorObjectBounds(selectedInteriorDesign) : null;
  const interiorPanelReferences = getInteriorPanelReferences();
  const interiorDraftBounds = getInteriorDraftBounds(interiorShapeDraft);
  const interiorExportData = useMemo(
    () => (showInteriorExportPreview ? collectInteriorDesignContours() : null),
    [showInteriorExportPreview, interiorDesigns, patternEnabled, patternMode, patternThickness, patternMinLength, patternMaxLength, patternRowSpacing, patternGap, patternSeed, patternRoundedEnds, patternRandomRowSpacing, patternRandomGap, alignedSlotRows, alignedSlotBottomRows, alignedSlotBreakWidth, alignedSlotLeftInset, alignedSlotRightInset, alignedSlotMinLength, alignedSlotUseRowSpacing, alignedSlotRowSpacing, alignedSlotStaggerBreaks, interiorClipEnabled, interiorMarginInput]
  );
  const interiorExportDiagnostics = useMemo(
    () => getInteriorExportDiagnostics(interiorExportData),
    [interiorExportData, interiorDesigns]
  );

  const openInteriorDesigner = () => {
    clearMeasureTool();
    resetView();
    setWorkspaceMode('interior');
  };

  const getInlineSvgRenderData = (svgText) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText || '', 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg || doc.querySelector('parsererror')) return null;

    const serializer = new XMLSerializer();
    return {
      rootBox: getSvgRootBox(svg),
      markup: Array.from(svg.children).map(child => serializer.serializeToString(child)).join('')
    };
  };

  const getMeasuredTextBox = (text, fontFamily = 'Arial, sans-serif', letterSpacing = 0) => {
    const safeText = text || 'Text';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    svg.style.position = 'fixed';
    svg.style.left = '-10000px';
    svg.style.top = '-10000px';
    svg.style.width = '1px';
    svg.style.height = '1px';
    svg.style.opacity = '0';
    svg.style.pointerEvents = 'none';
    svg.setAttribute('aria-hidden', 'true');
    textNode.setAttribute('x', '0');
    textNode.setAttribute('y', '0');
    textNode.setAttribute('font-size', '100');
    textNode.setAttribute('font-family', fontFamily);
    textNode.setAttribute('letter-spacing', String(letterSpacing));
    textNode.textContent = safeText;
    svg.appendChild(textNode);
    document.body.appendChild(svg);

    try {
      const box = textNode.getBBox();
      if (box.width > 0.001 && box.height > 0.001) {
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }
    } catch {
      // Fall through to a conservative font box if the browser cannot measure.
    } finally {
      document.body.removeChild(svg);
    }

    return { x: 0, y: -80, width: Math.max(60, safeText.length * 55), height: 100 };
  };

  const renderInteriorDesignBody = (design, interactiveDesign = null) => {
    if (isInteriorGroup(design)) {
      return (design.children || []).map(child => (
        <g key={child.id} pointerEvents={interactiveDesign ? 'auto' : 'none'}>
          {renderInteriorDesignBody(child, interactiveDesign)}
        </g>
      ));
    }

    const bounds = getInteriorObjectBounds(design);
    const x = bounds.x;
    const y = bounds.y;
    const itemWidth = bounds.width;
    const itemHeight = bounds.height;
    const commonClipPath = interiorClipEnabled && design.color === 'white' ? 'url(#interior-margin-clip)' : undefined;
    const shapeFill = design.color === 'black' ? '#000000' : '#ffffff';
    const strokeWidth = Math.max(0.5, n(design.thickness, 8)) * scale;
    const arcPoints = design.kind === 'arc' ? sampleInteriorThreePointArc(design) : [];
    const arcPath = arcPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point[0] * scale} ${point[1] * scale}`).join(' ');
    const eventProps = interactiveDesign ? {
      onMouseDown: (e) => startInteriorDesignDrag(e, interactiveDesign, 'move'),
      onClick: (e) => selectInteriorDesignFromCanvas(e, interactiveDesign.id)
    } : {};
    const cursorStyle = interactiveDesign ? { cursor: interiorDrag?.id === interactiveDesign.id && interiorDrag.mode === 'move' ? 'grabbing' : 'move' } : undefined;

    if (isImportedInteriorSvg(design)) {
      const svgRenderData = getInlineSvgRenderData(design.svgText);
      if (svgRenderData) {
        const rootBox = svgRenderData.rootBox;
        const sx = itemWidth / (rootBox.width || 1);
        const sy = itemHeight / (rootBox.height || 1);
        const tx = (x - rootBox.x * sx) * scale;
        const ty = (y - rootBox.y * sy) * scale;

        return (
          <g clipPath={commonClipPath}>
            <g
              transform={`translate(${tx} ${ty}) scale(${sx * scale} ${sy * scale})`}
              pointerEvents="visiblePainted"
              {...eventProps}
              style={{
                ...(cursorStyle || {}),
                filter: design.color === 'black' ? 'brightness(0)' : 'brightness(0) invert(1)'
              }}
              dangerouslySetInnerHTML={{ __html: svgRenderData.markup }}
            />
          </g>
        );
      }

      return (
        <image
          href={design.href}
          x={x * scale}
          y={y * scale}
          width={itemWidth * scale}
          height={itemHeight * scale}
          preserveAspectRatio="none"
          clipPath={commonClipPath}
          {...eventProps}
          style={{
            ...(cursorStyle || {}),
            filter: design.color === 'black' ? 'brightness(0)' : 'brightness(0) invert(1)'
          }}
        />
      );
    }

    if (design.kind === 'rect') {
      return <rect x={x * scale} y={y * scale} width={itemWidth * scale} height={itemHeight * scale} fill={shapeFill} clipPath={commonClipPath} {...eventProps} style={cursorStyle} />;
    }

    if (design.kind === 'ellipse') {
      return <ellipse cx={(x + itemWidth / 2) * scale} cy={(y + itemHeight / 2) * scale} rx={(itemWidth / 2) * scale} ry={(itemHeight / 2) * scale} fill={shapeFill} clipPath={commonClipPath} {...eventProps} style={cursorStyle} />;
    }

    if (design.kind === 'line') {
      return <line x1={n(design.x1, 0) * scale} y1={n(design.y1, 0) * scale} x2={n(design.x2, 0) * scale} y2={n(design.y2, 0) * scale} stroke={shapeFill} strokeWidth={strokeWidth} strokeLinecap="butt" clipPath={commonClipPath} {...eventProps} style={cursorStyle} />;
    }

    if (design.kind === 'arc') {
      return <path d={arcPath} fill="none" stroke={shapeFill} strokeWidth={strokeWidth} strokeLinecap="butt" strokeLinejoin="round" clipPath={commonClipPath} {...eventProps} style={cursorStyle} />;
    }

    if (design.kind === 'eraser') {
      const path = (design.points || [])
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point[0] * scale} ${point[1] * scale}`)
        .join(' ');

      return (
        <path
          d={path}
          fill="none"
          stroke="#000000"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath={commonClipPath}
          {...eventProps}
          style={cursorStyle}
        />
      );
    }

    if (design.kind === 'text') {
      const textValue = design.text ?? '';
      const rawLetterSpacing = n(design.letterSpacing, 0);
      const measurementLetterSpacing = rawLetterSpacing * (100 / Math.max(1, itemHeight));
      const textBox = getMeasuredTextBox(textValue, design.fontFamily || 'Arial, sans-serif', measurementLetterSpacing);
      const textScaleX = itemWidth / Math.max(0.001, textBox.width);
      const textScaleY = itemHeight / Math.max(0.001, textBox.height);
      const textTranslateX = (x - textBox.x * textScaleX) * scale;
      const textTranslateY = (y - textBox.y * textScaleY) * scale;
      return (
        <g clipPath={commonClipPath} {...eventProps} style={cursorStyle}>
          <rect
            x={x * scale}
            y={y * scale}
            width={itemWidth * scale}
            height={itemHeight * scale}
            fill="transparent"
          />
          {textValue && (
            <text
              x="0"
              y="0"
              fill={shapeFill}
              fontSize="100"
              fontFamily={design.fontFamily || 'Arial, sans-serif'}
              letterSpacing={measurementLetterSpacing}
              transform={`translate(${textTranslateX} ${textTranslateY}) scale(${textScaleX * scale} ${textScaleY * scale})`}
              pointerEvents="none"
            >
              {textValue}
            </text>
          )}
        </g>
      );
    }

    return null;
  };

  if (workspaceMode === 'interior') {
    return (
      <div className="h-screen overflow-hidden bg-slate-100 p-3">
        <div className="h-full w-full bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col min-h-0">
          <div className="shrink-0 border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  clearMeasureTool();
                  cancelInteriorShapeTool();
                  setWorkspaceMode('frame');
                }}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft size={16} />
                Back to frame
              </button>
              <div>
                <h1 className="text-lg font-bold text-slate-800">Interior Designer</h1>
                <p className="text-xs text-slate-500">
                  {activeInteriorShapeTool
                    ? `${getInteriorShapeName(activeInteriorShapeTool)} tool active`
                    : `${safeWidth} x ${safeHeight} mm frame`}
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <details
                className="relative"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <summary className="list-none rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                  Position
                </summary>
                <div className="absolute right-0 top-10 z-30 w-72 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg">
                  <div className="mb-2">
                    <p className="font-semibold text-slate-700">Reference</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Clean main body</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['Center H', 'center-x'],
                      ['Center V', 'center-y'],
                      ['Align Left', 'left'],
                      ['Align Right', 'right'],
                      ['Align Top', 'top'],
                      ['Align Bottom', 'bottom']
                    ].map(([label, mode]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => alignInteriorSelectionToPanel(mode)}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 font-medium text-slate-700 hover:bg-white"
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      ['Left', 'left'],
                      ['Right', 'right'],
                      ['Top', 'top'],
                      ['Bottom', 'bottom']
                    ].map(([label, side]) => (
                      <label key={side} className="text-[11px] font-medium text-slate-500">
                        {label} mm
                        <input
                          type="number"
                          step="0.1"
                          value={positionDistanceInputs[side]}
                          onChange={e => setPositionDistanceInputs(prev => ({ ...prev, [side]: e.target.value }))}
                          onBlur={e => applyInteriorDistanceToPanel(side, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          className="mt-1 w-full rounded-md border border-slate-200 bg-white p-1.5 text-xs text-slate-900"
                        />
                      </label>
                    ))}
                  </div>

                  {interiorPositionMessage && (
                    <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] font-medium text-amber-800">
                      {interiorPositionMessage}
                    </p>
                  )}
                </div>
              </details>
            </div>

            {selectedInteriorDesign && (
              <div className="flex min-w-0 items-center justify-end gap-2">
                <div className="min-w-0 max-w-40">
                  <p className="truncate text-xs font-semibold text-slate-700">
                    {selectedInteriorDesignIds.length > 1 ? `${selectedInteriorDesignIds.length} selected` : selectedInteriorDesign.name}
                  </p>
                  <p className={[
                    'truncate text-[10px] font-medium',
                    selectedInteriorDesign.exportable === false ? 'text-amber-700' : 'text-emerald-700'
                  ].join(' ')}>
                    {selectedInteriorDesign.exportable === false ? 'Needs cleanup' : 'DXF ready'}
                  </p>
                </div>

                {[
                  ['X', 'x'],
                  ['Y', 'y'],
                  ['W', 'width'],
                  ['H', 'height']
                ].map(([label, field]) => (
                  <label key={field} className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    {label}
                    <input
                      type="number"
                      value={selectedInteriorBounds?.[field] ?? selectedInteriorDesign[field] ?? ''}
                      onChange={e => handleInteriorNumberChange(field, e.target.value)}
                      onBlur={() => handleInteriorNumberBlur(field, field === 'width' || field === 'height' ? 100 : 0)}
                      className="w-20 rounded-md border bg-white p-1.5 text-xs text-slate-900"
                    />
                  </label>
                ))}

                {(selectedInteriorDesign.kind === 'line' || selectedInteriorDesign.kind === 'arc' || selectedInteriorDesign.kind === 'eraser') && (
                  <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    T
                    <input
                      type="number"
                      min="0.5"
                      value={selectedInteriorDesign.thickness ?? 8}
                      onChange={e => updateInteriorDesign(selectedInteriorDesign.id, { thickness: e.target.value === '' ? '' : Math.max(0.5, Number(e.target.value)) })}
                      onBlur={() => updateInteriorDesign(selectedInteriorDesign.id, { thickness: Math.max(0.5, n(selectedInteriorDesign.thickness, 8)) })}
                      className="w-16 rounded-md border bg-white p-1.5 text-xs text-slate-900"
                    />
                  </label>
                )}

                {selectedInteriorDesign.kind === 'text' && (
                  <>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      Text
                      <input
                        type="text"
                        value={selectedInteriorDesign.text ?? ''}
                        onChange={e => updateInteriorDesign(selectedInteriorDesign.id, { text: e.target.value })}
                        className="w-44 rounded-md border bg-white p-1.5 text-xs text-slate-900"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      Font
                      <select
                        value={selectedInteriorDesign.fontFamily || interiorFontOptions[0].value}
                        onChange={e => updateInteriorDesign(selectedInteriorDesign.id, { fontFamily: e.target.value })}
                        className="w-36 rounded-md border bg-white p-1.5 text-xs text-slate-900"
                      >
                        {interiorFontOptions.map(font => (
                          <option key={font.value} value={font.value}>
                            {font.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      Spacing
                      <input
                        type="number"
                        step="0.1"
                        value={selectedInteriorDesign.letterSpacing ?? 0}
                        onChange={e => updateInteriorDesign(selectedInteriorDesign.id, { letterSpacing: e.target.value === '' ? '' : Number(e.target.value) })}
                        onBlur={() => updateInteriorDesign(selectedInteriorDesign.id, { letterSpacing: n(selectedInteriorDesign.letterSpacing, 0) })}
                        className="w-16 rounded-md border bg-white p-1.5 text-xs text-slate-900"
                      />
                    </label>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => toggleInteriorAspectLock(selectedInteriorDesign)}
                  className={[
                    'inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition',
                    selectedInteriorDesign.aspectLocked
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  ].join(' ')}
                  title={selectedInteriorDesign.aspectLocked ? 'Unlock proportions' : 'Lock proportions'}
                >
                  {selectedInteriorDesign.aspectLocked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>

                <button
                  type="button"
                  disabled={selectedInteriorDesignIds.length < 2}
                  onClick={groupSelectedInteriorDesigns}
                  className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  title="Group selected"
                >
                  Group
                </button>
                <button
                  type="button"
                  disabled={!selectedInteriorDesign || (!isInteriorGroup(selectedInteriorDesign) && !isImportedInteriorSvg(selectedInteriorDesign))}
                  onClick={ungroupSelectedInteriorDesign}
                  className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  title="Ungroup selected"
                >
                  Ungroup
                </button>

                <div className="flex items-center rounded-md border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => moveSelectedInteriorDesignLayer('back')}
                    className="inline-flex items-center justify-center border-r border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    title="Send to back"
                  >
                    <ArrowDown size={14} />
                    <ArrowDown size={10} className="-ml-2 mt-1" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSelectedInteriorDesignLayer('down')}
                    className="inline-flex items-center justify-center border-r border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    title="Move down one layer"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSelectedInteriorDesignLayer('up')}
                    className="inline-flex items-center justify-center border-r border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    title="Move up one layer"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSelectedInteriorDesignLayer('front')}
                    className="inline-flex items-center justify-center px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    title="Bring to front"
                  >
                    <ArrowUp size={14} />
                    <ArrowUp size={10} className="-ml-2 -mt-1" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={deleteSelectedInteriorDesign}
                  className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100"
                  title="Delete selected SVG"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
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
              onMouseDown={handleInteriorCanvasMouseDown}
                onMouseMove={handleInteriorPreviewMouseMove}
                onMouseUp={() => {
                  finishInteriorInteraction();
                  finishInteriorSelectionBox();
                  finishInteriorShapeDraft();
                }}
                onMouseLeave={() => {
                  setPanState(null);
                  setInteriorDrag(null);
                  setInteriorSelectionBox(null);
                  if (!draggingMeasurement) setHoverSnap(null);
                  setIsInteriorPointerOnBody(false);
                  setIsInteriorPointerOnWhiteSurface(false);
                  if (interiorShapeDraft?.kind !== 'arc') setInteriorShapeDraft(null);
                }}
                onClick={handleInteriorCanvasClick}
                style={{
                  cursor: panState
                    ? 'grabbing'
                    : activeTool === 'measure'
                      ? 'crosshair'
                      : activeInteriorShapeTool
                      ? isInteriorPointerOnBody ? 'crosshair' : 'default'
                      : (interiorSelectionBox || isInteriorPointerOnWhiteSurface)
                      ? 'crosshair'
                      : 'default'
                }}
              >
                <defs>
                  <clipPath id="interior-margin-clip" clipPathUnits="userSpaceOnUse">
                    <path d={buildInteriorMarginPath()} />
                  </clipPath>
                </defs>

                <path
                  d={buildOutlinePath()}
                  fill="#000000"
                  stroke="#0f172a"
                  strokeWidth={2 / viewZoom}
                />

                {showInteriorMarginGuide && interiorMarginBoundarySets.length > 0 && (
                  <path
                    d={buildInteriorMarginPath()}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={2 / viewZoom}
                    strokeDasharray={`${8 / viewZoom} ${5 / viewZoom}`}
                    pointerEvents="none"
                  />
                )}

                {interiorDesigns.map((design) => {
                  const selected = selectedInteriorDesignIds.includes(design.id) || design.id === selectedInteriorDesignId;
                  const bounds = getInteriorObjectBounds(design);
                  const x = bounds.x;
                  const y = bounds.y;
                  const itemWidth = bounds.width;
                  const itemHeight = bounds.height;
                  const commonClipPath = interiorClipEnabled && design.color === 'white' ? 'url(#interior-margin-clip)' : undefined;
                  const shapeFill = design.color === 'black' ? '#000000' : '#ffffff';
                  const strokeWidth = Math.max(0.5, n(design.thickness, 8)) * scale;
                  const arcPoints = design.kind === 'arc' ? sampleInteriorThreePointArc(design) : [];
                  const arcPath = arcPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point[0] * scale} ${point[1] * scale}`).join(' ');

                  return (
                    <g key={design.id} pointerEvents={activeInteriorShapeTool ? 'none' : 'auto'}>
                      {isInteriorGroup(design) && (
                        <g>
                          {renderInteriorDesignBody(design, design)}
                        </g>
                      )}

                      {isImportedInteriorSvg(design) && (
                        renderInteriorDesignBody(design, design)
                      )}

                      {design.kind === 'rect' && (
                        <rect
                          x={x * scale}
                          y={y * scale}
                          width={itemWidth * scale}
                          height={itemHeight * scale}
                          fill={shapeFill}
                          clipPath={commonClipPath}
                          onMouseDown={(e) => startInteriorDesignDrag(e, design, 'move')}
                          onClick={(e) => selectInteriorDesignFromCanvas(e, design.id)}
                          style={{ cursor: interiorDrag?.id === design.id && interiorDrag.mode === 'move' ? 'grabbing' : 'move' }}
                        />
                      )}

                      {design.kind === 'ellipse' && (
                        <ellipse
                          cx={(x + itemWidth / 2) * scale}
                          cy={(y + itemHeight / 2) * scale}
                          rx={(itemWidth / 2) * scale}
                          ry={(itemHeight / 2) * scale}
                          fill={shapeFill}
                          clipPath={commonClipPath}
                          onMouseDown={(e) => startInteriorDesignDrag(e, design, 'move')}
                          onClick={(e) => selectInteriorDesignFromCanvas(e, design.id)}
                          style={{ cursor: interiorDrag?.id === design.id && interiorDrag.mode === 'move' ? 'grabbing' : 'move' }}
                        />
                      )}

                      {design.kind === 'line' && (
                        <line
                          x1={n(design.x1, 0) * scale}
                          y1={n(design.y1, 0) * scale}
                          x2={n(design.x2, 0) * scale}
                          y2={n(design.y2, 0) * scale}
                          stroke={shapeFill}
                          strokeWidth={strokeWidth}
                          strokeLinecap="butt"
                          clipPath={commonClipPath}
                          onMouseDown={(e) => startInteriorDesignDrag(e, design, 'move')}
                          onClick={(e) => selectInteriorDesignFromCanvas(e, design.id)}
                          style={{ cursor: interiorDrag?.id === design.id && interiorDrag.mode === 'move' ? 'grabbing' : 'move' }}
                        />
                      )}

                      {design.kind === 'arc' && (
                        <path
                          d={arcPath}
                          fill="none"
                          stroke={shapeFill}
                          strokeWidth={strokeWidth}
                          strokeLinecap="butt"
                          strokeLinejoin="round"
                          clipPath={commonClipPath}
                          onMouseDown={(e) => startInteriorDesignDrag(e, design, 'move')}
                          onClick={(e) => selectInteriorDesignFromCanvas(e, design.id)}
                          style={{ cursor: interiorDrag?.id === design.id && interiorDrag.mode === 'move' ? 'grabbing' : 'move' }}
                        />
                      )}

                      {design.kind === 'eraser' && (
                        renderInteriorDesignBody(design, design)
                      )}

                      {design.kind === 'text' && (
                        renderInteriorDesignBody(design, design)
                      )}

                      {selected && selectedInteriorDesignIds.length <= 1 && !showInteriorExportPreview && (
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
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeInteriorShapeTool) return;
                              }}
                              style={{ cursor: handle.cursor }}
                            />
                          ))}
                          {getInteriorPointHandles(design).map(handle => (
                            <circle
                              key={handle.id}
                              cx={handle.x * scale}
                              cy={handle.y * scale}
                              r={6 / viewZoom}
                              fill="#2563eb"
                              stroke="white"
                              strokeWidth={1.5 / viewZoom}
                              onMouseDown={(e) => startInteriorDesignDrag(e, design, 'point', handle.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeInteriorShapeTool) return;
                              }}
                              style={{ cursor: handle.cursor }}
                            />
                          ))}
                        </g>
                      )}
                    </g>
                  );
                })}

                {selectedInteriorDesignItems.length > 1 && selectedInteriorBounds && !showInteriorExportPreview && (
                  <g>
                    <rect
                      x={selectedInteriorBounds.x * scale}
                      y={selectedInteriorBounds.y * scale}
                      width={selectedInteriorBounds.width * scale}
                      height={selectedInteriorBounds.height * scale}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth={1.5 / viewZoom}
                      strokeDasharray={`${5 / viewZoom} ${4 / viewZoom}`}
                      pointerEvents="none"
                    />
                    {getInteriorDesignHandles(selectedInteriorBounds).map(handle => (
                      <rect
                        key={`multi-${handle.id}`}
                        x={handle.x * scale - 5 / viewZoom}
                        y={handle.y * scale - 5 / viewZoom}
                        width={10 / viewZoom}
                        height={10 / viewZoom}
                        fill="#2563eb"
                        stroke="white"
                        strokeWidth={1 / viewZoom}
                        onMouseDown={(e) => startInteriorSelectionTransform(e, 'multi-resize', handle.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: handle.cursor }}
                      />
                    ))}
                  </g>
                )}

                {interiorShapeDraft && interiorDraftBounds && (
                  <g pointerEvents="none">
                    {(interiorShapeDraft.kind === 'rect' || interiorShapeDraft.kind === 'text') && (
                      <rect
                        x={interiorDraftBounds.x * scale}
                        y={interiorDraftBounds.y * scale}
                        width={interiorDraftBounds.width * scale}
                        height={interiorDraftBounds.height * scale}
                        fill="#ffffff"
                        opacity="0.75"
                        stroke="#2563eb"
                        strokeWidth={1.5 / viewZoom}
                        strokeDasharray={`${5 / viewZoom} ${4 / viewZoom}`}
                      />
                    )}

                    {interiorShapeDraft.kind === 'text' && (
                      (() => {
                        const textBox = getMeasuredTextBox('Text');
                        const textScaleX = interiorDraftBounds.width / Math.max(0.001, textBox.width);
                        const textScaleY = interiorDraftBounds.height / Math.max(0.001, textBox.height);
                        const textTranslateX = (interiorDraftBounds.x - textBox.x * textScaleX) * scale;
                        const textTranslateY = (interiorDraftBounds.y - textBox.y * textScaleY) * scale;
                        return (
                          <text
                            x="0"
                            y="0"
                            fill="#0f172a"
                            fontSize="100"
                            opacity="0.65"
                            transform={`translate(${textTranslateX} ${textTranslateY}) scale(${textScaleX * scale} ${textScaleY * scale})`}
                          >
                            Text
                          </text>
                        );
                      })()
                    )}

                    {interiorShapeDraft.kind === 'ellipse' && (
                      <ellipse
                        cx={(interiorDraftBounds.x + interiorDraftBounds.width / 2) * scale}
                        cy={(interiorDraftBounds.y + interiorDraftBounds.height / 2) * scale}
                        rx={(interiorDraftBounds.width / 2) * scale}
                        ry={(interiorDraftBounds.height / 2) * scale}
                        fill="#ffffff"
                        opacity="0.75"
                        stroke="#2563eb"
                        strokeWidth={1.5 / viewZoom}
                        strokeDasharray={`${5 / viewZoom} ${4 / viewZoom}`}
                      />
                    )}

                    {interiorShapeDraft.kind === 'line' && (
                      <line
                        x1={interiorShapeDraft.x1 * scale}
                        y1={interiorShapeDraft.y1 * scale}
                        x2={interiorShapeDraft.x2 * scale}
                        y2={interiorShapeDraft.y2 * scale}
                        stroke="#ffffff"
                        strokeWidth={8 * scale}
                        strokeLinecap="butt"
                        opacity="0.8"
                      />
                    )}

                    {interiorShapeDraft.kind === 'arc' && interiorShapeDraft.points.length > 0 && (
                      <>
                        {(() => {
                          const previewPoints = interiorShapeDraft.preview
                            ? [...interiorShapeDraft.points, interiorShapeDraft.preview]
                            : interiorShapeDraft.points;
                          const arcPreview = previewPoints.length >= 3
                            ? sampleInteriorThreePointArc({
                              x1: previewPoints[0][0],
                              y1: previewPoints[0][1],
                              x2: previewPoints[2][0],
                              y2: previewPoints[2][1],
                              x3: previewPoints[1][0],
                              y3: previewPoints[1][1]
                            })
                            : previewPoints;
                          const path = arcPreview.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point[0] * scale} ${point[1] * scale}`).join(' ');
                          return (
                            <path
                              d={path}
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth={8 * scale}
                              strokeLinecap="butt"
                              strokeLinejoin="round"
                              opacity="0.8"
                            />
                          );
                        })()}
                        {interiorShapeDraft.points.map((point, index) => (
                          <circle
                            key={`draft-arc-point-${index}`}
                            cx={point[0] * scale}
                            cy={point[1] * scale}
                            r={5 / viewZoom}
                            fill="#2563eb"
                            stroke="white"
                            strokeWidth={1 / viewZoom}
                          />
                        ))}
                      </>
                    )}

                    {interiorShapeDraft.kind === 'eraser' && (interiorShapeDraft.points || []).length > 0 && (
                      <path
                        d={(interiorShapeDraft.points || []).map((point, index) => `${index === 0 ? 'M' : 'L'} ${point[0] * scale} ${point[1] * scale}`).join(' ')}
                        fill="none"
                        stroke="#000000"
                        strokeWidth={eraserSize * scale}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.75"
                      />
                    )}
                  </g>
                )}

                {interiorSelectionBox && !showInteriorExportPreview && (
                  <rect
                    x={Math.min(interiorSelectionBox.x1, interiorSelectionBox.x2) * scale}
                    y={Math.min(interiorSelectionBox.y1, interiorSelectionBox.y2) * scale}
                    width={Math.abs(interiorSelectionBox.x2 - interiorSelectionBox.x1) * scale}
                    height={Math.abs(interiorSelectionBox.y2 - interiorSelectionBox.y1) * scale}
                    fill="#2563eb"
                    fillOpacity="0.08"
                    stroke="#2563eb"
                    strokeWidth={1.5 / viewZoom}
                    strokeDasharray={`${5 / viewZoom} ${4 / viewZoom}`}
                    pointerEvents="none"
                  />
                )}

                {patternEnabled && patternMode === 'alignedSlots' && !showInteriorExportPreview && (
                  <g pointerEvents="none">
                    {getAlignedSlotClearanceContours().map((contour, index) => (
                      <polygon
                        key={`aligned-clearance-preview-${index}`}
                        points={polygonPoints(contour.points)}
                        fill="#000000"
                      />
                    ))}
                  </g>
                )}

                {patternEnabled && (
                  <g pointerEvents="none">
                    {getPatternContours().map((contour, index) => (
                      <polygon
                        key={`pattern-preview-${index}`}
                        points={polygonPoints(contour.points)}
                        fill="#ffffff"
                      />
                    ))}
                  </g>
                )}

                {measurements.map((m) => {
                  if (m.type === 'angle') return null;

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
                        fill="none"
                        stroke="#000000"
                        strokeWidth={6 / viewZoom}
                        transform={`rotate(${geometry.angle} ${geometry.label[0] * scale} ${geometry.label[1] * scale})`}
                      >
                        {geometry.distance.toFixed(1)} mm
                      </text>

                      <text
                        x={geometry.label[0] * scale}
                        y={geometry.label[1] * scale}
                        fill={color}
                        fontSize={13 / viewZoom}
                        fontWeight="600"
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
                  <rect key={`interior-measure-point-${i}`} x={p[0] * scale - 4 / viewZoom} y={p[1] * scale - 4 / viewZoom} width={8 / viewZoom} height={8 / viewZoom} fill="#2563eb" stroke="white" strokeWidth="1" />
                ))}

                {activeTool === 'measure' && hoverSnap && !draggingMeasurement && (
                  <rect x={hoverSnap[0] * scale - 5 / viewZoom} y={hoverSnap[1] * scale - 5 / viewZoom} width={10 / viewZoom} height={10 / viewZoom} fill="none" stroke="#2563eb" strokeWidth={2 / viewZoom} />
                )}

                {showInteriorExportPreview && (
                  <g pointerEvents="none">
                    {(interiorExportData?.contours || []).map((contour, index) => {
                      const color = contour.role === 'hole'
                        ? '#f59e0b'
                        : contour.source === 'stroke'
                          ? '#22c55e'
                          : '#38bdf8';
                      const points = contour.points.map(([px, py]) => `${px * scale},${py * scale}`).join(' ');

                      return (
                        <polyline
                          key={`${contour.designId}-${index}`}
                          points={points}
                          fill="none"
                          stroke={color}
                          strokeWidth={2 / viewZoom}
                          strokeDasharray={contour.role === 'hole' ? `${7 / viewZoom} ${4 / viewZoom}` : undefined}
                          opacity="0.95"
                        />
                      );
                    })}
                  </g>
                )}
              </svg>

              <div
                className="absolute left-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] items-start gap-2"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
              >
                <details className="relative">
                  <summary className="list-none cursor-pointer select-none rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-white">
                    Margin
                  </summary>
                  <div className="absolute left-0 top-10 z-40 w-52 rounded-lg border border-slate-200 bg-white/95 p-3 text-xs text-slate-700 shadow-lg">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 font-medium">
                        <input
                          type="checkbox"
                          checked={interiorClipEnabled}
                          onChange={e => setInteriorClipEnabled(e.target.checked)}
                        />
                        Clip white designs
                      </label>
                      <div>
                        <label className="text-[11px] text-slate-500">Distance (mm)</label>
                        <input
                          type="number"
                          min="0"
                          value={interiorMarginInput}
                          onFocus={() => setShowInteriorMarginGuide(true)}
                          onChange={e => {
                            setShowInteriorMarginGuide(true);
                            setInteriorMarginInput(e.target.value === '' ? '' : +e.target.value);
                          }}
                          onBlur={handleInteriorMarginBlur}
                          className="mt-1 w-full rounded-md border bg-white p-1.5 text-sm text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                </details>

                <details className="relative">
                  <summary className="list-none cursor-pointer select-none rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-white">
                    Pattern
                  </summary>
                  <div className="absolute left-0 top-10 z-40 max-h-[calc(100vh-11rem)] w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white/95 p-3 text-xs text-slate-700 shadow-lg">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 font-medium">
                        <input
                          type="checkbox"
                          checked={patternEnabled}
                          onChange={e => setPatternEnabled(e.target.checked)}
                        />
                        Enable pattern
                      </label>
                      <div>
                        <label className="text-[11px] text-slate-500">Mode</label>
                        <select
                          value={patternMode}
                          onChange={e => setPatternMode(e.target.value)}
                          className="mt-1 w-full rounded-md border bg-white p-1.5 text-sm text-slate-900"
                        >
                          <option value="random">Random slots</option>
                          <option value="alignedSlots">Aligned slots</option>
                        </select>
                      </div>
                      {patternMode === 'alignedSlots' && (
                        <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={alignedSlotStaggerBreaks}
                            onChange={e => setAlignedSlotStaggerBreaks(e.target.checked)}
                          />
                          Stagger breaks
                        </label>
                      )}
                      {(patternMode === 'random'
                        ? [
                          ['Thickness', patternThickness, setPatternThickness, 1, null, null],
                          ['Min length', patternMinLength, setPatternMinLength, 1, null, null],
                          ['Max length', patternMaxLength, setPatternMaxLength, 1, null, null],
                          ['Row spacing', patternRowSpacing, setPatternRowSpacing, 1, patternRandomRowSpacing, setPatternRandomRowSpacing],
                          ['Gap', patternGap, setPatternGap, 0, patternRandomGap, setPatternRandomGap],
                          ['Seed', patternSeed, setPatternSeed, 1, null, null]
                        ]
                        : [
                          ['Rows count', alignedSlotRows, setAlignedSlotRows, 1, null, null],
                          ...(bottomPanelEnabled ? [['Bottom panel rows', alignedSlotBottomRows, setAlignedSlotBottomRows, 1, null, null]] : []),
                          ['Thickness', patternThickness, setPatternThickness, 1, null, null],
                          ['Break width', alignedSlotBreakWidth, setAlignedSlotBreakWidth, 0, null, null],
                          ['Left inset', alignedSlotLeftInset, setAlignedSlotLeftInset, 0, null, null],
                          ['Right inset', alignedSlotRightInset, setAlignedSlotRightInset, 0, null, null],
                          ['Min segment', alignedSlotMinLength, setAlignedSlotMinLength, 1, null, null],
                          ['Row spacing', alignedSlotUseRowSpacing ? alignedSlotRowSpacing : formatPositionDistance(getAlignedSlotEqualRowSpacing()), setAlignedSlotRowSpacing, 0, alignedSlotUseRowSpacing, setAlignedSlotUseRowSpacing, !alignedSlotUseRowSpacing]
                        ]).map(([label, value, setter, min, randomEnabled, setRandomEnabled, readOnly = false]) => (
                          <div key={label}>
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[11px] text-slate-500">{label}{label === 'Rows count' || label === 'Bottom panel rows' ? '' : ' (mm)'}</label>
                              {setRandomEnabled && (
                                <label className="flex items-center gap-1 text-[10px] text-slate-500">
                                  <input
                                    type="checkbox"
                                    checked={randomEnabled}
                                    onChange={e => {
                                      const checked = e.target.checked;
                                      if (patternMode === 'alignedSlots' && label === 'Row spacing' && checked) {
                                        const displayedSpacing = n(value, getAlignedSlotEqualRowSpacing());
                                        setAlignedSlotRowSpacing(displayedSpacing);
                                      }
                                      setRandomEnabled(checked);
                                    }}
                                  />
                                  {patternMode === 'alignedSlots' && label === 'Row spacing' ? 'Use fixed spacing' : 'Random'}
                                </label>
                              )}
                            </div>
                            <input
                              type="number"
                              min={min}
                              value={value}
                              readOnly={readOnly}
                              onChange={e => setter(e.target.value === '' ? '' : +e.target.value)}
                              onBlur={() => {
                                if (!readOnly) handleNumberBlur(setter, value, min, Infinity, min);
                              }}
                              className={['mt-1 w-full rounded-md border p-1.5 text-sm text-slate-900', readOnly ? 'bg-slate-100' : 'bg-white'].join(' ')}
                            />
                          </div>
                        ))}
                      <label className="flex items-center gap-2 font-medium">
                        <input
                          type="checkbox"
                          checked={patternRoundedEnds}
                          onChange={e => setPatternRoundedEnds(e.target.checked)}
                        />
                        Rounded ends
                      </label>
                      {patternMode === 'random' && (
                        <button
                          type="button"
                          onClick={() => setPatternSeed(prev => Math.max(1, n(prev, 1) + 1))}
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Regenerate
                        </button>
                      )}
                    </div>
                  </div>
                </details>
              </div>

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
                        onClick={() => {
                          const ids = selectedInteriorDesignIds.length ? selectedInteriorDesignIds : [selectedInteriorDesign?.id].filter(Boolean);
                          if (!ids.length) return;
                          applyInteriorDesigns(prev => prev.map(item => ids.includes(item.id) ? applyInteriorColor(item, value) : item));
                        }}
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
                  <p className="text-[11px] text-slate-500">
                    {activeTool === 'measure'
                      ? 'Measure active'
                      : activeInteriorShapeTool ? `${getInteriorShapeName(activeInteriorShapeTool)} active` : 'No tool selected'}
                  </p>
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
                <button
                  type="button"
                  onClick={() => {
                    cancelInteriorShapeTool();
                    setActiveTool(prev => {
                      if (prev === 'measure') {
                        setMeasurePoints([]);
                        setMeasurements([]);
                        setHoverSnap(null);
                        setDraggingMeasurement(null);
                        return null;
                      }

                      setMeasurePoints([]);
                      setHoverSnap(null);
                      setDraggingMeasurement(null);
                      return 'measure';
                    });
                  }}
                  className={[
                    'w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm border',
                    activeTool === 'measure'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  ].join(' ')}
                >
                  <Ruler size={17} />
                  <span className="flex-1 text-left">Measure</span>
                  <span className={[
                    'text-[10px] px-1.5 py-0.5 rounded border',
                    activeTool === 'measure' ? 'border-white/30 text-white/80' : 'border-slate-200 text-slate-400'
                  ].join(' ')}>
                    M
                  </span>
                </button>
                <div className="rounded-lg border border-slate-200 bg-white p-2">
                  <p className="mb-2 text-xs font-semibold text-slate-700">Draw shapes</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      ['rect', Square, 'Rectangle'],
                      ['ellipse', Circle, 'Ellipse'],
                      ['line', Minus, 'Line'],
                      ['arc', DraftingCompass, '3-point arc']
                    ].map(([kind, Icon, label]) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => selectInteriorShapeTool(kind)}
                        className={[
                          'flex items-center gap-2 rounded-md border px-2 py-2 text-xs font-medium transition',
                          activeInteriorShapeTool === kind
                            ? 'border-blue-400 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                        ].join(' ')}
                      >
                        <Icon size={15} />
                        <span className="truncate">{label}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => selectInteriorShapeTool('text')}
                    className={[
                      'mt-1.5 flex w-full items-center gap-2 rounded-md border px-2 py-2 text-xs font-medium transition',
                      activeInteriorShapeTool === 'text'
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    ].join(' ')}
                  >
                    <Type size={15} />
                    <span className="truncate">Text</span>
                  </button>
                  {activeInteriorShapeTool && (
                    <button
                      type="button"
                      onClick={cancelInteriorShapeTool}
                      className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel drawing
                    </button>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-2">
                  <button
                    type="button"
                    onClick={() => selectInteriorShapeTool('eraser')}
                    className={[
                      'flex w-full items-center gap-2 rounded-md border px-2 py-2 text-xs font-medium transition',
                      activeInteriorShapeTool === 'eraser'
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    ].join(' ')}
                  >
                    <Eraser size={15} />
                    <span className="flex-1 text-left">Eraser</span>
                  </button>
                  <label className="mt-2 block text-[11px] font-medium text-slate-500">
                    Size mm
                    <input
                      type="number"
                      min="1"
                      value={eraserSizeInput}
                      onChange={e => setEraserSizeInput(e.target.value === '' ? '' : Number(e.target.value))}
                      onBlur={() => setEraserSizeInput(Math.max(1, n(eraserSizeInput, 20)))}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white p-1.5 text-xs text-slate-900"
                    />
                  </label>
                </div>
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
                <button
                  type="button"
                  onClick={() => setShowInteriorExportPreview(prev => !prev)}
                  className={[
                    'w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm border',
                    showInteriorExportPreview
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  ].join(' ')}
                >
                  <MousePointer2 size={17} />
                  <span className="flex-1 text-left">Preview DXF contours</span>
                </button>
              </div>

              {interiorExportDiagnostics.designCount > 0 && (
                <div className="mt-3 rounded-lg bg-white border p-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700 mb-2">DXF Export Check</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <span>Designs</span>
                    <span className="text-right font-medium">{interiorExportDiagnostics.designCount}</span>
                    <span>Contours</span>
                    <span className="text-right font-medium">{interiorExportDiagnostics.contourCount}</span>
                    <span>Closed</span>
                    <span className="text-right font-medium">{interiorExportDiagnostics.closedCount}</span>
                    <span>Holes</span>
                    <span className="text-right font-medium">{interiorExportDiagnostics.holeCount}</span>
                    <span>Expanded strokes</span>
                    <span className="text-right font-medium">{interiorExportDiagnostics.expandedStrokeCount}</span>
                    <span>Centerline strokes</span>
                    <span className="text-right font-medium">{interiorExportDiagnostics.centerlineStrokeCount}</span>
                    <span>Open lines</span>
                    <span className="text-right font-medium">{interiorExportDiagnostics.openCount}</span>
                  </div>

                  {interiorExportDiagnostics.skippedCount > 0 && (
                    <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                      {interiorExportDiagnostics.skippedCount} design(s) need cleanup before export.
                    </p>
                  )}
                  {interiorExportDiagnostics.centerlineStrokeCount > 0 && (
                    <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                      Some closed strokes are still exported as centerlines. Convert strokes to outlines in the SVG editor for best laser results.
                    </p>
                  )}
                  {showInteriorExportPreview && (
                    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-600">
                      <p><span className="font-semibold text-sky-600">Blue</span>: filled contours</p>
                      <p><span className="font-semibold text-green-600">Green</span>: expanded strokes</p>
                      <p><span className="font-semibold text-amber-600">Amber dashed</span>: detected holes</p>
                    </div>
                  )}
                  {!showInteriorExportPreview && interiorExportDiagnostics.designCount > 0 && (
                    <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-500">
                      Contour details are calculated when previewing or exporting.
                    </p>
                  )}
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

          <details className="rounded-lg bg-slate-50 border px-3 py-2">
            <summary className="cursor-pointer select-none text-sm font-medium text-slate-700">Split panel</summary>
            <div className="mt-2 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={splitPanelEnabled}
                  onChange={e => setSplitPanelEnabled(e.target.checked)}
                />
                Enable vertical split
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Left panel width (mm)</label>
                  <input
                    type="number"
                    min={minSplitPanelWidth}
                    max={maxSplitPanelWidth}
                    value={splitPositionInput}
                    onFocus={() => setFocusedNumberField('splitPosition')}
                    onChange={e => setSplitPositionInput(e.target.value === '' ? '' : +e.target.value)}
                    onBlur={() => handleNumberBlur(setSplitPositionInput, splitPositionInput, minSplitPanelWidth, maxSplitPanelWidth, safeWidth / 2)}
                    className="w-full mt-1 p-2 border rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500">Clear split gap (mm)</label>
                  <input
                    type="number"
                    min="0"
                    value={splitGapInput}
                    onFocus={() => setFocusedNumberField('splitGap')}
                    onChange={e => setSplitGapInput(e.target.value === '' ? '' : +e.target.value)}
                    onBlur={() => handleNumberBlur(setSplitGapInput, splitGapInput, 0, Infinity, 20)}
                    className="w-full mt-1 p-2 border rounded-md text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Split ear length</label>
                  <input
                    type="number"
                    min="1"
                    value={splitEarLengthInput}
                    onFocus={() => setFocusedNumberField('splitEarLength')}
                    onChange={e => setSplitEarLengthInput(e.target.value === '' ? '' : +e.target.value)}
                    onBlur={() => handleNumberBlur(setSplitEarLengthInput, splitEarLengthInput, 1, Infinity, 30)}
                    className="w-full mt-1 p-2 border rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500">Split ear depth</label>
                  <input
                    type="number"
                    min="0"
                    value={splitEarDepthInput}
                    onFocus={() => setFocusedNumberField('splitEarDepth')}
                    onChange={e => setSplitEarDepthInput(e.target.value === '' ? '' : +e.target.value)}
                    onBlur={() => handleNumberBlur(setSplitEarDepthInput, splitEarDepthInput, 0, Infinity, 10)}
                    className="w-full mt-1 p-2 border rounded-md text-sm"
                  />
                </div>
              </div>

              <div className="rounded-md bg-white border p-2">
                <p className="text-xs font-semibold text-slate-700 mb-2">Panel top/bottom ears</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Left top', splitLeftTopEars, setSplitLeftTopEars],
                    ['Left bottom', splitLeftBottomEars, setSplitLeftBottomEars],
                    ['Right top', splitRightTopEars, setSplitRightTopEars],
                    ['Right bottom', splitRightBottomEars, setSplitRightBottomEars]
                  ].map(([label, value, setter]) => (
                    <div key={label}>
                      <label className="text-[11px] text-slate-500">{label}</label>
                      <input
                        type="number"
                        min="1"
                        value={value}
                        onFocus={() => setFocusedNumberField(`split${label.replace(' ', '')}`)}
                        onChange={e => setter(e.target.value === '' ? '' : +e.target.value)}
                        onBlur={() => handleNumberBlur(setter, value, 1, Infinity, 1)}
                        className="w-full mt-1 p-1.5 border rounded-md text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={splitManualMode}
                  onChange={e => setSplitManualMode(e.target.checked)}
                />
                Manual split ears count
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={syncSplitEars}
                  onChange={e => setSyncSplitEars(e.target.checked)}
                />
                Match split ears across gap
              </label>

              {splitManualMode && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">Left cut ears</label>
                    <input
                      type="number"
                      min="1"
                      value={splitLeftCutEars}
                      onFocus={() => setFocusedNumberField('splitLeftCutEars')}
                      onChange={e => setSplitLeftCutEars(e.target.value === '' ? '' : +e.target.value)}
                      onBlur={() => handleNumberBlur(setSplitLeftCutEars, splitLeftCutEars, 1, Infinity, 1)}
                      className="w-full mt-1 p-2 border rounded-md text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500">Right cut ears</label>
                    <input
                      type="number"
                      min="1"
                      value={splitRightCutEars}
                      onFocus={() => setFocusedNumberField('splitRightCutEars')}
                      onChange={e => setSplitRightCutEars(e.target.value === '' ? '' : +e.target.value)}
                      onBlur={() => handleNumberBlur(setSplitRightCutEars, splitRightCutEars, 1, Infinity, 1)}
                      disabled={syncSplitEars}
                      className={[
                        'w-full mt-1 p-2 border rounded-md text-sm',
                        syncSplitEars ? 'bg-slate-100 text-slate-400' : ''
                      ].join(' ')}
                    />
                  </div>
                </div>
              )}
            </div>
          </details>

          <details className="rounded-lg bg-slate-50 border px-3 py-2">
            <summary className="cursor-pointer select-none text-sm font-medium text-slate-700">Add bottom panel</summary>
            <div className="mt-2 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={bottomPanelEnabled}
                  onChange={e => setBottomPanelEnabled(e.target.checked)}
                />
                Add bottom panel
              </label>

              {bottomPanelEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500">Bottom panel height (mm)</label>
                      <input
                        type="number"
                        min={minPanelSize}
                        value={bottomPanelHeightInput}
                        onFocus={() => setFocusedNumberField('bottomPanelHeight')}
                        onChange={e => setBottomPanelHeightInput(e.target.value === '' ? '' : +e.target.value)}
                        onBlur={() => handleNumberBlur(setBottomPanelHeightInput, bottomPanelHeightInput, minPanelSize, Infinity, 400)}
                        className="w-full mt-1 p-2 border rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Gap (mm)</label>
                      <input
                        type="number"
                        value={bottomPanelGap}
                        readOnly
                        className="w-full mt-1 p-2 border rounded-md bg-slate-100 text-slate-600 text-sm"
                      />
                    </div>
                  </div>

                  {manualMode && (
                    <div>
                      <label className="text-xs text-slate-500">Bottom panel vertical ears</label>
                      <input
                        type="number"
                        min="1"
                        value={bottomPanelVEars}
                        onChange={e => setBottomPanelVEars(e.target.value === '' ? '' : +e.target.value)}
                        onBlur={() => handleNumberBlur(setBottomPanelVEars, bottomPanelVEars, 1, Infinity, 1)}
                        className="w-full mt-1 p-2 border rounded-md text-sm"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Horizontal ears use the main horizontal ear count. Ear size uses the main ear size controls.</p>
                    </div>
                  )}
                </>
              )}
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
