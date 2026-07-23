import { useEffect, useMemo, useRef, useState } from 'react';
import { svgPathProperties } from 'svg-path-properties';
import { SVGPathData, SVGPathDataTransformer, encodeSVGPath } from 'svg-pathdata';
import ClipperLib from 'clipper-lib';
import opentype from 'opentype.js';
import {
  builtInPresentationDecorations as projectPresentationDecorations,
  fallbackPresentationDecorationUrl,
  legacyPresentationDecorationAliases
} from './presentationDecorations';
import { interiorFontOptions } from './interiorFonts';
import {
  Ruler,
  Plus,
  Trash2,
  Wrench,
  MousePointer2,
  ArrowUp,
  ArrowDown,
  PenLine,
  DraftingCompass,
  Lock,
  Unlock,
  Square,
  Circle,
  Type,
  Upload,
  Minus,
  Eraser,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

const projectSvgLibraryModules = import.meta.glob('./assets/svg-library/**/*.svg', {
  query: '?raw',
  import: 'default'
});

const projectSvgLibraryItems = Object.entries(projectSvgLibraryModules)
  .map(([path, loader]) => {
    const fileName = path.split('/').pop() || 'SVG design.svg';
    const relativePath = path.replace(/^\.\/assets\/svg-library\//, '');
    const parts = relativePath.split('/');
    const folder = parts.length > 1 ? parts[0] : 'General';
    return {
      id: path,
      name: fileName.replace(/\.svg$/i, '').replace(/[-_]+/g, ' '),
      folder,
      path,
      loader
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const projectSvgLibraryFolders = Array.from(new Set(projectSvgLibraryItems.map(item => item.folder)))
  .sort((a, b) => a.localeCompare(b));

const INTERIOR_SVG_LIBRARY_DRAG_TYPE = 'application/x-interior-svg-library';
const INTERIOR_BOARD_DRAG_TYPE = 'application/x-interior-saved-board';
const SVG_LIBRARY_THUMB_SIZE = 96;
const INTERIOR_IMPORTED_SVG_INITIAL_SCALE = 4;
const projectSvgLibraryTextCache = new Map();

const loadProjectSvgLibraryItemText = async (item) => {
  if (!item) return '';
  if (projectSvgLibraryTextCache.has(item.id)) return projectSvgLibraryTextCache.get(item.id);
  const svgText = String(await item.loader() || '');
  projectSvgLibraryTextCache.set(item.id, svgText);
  return svgText;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const MIN_VIEW_ZOOM = 0.1;
const MAX_VIEW_ZOOM = 50;

function Section({ title, defaultOpen = false, alwaysOpen = false, enabled, onToggleEnabled, enabledLabel = 'Enabled', open, onOpenChange, children }) {
  const controlled = open !== undefined;

  const titleRow = onToggleEnabled ? (
    <span className="flex w-full items-center justify-between gap-2">
      <span>{title}</span>
      <label
        className="flex items-center gap-1.5 text-xs font-normal text-slate-500"
        onClick={(e) => e.stopPropagation()}
      >
        <input type="checkbox" checked={enabled} onChange={e => onToggleEnabled(e.target.checked)} />
        {enabledLabel}
      </label>
    </span>
  ) : title;

  if (alwaysOpen) {
    return (
      <div className="rounded-lg bg-slate-50 border px-3 py-2 space-y-2">
        <div className="text-sm font-medium text-slate-700">{titleRow}</div>
        {children}
      </div>
    );
  }

  const summaryProps = controlled
    ? { onClick: (e) => { e.preventDefault(); onOpenChange(!open); } }
    : {};

  return (
    <details className="rounded-lg bg-slate-50 border px-3 py-2" open={controlled ? open : defaultOpen}>
      <summary className="cursor-pointer select-none text-sm font-medium text-slate-700" {...summaryProps}>{titleRow}</summary>
      <div className="mt-2 space-y-3">{children}</div>
    </details>
  );
}

function WorkspaceTabs({ workspaceMode, onSwitch }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
      {[
        ['Frame', 'frame'],
        ['Interior', 'interior'],
        ['Presentation', 'presentation']
      ].map(([label, mode]) => (
        <button
          key={mode}
          type="button"
          onClick={() => onSwitch(mode)}
          className={[
            'rounded-md px-3 py-1.5 text-sm font-semibold transition',
            workspaceMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ViewZoomControls({ viewZoom, setViewZoom, resetView }) {
  return (
    <div className="mb-2 flex items-center gap-1 rounded-lg border bg-white p-1">
      <button
        type="button"
        onClick={() => setViewZoom(z => clamp(z / 1.12, MIN_VIEW_ZOOM, MAX_VIEW_ZOOM))}
        className="flex-1 flex items-center justify-center rounded-md p-1.5 text-slate-600 hover:bg-slate-50"
        title="Zoom out"
      >
        <ZoomOut size={15} />
      </button>
      <button
        type="button"
        onClick={resetView}
        className="flex-1 rounded-md p-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
        title="Reset view"
      >
        {Math.round(viewZoom * 100)}%
      </button>
      <button
        type="button"
        onClick={() => setViewZoom(z => clamp(z * 1.12, MIN_VIEW_ZOOM, MAX_VIEW_ZOOM))}
        className="flex-1 flex items-center justify-center rounded-md p-1.5 text-slate-600 hover:bg-slate-50"
        title="Zoom in"
      >
        <ZoomIn size={15} />
      </button>
    </div>
  );
}

function ToolButton({ id, icon: Icon, label, shortcut, disabled = false, activeTool, setActiveTool, setMeasurePoints, setHoverSnap, setDraggingMeasurement, clearMeasureTool }) {
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
}

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
  const [rightPanelTopOffsetInput, setRightPanelTopOffsetInput] = useState(0);
  const [rightPanelTopOffsetGlueEars, setRightPanelTopOffsetGlueEars] = useState(false);
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
  // When set, this replaces the parametric ear/split/top-shape frame outline entirely: it's a
  // single closed polygon (mm) read from an imported DXF file. Ear placement, split panels, and
  // top-shape controls don't apply to an arbitrary imported outline, so they're bypassed wherever
  // this is set rather than trying to make them understand a shape they can't parametrize.
  const [importedFrameOutline, setImportedFrameOutline] = useState(null);
  const [importedFrameFileName, setImportedFrameFileName] = useState('');
  const [workspaceMode, setWorkspaceMode] = useState('frame');
  const [interiorDesigns, setInteriorDesigns] = useState(() => {
    if (typeof localStorage === 'undefined') return [];
    try {
      const saved = JSON.parse(localStorage.getItem('rectangle-ear-interior-live-canvas') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [selectedInteriorDesignId, setSelectedInteriorDesignId] = useState(null);
  const [selectedInteriorDesignIds, setSelectedInteriorDesignIds] = useState([]);
  const [excludedPatternSlotIds, setExcludedPatternSlotIds] = useState([]);
  const [interiorDrag, setInteriorDrag] = useState(null);
  const [interiorSelectionBox, setInteriorSelectionBox] = useState(null);
  const [isInteriorPointerOnBody, setIsInteriorPointerOnBody] = useState(false);
  const [isInteriorPointerOnWhiteSurface, setIsInteriorPointerOnWhiteSurface] = useState(false);
  const [activeInteriorShapeTool, setActiveInteriorShapeTool] = useState(null);
  const [interiorShapeDraft, setInteriorShapeDraft] = useState(null);
  const [pendingPatternPathSourceId, setPendingPatternPathSourceId] = useState(null);
  const [hoveredPatternPathEdge, setHoveredPatternPathEdge] = useState(null);
  const [eraserSizeInput, setEraserSizeInput] = useState(20);
  const [interiorDimensionDrafts, setInteriorDimensionDrafts] = useState({});
  const [positionDistanceInputs, setPositionDistanceInputs] = useState({ left: '', right: '', top: '', bottom: '' });
  const [interiorPositionMessage, setInteriorPositionMessage] = useState('');
  const [showInteriorExportPreview, setShowInteriorExportPreview] = useState(false);
  const [interiorClipEnabled, setInteriorClipEnabled] = useState(false);
  const [interiorMarginInput, setInteriorMarginInput] = useState(30);
  const [showInteriorMarginGuide, setShowInteriorMarginGuide] = useState(false);
  const [interiorOverlayPanel, setInteriorOverlayPanel] = useState(null);
  const [selectedInteriorSvgLibraryFolder, setSelectedInteriorSvgLibraryFolder] = useState(projectSvgLibraryFolders[0] || 'General');
  const [svgLibraryThumbnails, setSvgLibraryThumbnails] = useState({});
  const [expandedSvgLibraryThumbnail, setExpandedSvgLibraryThumbnail] = useState(null);
  const [savedInteriorBoards, setSavedInteriorBoards] = useState(() => {
    if (typeof localStorage === 'undefined') return [];
    try {
      const saved = JSON.parse(localStorage.getItem('rectangle-ear-saved-interior-boards') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [showInteriorBoardsMenu, setShowInteriorBoardsMenu] = useState(false);
  const [pendingBoardImportId, setPendingBoardImportId] = useState(null);
  const [patternEnabled, setPatternEnabled] = useState(false);
  const [patternMode, setPatternMode] = useState('random');
  const [patternLocked, setPatternLocked] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    try {
      return JSON.parse(localStorage.getItem('rectangle-ear-pattern-lock') || 'null')?.locked ?? false;
    } catch {
      return false;
    }
  });
  const [lockedPatternContours, setLockedPatternContours] = useState(() => {
    if (typeof localStorage === 'undefined') return null;
    try {
      return JSON.parse(localStorage.getItem('rectangle-ear-pattern-lock') || 'null')?.contours ?? null;
    } catch {
      return null;
    }
  });
  const [patternThickness, setPatternThickness] = useState(15);
  const [patternMinLength, setPatternMinLength] = useState(80);
  const [patternMaxLength, setPatternMaxLength] = useState(260);
  const [patternRowSpacing, setPatternRowSpacing] = useState(90);
  const [patternGap, setPatternGap] = useState(90);
  const [patternSeed, setPatternSeed] = useState(1);
  const [patternRoundedEnds, setPatternRoundedEnds] = useState(false);
  const [patternRandomRowSpacing, setPatternRandomRowSpacing] = useState(false);
  const [patternRandomGap, setPatternRandomGap] = useState(false);
  const [patternRandomDirectionEnabled, setPatternRandomDirectionEnabled] = useState(false);
  const [patternRandomDirectionAmount, setPatternRandomDirectionAmount] = useState(10);
  const [alignedSlotRows, setAlignedSlotRows] = useState(6);
  const [alignedSlotBottomRows, setAlignedSlotBottomRows] = useState(2);
  const [alignedSlotBreakWidth, setAlignedSlotBreakWidth] = useState(30);
  const [alignedSlotLeftInset, setAlignedSlotLeftInset] = useState(30);
  const [alignedSlotRightInset, setAlignedSlotRightInset] = useState(30);
  const [alignedSlotMinLength, setAlignedSlotMinLength] = useState(150);
  const [alignedSlotUseRowSpacing, setAlignedSlotUseRowSpacing] = useState(false);
  const [alignedSlotRowSpacing, setAlignedSlotRowSpacing] = useState(80);
  const [alignedSlotStaggerBreaks, setAlignedSlotStaggerBreaks] = useState(false);
  const [alignedSlotRowOffsetInput, setAlignedSlotRowOffsetInput] = useState(0);
  const [presentationItems, setPresentationItems] = useState(() => {
    if (typeof localStorage === 'undefined') return [];
    try {
      const saved = JSON.parse(localStorage.getItem('rectangle-ear-presentation-items') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [selectedPresentationItemId, setSelectedPresentationItemId] = useState(null);
  const [selectedPresentationItemIds, setSelectedPresentationItemIds] = useState([]);
  const [presentationZoom, setPresentationZoom] = useState(1);
  const [presentationPosition, setPresentationPosition] = useState(null);
  const [presentationDrag, setPresentationDrag] = useState(null);
  const [presentationDecorations, setPresentationDecorations] = useState(() => {
    if (typeof localStorage === 'undefined') return [];
    try {
      const saved = JSON.parse(localStorage.getItem('rectangle-ear-presentation-decorations') || '[]');
      return Array.isArray(saved) ? saved.map(item => ({ ...item, imageUrl: item.imageUrl || '' })) : [];
    } catch {
      return [];
    }
  });
  const [presentationDecorationOverrides, setPresentationDecorationOverrides] = useState(() => {
    if (typeof localStorage === 'undefined') return {};
    try {
      const saved = JSON.parse(localStorage.getItem('rectangle-ear-presentation-decoration-overrides') || '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch {
      return {};
    }
  });
  const [loadedInteriorFonts, setLoadedInteriorFonts] = useState({});

  const [activeTool, setActiveTool] = useState(null);
  const [manualFrameEars, setManualFrameEars] = useState({ added: [], deleted: [] });

  // VIEWPORT / CAD CAMERA
  const [viewZoom, setViewZoom] = useState(1);
  const [viewPosition, setViewPosition] = useState(null);
  const [panState, setPanState] = useState(null);
  const lastMiddleClickRef = useRef(0);
  const previewWheelBlockerRef = useRef(null);
  const designFileInputRef = useRef(null);
  const frameDxfFileInputRef = useRef(null);
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
  const interiorSvgLibraryDragRef = useRef(false);
  const interiorSvgLibraryDragItemRef = useRef(null);
  const interiorBoardDragItemRef = useRef(null);
  const positionMessageTimeoutRef = useRef(null);
  const presentationItemsRef = useRef([]);
  const selectedPresentationItemIdRef = useRef(null);
  const selectedPresentationItemIdsRef = useRef([]);
  const presentationUndoStackRef = useRef([]);
  const presentationRedoStackRef = useRef([]);
  const presentationClipboardRef = useRef(null);
  const presentationMousePointRef = useRef(null);
  const presentationClientMouseRef = useRef(null);
  const presentationSvgRef = useRef(null);
  const presentationDecorationFileInputRef = useRef(null);
  const importedSvgHitCacheRef = useRef(new Map());
  const interiorShapeContoursCacheRef = useRef(new Map());
  const interiorPatternPathEdgesCacheRef = useRef(new Map());
  const interiorArcBandPointsCacheRef = useRef(new Map());
  const importedSvgHitMaskCacheRef = useRef(new Map());
  const [, setImportedSvgHitMaskVersion] = useState(0);

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

  const clonePresentationItems = (items) => items.map(item => ({ ...item }));

  const samePresentationItems = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const recordPresentationHistory = (snapshot = presentationItemsRef.current) => {
    const cloned = clonePresentationItems(snapshot);
    const stack = presentationUndoStackRef.current;
    const last = stack[stack.length - 1];
    if (last && samePresentationItems(last, cloned)) return;

    stack.push(cloned);
    if (stack.length > 80) stack.shift();
    presentationRedoStackRef.current = [];
  };

  const applyPresentationItems = (updater, { history = true, selectedId, selectedIds } = {}) => {
    setPresentationItems(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (history && !samePresentationItems(prev, next)) recordPresentationHistory(prev);
      return next;
    });

    if (selectedId !== undefined) {
      setSelectedPresentationItemId(selectedId);
      setSelectedPresentationItemIds(selectedId ? [selectedId] : []);
    }

    if (selectedIds !== undefined) {
      const nextIds = selectedIds.filter(Boolean);
      setSelectedPresentationItemIds(nextIds);
      setSelectedPresentationItemId(nextIds[nextIds.length - 1] || null);
    }
  };

  const restorePresentationHistorySnapshot = (snapshot) => {
    const selectedStillExists = snapshot.some(item => item.id === selectedPresentationItemIdRef.current);
    const remainingSelection = selectedPresentationItemIdsRef.current.filter(id => snapshot.some(item => item.id === id));
    setPresentationItems(clonePresentationItems(snapshot));
    if (!selectedStillExists) setSelectedPresentationItemId(remainingSelection[remainingSelection.length - 1] || null);
    setSelectedPresentationItemIds(remainingSelection);
    setPresentationDrag(null);
  };

  const undoPresentationAction = () => {
    const previous = presentationUndoStackRef.current.pop();
    if (!previous) return;

    presentationRedoStackRef.current.push(clonePresentationItems(presentationItemsRef.current));
    restorePresentationHistorySnapshot(previous);
  };

  const redoPresentationAction = () => {
    const next = presentationRedoStackRef.current.pop();
    if (!next) return;

    presentationUndoStackRef.current.push(clonePresentationItems(presentationItemsRef.current));
    restorePresentationHistorySnapshot(next);
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
  // Curves get flattened into straight-line segments before export/cutting. Any scheme that
  // allocates a FIXED total segment count for a curve (rather than scaling with its actual
  // physical length) produces long, visibly straight facets once that curve is big enough — e.g.
  // 64 segments over a 1500mm-wide board's top arc is a ~23mm chord per segment. This caps the
  // chord length instead, so curves stay smooth at laser-cutting scale regardless of size.
  const MAX_CURVE_CHORD_MM = 0.35;
  // Live editing (dragging, hovering, panning/zooming, selection outlines) redraws every visible
  // shape's full point array on every React re-render — at MAX_CURVE_CHORD_MM's export-grade
  // density that means rebuilding+repainting SVG polygons with thousands of points many times a
  // second, which is what actually made the whole app feel sluggish (not just recomputation cost,
  // which is already cached elsewhere). Nothing on a laser-cut-sized board is visibly faceted at
  // this coarser chord length on screen, so live/preview paths default to this instead, and only
  // the final DXF export path opts into the finer MAX_CURVE_CHORD_MM.
  const PREVIEW_CURVE_CHORD_MM = 1.5;
  // Circle/ellipse sampling below happens in each SVG's own local units, before its placement
  // matrix scales it to final mm — estimate that scale so segment counts target a physical chord
  // length regardless of how big/small the shape ends up on the board.
  const estimateMatrixScale = (matrix) => {
    const scaleX = Math.hypot(matrix[0], matrix[1]);
    const scaleY = Math.hypot(matrix[2], matrix[3]);
    return Math.max(scaleX, scaleY, 0.0001);
  };
  // Clipper's own arcTolerance param (max deviation from the true curve) only affects its
  // jtRound/etOpenRound join geometry; kept tight for the same "no visible facets" reason as
  // MAX_CURVE_CHORD_MM above.
  const CLIPPER_ARC_TOLERANCE_MM = 0.05;
  const getAdaptiveCircleSegments = (rx, ry, matrix, chordTarget = PREVIEW_CURVE_CHORD_MM) => {
    const scale = estimateMatrixScale(matrix);
    const circumference = 2 * Math.PI * Math.max(Math.abs(rx), Math.abs(ry)) * scale;
    return Math.min(20000, Math.max(24, Math.ceil(circumference / chordTarget)));
  };
  const IMPORTED_SVG_HIT_TOLERANCE_PX = 8;
  const IMPORTED_SVG_HIT_MASK_SIZE = 192;

  const topVisibleCornerMargin = Math.max(0, margin - topEarDepth);

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
  const rightPanelTopOffset = (hasPanelSplit && isAsymmetricTop) ? Math.max(0, n(rightPanelTopOffsetInput, 0)) : 0;
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
  const topEdgeMarginForLayout = topVisibleCornerMargin * angledLengthProjection;
  const bottomEdgeMarginForLayout = Math.max(0, margin - bottomEarDepth) * angledLengthProjection;
  const topEarLengthForLayout = isAngledPanel && topShape === 'straight' ? topEarLength * angledLengthProjection : topEarLength;
  const bottomEarLengthForLayout = isAngledPanel ? bottomEarLength * angledLengthProjection : bottomEarLength;
  const topEdgeNormal = [shearOffset / angledEdgeLength, -angledRun / angledEdgeLength];
  const bottomEdgeNormal = [-shearOffset / angledEdgeLength, angledRun / angledEdgeLength];

  const transformPoint = ([x, y]) => {
    // An imported outline isn't a parametric panel — there's no "corner angle" to shear it by.
    if (importedFrameOutline) return [x, y];

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
  const visibleProjectSvgLibraryItems = projectSvgLibraryItems.filter(item => item.folder === selectedInteriorSvgLibraryFolder);
  const eraserSize = Math.max(1, n(eraserSizeInput, 20));

  const angleFromOffset = (offset) => clamp(90 + Math.atan(offset / safeWidth) * 180 / Math.PI, 30, 150);

  const offsetFromAngle = (angle) => safeWidth * Math.tan((clamp(angle, 30, 150) - 90) * Math.PI / 180);

  const openPresentationImageDb = () => new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }

    const request = indexedDB.open('rectangle-ear-presentation-assets', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('images');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const putPresentationStoredImage = async (key, imageUrl) => {
    if (!key || !imageUrl || !imageUrl.startsWith('data:')) return;
    const db = await openPresentationImageDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').put(imageUrl, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  };

  const getPresentationStoredImage = async (key) => {
    if (!key) return '';
    const db = await openPresentationImageDb();
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readonly');
      const request = tx.objectStore('images').get(key);
      request.onsuccess = () => resolve(request.result || '');
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  };

  const deletePresentationStoredImage = async (key) => {
    if (!key) return;
    const db = await openPresentationImageDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  };

  const sanitizePresentationDecorationForStorage = (decoration) => {
    const { imageUrl, ...rest } = decoration;
    return {
      ...rest,
      hasStoredImage: Boolean(imageUrl?.startsWith?.('data:')),
      imageUrl: imageUrl && !imageUrl.startsWith('data:') ? imageUrl : ''
    };
  };

  const sanitizePresentationItemForStorage = (item) => {
    if (!isPresentationImageItem(item)) return item;
    const { imageUrl, ...rest } = item;
    return rest;
  };

  const clearMeasureTool = () => {
    setActiveTool(null);
    setMeasurePoints([]);
    setMeasurements([]);
    setHoverSnap(null);
    setDraggingMeasurement(null);
  };

  const toolButtonProps = { activeTool, setActiveTool, setMeasurePoints, setHoverSnap, setDraggingMeasurement, clearMeasureTool };

  const getFrameSettingsSnapshot = () => ({
    width, height, leftHeight, middlePosition, middleHeight,
    manualMode, hEars, vEars, leftVEars, rightVEars,
    topEarLengthInput, topEarDepthInput, rightEarLengthInput, rightEarDepthInput,
    bottomEarLengthInput, bottomEarDepthInput, leftEarLengthInput, leftEarDepthInput,
    splitPanelEnabled, splitPositionInput, splitGapInput, splitEarLengthInput, splitEarDepthInput,
    splitManualMode, splitLeftCutEars, splitRightCutEars, syncSplitEars,
    splitLeftTopEars, splitLeftBottomEars, splitRightTopEars, splitRightBottomEars,
    rightPanelTopOffsetInput, rightPanelTopOffsetGlueEars,
    bottomPanelEnabled, bottomPanelHeightInput, bottomPanelVEars,
    topShape, arcRise, transitionHeight, crownWidth, removeSideHorizontalConstraint, cornerAngle
  });

  const applyFrameSettingsSnapshot = (saved) => {
    if (!saved || typeof saved !== 'object') return;
    const setters = {
      width: setWidth, height: setHeight, leftHeight: setLeftHeight, middlePosition: setMiddlePosition, middleHeight: setMiddleHeight,
      manualMode: setManualMode, hEars: setHEars, vEars: setVEars, leftVEars: setLeftVEars, rightVEars: setRightVEars,
      topEarLengthInput: setTopEarLengthInput, topEarDepthInput: setTopEarDepthInput,
      rightEarLengthInput: setRightEarLengthInput, rightEarDepthInput: setRightEarDepthInput,
      bottomEarLengthInput: setBottomEarLengthInput, bottomEarDepthInput: setBottomEarDepthInput,
      leftEarLengthInput: setLeftEarLengthInput, leftEarDepthInput: setLeftEarDepthInput,
      splitPanelEnabled: setSplitPanelEnabled, splitPositionInput: setSplitPositionInput,
      splitGapInput: setSplitGapInput, splitEarLengthInput: setSplitEarLengthInput, splitEarDepthInput: setSplitEarDepthInput,
      splitManualMode: setSplitManualMode, splitLeftCutEars: setSplitLeftCutEars, splitRightCutEars: setSplitRightCutEars,
      syncSplitEars: setSyncSplitEars, splitLeftTopEars: setSplitLeftTopEars, splitLeftBottomEars: setSplitLeftBottomEars,
      splitRightTopEars: setSplitRightTopEars, splitRightBottomEars: setSplitRightBottomEars,
      rightPanelTopOffsetInput: setRightPanelTopOffsetInput, rightPanelTopOffsetGlueEars: setRightPanelTopOffsetGlueEars,
      bottomPanelEnabled: setBottomPanelEnabled, bottomPanelHeightInput: setBottomPanelHeightInput, bottomPanelVEars: setBottomPanelVEars,
      topShape: setTopShape, arcRise: setArcRise, transitionHeight: setTransitionHeight, crownWidth: setCrownWidth,
      removeSideHorizontalConstraint: setRemoveSideHorizontalConstraint, cornerAngle: setCornerAngle
    };
    Object.entries(setters).forEach(([key, setter]) => {
      if (saved[key] !== undefined) setter(saved[key]);
    });
  };

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = JSON.parse(localStorage.getItem('rectangle-ear-frame-settings') || 'null');
      applyFrameSettingsSnapshot(saved);
    } catch {
      // Ignore corrupt storage.
    }
  }, []);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('rectangle-ear-frame-settings', JSON.stringify(getFrameSettingsSnapshot()));
    } catch {
      // Avoid crashing when browser storage is full.
    }
  }, [
    width, height, leftHeight, middlePosition, middleHeight,
    manualMode, hEars, vEars, leftVEars, rightVEars,
    topEarLengthInput, topEarDepthInput, rightEarLengthInput, rightEarDepthInput,
    bottomEarLengthInput, bottomEarDepthInput, leftEarLengthInput, leftEarDepthInput,
    splitPanelEnabled, splitPositionInput, splitGapInput, splitEarLengthInput, splitEarDepthInput,
    splitManualMode, splitLeftCutEars, splitRightCutEars, syncSplitEars,
    splitLeftTopEars, splitLeftBottomEars, splitRightTopEars, splitRightBottomEars,
    rightPanelTopOffsetInput, rightPanelTopOffsetGlueEars,
    bottomPanelEnabled, bottomPanelHeightInput, bottomPanelVEars,
    topShape, arcRise, transitionHeight, crownWidth, removeSideHorizontalConstraint, cornerAngle
  ]);

  useEffect(() => {
    interiorDesignsRef.current = interiorDesigns;
  }, [interiorDesigns]);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('rectangle-ear-saved-interior-boards', JSON.stringify(savedInteriorBoards));
      } catch {
        // Avoid crashing when browser storage is full.
      }
    }
  }, [savedInteriorBoards]);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('rectangle-ear-interior-live-canvas', JSON.stringify(interiorDesigns));
      } catch {
        // Avoid crashing when browser storage is full.
      }
    }
  }, [interiorDesigns]);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('rectangle-ear-pattern-lock', JSON.stringify({ locked: patternLocked, contours: lockedPatternContours }));
      } catch {
        // Avoid crashing when browser storage is full.
      }
    }
  }, [patternLocked, lockedPatternContours]);

  useEffect(() => {
    presentationItemsRef.current = presentationItems;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('rectangle-ear-presentation-items', JSON.stringify(presentationItems.map(sanitizePresentationItemForStorage)));
      } catch {
        // Avoid crashing when browser storage is full.
      }
    }
  }, [presentationItems]);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      presentationDecorations.forEach(decoration => {
        if (decoration.imageUrl?.startsWith?.('data:')) {
          putPresentationStoredImage(`decoration:${decoration.id}`, decoration.imageUrl).catch(() => {});
        }
      });
      try {
        localStorage.setItem(
          'rectangle-ear-presentation-decorations',
          JSON.stringify(presentationDecorations.map(sanitizePresentationDecorationForStorage))
        );
      } catch {
        // Avoid crashing when browser storage is full.
      }
    }
  }, [presentationDecorations]);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      Object.entries(presentationDecorationOverrides).forEach(([id, override]) => {
        if (override?.imageUrl?.startsWith?.('data:')) {
          putPresentationStoredImage(`override:${id}`, override.imageUrl).catch(() => {});
        }
      });
      const metadata = Object.fromEntries(
        Object.entries(presentationDecorationOverrides).map(([id, override]) => {
          const { imageUrl, ...rest } = override || {};
          return [id, {
            ...rest,
            hasStoredImage: Boolean(imageUrl?.startsWith?.('data:')),
            imageUrl: imageUrl && !imageUrl.startsWith('data:') ? imageUrl : ''
          }];
        })
      );
      try {
        localStorage.setItem('rectangle-ear-presentation-decoration-overrides', JSON.stringify(metadata));
      } catch {
        // Avoid crashing when browser storage is full.
      }
    }
  }, [presentationDecorationOverrides]);

  useEffect(() => {
    const style = document.createElement('style');
    style.setAttribute('data-interior-fonts', 'true');
    style.textContent = interiorFontOptions
      .map(font => `@font-face{font-family:${JSON.stringify(font.value)};src:url(${font.url}) format("truetype");font-display:block;}`)
      .join('\n');
    document.head.appendChild(style);

    let cancelled = false;
    Promise.all(interiorFontOptions.map(async font => {
      const response = await fetch(font.url);
      const buffer = await response.arrayBuffer();
      return [font.value, opentype.parse(buffer)];
    }))
      .then(entries => {
        if (!cancelled) setLoadedInteriorFonts(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setLoadedInteriorFonts({});
      });

    return () => {
      cancelled = true;
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateStoredImages = async () => {
      const hydratedDecorations = await Promise.all(presentationDecorations.map(async decoration => {
        if (decoration.imageUrl || !decoration.hasStoredImage) return decoration;
        const imageUrl = await getPresentationStoredImage(`decoration:${decoration.id}`).catch(() => '');
        return imageUrl ? { ...decoration, imageUrl } : decoration;
      }));

      if (!cancelled && hydratedDecorations.some((decoration, index) => decoration !== presentationDecorations[index])) {
        setPresentationDecorations(hydratedDecorations);
      }

      const overrideEntries = await Promise.all(Object.entries(presentationDecorationOverrides).map(async ([id, override]) => {
        if (override?.imageUrl || !override?.hasStoredImage) return [id, override];
        const imageUrl = await getPresentationStoredImage(`override:${id}`).catch(() => '');
        return [id, imageUrl ? { ...override, imageUrl } : override];
      }));
      const hydratedOverrides = Object.fromEntries(overrideEntries);

      if (!cancelled && Object.entries(hydratedOverrides).some(([id, override]) => override !== presentationDecorationOverrides[id])) {
        setPresentationDecorationOverrides(hydratedOverrides);
      }
    };

    hydrateStoredImages().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const normalizeDecorationName = (value) => String(value || '').trim().toLowerCase();
    const localToProjectIds = Object.fromEntries(
      presentationDecorations
        .map(decoration => [decoration.id, legacyPresentationDecorationAliases[normalizeDecorationName(decoration.name)]])
        .filter(([, projectId]) => projectId)
    );
    const localIds = Object.keys(localToProjectIds);
    if (!localIds.length) return;

    localIds.forEach(id => {
      deletePresentationStoredImage(`decoration:${id}`).catch(() => {});
    });
    setPresentationDecorations(prev => prev.filter(decoration => !localToProjectIds[decoration.id]));
    setPresentationItems(prev => prev.map(item => (
      localToProjectIds[item.sourceDecorationId]
        ? { ...item, sourceDecorationId: localToProjectIds[item.sourceDecorationId], imageUrl: undefined }
        : item
    )));
  }, []);

  useEffect(() => {
    selectedPresentationItemIdRef.current = selectedPresentationItemId;
  }, [selectedPresentationItemId]);

  useEffect(() => {
    selectedPresentationItemIdsRef.current = selectedPresentationItemIds;
  }, [selectedPresentationItemIds]);

  useEffect(() => {
    selectedInteriorDesignIdRef.current = selectedInteriorDesignId;
  }, [selectedInteriorDesignId]);

  useEffect(() => {
    selectedInteriorDesignIdsRef.current = selectedInteriorDesignIds;
  }, [selectedInteriorDesignIds]);

  useEffect(() => {
    setInteriorDimensionDrafts({});
  }, [selectedInteriorDesignId, selectedInteriorDesignIds.length]);

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
    const handleWindowMouseMove = (e) => {
      presentationClientMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !isTextEditingTarget(e.target)) {
        e.preventDefault();
        if (workspaceMode === 'interior') {
          if (e.shiftKey) {
            redoInteriorDesignAction();
          } else {
            undoInteriorDesignAction();
          }
        } else if (workspaceMode === 'presentation') {
          if (e.shiftKey) {
            redoPresentationAction();
          } else {
            undoPresentationAction();
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !isTextEditingTarget(e.target)) {
        if (workspaceMode === 'interior') {
          e.preventDefault();
          copySelectedInteriorDesign();
        } else if (workspaceMode === 'presentation') {
          e.preventDefault();
          copySelectedPresentationItem();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !isTextEditingTarget(e.target)) {
        if (workspaceMode === 'interior') {
          e.preventDefault();
          pasteInteriorDesign();
        } else if (workspaceMode === 'presentation') {
          e.preventDefault();
          pastePresentationItem();
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
        setPresentationDrag(null);
        setPendingPatternPathSourceId(null);
        setHoveredPatternPathEdge(null);
      }

      if (!isTextEditingTarget(e.target) && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (workspaceMode === 'presentation' && selectedPresentationItemIdRef.current) {
          e.preventDefault();
          deleteSelectedPresentationItem();
          return;
        }
        setMeasurements(prev => prev.filter(m => !m.selected));
        setDraggingMeasurement(null);
      }
    };

    const handleMouseUp = () => {
      setExpandedSvgLibraryThumbnail(null);
      finishInteriorInteraction();
      setPresentationDrag(prev => {
        if (prev?.startItems && samePresentationItems(prev.startItems, presentationItemsRef.current)) {
          const last = presentationUndoStackRef.current[presentationUndoStackRef.current.length - 1];
          if (last && samePresentationItems(last, prev.startItems)) {
            presentationUndoStackRef.current.pop();
          }
        }
        return null;
      });
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [workspaceMode, presentationPosition, presentationZoom]);

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

  const isManualEarDeleted = (orientation, pos, tolerance = 0.5) => (
    manualFrameEars.deleted.some(ear => (
      ear.orientation === orientation && Math.abs(n(ear.pos, 0) - pos) <= tolerance
    ))
  );

  const getAddedManualEarsForOrientation = (orientation) => (
    manualFrameEars.added.filter(ear => ear.orientation === orientation)
  );

  const normalizeEarStart = (start, min, max) => clamp(start, Math.min(min, max), Math.max(min, max));

  const applyManualTopArcEarEdits = (ranges, arc) => {
    if (!arc) return ranges;

    const filtered = ranges.filter(range => !isManualEarDeleted('top-arc', (range.start + range.end) / 2, 1));
    const added = getAddedManualEarsForOrientation('top-arc')
      .map(ear => {
        const center = clamp(n(ear.pos, 0), 0, arc.arcLength);
        const start = normalizeEarStart(center - topEarLength / 2, 0, Math.max(0, arc.arcLength - topEarLength));
        return {
          start,
          end: Math.min(arc.arcLength, start + topEarLength),
          id: ear.id,
          custom: true
        };
      })
      .filter(range => range.end - range.start > 0.001);

    return [...filtered, ...added].sort((a, b) => a.start - b.start);
  };

  const getTopArcEarRanges = () => {
    const arc = getActiveTopArcData();
    if (!arc || topEarDepth <= 0) return [];

    const ranges = [];

    if (manualMode) {
      const count = Math.max(1, n(hEars, 1));

      if (count === 1) {
        const start = arc.arcLength / 2 - topEarLength / 2;
        ranges.push({ start, end: start + topEarLength });
        return applyManualTopArcEarEdits(ranges, arc);
      }

      const usable = arc.arcLength - 2 * topVisibleCornerMargin - topEarLength;
      if (usable < 0) return applyManualTopArcEarEdits([], arc);

      const spacing = usable / (count - 1);

      for (let i = 0; i < count; i++) {
        const start = topVisibleCornerMargin + i * spacing;
        ranges.push({ start, end: start + topEarLength });
      }

      return applyManualTopArcEarEdits(ranges, arc);
    }

    const usable = arc.arcLength - 2 * topVisibleCornerMargin - topEarLength;
    if (usable < 0) return applyManualTopArcEarEdits([], arc);

    let gaps = 1;
    while (usable / gaps > MAX_SPACING) gaps++;
    while (gaps > 1 && usable / gaps < MIN_SPACING) gaps--;

    const spacing = usable / gaps;

    for (let i = 0; i <= gaps; i++) {
      const start = topVisibleCornerMargin + i * spacing;
      ranges.push({ start, end: start + topEarLength });
    }

    return applyManualTopArcEarEdits(ranges, arc);
  };

  const points = useMemo(() => {
    const ears = [];

    const addAutoSide = (sideLength, orientation, length, depth, edgeMargin = topEarDepth + Math.max(0, margin - depth)) => {
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

    const addManualSide = (sideLength, orientation, count, length, depth, edgeMargin = topEarDepth + Math.max(0, margin - depth)) => {
      if (depth <= 0) return;

      if (count === 1) {
        ears.push({ orientation, pos: sideLength / 2 - length / 2 });
        return;
      }

      const usable = sideLength - 2 * edgeMargin - length;
      if (usable < 0) return;

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

      if (count === 1) {
        ears.push({ orientation, pos: startY + sideLength / 2 - length / 2 });
        return;
      }

      const usable = sideLength - 2 * visibleMargin - length;
      if (usable < 0) return;

      const spacing = usable / (count - 1);
      for (let i = 0; i < count; i++) {
        ears.push({ orientation, pos: startY + visibleMargin + i * spacing });
      }
    };

    if (!manualMode) {
      if (topShape === 'straight') addAutoSide(safeWidth, 'top', topEarLengthForLayout, topEarDepth, leftEarDepth + topEdgeMarginForLayout);
      addAutoSide(safeWidth, 'bottom', bottomEarLengthForLayout, bottomEarDepth, leftEarDepth + bottomEdgeMarginForLayout);

      if (isSplitHeightTop) {
        addAutoVerticalSpan(splitLeftBaseY, bottomBaseY, 'left', leftEarLength, leftEarDepth);
        addAutoVerticalSpan(splitRightBaseY, bottomBaseY, 'right', rightEarLength, rightEarDepth);
      } else {
        addAutoSide(safeHeight, 'left', leftEarLength, leftEarDepth);
        addAutoSide(safeHeight, 'right', rightEarLength, rightEarDepth);
      }
    } else {
      if (topShape === 'straight') addManualSide(safeWidth, 'top', Math.max(1, n(hEars, 1)), topEarLengthForLayout, topEarDepth, leftEarDepth + topEdgeMarginForLayout);
      addManualSide(safeWidth, 'bottom', Math.max(1, n(hEars, 1)), bottomEarLengthForLayout, bottomEarDepth, leftEarDepth + bottomEdgeMarginForLayout);

      if (isSplitHeightTop) {
        addManualVerticalSpan(splitLeftBaseY, bottomBaseY, 'left', Math.max(1, n(leftVEars, 1)), leftEarLength, leftEarDepth);
        addManualVerticalSpan(splitRightBaseY, bottomBaseY, 'right', Math.max(1, n(rightVEars, 1)), rightEarLength, rightEarDepth);
      } else {
        addManualSide(safeHeight, 'left', Math.max(1, n(vEars, 1)), leftEarLength, leftEarDepth);
        addManualSide(safeHeight, 'right', Math.max(1, n(vEars, 1)), rightEarLength, rightEarDepth);
      }
    }

    const filteredGeneratedEars = ears.filter(ear => !isManualEarDeleted(ear.orientation, ear.pos));
    const addedEars = manualFrameEars.added
      .filter(ear => ['top', 'right', 'bottom', 'left'].includes(ear.orientation))
      .map(ear => ({
        orientation: ear.orientation,
        pos: n(ear.pos, 0),
        id: ear.id,
        custom: true
      }));

    return [...filteredGeneratedEars, ...addedEars];
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
    manualFrameEars,
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

  const appendArcSegment = (verts, arc, startS, endS, radialOffset = 0) => {
    const length = Math.abs(endS - startS);
    if (length <= 0.001) return;

    // Segment count scales with this span's own physical length (mm), not a fixed total budget
    // shared across the whole arc — a fixed budget makes long arcs (e.g. a board's full top edge)
    // produce long, visibly straight facets instead of a smooth curve. This feeds the on-screen
    // preview/clip-boundary polygon only — the actual frame DXF export encodes arcs as true DXF
    // ARC/bulge entities (buildArcTopDXFLwPolyline), not these flattened points — so it uses the
    // cheaper preview chord target rather than export-grade density.
    const segments = Math.max(1, Math.ceil(length / PREVIEW_CURVE_CHORD_MM));
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

    const ranges = [];
    if (useManual) {
      const count = Math.max(1, n(countValue, 1));
      if (count === 1) {
        const start = minY + sideLength / 2 - length / 2;
        ranges.push({ start, end: start + length });
      } else {
        const usable = sideLength - 2 * visibleMargin - length;
        if (usable < 0) {
          return [];
        }

        const spacing = usable / (count - 1);
        for (let i = 0; i < count; i++) {
          const start = minY + visibleMargin + i * spacing;
          ranges.push({ start, end: start + length });
        }
      }
    } else {
      const usable = sideLength - 2 * visibleMargin - length;
      if (usable < 0) {
        return [];
      }

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
      appendArcSegment(verts, arc, currentS, ear.start, 0);

      const innerStart = arc.pointAt(ear.start, 0);
      const outerStart = arc.pointAt(ear.start, topEarDepth);
      const outerEnd = arc.pointAt(ear.end, topEarDepth);
      const innerEnd = arc.pointAt(ear.end, 0);

      pushPoint(verts, innerStart);
      pushPoint(verts, outerStart);
      appendArcSegment(verts, arc, ear.start, ear.end, topEarDepth);
      pushPoint(verts, outerEnd);
      pushPoint(verts, innerEnd);

      currentS = ear.end;
    });

    appendArcSegment(verts, arc, currentS, arc.arcLength, 0);
  };

  const getHorizontalEarRanges = (startX, endX, length, depth, edgeMargin, useManual, countValue) => {
    if (depth <= 0 || length <= 0) return [];

    const sideLength = endX - startX;

    const ranges = [];

    if (useManual) {
      const count = Math.max(1, n(countValue, 1));
      if (count === 1) {
        const start = startX + sideLength / 2 - length / 2;
        ranges.push({ start, end: start + length });
        return ranges;
      }

      const usable = sideLength - 2 * edgeMargin - length;
      if (usable < 0) return [];

      const spacing = usable / (count - 1);
      for (let i = 0; i < count; i++) {
        const start = startX + edgeMargin + i * spacing;
        ranges.push({ start, end: start + length });
      }

      return ranges;
    }

    const usable = sideLength - 2 * edgeMargin - length;
    if (usable < 0) return [];

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

    const ranges = [];

    if (useManual) {
      const count = Math.max(1, n(countValue, 1));
      if (count === 1) {
        const start = startS + spanLength / 2 - topEarLength / 2;
        ranges.push({ start, end: start + topEarLength });
        return ranges;
      }

      const usable = spanLength - 2 * topVisibleCornerMargin - topEarLength;
      if (usable < 0) return [];

      const spacing = usable / (count - 1);
      for (let i = 0; i < count; i++) {
        const start = startS + topVisibleCornerMargin + i * spacing;
        ranges.push({ start, end: start + topEarLength });
      }

      return ranges;
    }

    const usable = spanLength - 2 * topVisibleCornerMargin - topEarLength;
    if (usable < 0) return [];

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
      appendArcSegment(verts, arc, currentS, ear.start, 0);

      const innerStart = arc.pointAt(ear.start, 0);
      const outerStart = arc.pointAt(ear.start, topEarDepth);
      const outerEnd = arc.pointAt(ear.end, topEarDepth);
      const innerEnd = arc.pointAt(ear.end, 0);

      pushPoint(verts, innerStart);
      pushPoint(verts, outerStart);
      appendArcSegment(verts, arc, ear.start, ear.end, topEarDepth);
      pushPoint(verts, outerEnd);
      pushPoint(verts, innerEnd);

      currentS = ear.end;
    });

    appendArcSegment(verts, arc, currentS, endS, 0);
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
    const rightPanelEarOffset = rightPanelTopOffsetGlueEars ? 0 : rightPanelTopOffset;
    const rightArcEndPointRaw = arc ? arc.pointAt(rightSplitS, 0) : [rightSplitX, topEarDepth];
    // The arc itself always shifts by the full offset — this is where the visible material actually ends,
    // regardless of whether the ears further down the edge are glued in place.
    const rightArcActualEndY = rightArcEndPointRaw[1] + rightPanelTopOffset;
    const rightSplitTop = [rightArcEndPointRaw[0], rightArcActualEndY];
    const rightSplitBottom = [rightSplitX, bottomBaseY];
    const syncedSplitEarRanges = syncSplitEars
      ? getVerticalEarRanges(splitTop[1], splitBottom[1], splitEarLength, splitEarDepth, splitManualMode, splitLeftCutEars)
      : null;
    // When glued, compute the ear pattern against the ORIGINAL (unshifted) reference so positions match
    // the un-offset baseline, then drop any ear the now-shifted arc would cross into — otherwise the fixed
    // ear notch and the moved arc overlap and produce a self-intersecting outline (a visible spike).
    const idealRightSplitRanges = syncedSplitEarRanges
      || getVerticalEarRanges(bottomBaseY, rightArcEndPointRaw[1] + rightPanelEarOffset, splitEarLength, splitEarDepth, splitManualMode, splitRightCutEars);
    const rightSplitRanges = rightPanelTopOffsetGlueEars
      ? idealRightSplitRanges.filter(range => Math.min(range.start, range.end) >= rightArcActualEndY)
      : idealRightSplitRanges;

    const leftVerts = [...leftTop];
    addVerticalEarsToEdge(leftVerts, splitX, splitTop[1], splitBottom[1], 'right', splitEarLength, splitEarDepth, splitManualMode, splitLeftCutEars, syncedSplitEarRanges);
    bottomLeftToRight.slice().reverse().forEach(point => pushPoint(leftVerts, point));
    grouped.left.forEach(ear => {
      const p = ear.pos;
      leftVerts.push([leftEarDepth, p + leftEarLength], [0, p + leftEarLength], [0, p], [leftEarDepth, p]);
    });

    const rightVerts = rightPanelTopOffset ? rightTop.map(([x, y]) => [x, y + rightPanelTopOffset]) : [...rightTop];
    const rightOuterArcActualEndY = rightVerts[rightVerts.length - 1][1];
    const rightOuterEars = rightPanelTopOffsetGlueEars
      ? grouped.right.filter(ear => ear.pos >= rightOuterArcActualEndY)
      : grouped.right;
    rightOuterEars.forEach(ear => {
      const p = ear.pos + rightPanelEarOffset;
      rightVerts.push(
        [safeWidth - rightEarDepth, p],
        [safeWidth, p],
        [safeWidth, p + rightEarLength],
        [safeWidth - rightEarDepth, p + rightEarLength]
      );
    });
    bottomRightToLeft.forEach(point => pushPoint(rightVerts, point));
    addVerticalEarsToEdge(rightVerts, rightSplitX, rightSplitBottom[1], rightSplitTop[1], 'left', splitEarLength, splitEarDepth, splitManualMode, splitRightCutEars, rightSplitRanges);

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
    if (importedFrameOutline) return importedFrameOutline;

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

  const getPrimaryPanelVertexSets = () => (
    importedFrameOutline ? [importedFrameOutline] : (hasPanelSplit ? getSplitPanelVertexSets() : [buildVertices()])
  );

  const getPanelVertexSets = () => {
    const panels = getPrimaryPanelVertexSets();
    return (bottomPanelEnabled && !importedFrameOutline) ? [...panels, buildBottomPanelVertices()] : panels;
  };

  const snapPoints = hasPanelSplit || bottomPanelEnabled
    ? transformPoints(getPanelVertexSets().flat())
    : transformPoints(buildSnapVertices());

  const appendCleanArcSpan = (verts, arc, startS, endS) => {
    const length = Math.abs(endS - startS);
    // Preview/clip-boundary use only — see appendArcSegment above.
    const segments = Math.max(1, Math.ceil(length / PREVIEW_CURVE_CHORD_MM));
    for (let i = 1; i <= segments; i++) {
      const s = startS + (endS - startS) * (i / segments);
      pushPoint(verts, arc.pointAt(s, 0));
    }
  };

  const getCleanTopSpanVertices = (startX, endX, yOffset = 0) => {
    const arc = getActiveTopArcData();
    if (!arc) {
      const y1 = isSplitHeightTop
        ? safeHeight - (safeLeftHeight + (safeHeight - safeLeftHeight) * ((startX - leftEarDepth) / Math.max(1, safeWidth - leftEarDepth - rightEarDepth))) + topEarDepth
        : topEarDepth;
      const y2 = isSplitHeightTop
        ? safeHeight - (safeLeftHeight + (safeHeight - safeLeftHeight) * ((endX - leftEarDepth) / Math.max(1, safeWidth - leftEarDepth - rightEarDepth))) + topEarDepth
        : topEarDepth;
      return [[startX, y1 + yOffset], [endX, y2 + yOffset]];
    }

    const startS = getArcSAtX(arc, startX);
    const endS = getArcSAtX(arc, endX);
    const verts = [arc.pointAt(startS, 0)];
    appendCleanArcSpan(verts, arc, startS, endS);
    return yOffset ? verts.map(([x, y]) => [x, y + yOffset]) : verts;
  };

  const getCleanMainBodyPanelVertexSets = () => {
    if (importedFrameOutline) return [importedFrameOutline];

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
      const rightTop = getCleanTopSpanVertices(rightSplitX, safeWidth - rightEarDepth, rightPanelTopOffset);

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

  const getPresentationOuterFrameCleanVertexSets = () => {
    const mainTop = getCleanTopSpanVertices(leftEarDepth, safeWidth - rightEarDepth);
    const mainPanel = [
      ...mainTop,
      [safeWidth - rightEarDepth, bottomBaseY],
      [leftEarDepth, bottomBaseY]
    ];

    if (!bottomPanelEnabled) return [mainPanel];

    const yOffset = safeHeight + bottomPanelGap;
    return [
      mainPanel,
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
      const offsetter = new ClipperLib.ClipperOffset(2, CLIPPER_ARC_TOLERANCE_MM * scaleFactor);
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

  const offsetPolygonOutward = (pointsArray, distance) => {
    if (distance <= 0) return [pointsArray];

    const scaleFactor = 1000;
    const source = pointsArray.map(([x, y]) => ({
      X: Math.round(x * scaleFactor),
      Y: Math.round(y * scaleFactor)
    }));
    const sourceArea = Math.abs(polygonArea(pointsArray));

    const solve = (delta) => {
      const offsetter = new ClipperLib.ClipperOffset(2, CLIPPER_ARC_TOLERANCE_MM * scaleFactor);
      offsetter.AddPath(source, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
      const solution = new ClipperLib.Paths();
      offsetter.Execute(solution, delta * scaleFactor);
      return solution
        .map(path => path.map(point => [point.X / scaleFactor, point.Y / scaleFactor]))
        .filter(path => path.length >= 3);
    };

    const positive = solve(distance);
    const positiveArea = positive.reduce((sum, path) => sum + Math.abs(polygonArea(path)), 0);
    if (positive.length && positiveArea > sourceArea) return positive;

    const negative = solve(-distance);
    const negativeArea = negative.reduce((sum, path) => sum + Math.abs(polygonArea(path)), 0);
    if (negative.length && negativeArea > sourceArea) return negative;

    return [];
  };

  const getInteriorMarginBoundarySetsForDistance = (distance) => (
    getCleanMainBodyPanelVertexSets()
      .flatMap(panel => offsetPolygonInward(transformPoints(panel), Math.max(0, n(distance, 30))))
  );

  const interiorMarginBoundarySets = getInteriorMarginBoundarySetsForDistance(interiorMargin);

  const getActivePatternCleanPanelVertexSets = () => getCleanMainBodyPanelVertexSets();

  const getActivePatternPanelBoundarySets = () => (
    getActivePatternCleanPanelVertexSets()
      .map(panel => transformPoints(panel))
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

  const clipPatternSlotToPanel = (points) => {
    const patternPanelBoundarySets = getActivePatternPanelBoundarySets();
    if (!patternPanelBoundarySets.length) return [];

    const subject = cleanClipperPaths([toClipperPath(points)]);
    const clips = cleanClipperPaths(patternPanelBoundarySets.map(toClipperPath));
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

  const getProjectionBoundsFromPointSets = (pointSets, angle) => {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const nx = -uy;
    const ny = ux;
    const points = pointSets.flat();
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
    return getCleanMainBodyPanelVertexSets().map((panel, index) => {
      const boundary = [transformPoints(panel)];
      return {
        panel,
        boundary,
        index,
        bounds: getProjectionBoundsFromPointSets(boundary, angle)
      };
    });
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
    const rowOffset = n(alignedSlotRowOffsetInput, 0);
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
        rowNormals.push((alignedSlotUseRowSpacing
          ? minNormal + rowSpace + thickness / 2 + rowIndex * (thickness + fixedRowSpacing)
          : minNormal + rowSpace * (rowIndex + 1) + thickness * (rowIndex + 0.5)) + rowOffset);
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

  const clipPolygonToBoundary = (points, boundaryPointSets) => {
    const subject = cleanClipperPaths([toClipperPath(points)]);
    const clips = cleanClipperPaths(boundaryPointSets.map(toClipperPath));
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

          clipPolygonToBoundary(rawStrip, ref.boundary).forEach(points => {
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

            clipPolygonToBoundary(rawSlot, ref.boundary).forEach(points => {
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
    const patternPanelBoundarySets = getActivePatternPanelBoundarySets();
    if (!patternEnabled || patternPanelBoundarySets.length === 0) return [];

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
    const allPoints = patternPanelBoundarySets.flat();
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

        let cx = ux * centerProjection + nx * lineNormal;
        let cy = uy * centerProjection + ny * lineNormal;

        if (patternRandomDirectionEnabled) {
          const shiftAmount = Math.max(0, n(patternRandomDirectionAmount, 10));
          const shiftAngle = random() * Math.PI * 2;
          cx += Math.cos(shiftAngle) * shiftAmount;
          cy += Math.sin(shiftAngle) * shiftAmount;
        }

        const rawSlot = patternRoundedEnds
          ? makeRoundedSlotPolygon(cx, cy, length, thickness, angle)
          : makeSlotPolygon(cx, cy, length, thickness, angle);

        clipPatternSlotToPanel(rawSlot).forEach(points => {
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

    return contours.filter(contour => !excludedPatternSlotIds.includes(contour.designId));
  };

  const getPatternContours = () => {
    if (patternLocked && lockedPatternContours) return lockedPatternContours;
    if (patternMode === 'alignedSlots') return getAlignedSlotPatternContours();
    return getRandomSlotPatternContours();
  };

  const lockCurrentPattern = () => {
    const snapshot = getPatternContours();
    setLockedPatternContours(snapshot);
    setPatternLocked(true);
  };

  const unlockPattern = () => {
    setPatternLocked(false);
    setLockedPatternContours(null);
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
  }, [workspaceMode]);

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
    const svg = e.currentTarget.ownerSVGElement
      || e.target.ownerSVGElement
      || (typeof e.currentTarget.querySelector === 'function' ? e.currentTarget.querySelector('svg') : null)
      || e.currentTarget;
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

  const distanceCanvasPointToSegment = (point, a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= 0.000001) {
      return { distance: Math.hypot(point.x - a[0], point.y - a[1]), t: 0 };
    }

    const t = clamp(((point.x - a[0]) * dx + (point.y - a[1]) * dy) / lengthSq, 0, 1);
    const px = a[0] + dx * t;
    const py = a[1] + dy * t;
    return { distance: Math.hypot(point.x - px, point.y - py), t };
  };

  const getFrameEarToolTolerance = () => 22 / Math.max(0.0001, scale * viewZoom);

  const getNearestTransformedArcPoint = (arc, point) => {
    let best = { s: 0, distance: Infinity };

    for (let i = 0; i <= 256; i++) {
      const s = arc.arcLength * (i / 256);
      const transformed = transformPoint(arc.pointAt(s, 0));
      const distance = Math.hypot(point.x - transformed[0], point.y - transformed[1]);
      if (distance < best.distance) best = { s, distance };
    }

    return best;
  };

  const getFrameEarAddTarget = (point) => {
    const candidates = [];

    const getClearGaps = (edgeStart, edgeEnd, ears, length) => {
      const sorted = [...ears]
        .map(ear => ({ start: n(ear.pos, 0), end: n(ear.pos, 0) + length }))
        .sort((a, b) => a.start - b.start);
      const gaps = [];
      let cursor = edgeStart;

      sorted.forEach(ear => {
        if (ear.start - cursor > 0.001) gaps.push({ start: cursor, end: ear.start });
        cursor = Math.max(cursor, ear.end);
      });

      if (edgeEnd - cursor > 0.001) gaps.push({ start: cursor, end: edgeEnd });
      return gaps;
    };

    const addLineGapCandidates = (orientation, edgeStart, edgeEnd, fixedAxis, length) => {
      const edgeMin = Math.min(edgeStart, edgeEnd);
      const edgeMax = Math.max(edgeStart, edgeEnd);
      const ears = [...(grouped[orientation] || [])].sort((a, b) => a.pos - b.pos);
      const gaps = getClearGaps(edgeMin, edgeMax, ears, length);

      gaps.forEach(gap => {
        const start = orientation === 'top' || orientation === 'bottom'
          ? [gap.start, fixedAxis]
          : [fixedAxis, gap.start];
        const end = orientation === 'top' || orientation === 'bottom'
          ? [gap.end, fixedAxis]
          : [fixedAxis, gap.end];
        const hit = distanceCanvasPointToSegment(point, transformPoint(start), transformPoint(end));
        const center = (gap.start + gap.end) / 2;
        candidates.push({
          orientation,
          distance: hit.distance,
          pos: center - length / 2
        });
      });
    };

    const addArcGapCandidates = (arc) => {
      const sorted = getTopArcEarRanges().sort((a, b) => a.start - b.start);
      const gaps = [];
      let cursor = 0;

      sorted.forEach(ear => {
        if (ear.start - cursor > 0.001) gaps.push({ start: cursor, end: ear.start });
        cursor = Math.max(cursor, ear.end);
      });

      if (arc.arcLength - cursor > 0.001) gaps.push({ start: cursor, end: arc.arcLength });

      gaps.forEach(gap => {
        const center = (gap.start + gap.end) / 2;
        const hitPoint = transformPoint(arc.pointAt(center, 0));
        const distance = Math.hypot(point.x - hitPoint[0], point.y - hitPoint[1]);
        candidates.push({
          orientation: 'top-arc',
          distance,
          pos: center
        });
      });
    };

    const addWholeLineCandidate = (orientation, start, end, length) => {
      const hit = distanceCanvasPointToSegment(point, transformPoint(start), transformPoint(end));
      const center = orientation === 'top' || orientation === 'bottom'
        ? (start[0] + end[0]) / 2
        : (start[1] + end[1]) / 2;
      candidates.push({
        orientation,
        distance: hit.distance,
        pos: center - length / 2
      });
    };

    if (hasArcTop) {
      const arc = getActiveTopArcData();
      if (arc && topEarDepth > 0 && topEarLength > 0) {
        addArcGapCandidates(arc);
      }
    } else if (topEarDepth > 0 && topEarLengthForLayout > 0) {
      addLineGapCandidates('top', leftEarDepth, safeWidth - rightEarDepth, topEarDepth, topEarLengthForLayout);
    }

    if (bottomEarDepth > 0 && bottomEarLengthForLayout > 0) {
      addLineGapCandidates('bottom', leftEarDepth, safeWidth - rightEarDepth, bottomBaseY, bottomEarLengthForLayout);
    }
    if (leftEarDepth > 0 && leftEarLength > 0) {
      const start = getStartPoint();
      const end = [leftEarDepth, bottomBaseY];
      if (Math.abs(end[1] - start[1]) >= leftEarLength) {
        addLineGapCandidates('left', start[1], end[1], leftEarDepth, leftEarLength);
      } else {
        addWholeLineCandidate('left', start, end, leftEarLength);
      }
    }
    if (rightEarDepth > 0 && rightEarLength > 0) {
      const start = getRightTopBasePoint();
      const end = [safeWidth - rightEarDepth, bottomBaseY];
      if (Math.abs(end[1] - start[1]) >= rightEarLength) {
        addLineGapCandidates('right', start[1], end[1], safeWidth - rightEarDepth, rightEarLength);
      } else {
        addWholeLineCandidate('right', start, end, rightEarLength);
      }
    }

    const best = candidates.sort((a, b) => a.distance - b.distance)[0];
    return best && best.distance <= getFrameEarToolTolerance() ? best : null;
  };

  const addManualFrameEar = (target) => {
    setManualFrameEars(prev => ({
      added: [...prev.added, { id: crypto.randomUUID(), orientation: target.orientation, pos: target.pos }],
      deleted: prev.deleted.filter(ear => (
        ear.orientation !== target.orientation || Math.abs(n(ear.pos, 0) - target.pos) > 1
      ))
    }));
  };

  const getFrameEarDescriptors = () => {
    if (importedFrameOutline) return [];
    const descriptors = [];

    if (hasArcTop) {
      const arc = getActiveTopArcData();
      if (arc) {
        getTopArcEarRanges().forEach(ear => {
          const centerS = (ear.start + ear.end) / 2;
          descriptors.push({
            orientation: 'top-arc',
            pos: centerS,
            id: ear.id,
            custom: Boolean(ear.custom),
            center: transformPoint(arc.pointAt(centerS, topEarDepth / 2))
          });
        });
      }
    } else {
      grouped.top.forEach(ear => {
        descriptors.push({
          orientation: 'top',
          pos: ear.pos,
          id: ear.id,
          custom: Boolean(ear.custom),
          center: transformPoint([ear.pos + topEarLengthForLayout / 2, topEarDepth / 2])
        });
      });
    }

    grouped.right.forEach(ear => descriptors.push({
      orientation: 'right',
      pos: ear.pos,
      id: ear.id,
      custom: Boolean(ear.custom),
      center: transformPoint([safeWidth - rightEarDepth / 2, ear.pos + rightEarLength / 2])
    }));

    grouped.bottom.forEach(ear => descriptors.push({
      orientation: 'bottom',
      pos: ear.pos,
      id: ear.id,
      custom: Boolean(ear.custom),
      center: transformPoint([ear.pos + bottomEarLengthForLayout / 2, safeHeight - bottomEarDepth / 2])
    }));

    grouped.left.forEach(ear => descriptors.push({
      orientation: 'left',
      pos: ear.pos,
      id: ear.id,
      custom: Boolean(ear.custom),
      center: transformPoint([leftEarDepth / 2, ear.pos + leftEarLength / 2])
    }));

    return descriptors;
  };

  const getFrameEarDeleteTarget = (point) => {
    const tolerance = Math.max(getFrameEarToolTolerance(), 34 / Math.max(0.0001, scale * viewZoom));
    const best = getFrameEarDescriptors()
      .map(ear => ({ ...ear, distance: Math.hypot(point.x - ear.center[0], point.y - ear.center[1]) }))
      .sort((a, b) => a.distance - b.distance)[0];

    return best && best.distance <= tolerance ? best : null;
  };

  const deleteManualFrameEar = (target) => {
    setManualFrameEars(prev => ({
      added: target.custom ? prev.added.filter(ear => ear.id !== target.id) : prev.added,
      deleted: target.custom
        ? prev.deleted
        : [...prev.deleted, { id: crypto.randomUUID(), orientation: target.orientation, pos: target.pos }]
    }));
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

    if (patternEnabled) {
      getPatternContours().forEach(contour => {
        contour.points.forEach(addPoint);
      });
    }

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

  const nearestPointOnSegment = (point, a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= 0.000001) return a;
    const t = clamp(((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSq, 0, 1);
    return [a[0] + dx * t, a[1] + dy * t];
  };

  const getInteriorDrawingSnapCandidates = () => {
    const candidates = [];
    const addPoint = (point) => {
      if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return;
      candidates.push({ type: 'point', point });
    };
    const addSegment = (a, b) => {
      if (!a || !b) return;
      if (!Number.isFinite(a[0]) || !Number.isFinite(a[1]) || !Number.isFinite(b[0]) || !Number.isFinite(b[1])) return;
      candidates.push({ type: 'segment', a, b });
    };

    flattenInteriorDesigns(interiorDesignsRef.current).forEach(design => {
      if (isImportedInteriorSvg(design) || design.kind === 'text' || design.kind === 'eraser') return;

      if (design.kind === 'line') {
        const p1 = [n(design.x1, 0), n(design.y1, 0)];
        const p2 = [n(design.x2, 0), n(design.y2, 0)];
        addPoint(p1);
        addPoint(p2);
        addSegment(p1, p2);
        return;
      }

      if (design.kind === 'arc') {
        const points = sampleInteriorThreePointArc(design, 24);
        points.forEach(addPoint);
        points.slice(0, -1).forEach((point, index) => addSegment(point, points[index + 1]));
        getInteriorPointHandles(design).forEach(handle => addPoint([handle.x, handle.y]));
        return;
      }

      if (design.kind === 'polygon') {
        const points = design.points || [];
        points.forEach(addPoint);
        points.forEach((point, index) => addSegment(point, points[(index + 1) % points.length]));
        return;
      }

      if (design.kind === 'editableSvg') {
        (design.contours || []).forEach(contour => {
          const points = contour.points || [];
          points.forEach(addPoint);
          const segCount = contour.closed ? points.length : points.length - 1;
          for (let i = 0; i < segCount; i++) addSegment(points[i], points[(i + 1) % points.length]);
        });
        return;
      }

      const bounds = getInteriorObjectBounds(design);
      const corners = [
        [bounds.x, bounds.y],
        [bounds.x + bounds.width, bounds.y],
        [bounds.x + bounds.width, bounds.y + bounds.height],
        [bounds.x, bounds.y + bounds.height]
      ];
      corners.forEach(addPoint);
      corners.forEach((point, index) => addSegment(point, corners[(index + 1) % corners.length]));
    });

    return candidates;
  };

  const findNearestInteriorDrawingSnapPoint = (x, y, { includeSegments = true } = {}) => {
    const pointer = [x, y];
    let best = null;
    let bestDist = Infinity;

    getInteriorDrawingSnapCandidates().forEach(candidate => {
      if (candidate.type === 'segment' && !includeSegments) return;
      const point = candidate.type === 'segment'
        ? nearestPointOnSegment(pointer, candidate.a, candidate.b)
        : candidate.point;
      const dist = Math.hypot(point[0] - x, point[1] - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = point;
      }
    });

    const snapTolerancePx = 12;
    const snapToleranceMm = snapTolerancePx / (scale * viewZoom);
    return bestDist <= snapToleranceMm ? best : null;
  };

  const getInteriorDrawingPoint = (e, allowSnap = true, options = {}) => {
    const point = getSvgPoint(e);
    if (!allowSnap) return point;
    const snapped = findNearestInteriorDrawingSnapPoint(point.x, point.y, options);
    return snapped ? { x: snapped[0], y: snapped[1] } : point;
  };

  const constrainLinePoint = (start, point, allowAnyAngle) => {
    if (allowAnyAngle) return point;
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    return Math.abs(dx) >= Math.abs(dy)
      ? { x: point.x, y: start.y }
      : { x: start.x, y: point.y };
  };

  const getInteriorLineDrawingPoint = (e, start = null) => {
    const point = getInteriorDrawingPoint(e, true, { includeSegments: false });
    return start ? constrainLinePoint(start, point, e.ctrlKey || e.metaKey) : point;
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

    const addArcRangeGap = (id, arc, ranges, yOffset = 0) => {
      if (!arc || ranges.length < 2) return;
      const sorted = [...ranges].sort((a, b) => a.start - b.start);
      const p1raw = arc.pointAt(sorted[0].end, 0);
      const p2raw = arc.pointAt(sorted[1].start, 0);
      const p1 = [p1raw[0], p1raw[1] + yOffset];
      const p2 = [p2raw[0], p2raw[1] + yOffset];
      const outsideY = Math.min(p1[1], p2[1]) - 120;
      addMeasurement(createAutomaticGapMeasurement(id, p1, p2, [(p1[0] + p2[0]) / 2, outsideY]));
    };

    const getVerticalEarRangesForSpan = (startY, endY, length, depth, useManual, countValue) => {
      if (depth <= 0 || length <= 0) return [];

      const minY = Math.min(startY, endY);
      const maxY = Math.max(startY, endY);
      const sideLength = maxY - minY;
      const visibleMargin = Math.max(0, margin - depth);

      const ranges = [];
      if (useManual) {
        const count = Math.max(1, n(countValue, 1));
        if (count === 1) {
          const start = minY + sideLength / 2 - length / 2;
          ranges.push({ start, end: start + length });
          return ranges;
        }

        const usable = sideLength - 2 * visibleMargin - length;
        if (usable < 0) return [];

        const spacing = usable / (count - 1);
        for (let i = 0; i < count; i++) {
          const start = minY + visibleMargin + i * spacing;
          ranges.push({ start, end: start + length });
        }
        return ranges;
      }

      const usable = sideLength - 2 * visibleMargin - length;
      if (usable < 0) return [];

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
        addArcRangeGap('auto-gap-right-panel-top', arc, getArcEarRangesForSpan(rightSplitS, arc.arcLength, true, splitRightTopEars), rightPanelTopOffset);
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

      const rightPanelEarOffset = rightPanelTopOffsetGlueEars ? 0 : rightPanelTopOffset;
      const splitTop = arc ? arc.pointAt(getArcSAtX(arc, splitX), 0) : [splitX, topEarDepth];
      const rightSplitTopRaw = arc ? arc.pointAt(getArcSAtX(arc, rightSplitX), 0) : [rightSplitX, topEarDepth];
      const rightSplitTop = [rightSplitTopRaw[0], rightSplitTopRaw[1] + rightPanelEarOffset];
      const leftSplitRanges = getVerticalEarRangesForSpan(splitTop[1], bottomBaseY, splitEarLength, splitEarDepth, splitManualMode, splitLeftCutEars);
      const rightSplitRanges = syncSplitEars
        ? leftSplitRanges
        : getVerticalEarRangesForSpan(rightSplitTop[1], bottomBaseY, splitEarLength, splitEarDepth, splitManualMode, splitRightCutEars);
      addVerticalRangeGap('auto-gap-left-panel-split', leftSplitRanges, splitX, splitX + 120);
      addVerticalRangeGap('auto-gap-right-panel-split', rightSplitRanges, rightSplitX, rightSplitX - 120);

      addVerticalGap('auto-gap-left-panel-left', grouped.left, leftEarDepth, -120, leftEarLength, leftEarDepth);
      addVerticalGap(
        'auto-gap-right-panel-right',
        grouped.right.map(ear => ({ ...ear, pos: ear.pos + rightPanelEarOffset })),
        safeWidth - rightEarDepth,
        safeWidth + 120,
        rightEarLength,
        rightEarDepth
      );

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
  // For points already placed inside a wrapper <g transform="...scale(...)"> (e.g. thickened SVG
  // contours, in the same raw/local coordinate space as dangerouslySetInnerHTML markup) — the
  // wrapper already applies the global mm scale, so these must NOT be multiplied again.
  const rawPolygonPoints = (pointsArray) => pointsArray.map(([x, y]) => `${x},${y}`).join(' ');

  // Combines multiple (possibly disjoint) contours — e.g. an editable multi-path SVG shape — into
  // one <path d> string in absolute mm coordinates (same convention as polygonPoints).
  const buildInteriorContoursPathD = (contours) => (
    contours.map(contour => {
      const points = contour.points || [];
      if (points.length < 2) return '';
      const [first, ...rest] = points;
      const segments = rest.map(([x, y]) => `L ${x * scale} ${y * scale}`).join(' ');
      return `M ${first[0] * scale} ${first[1] * scale} ${segments}${contour.closed ? ' Z' : ''}`;
    }).filter(Boolean).join(' ')
  );

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
  // editableSvg shapes can be toggled out of point-editing (pointEditMode: false) to get normal
  // corner resize/rotate handles back instead of one handle per vertex — the point geometry itself
  // is unchanged either way, and re-entering point mode later is just flipping the flag back.
  const isPointEditedInteriorShape = (design) => design?.kind === 'line' || design?.kind === 'arc' || design?.kind === 'polygon' || (design?.kind === 'editableSvg' && design.pointEditMode !== false);
  const isInteriorGroup = (design) => design?.kind === 'group';
  const flattenInteriorDesigns = (designs, parentMatrix = null) => (
    designs.flatMap(design => {
      const inheritedDesign = parentMatrix ? { ...design, __parentMatrix: parentMatrix } : design;
      if (!isInteriorGroup(inheritedDesign)) return [inheritedDesign];

      const groupMatrix = getInteriorDesignTransformMatrix(inheritedDesign);
      return flattenInteriorDesigns(inheritedDesign.children || [], groupMatrix);
    })
  );

  const getInteriorObjectBounds = (design) => {
    if (!design) return { x: 0, y: 0, width: 10, height: 10 };

    if (isInteriorGroup(design)) {
      if (design.clipBounds) {
        return {
          x: n(design.clipBounds.x, 0),
          y: n(design.clipBounds.y, 0),
          width: Math.max(10, n(design.clipBounds.width, 10)),
          height: Math.max(10, n(design.clipBounds.height, 10))
        };
      }

      return getInteriorSelectionBounds(design.children || []);
    }

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
      const thickness = Math.max(0.5, n(design.thickness, 8));
      const points = [
        [n(design.x1, n(design.x, 0)), n(design.y1, n(design.y, 0))],
        [n(design.x2, n(design.x, 0) + n(design.width, 10) / 2), n(design.y2, n(design.y, 0) - 60)],
        [n(design.x3, n(design.x, 0) + n(design.width, 10)), n(design.y3, n(design.y, 0))]
      ];
      const xs = points.map(point => point[0]);
      const ys = points.map(point => point[1]);
      const minX = Math.min(...xs) - thickness;
      const minY = Math.min(...ys) - thickness;
      const maxX = Math.max(...xs) + thickness;
      const maxY = Math.max(...ys) + thickness;
      return {
        x: minX,
        y: minY,
        width: Math.max(10, maxX - minX),
        height: Math.max(10, maxY - minY)
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

    if (design.kind === 'polygon') {
      const points = (design.points || []).filter(point => Array.isArray(point) && point.length >= 2);
      if (!points.length) return { x: 0, y: 0, width: 10, height: 10 };
      const xs = points.map(point => point[0]);
      const ys = points.map(point => point[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      return {
        x: minX,
        y: minY,
        width: Math.max(10, maxX - minX),
        height: Math.max(10, maxY - minY)
      };
    }

    if (design.kind === 'editableSvg') {
      const points = (design.contours || []).flatMap(contour => contour.points || []);
      if (!points.length) return { x: n(design.x, 0), y: n(design.y, 0), width: 10, height: 10 };
      const xs = points.map(point => point[0]);
      const ys = points.map(point => point[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      return {
        x: minX,
        y: minY,
        width: Math.max(10, maxX - minX),
        height: Math.max(10, maxY - minY)
      };
    }

    if (design.kind === 'patternAlongPath') {
      const instances = buildPatternAlongPathInstances(design);
      const halfW = Math.max(1, n(design.motifWidth, 20)) * n(design.scale, 1) / 2;
      const halfH = Math.max(1, n(design.motifHeight, 20)) * n(design.scale, 1) / 2;
      if (!instances.length) return { x: n(design.x, 0), y: n(design.y, 0), width: 10, height: 10 };
      const xs = instances.flatMap(inst => [inst.x - halfW, inst.x + halfW]);
      const ys = instances.flatMap(inst => [inst.y - halfH, inst.y + halfH]);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(10, Math.max(...xs) - Math.min(...xs)),
        height: Math.max(10, Math.max(...ys) - Math.min(...ys))
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

  const getInteriorTransformCenter = (bounds) => [
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2
  ];

  // Axis-aligned bounding box of the shape's OWN rect after rotation is applied — used for the
  // selection outline/handles so they visually tighten/expand around the rotated shape instead of
  // staying pinned to the un-rotated bounds.
  const getInteriorRotatedBounds = (design, bounds) => {
    const rotation = n(design?.rotation, 0);
    if (!rotation) return bounds;

    const [cx, cy] = getInteriorTransformCenter(bounds);
    const rad = rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const corners = [
      [bounds.x, bounds.y],
      [bounds.x + bounds.width, bounds.y],
      [bounds.x + bounds.width, bounds.y + bounds.height],
      [bounds.x, bounds.y + bounds.height]
    ].map(([px, py]) => {
      const dx = px - cx;
      const dy = py - cy;
      return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
    });

    const xs = corners.map(point => point[0]);
    const ys = corners.map(point => point[1]);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
  };

  const getInteriorDesignTransformMatrix = (design, bounds = getInteriorObjectBounds(design)) => {
    const [cx, cy] = getInteriorTransformCenter(bounds);
    const angle = n(design?.rotation, 0) * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const sx = design?.mirrorX ? -1 : 1;
    const sy = design?.mirrorY ? -1 : 1;
    // Rotate first, then mirror in world space (about the same center) — so mirroring flips the
    // shape as it currently appears on screen, not its original pre-rotation local axes.
    const a = sx * cos;
    const b = sy * sin;
    const c = -sx * sin;
    const d = sy * cos;
    const localMatrix = [
      a,
      b,
      c,
      d,
      cx - a * cx - c * cy,
      cy - b * cx - d * cy
    ];
    return design?.__parentMatrix ? multiplyMatrix(design.__parentMatrix, localMatrix) : localMatrix;
  };

  const transformInteriorDesignPoint = (design, point, bounds = getInteriorObjectBounds(design)) => (
    applyMatrix(getInteriorDesignTransformMatrix(design, bounds), point)
  );

  const transformInteriorDesignPoints = (design, points, bounds = getInteriorObjectBounds(design)) => (
    (points || []).map(point => transformInteriorDesignPoint(design, point, bounds))
  );

  const getInteriorSvgTransform = (design, bounds = getInteriorObjectBounds(design)) => {
    const [cx, cy] = getInteriorTransformCenter(bounds);
    const transforms = [];
    // Mirror is listed first (outermost/applied last) so it flips the shape as it currently
    // appears on screen — rotation is applied first (innermost), then the mirror reflects that
    // already-rotated result in world space, rather than flipping the pre-rotation local axes.
    if (design?.mirrorX || design?.mirrorY) {
      transforms.push(`translate(${cx * scale} ${cy * scale}) scale(${design.mirrorX ? -1 : 1} ${design.mirrorY ? -1 : 1}) translate(${-cx * scale} ${-cy * scale})`);
    }
    if (n(design?.rotation, 0)) transforms.push(`rotate(${n(design.rotation, 0)} ${cx * scale} ${cy * scale})`);
    return transforms.join(' ');
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
        ...(design.clipBounds ? { clipBounds: next } : {}),
        ...(design.bendPoints ? { bendPoints: design.bendPoints.map(point => transformPoint(point[0], point[1])) } : {}),
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

    if (design.kind === 'polygon') {
      return {
        ...next,
        points: (design.points || []).map(point => transformPoint(point[0], point[1]))
      };
    }

    if (design.kind === 'editableSvg') {
      return {
        ...next,
        contours: (design.contours || []).map(contour => ({
          ...contour,
          points: contour.points.map(point => transformPoint(point[0], point[1]))
        })),
        ...(design.bendPoints ? { bendPoints: design.bendPoints.map(point => transformPoint(point[0], point[1])) } : {})
      };
    }

    if (design.kind === 'patternAlongPath') {
      const uniformScale = (scaleX + scaleY) / 2;
      return {
        ...next,
        pathPoints: (design.pathPoints || []).map(point => transformPoint(point[0], point[1])),
        motifWidth: Math.max(1, n(design.motifWidth, 20) * uniformScale),
        motifHeight: Math.max(1, n(design.motifHeight, 20) * uniformScale),
        offset: n(design.offset, 0) * uniformScale,
        ...(design.bendPoints ? { bendPoints: design.bendPoints.map(point => transformPoint(point[0], point[1])) } : {})
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
      { id: 'rotate', x: cx, y: y - 32 / (scale * viewZoom), cursor: 'grab' },
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

    if (design?.kind === 'polygon') {
      return (design.points || []).map((point, index) => ({
        id: `poly-${index}`,
        x: point[0],
        y: point[1],
        cursor: 'move'
      }));
    }

    if (design?.kind === 'editableSvg' && design.pointEditMode !== false) {
      return (design.contours || []).flatMap((contour, contourIndex) => (
        contour.points.map((point, pointIndex) => ({
          id: `edit-${contourIndex}-${pointIndex}`,
          x: point[0],
          y: point[1],
          cursor: 'move'
        }))
      ));
    }

    // Bend-line control points (left/mid/right) are additive: shown for a group or patternAlongPath
    // whenever it has a bend line, and for an editableSvg only while OUT of corner point-edit mode
    // (matching the "flat while editing corners, bent otherwise" convention the bend already follows).
    if (design?.bendPoints && (isInteriorGroup(design) || design?.kind === 'patternAlongPath' || (design?.kind === 'editableSvg' && design.pointEditMode === false))) {
      return design.bendPoints.map((point, index) => ({
        id: `bend-${index}`,
        x: point[0],
        y: point[1],
        cursor: 'move'
      }));
    }

    return [];
  };

  const getInteriorShapeName = (kind) => ({
    rect: 'Rectangle',
    ellipse: 'Ellipse',
    line: 'Line',
    arc: '3-point arc',
    polygon: 'Closed profile',
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
      aspectLocked: false,
      rotation: 0,
      mirrorX: false,
      mirrorY: false,
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
        fontFamily: interiorFontOptions[0].value,
        letterSpacing: 0,
        exportable: true,
        warnings: [],
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

  const pointKey = (point) => `${Math.round(point[0] * 1000) / 1000},${Math.round(point[1] * 1000) / 1000}`;

  const findClosedLineProfile = (existingLines, closingLine) => {
    if (existingLines.length < 2 || !closingLine) return null;

    const adjacency = new Map();
    const pointByKey = new Map();
    const addEdge = (key, edge) => {
      adjacency.set(key, [...(adjacency.get(key) || []), edge]);
      pointByKey.set(edge.fromKey, edge.from);
      pointByKey.set(edge.toKey, edge.to);
    };

    existingLines.forEach((line, index) => {
      const p1 = [n(line.x1, 0), n(line.y1, 0)];
      const p2 = [n(line.x2, 0), n(line.y2, 0)];
      const k1 = pointKey(p1);
      const k2 = pointKey(p2);
      addEdge(k1, { index, fromKey: k1, toKey: k2, from: p1, to: p2 });
      addEdge(k2, { index, fromKey: k2, toKey: k1, from: p2, to: p1 });
    });

    const start = [n(closingLine.x2, 0), n(closingLine.y2, 0)];
    const targetKey = pointKey([n(closingLine.x1, 0), n(closingLine.y1, 0)]);
    const startKey = pointKey(start);
    const stack = [{ key: startKey, pathKeys: [startKey], usedLineIndexes: new Set() }];

    while (stack.length) {
      const current = stack.pop();
      const edges = adjacency.get(current.key) || [];

      for (const edge of edges) {
        if (current.usedLineIndexes.has(edge.index)) continue;

        const nextUsed = new Set(current.usedLineIndexes);
        nextUsed.add(edge.index);
        const nextPath = [...current.pathKeys, edge.toKey];

        if (edge.toKey === targetKey && nextUsed.size >= 2) {
          const closingIndex = existingLines.length;
          return {
            points: [
              [n(closingLine.x1, 0), n(closingLine.y1, 0)],
              [n(closingLine.x2, 0), n(closingLine.y2, 0)],
              ...nextPath.slice(1, -1).map(key => pointByKey.get(key) || start)
            ],
            usedLineIndexes: new Set([...nextUsed, closingIndex])
          };
        }

        if (nextPath.length <= existingLines.length + 1) {
          stack.push({ key: edge.toKey, pathKeys: nextPath, usedLineIndexes: nextUsed });
        }
      }
    }

    return null;
  };

  const addInteriorLineOrClosedProfile = (shape) => {
    if (!shape) return;

    const existingLines = interiorDesignsRef.current.filter(design => (
      design.kind === 'line'
      && (design.color || 'white') === 'white'
      && Math.abs(n(design.thickness, 8) - n(shape.thickness, 8)) < 0.001
    ));
    const profile = findClosedLineProfile(existingLines, shape);

    if (!profile) {
      addInteriorShape(shape);
      return;
    }

    const polygon = {
      id: crypto.randomUUID(),
      kind: 'polygon',
      name: 'Closed profile',
      color: 'white',
      exportable: true,
      warnings: [],
      aspectLocked: false,
      points: profile.points
    };

    applyInteriorDesigns(prev => {
      const lineIdsToRemove = new Set(existingLines
        .filter((_, index) => profile.usedLineIndexes.has(index))
        .map(line => line.id));
      return [...prev.filter(design => !lineIdsToRemove.has(design.id)), polygon];
    }, { selectedId: polygon.id });
  };

  const setInteriorSelection = (ids) => {
    const cleanIds = Array.from(new Set(ids.filter(Boolean)));
    setSelectedInteriorDesignIds(cleanIds);
    setSelectedInteriorDesignId(cleanIds[cleanIds.length - 1] || null);
  };

  const promotePatternSlotToDesign = (contour) => {
    const newDesign = {
      id: crypto.randomUUID(),
      kind: 'polygon',
      name: 'Pattern slot',
      color: 'white',
      points: contour.points,
      aspectLocked: false,
      rotation: 0,
      mirrorX: false,
      mirrorY: false
    };
    setExcludedPatternSlotIds(prev => [...prev, contour.designId]);
    applyInteriorDesigns(prev => [...prev, newDesign]);
    return newDesign;
  };

  const selectPatternSlotFromCanvas = (e, contour) => {
    if (activeInteriorShapeTool) return;
    e.stopPropagation();
    const newDesign = promotePatternSlotToDesign(contour);
    if (e.shiftKey) {
      setInteriorSelection([...selectedInteriorDesignIdsRef.current, newDesign.id]);
    } else {
      setInteriorSelection([newDesign.id]);
    }
  };

  const toggleInteriorSelection = (id) => {
    const current = selectedInteriorDesignIdsRef.current;
    setInteriorSelection(current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const getSvgChildBBox = (svg, child) => {
    const geometryPoints = [];
    const cssRules = parseSvgCssRules(svg);
    const ignoredTags = new Set(['defs', 'style', 'title', 'desc', 'metadata', 'namedview', 'sodipodi:namedview']);

    const addPoints = (points) => {
      points
        .filter(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
        .forEach(point => geometryPoints.push(point));
    };

    const walkGeometry = (node, parentMatrix = [1, 0, 0, 1, 0, 0], parentStyle = getDefaultSvgStyle(), visitedUses = new Set()) => {
      if (node.nodeType !== 1) return;

      const tag = node.tagName?.toLowerCase();
      if (!tag || ignoredTags.has(tag)) return;
      if (isSvgCanvasBackgroundRect(node, svg)) return;

      const matrix = multiplyMatrix(parentMatrix, parseSvgTransform(node.getAttribute('transform')));
      const style = resolveSvgNodeStyle(node, parentStyle, cssRules);
      if (isHiddenSvgStyle(style)) return;

      if (tag === 'use') {
        const rawHref = node.getAttribute('href') || node.getAttribute('xlink:href') || '';
        const id = rawHref.startsWith('#') ? rawHref.slice(1) : '';
        const target = getSvgElementById(svg, id);
        if (target && !visitedUses.has(id)) {
          const x = parseFloat(node.getAttribute('x')) || 0;
          const y = parseFloat(node.getAttribute('y')) || 0;
          walkGeometry(target, multiplyMatrix(matrix, [1, 0, 0, 1, x, y]), style, new Set([...visitedUses, id]));
        }
        return;
      }

      const fillVisible = hasVisibleFill(style, tag);
      const strokeVisible = hasBlackStroke(style);
      const strokeWidth = getStrokeWidth(style, matrix);

      if (tag === 'path' && (fillVisible || strokeVisible)) {
        const d = node.getAttribute('d');
        if (d) {
          try {
            splitSvgPathSubpaths(d).forEach(subpath => {
              const points = sampleSvgPathCommands(subpath.commands, matrix, 0.1);
              if (fillVisible) addPoints(points);
              if (strokeVisible && strokeWidth > 0) {
                const outlines = subpath.closed
                  ? offsetClosedStrokeContours(points, strokeWidth)
                  : offsetOpenStrokeContours(points, strokeWidth, style['stroke-linecap']);
                outlines.forEach(addPoints);
              }
            });
          } catch {
            // Fall back to browser bbox below if this path cannot be sampled.
          }
        }
      } else if (tag === 'rect' && (fillVisible || strokeVisible)) {
        const x = parseFloat(node.getAttribute('x')) || 0;
        const y = parseFloat(node.getAttribute('y')) || 0;
        const w = parseFloat(node.getAttribute('width')) || 0;
        const h = parseFloat(node.getAttribute('height')) || 0;
        const rawRx = node.hasAttribute('rx') ? parseFloat(node.getAttribute('rx')) : parseFloat(node.getAttribute('ry')) || 0;
        const rawRy = node.hasAttribute('ry') ? parseFloat(node.getAttribute('ry')) : rawRx;
        const points = buildRoundedRectPoints(x, y, w, h, rawRx, rawRy, matrix);
        addPoints(points);
        if (strokeVisible && strokeWidth > 0) offsetClosedStrokeContours(points, strokeWidth).forEach(addPoints);
      } else if ((tag === 'circle' || tag === 'ellipse') && (fillVisible || strokeVisible)) {
        const cx = parseFloat(node.getAttribute('cx')) || 0;
        const cy = parseFloat(node.getAttribute('cy')) || 0;
        const rx = tag === 'circle' ? parseFloat(node.getAttribute('r')) || 0 : parseFloat(node.getAttribute('rx')) || 0;
        const ry = tag === 'circle' ? rx : parseFloat(node.getAttribute('ry')) || 0;
        const points = [];
        const circleSegments = getAdaptiveCircleSegments(rx, ry, matrix);
        for (let i = 0; i < circleSegments; i++) {
          const angle = i * Math.PI * 2 / circleSegments;
          points.push(applyMatrix(matrix, [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]));
        }
        addPoints(points);
        if (strokeVisible && strokeWidth > 0) offsetClosedStrokeContours(points, strokeWidth).forEach(addPoints);
      } else if ((tag === 'polygon' || tag === 'polyline') && (fillVisible || strokeVisible)) {
        const points = parseSvgPoints(node.getAttribute('points')).map(point => applyMatrix(matrix, point));
        addPoints(points);
        if (strokeVisible && strokeWidth > 0) {
          const outlines = tag === 'polygon'
            ? offsetClosedStrokeContours(points, strokeWidth)
            : offsetOpenStrokeContours(points, strokeWidth, style['stroke-linecap']);
          outlines.forEach(addPoints);
        }
      } else if (tag === 'line' && strokeVisible && strokeWidth > 0) {
        const p1 = [parseFloat(node.getAttribute('x1')) || 0, parseFloat(node.getAttribute('y1')) || 0];
        const p2 = [parseFloat(node.getAttribute('x2')) || 0, parseFloat(node.getAttribute('y2')) || 0];
        offsetOpenStrokeContours([applyMatrix(matrix, p1), applyMatrix(matrix, p2)], strokeWidth, style['stroke-linecap']).forEach(addPoints);
      }

      Array.from(node.children || []).forEach(childNode => walkGeometry(childNode, matrix, style, visitedUses));
    };

    walkGeometry(child);

    if (geometryPoints.length) {
      const xs = geometryPoints.map(point => point[0]);
      const ys = geometryPoints.map(point => point[1]);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      if (maxX - minX > 0.0001 && maxY - minY > 0.0001) {
        const pad = 0.001;
        return {
          x: minX - pad,
          y: minY - pad,
          width: maxX - minX + pad * 2,
          height: maxY - minY + pad * 2
        };
      }
    }

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

  const getSvgArtworkBBox = (svg) => {
    const testSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const ignoredTags = new Set(['defs', 'style', 'title', 'desc', 'metadata', 'namedview', 'sodipodi:namedview']);
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

    Array.from(svg.children)
      .filter(node => {
        const tag = node.tagName?.toLowerCase();
        return tag && !ignoredTags.has(tag) && !isSvgCanvasBackgroundRect(node, svg);
      })
      .forEach(node => testSvg.appendChild(node.cloneNode(true)));

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
      // If browser measurement fails, keep using the original SVG document box.
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
    const sourceBox = design.sourceBox || rootBox;
    const designWidth = Math.max(10, n(design.width, 10));
    const designHeight = Math.max(10, n(design.height, 10));
    const scaleX = designWidth / (sourceBox.width || 1);
    const scaleY = designHeight / (sourceBox.height || 1);
    const attrs = Array.from(svg.attributes)
      .filter(attr => !['viewBox', 'width', 'height'].includes(attr.name))
      .map(attr => `${attr.name}="${attr.value.replace(/"/g, '&quot;')}"`)
      .join(' ');
    const fittedAttrs = [
      attrs,
      `viewBox="0 0 ${childBox.width} ${childBox.height}"`,
      `width="${childBox.width}"`,
      `height="${childBox.height}"`
    ].filter(Boolean).join(' ');
    const normalizedChild = `<g transform="translate(${-childBox.x} ${-childBox.y})">${serializer.serializeToString(child)}</g>`;
    const svgText = `<svg ${fittedAttrs}>${defs}${normalizedChild}</svg>`;
    const localSourceBox = { x: 0, y: 0, width: childBox.width, height: childBox.height };
    const validation = validateInteriorSvg(svgText);
    return {
      ...design,
      id: crypto.randomUUID(),
      name: `${design.name || 'SVG'} part ${childIndex + 1}`,
      x: n(design.x, 0) + (childBox.x - sourceBox.x) * scaleX,
      y: n(design.y, 0) + (childBox.y - sourceBox.y) * scaleY,
      width: Math.max(1, childBox.width * scaleX),
      height: Math.max(1, childBox.height * scaleY),
      sourceBox: localSourceBox,
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
          const clone = pathElement.cloneNode(true);
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
    const dedupeParts = (parts) => {
      const seen = new Set();
      return parts.filter(part => {
        const box = getSvgChildBBox(svg, part);
        const boxKey = box
          ? [box.x, box.y, box.width, box.height].map(value => Math.round(value * 1000) / 1000).join(',')
          : 'no-box';
        const tag = part.tagName?.toLowerCase() || 'node';
        const dataKey = tag === 'path'
          ? (part.getAttribute('d') || '').replace(/\s+/g, ' ').trim()
          : `${part.getAttribute('points') || ''}|${part.getAttribute('x') || ''}|${part.getAttribute('y') || ''}|${part.getAttribute('width') || ''}|${part.getAttribute('height') || ''}|${part.getAttribute('cx') || ''}|${part.getAttribute('cy') || ''}|${part.getAttribute('r') || ''}|${part.getAttribute('rx') || ''}|${part.getAttribute('ry') || ''}`;
        const key = `${tag}|${boxKey}|${dataKey}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const topLevelChildren = Array.from(svg.children)
      .filter(child => !ignoredSvgUngroupTags.has(child.tagName.toLowerCase()));
    const onlyChild = topLevelChildren.length === 1 ? topLevelChildren[0] : null;
    const onlyChildTag = onlyChild?.tagName?.toLowerCase();

    if (onlyChild && ['g', 'svg', 'symbol'].includes(onlyChildTag)) {
      const wrappedDrawableParts = collectDrawableSvgUngroupParts(onlyChild);
      if (wrappedDrawableParts.length > 1) return dedupeParts(wrappedDrawableParts);
    }

    const hasTopLevelGroup = topLevelChildren.some(child => child.tagName.toLowerCase() === 'g');

    if (hasTopLevelGroup) return dedupeParts(topLevelChildren);

    const topLevelParts = topLevelChildren.flatMap(child => (
      child.tagName.toLowerCase() === 'path' ? splitUngroupPathElement(child) : [child]
    ));

    if (topLevelParts.length > 1) return dedupeParts(topLevelParts);

    const leafParts = topLevelChildren.flatMap(collectDrawableSvgUngroupParts);
    return leafParts.length > 1 ? dedupeParts(leafParts) : dedupeParts(topLevelParts);
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

  const getInteriorDesignById = (id, sourceDesigns = interiorDesigns) => (
    flattenInteriorDesigns(sourceDesigns).find(design => design.id === id) || null
  );

  const getInteriorClipSourceContours = (design, sourceDesigns = interiorDesigns) => {
    if (!design?.clipSourceId) return [];
    const source = getInteriorDesignById(design.clipSourceId, sourceDesigns);
    if (!source || source.id === design.id) return [];

    return getInteriorShapeContours(source)
      .map(points => cleanDxfPoints(points, true))
      .filter(points => points.length >= 3);
  };

  const getInteriorClipContoursFromSource = (source) => (
    getInteriorShapeContours(source)
      .map(points => cleanDxfPoints(points, true))
      .filter(points => points.length >= 3)
  );

  const canUseInteriorDesignAsClipSource = (design) => (
    (design?.color || 'white') === 'black' && getInteriorClipContoursFromSource(design).length > 0
  );

  const intersectClosedContourWithPaths = (points, clipPolygons) => {
    if (!clipPolygons.length || points.length < 3) return [points];

    const subject = cleanClipperPaths([toClipperPath(points)]);
    const clips = cleanClipperPaths(clipPolygons.map(toClipperPath));
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

  const getInteriorClipPolygonsForDesign = (design, options = {}) => {
    const sourceDesigns = options.sourceDesigns || interiorDesigns;
    const clipEnabled = options.clipEnabled ?? interiorClipEnabled;
    const marginBoundarySets = options.marginBoundarySets ?? interiorMarginBoundarySets;
    const clipGroups = [];
    const clipSourceContours = getInteriorClipSourceContours(design, sourceDesigns);
    if (clipSourceContours.length) clipGroups.push(clipSourceContours);

    if (clipEnabled && marginBoundarySets.length) {
      clipGroups.push(marginBoundarySets);
    }

    if (!clipGroups.length) return [];

    const unionedGroups = clipGroups
      .map(group => unionClipperPaths(orientClipperPaths(group.map(toClipperPath))))
      .filter(group => group.length);

    if (!unionedGroups.length) return [];

    let current = unionedGroups[0];
    unionedGroups.slice(1).forEach(group => {
      if (!current.length) return;

      const clipper = new ClipperLib.Clipper();
      clipper.AddPaths(current, ClipperLib.PolyType.ptSubject, true);
      clipper.AddPaths(group, ClipperLib.PolyType.ptClip, true);

      const solution = new ClipperLib.Paths();
      clipper.Execute(
        ClipperLib.ClipType.ctIntersection,
        solution,
        ClipperLib.PolyFillType.pftNonZero,
        ClipperLib.PolyFillType.pftNonZero
      );

      current = cleanClipperPaths(solution);
    });

    return current.map(fromClipperPath);
  };

  const applyInteriorClipFromSelection = () => {
    const selected = interiorDesignsRef.current.filter(design => selectedInteriorDesignIdsRef.current.includes(design.id));
    const clipSource = selected.find(canUseInteriorDesignAsClipSource);
    const clippedTargets = selected.filter(design => design.id !== clipSource?.id && (design.color || 'white') === 'white');

    if (!clipSource || !clippedTargets.length) {
      showInteriorPositionMessage('Select one black shape and at least one white design.');
      return;
    }

    const clippedGroup = {
      id: crypto.randomUUID(),
      kind: 'group',
      name: 'Clipped pattern',
      color: 'white',
      exportable: clippedTargets.every(design => design.exportable !== false),
      warnings: clippedTargets.flatMap(design => design.warnings || []),
      aspectLocked: false,
      clipBounds: getInteriorObjectBounds(clipSource),
      children: [
        { ...clipSource },
        ...clippedTargets.map(design => ({ ...design, clipSourceId: clipSource.id }))
      ]
    };

    applyInteriorDesigns(prev => {
      const selectedIds = new Set([clipSource.id, ...clippedTargets.map(target => target.id)]);
      const firstIndex = prev.findIndex(design => selectedIds.has(design.id));
      const next = prev.filter(design => !selectedIds.has(design.id));
      next.splice(Math.max(0, firstIndex), 0, clippedGroup);
      return next;
    }, { history: true, selectedId: clippedGroup.id });
  };

  const selectInteriorShapeTool = (kind) => {
    clearMeasureTool();
    setActiveInteriorShapeTool(prev => prev === kind ? null : kind);
    setInteriorShapeDraft(null);
    setHoverSnap(null);
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

  const isInteriorPointOnWhiteDesignSurface = (point, includeImportedSvgTolerance = false) => {
    const px = point.x;
    const py = point.y;
    const importedSvgToleranceMm = includeImportedSvgTolerance
      ? IMPORTED_SVG_HIT_TOLERANCE_PX / Math.max(0.0001, scale * viewZoom)
      : 0;

    return flattenInteriorDesigns(interiorDesignsRef.current).some(design => {
      if ((design.color || 'white') !== 'white') return false;

      if (isImportedInteriorSvg(design)) {
        return isPointNearImportedSvgVisibleSurface(design, point, importedSvgToleranceMm);
      }

      const bounds = getInteriorObjectBounds(design);
      const tolerance = 0;
      const inBounds = px >= bounds.x - tolerance
        && px <= bounds.x + bounds.width + tolerance
        && py >= bounds.y - tolerance
        && py <= bounds.y + bounds.height + tolerance;
      if (!inBounds) return false;

      if (design.kind === 'rect' || design.kind === 'text' || design.kind === 'patternAlongPath') return true;

      if (design.kind === 'ellipse') {
        const rx = bounds.width / 2;
        const ry = bounds.height / 2;
        const cx = bounds.x + rx;
        const cy = bounds.y + ry;
        return (((px - cx) ** 2) / ((rx || 1) ** 2)) + (((py - cy) ** 2) / ((ry || 1) ** 2)) <= 1;
      }

      if (design.kind === 'polygon') return pointInPolygon([px, py], design.points || []);

      if (design.kind === 'line' || design.kind === 'arc' || design.kind === 'editableSvg') {
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

  const formatInteriorDimensionInput = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '';
    return numeric.toFixed(2);
  };

  const clearInteriorDimensionDraft = (field) => {
    setInteriorDimensionDrafts(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
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

    if (selected.length > 1 && (mode === 'center-x' || mode === 'center-y')) {
      const selectedBounds = getInteriorSelectionBounds(selected);
      const targetCenterX = selectedBounds.x + selectedBounds.width / 2;
      const targetCenterY = selectedBounds.y + selectedBounds.height / 2;

      applyInteriorDesigns(prev => prev.map(item => {
        if (!selectedInteriorDesignIdsRef.current.includes(item.id)) return item;

        const bounds = getInteriorObjectBounds(item);
        const itemCenterX = bounds.x + bounds.width / 2;
        const itemCenterY = bounds.y + bounds.height / 2;

        return {
          ...item,
          ...applyInteriorObjectBounds(item, {
            x: bounds.x + (mode === 'center-x' ? targetCenterX - itemCenterX : 0),
            y: bounds.y + (mode === 'center-y' ? targetCenterY - itemCenterY : 0),
            width: bounds.width,
            height: bounds.height
          })
        };
      }), { history: true });
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

    if (activeInteriorShapeTool && activeInteriorShapeTool !== 'eraser') {
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

    if (!activeInteriorShapeTool) {
      setInteriorSelection([]);
      setInteriorSelectionBox({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      return;
    }

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

    if (pendingPatternPathSourceId) {
      if (hoveredPatternPathEdge) confirmPatternAlongPath(pendingPatternPathSourceId, hoveredPatternPathEdge);
      setPendingPatternPathSourceId(null);
      setHoveredPatternPathEdge(null);
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

    if (activeInteriorShapeTool === 'eraser') return;

    const point = activeInteriorShapeTool === 'line'
      ? getInteriorLineDrawingPoint(e, interiorShapeDraft ? { x: interiorShapeDraft.x1, y: interiorShapeDraft.y1 } : null)
      : getInteriorDrawingPoint(e, true);
    interiorMousePointRef.current = point;
    const onBody = isInteriorPointOnBody(point);
    const onWhiteSurface = isInteriorPointOnWhiteDesignSurface(point);
    setIsInteriorPointerOnBody(onBody);
    setIsInteriorPointerOnWhiteSurface(onWhiteSurface);

    if (activeInteriorShapeTool !== 'arc') {
      if (!interiorShapeDraft || interiorShapeDraft.kind !== activeInteriorShapeTool) {
        setInteriorSelection([]);
        setInteriorShapeDraft({
          kind: activeInteriorShapeTool,
          x1: point.x,
          y1: point.y,
          x2: point.x,
          y2: point.y,
          drawing: true,
          clickPlacement: true
        });
        return;
      }

      const nextDraft = {
        ...interiorShapeDraft,
        x2: point.x,
        y2: point.y,
        drawing: false,
        clickPlacement: false
      };
      commitInteriorClickDraft(nextDraft);
      setInteriorShapeDraft(null);
      return;
    }

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

    if (length >= 2) {
      const shape = createInteriorShapeFromDraft(interiorShapeDraft);
      if (shape?.kind === 'line') {
        addInteriorLineOrClosedProfile(shape);
      } else {
        addInteriorShape(shape);
      }
    }
    setInteriorShapeDraft(null);
  };

  const commitInteriorClickDraft = (draft) => {
    if (!draft || draft.kind === 'arc' || draft.kind === 'eraser') return;

    const bounds = getInteriorDraftBounds(draft);
    if (!bounds) return;

    const isLine = draft.kind === 'line';
    const length = isLine
      ? Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1)
      : Math.min(bounds.width, bounds.height);

    if (length < 2) return;

    const shape = createInteriorShapeFromDraft(draft);
    if (shape?.kind === 'line') {
      addInteriorLineOrClosedProfile(shape);
    } else {
      addInteriorShape(shape);
    }
  };

  const svgTextToDataUrl = (text) => {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return `data:image/svg+xml;base64,${btoa(binary)}`;
  };

  const createSvgLibraryThumbnail = (rawSvgText) => new Promise((resolve) => {
    const svgText = removeSvgCanvasBackground(String(rawSvgText || ''));
    const image = new window.Image();
    const sourceUrl = svgTextToDataUrl(svgText);

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SVG_LIBRARY_THUMB_SIZE;
        canvas.height = SVG_LIBRARY_THUMB_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(sourceUrl);
          return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const imageWidth = image.naturalWidth || SVG_LIBRARY_THUMB_SIZE;
        const imageHeight = image.naturalHeight || SVG_LIBRARY_THUMB_SIZE;
        const fit = Math.min(
          (SVG_LIBRARY_THUMB_SIZE - 12) / Math.max(1, imageWidth),
          (SVG_LIBRARY_THUMB_SIZE - 12) / Math.max(1, imageHeight)
        );
        const drawWidth = imageWidth * fit;
        const drawHeight = imageHeight * fit;
        ctx.drawImage(
          image,
          (SVG_LIBRARY_THUMB_SIZE - drawWidth) / 2,
          (SVG_LIBRARY_THUMB_SIZE - drawHeight) / 2,
          drawWidth,
          drawHeight
        );
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(sourceUrl);
      }
    };

    image.onerror = () => resolve(sourceUrl);
    image.src = sourceUrl;
  });

  useEffect(() => {
    if (interiorOverlayPanel !== 'svgLibrary') return;
    const missingItems = visibleProjectSvgLibraryItems.filter(item => !svgLibraryThumbnails[item.id]);
    if (!missingItems.length) return;

    let cancelled = false;

    const generate = async () => {
      for (const item of missingItems) {
        const svgText = await loadProjectSvgLibraryItemText(item);
        const thumbnail = await createSvgLibraryThumbnail(svgText);
        if (cancelled) return;
        setSvgLibraryThumbnails(prev => (
          prev[item.id] ? prev : { ...prev, [item.id]: thumbnail }
        ));
      }
    };

    generate();

    return () => {
      cancelled = true;
    };
  }, [interiorOverlayPanel, selectedInteriorSvgLibraryFolder, visibleProjectSvgLibraryItems, svgLibraryThumbnails]);

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

  const createInteriorSvgDesignFromText = (rawSvgText, name = 'SVG design', point = null) => {
    const svgText = removeSvgCanvasBackground(String(rawSvgText || ''));
    const validation = validateInteriorSvg(svgText);
    const defaultSize = Math.max(80, Math.min(safeWidth, safeHeight) * 0.25);
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    const rootBox = svg && !doc.querySelector('parsererror') ? getSvgRootBox(svg) : { x: 0, y: 0, width: 100, height: 100 };
    const sourceBox = svg && !doc.querySelector('parsererror') ? (getSvgArtworkBBox(svg) || rootBox) : rootBox;
    const aspectRatio = sourceBox.width / Math.max(0.0001, sourceBox.height);
    const fittedWidth = (aspectRatio >= 1 ? defaultSize : defaultSize * aspectRatio) * INTERIOR_IMPORTED_SVG_INITIAL_SCALE;
    const fittedHeight = (aspectRatio >= 1 ? defaultSize / aspectRatio : defaultSize) * INTERIOR_IMPORTED_SVG_INITIAL_SCALE;
    const targetPoint = point || { x: safeWidth / 2, y: safeHeight / 2 };

    return {
      id: crypto.randomUUID(),
      name: name.replace(/\.svg$/i, '') || 'SVG design',
      href: svgTextToDataUrl(svgText),
      svgText,
      exportable: validation.exportable,
      warnings: validation.warnings,
      color: 'white',
      x: targetPoint.x - fittedWidth / 2,
      y: targetPoint.y - fittedHeight / 2,
      width: fittedWidth,
      height: fittedHeight,
      sourceBox,
      aspectLocked: false,
      rotation: 0,
      mirrorX: false,
      mirrorY: false,
      lineThicken: 0,
      aspectRatio
    };
  };

  const addInteriorSvgDesignFromText = (rawSvgText, name = 'SVG design', point = null) => {
    const nextDesign = createInteriorSvgDesignFromText(rawSvgText, name, point);
    applyInteriorDesigns(prev => [...prev, nextDesign], { selectedId: nextDesign.id });
  };

  const handleInteriorDesignFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      addInteriorSvgDesignFromText(String(reader.result || ''), file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- DXF import (frame outline) -------------------------------------------------------------
  // Converts a DXF's signed bulge (a chord-relative arc encoding: bulge = tan(includedAngle/4),
  // positive = arc bows to the left of the p1->p2 direction / CCW, negative = right / CW) into
  // sampled arc points from p1 to (and including) p2.
  const sampleDxfBulgeSegment = (p1, p2, bulge) => {
    if (Math.abs(bulge) < 1e-9) return [p2];
    const theta = 4 * Math.atan(bulge);
    const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    if (d < 1e-9) return [p2];
    const halfTheta = Math.abs(theta) / 2;
    const radius = d / (2 * Math.sin(halfTheta));
    const apothem = radius * Math.cos(halfTheta);
    const midX = (p1[0] + p2[0]) / 2;
    const midY = (p1[1] + p2[1]) / 2;
    const ux = (p2[0] - p1[0]) / d;
    const uy = (p2[1] - p1[1]) / d;
    const sign = bulge >= 0 ? 1 : -1;
    // Left-perpendicular of p1->p2, offset toward the center by the apothem (verified by hand: for
    // a positive bulge this places the center such that the CCW sweep from p1 to p2 equals theta).
    const cx = midX + (-uy) * apothem * sign;
    const cy = midY + ux * apothem * sign;
    const startAngle = Math.atan2(p1[1] - cy, p1[0] - cx);
    const steps = Math.max(1, Math.ceil((radius * Math.abs(theta)) / MAX_CURVE_CHORD_MM));
    const points = [];
    for (let i = 1; i <= steps; i++) {
      const angle = startAngle + theta * (i / steps);
      points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }
    return points;
  };

  const flattenDxfBulgeVertices = (verts, closed) => {
    if (!verts.length) return [];
    const points = [[verts[0].x, verts[0].y]];
    const segCount = closed ? verts.length : verts.length - 1;
    for (let i = 0; i < segCount; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % verts.length];
      if (Math.abs(a.bulge) > 1e-9) {
        sampleDxfBulgeSegment([a.x, a.y], [b.x, b.y], a.bulge).forEach(point => points.push(point));
      } else {
        points.push([b.x, b.y]);
      }
    }
    return points;
  };

  // DXF ARC entities always sweep counter-clockwise from the start angle to the end angle.
  const sampleDxfArcEntity = (cx, cy, radius, startDeg, endDeg) => {
    const a1 = startDeg * Math.PI / 180;
    let sweep = (endDeg - startDeg) * Math.PI / 180;
    while (sweep <= 0) sweep += Math.PI * 2;
    const steps = Math.max(1, Math.ceil((radius * sweep) / MAX_CURVE_CHORD_MM));
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const angle = a1 + sweep * (i / steps);
      points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }
    return points;
  };

  const sampleDxfCircleEntity = (cx, cy, radius) => {
    const segments = Math.min(20000, Math.max(24, Math.ceil((2 * Math.PI * radius) / MAX_CURVE_CHORD_MM)));
    return Array.from({ length: segments }, (_, i) => {
      const angle = (i / segments) * Math.PI * 2;
      return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    });
  };

  // Greedily connects open segments (each an array of points; only the first/last points matter
  // for matching) end-to-end into closed loops, for outlines exported as separate LINE/ARC
  // entities rather than one continuous polyline.
  const chainDxfSegmentsIntoLoops = (segments, tolerance = 0.05) => {
    const remaining = segments.map(points => [...points]);
    const loops = [];
    const pointsMatch = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;

    while (remaining.length) {
      let current = remaining.shift();
      let extended = true;
      while (extended) {
        extended = false;
        for (let i = 0; i < remaining.length; i++) {
          const seg = remaining[i];
          const curStart = current[0];
          const curEnd = current[current.length - 1];
          const segStart = seg[0];
          const segEnd = seg[seg.length - 1];

          if (pointsMatch(curEnd, segStart)) {
            current = current.concat(seg.slice(1));
          } else if (pointsMatch(curEnd, segEnd)) {
            current = current.concat([...seg].reverse().slice(1));
          } else if (pointsMatch(curStart, segEnd)) {
            current = seg.slice(0, -1).concat(current);
          } else if (pointsMatch(curStart, segStart)) {
            current = [...seg].reverse().slice(0, -1).concat(current);
          } else {
            continue;
          }
          remaining.splice(i, 1);
          extended = true;
          break;
        }
      }
      if (current.length >= 3 && pointsMatch(current[0], current[current.length - 1])) {
        loops.push(current.slice(0, -1));
      }
    }
    return loops;
  };

  // Parses the ENTITIES section of an ASCII DXF file (group-code/value line pairs) and returns
  // the single largest closed outline found — reading LWPOLYLINE (with bulge arcs), legacy
  // POLYLINE+VERTEX+SEQEND, LINE, ARC, and CIRCLE, chaining any disconnected LINE/ARC entities
  // into closed loops the same way a real board outline would trace one continuous edge.
  const parseDxfOutlineFromText = (dxfText) => {
    const lines = dxfText.split(/\r\n|\r|\n/);
    const pairs = [];
    for (let i = 0; i + 1 < lines.length; i += 2) {
      const code = parseInt(lines[i], 10);
      pairs.push([code, (lines[i + 1] || '').trim()]);
    }

    let entitiesStart = -1;
    for (let i = 0; i < pairs.length - 1; i++) {
      if (pairs[i][0] === 0 && pairs[i][1] === 'SECTION' && pairs[i + 1][0] === 2 && pairs[i + 1][1] === 'ENTITIES') {
        entitiesStart = i + 2;
        break;
      }
    }
    if (entitiesStart === -1) throw new Error('No ENTITIES section found in this DXF file.');

    let entitiesEnd = pairs.length;
    for (let i = entitiesStart; i < pairs.length; i++) {
      if (pairs[i][0] === 0 && pairs[i][1] === 'ENDSEC') { entitiesEnd = i; break; }
    }

    const entityPairs = pairs.slice(entitiesStart, entitiesEnd);
    const rawEntities = [];
    let i = 0;
    while (i < entityPairs.length) {
      if (entityPairs[i][0] !== 0) { i++; continue; }
      const type = entityPairs[i][1];
      i++;
      const attrs = [];
      while (i < entityPairs.length && entityPairs[i][0] !== 0) { attrs.push(entityPairs[i]); i++; }
      const entity = { type, attrs, vertices: null };
      if (type === 'POLYLINE') {
        const vertices = [];
        while (i < entityPairs.length && entityPairs[i][0] === 0 && entityPairs[i][1] === 'VERTEX') {
          i++;
          const vAttrs = [];
          while (i < entityPairs.length && entityPairs[i][0] !== 0) { vAttrs.push(entityPairs[i]); i++; }
          vertices.push(vAttrs);
        }
        if (i < entityPairs.length && entityPairs[i][0] === 0 && entityPairs[i][1] === 'SEQEND') i++;
        entity.vertices = vertices;
      }
      rawEntities.push(entity);
    }

    const getCode = (attrs, code) => {
      const found = attrs.find(a => a[0] === code);
      return found ? found[1] : undefined;
    };
    const getNum = (attrs, code, fallback = 0) => {
      const value = getCode(attrs, code);
      return value === undefined ? fallback : parseFloat(value);
    };

    const closedLoops = [];
    const openSegments = [];

    rawEntities.forEach(entity => {
      if (entity.type === 'LWPOLYLINE') {
        const closed = (getNum(entity.attrs, 70, 0) & 1) === 1;
        const verts = [];
        let cur = null;
        entity.attrs.forEach(([code, value]) => {
          if (code === 10) { if (cur) verts.push(cur); cur = { x: parseFloat(value), y: 0, bulge: 0 }; }
          else if (code === 20 && cur) cur.y = parseFloat(value);
          else if (code === 42 && cur) cur.bulge = parseFloat(value);
        });
        if (cur) verts.push(cur);
        const points = flattenDxfBulgeVertices(verts, closed);
        if (points.length >= 2) (closed ? closedLoops : openSegments).push(points);
      } else if (entity.type === 'POLYLINE' && entity.vertices) {
        const closed = (getNum(entity.attrs, 70, 0) & 1) === 1;
        const verts = entity.vertices.map(vAttrs => ({
          x: getNum(vAttrs, 10, 0),
          y: getNum(vAttrs, 20, 0),
          bulge: getNum(vAttrs, 42, 0)
        }));
        const points = flattenDxfBulgeVertices(verts, closed);
        if (points.length >= 2) (closed ? closedLoops : openSegments).push(points);
      } else if (entity.type === 'LINE') {
        openSegments.push([
          [getNum(entity.attrs, 10, 0), getNum(entity.attrs, 20, 0)],
          [getNum(entity.attrs, 11, 0), getNum(entity.attrs, 21, 0)]
        ]);
      } else if (entity.type === 'ARC') {
        const radius = getNum(entity.attrs, 40, 0);
        if (radius > 0) {
          openSegments.push(sampleDxfArcEntity(
            getNum(entity.attrs, 10, 0), getNum(entity.attrs, 20, 0), radius,
            getNum(entity.attrs, 50, 0), getNum(entity.attrs, 51, 0)
          ));
        }
      } else if (entity.type === 'CIRCLE') {
        const radius = getNum(entity.attrs, 40, 0);
        if (radius > 0) closedLoops.push(sampleDxfCircleEntity(getNum(entity.attrs, 10, 0), getNum(entity.attrs, 20, 0), radius));
      }
    });

    const chainedLoops = chainDxfSegmentsIntoLoops(openSegments);
    const allLoops = [...closedLoops, ...chainedLoops];
    if (!allLoops.length) {
      throw new Error('No closed shape found in this DXF file (looked for closed polylines, or lines/arcs forming a closed loop).');
    }

    let best = allLoops[0];
    let bestArea = Math.abs(polygonArea(best));
    allLoops.slice(1).forEach(loop => {
      const area = Math.abs(polygonArea(loop));
      if (area > bestArea) { best = loop; bestArea = area; }
    });

    return cleanDxfPoints(best, true);
  };

  const importDxfFrameOutlineFromText = (dxfText, fileName = 'frame.dxf') => {
    try {
      const outline = parseDxfOutlineFromText(dxfText);
      if (outline.length < 3) throw new Error('The largest closed shape found has fewer than 3 points.');
      setImportedFrameOutline(outline);
      setImportedFrameFileName(fileName);
    } catch (error) {
      window.alert(`Could not import this DXF as the frame: ${error.message}`);
    }
  };

  const handleFrameDxfFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      importDxfFrameOutlineFromText(String(reader.result || ''), file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getInteriorDropPoint = (e) => {
    const directSvg = e.currentTarget?.tagName?.toLowerCase() === 'svg'
      ? e.currentTarget
      : e.target?.ownerSVGElement;
    const svg = directSvg || previewWheelBlockerRef.current?.querySelector('svg');

    if (!svg?.viewBox?.baseVal) return { x: safeWidth / 2, y: safeHeight / 2 };

    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    return {
      x: (viewBox.x + ((e.clientX - rect.left) / Math.max(1, rect.width)) * viewBox.width) / scale,
      y: (viewBox.y + ((e.clientY - rect.top) / Math.max(1, rect.height)) * viewBox.height) / scale
    };
  };

  const handleInteriorSvgLibraryDrop = async (e) => {
    const boardId = e.dataTransfer.getData(INTERIOR_BOARD_DRAG_TYPE)
      || interiorBoardDragItemRef.current;
    if (boardId) {
      e.preventDefault();
      e.stopPropagation();
      importSavedInteriorBoard(boardId, getInteriorDropPoint(e));
      interiorBoardDragItemRef.current = null;
      return;
    }

    const libraryId = e.dataTransfer.getData(INTERIOR_SVG_LIBRARY_DRAG_TYPE)
      || e.dataTransfer.getData('text/plain')
      || interiorSvgLibraryDragItemRef.current;
    if (!libraryId) return;

    e.preventDefault();
    e.stopPropagation();

    const libraryItem = projectSvgLibraryItems.find(item => item.id === libraryId);
    if (!libraryItem) return;

    const svgText = await loadProjectSvgLibraryItemText(libraryItem);
    addInteriorSvgDesignFromText(svgText, libraryItem.name, getInteriorDropPoint(e));
    interiorSvgLibraryDragItemRef.current = null;
  };

  const getInteriorViewportCenterPoint = () => {
    const viewBox = getCurrentViewBox();
    return {
      x: (viewBox.x + viewBox.width / 2) / scale,
      y: (viewBox.y + viewBox.height / 2) / scale
    };
  };

  const cloneInteriorDesignTreeWithNewIds = (design, idMap) => {
    const nextId = crypto.randomUUID();
    idMap.set(design.id, nextId);
    return {
      ...design,
      id: nextId,
      children: (design.children || []).map(child => cloneInteriorDesignTreeWithNewIds(child, idMap))
    };
  };

  const remapInteriorClipSourceIds = (design, idMap) => ({
    ...design,
    clipSourceId: design.clipSourceId && idMap.has(design.clipSourceId)
      ? idMap.get(design.clipSourceId)
      : design.clipSourceId,
    children: (design.children || []).map(child => remapInteriorClipSourceIds(child, idMap))
  });

  const shiftInteriorDesignTree = (design, dx, dy) => {
    const shiftPoint = (point) => [point[0] + dx, point[1] + dy];
    const next = { ...design };

    if (next.clipBounds) {
      next.clipBounds = { ...next.clipBounds, x: n(next.clipBounds.x, 0) + dx, y: n(next.clipBounds.y, 0) + dy };
    }

    if (isInteriorGroup(next)) {
      return {
        ...next,
        children: (next.children || []).map(child => shiftInteriorDesignTree(child, dx, dy))
      };
    }

    if (next.kind === 'line') {
      return {
        ...next,
        x1: n(next.x1, 0) + dx,
        y1: n(next.y1, 0) + dy,
        x2: n(next.x2, 0) + dx,
        y2: n(next.y2, 0) + dy
      };
    }

    if (next.kind === 'arc') {
      return {
        ...next,
        x1: n(next.x1, 0) + dx,
        y1: n(next.y1, 0) + dy,
        x2: n(next.x2, 0) + dx,
        y2: n(next.y2, 0) + dy,
        x3: n(next.x3, 0) + dx,
        y3: n(next.y3, 0) + dy
      };
    }

    if (next.kind === 'polygon') {
      return { ...next, points: (next.points || []).map(shiftPoint) };
    }

    if (next.kind === 'eraser') {
      return { ...next, points: (next.points || []).map(shiftPoint) };
    }

    return {
      ...next,
      x: n(next.x, 0) + dx,
      y: n(next.y, 0) + dy
    };
  };

  const getSavedInteriorBoardImportItems = (board) => {
    const idMap = new Map();
    return [...(board.designs || []), ...(board.patternShapes || [])]
      .map(design => cloneInteriorDesignTreeWithNewIds(design, idMap))
      .map(design => remapInteriorClipSourceIds(design, idMap));
  };

  const getInteriorBoardThumbnail = () => {
    const svg = previewWheelBlockerRef.current?.querySelector('svg');
    if (!svg) return '';

    const clone = svg.cloneNode(true);
    const base = getBaseViewBox();
    clone.setAttribute('viewBox', `${base.x} ${base.y} ${base.width} ${base.height}`);
    clone.setAttribute('width', '360');
    clone.setAttribute('height', '220');
    return svgTextToDataUrl(new XMLSerializer().serializeToString(clone));
  };

  const saveCurrentInteriorBoard = () => {
    const patternShapes = getPatternContours().map((contour, index) => ({
      id: crypto.randomUUID(),
      kind: 'polygon',
      name: `Saved pattern ${index + 1}`,
      color: 'white',
      points: contour.points,
      aspectLocked: false,
      rotation: 0,
      mirrorX: false,
      mirrorY: false
    }));

    const board = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      thumbnail: getInteriorBoardThumbnail(),
      framePanelSets: getPanelVertexSets().map(panel => transformPoints(panel)),
      marginBoundarySets: interiorMarginBoundarySets.map(panel => panel.map(point => [...point])),
      frame: {
        width: safeWidth,
        height: safeHeight,
        cornerAngle: safeCornerAngle,
        exportStraightenAngleRad: isAngledPanel ? Math.atan2(shearOffset, angledRun) : 0,
        topShape,
        hasPanelSplit,
        bottomPanelEnabled
      },
      frameSettings: getFrameSettingsSnapshot(),
      designs: cloneInteriorDesigns(interiorDesignsRef.current),
      patternShapes,
      settings: {
        interiorClipEnabled,
        interiorMarginInput,
        patternEnabled,
        patternMode,
        patternThickness,
        patternMinLength,
        patternMaxLength,
        patternRowSpacing,
        patternGap,
        patternSeed,
        patternRoundedEnds,
        patternRandomRowSpacing,
        patternRandomGap,
        patternRandomDirectionEnabled,
        patternRandomDirectionAmount,
        alignedSlotRows,
        alignedSlotBottomRows,
        alignedSlotBreakWidth,
        alignedSlotLeftInset,
        alignedSlotRightInset,
        alignedSlotMinLength,
        alignedSlotUseRowSpacing,
        alignedSlotRowSpacing,
        alignedSlotStaggerBreaks,
        alignedSlotRowOffsetInput,
        patternLocked,
        lockedPatternContours,
        excludedPatternSlotIds
      }
    };

    setSavedInteriorBoards(prev => [board, ...prev]);
    setShowInteriorBoardsMenu(true);
    showInteriorPositionMessage('Board saved.');
    return board;
  };

  const importSavedInteriorBoard = (boardId, point = getInteriorViewportCenterPoint()) => {
    const board = savedInteriorBoards.find(item => item.id === boardId);
    if (!board) return;

    const items = getSavedInteriorBoardImportItems(board);
    if (!items.length) return;

    const bounds = getInteriorSelectionBounds(items);
    const dx = point.x - (bounds.x + bounds.width / 2);
    const dy = point.y - (bounds.y + bounds.height / 2);
    const shifted = items.map(item => shiftInteriorDesignTree(item, dx, dy));

    applyInteriorDesigns(prev => [...prev, ...shifted], {
      history: true,
      selectedId: shifted[shifted.length - 1]?.id
    });
    setSelectedInteriorDesignIds(shifted.map(item => item.id));
  };

  const importFullBoard = (boardId) => {
    const board = savedInteriorBoards.find(item => item.id === boardId);
    if (!board) return;

    if (board.frameSettings) applyFrameSettingsSnapshot(board.frameSettings);

    const settings = board.settings || {};
    const settingsSetters = {
      interiorClipEnabled: setInteriorClipEnabled,
      interiorMarginInput: setInteriorMarginInput,
      patternEnabled: setPatternEnabled,
      patternMode: setPatternMode,
      patternThickness: setPatternThickness,
      patternMinLength: setPatternMinLength,
      patternMaxLength: setPatternMaxLength,
      patternRowSpacing: setPatternRowSpacing,
      patternGap: setPatternGap,
      patternSeed: setPatternSeed,
      patternRoundedEnds: setPatternRoundedEnds,
      patternRandomRowSpacing: setPatternRandomRowSpacing,
      patternRandomGap: setPatternRandomGap,
      patternRandomDirectionEnabled: setPatternRandomDirectionEnabled,
      patternRandomDirectionAmount: setPatternRandomDirectionAmount,
      alignedSlotRows: setAlignedSlotRows,
      alignedSlotBottomRows: setAlignedSlotBottomRows,
      alignedSlotBreakWidth: setAlignedSlotBreakWidth,
      alignedSlotLeftInset: setAlignedSlotLeftInset,
      alignedSlotRightInset: setAlignedSlotRightInset,
      alignedSlotMinLength: setAlignedSlotMinLength,
      alignedSlotUseRowSpacing: setAlignedSlotUseRowSpacing,
      alignedSlotRowSpacing: setAlignedSlotRowSpacing,
      alignedSlotStaggerBreaks: setAlignedSlotStaggerBreaks,
      alignedSlotRowOffsetInput: setAlignedSlotRowOffsetInput,
      patternLocked: setPatternLocked,
      lockedPatternContours: setLockedPatternContours,
      excludedPatternSlotIds: setExcludedPatternSlotIds
    };
    Object.entries(settingsSetters).forEach(([key, setter]) => {
      if (settings[key] !== undefined) setter(settings[key]);
    });

    setInteriorDesigns(cloneInteriorDesigns(board.designs || []));
    setSelectedInteriorDesignId(null);
    setSelectedInteriorDesignIds([]);
    setShowInteriorBoardsMenu(false);
    showInteriorPositionMessage('Board loaded.');
  };

  const requestFullBoardImport = (boardId) => {
    setPendingBoardImportId(boardId);
  };

  const confirmSaveThenImportBoard = () => {
    saveCurrentInteriorBoard();
    importFullBoard(pendingBoardImportId);
    setPendingBoardImportId(null);
  };

  const confirmDiscardAndImportBoard = () => {
    importFullBoard(pendingBoardImportId);
    setPendingBoardImportId(null);
  };

  const cancelBoardImport = () => {
    setPendingBoardImportId(null);
  };

  const deleteSavedInteriorBoard = (boardId) => {
    setSavedInteriorBoards(prev => prev.filter(board => board.id !== boardId));
  };

  const startInteriorDesignDrag = (e, design, mode, handle = null) => {
    if (activeInteriorShapeTool) return;
    if (activeTool === 'measure' || activeTool === 'angle') return;
    if (e.button !== 0) return;
    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const point = getSvgPoint(e);
    if (mode === 'move' && (design.color || 'white') === 'white' && !isInteriorPointOnWhiteDesignSurface(point, true)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const bounds = getInteriorObjectBounds(design);
    const [centerX, centerY] = getInteriorTransformCenter(bounds);
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

    if (mode === 'rotate' && selectedIds.includes(design.id) && selectedIds.length > 1) {
      const selected = interiorDesignsRef.current.filter(item => selectedIds.includes(item.id));
      const group = getInteriorSelectionBounds(selected);
      const [gcx, gcy] = getInteriorTransformCenter(group);
      setInteriorDrag({
        id: design.id,
        ids: selectedIds,
        mode: 'multi-rotate',
        startMouse: [point.x, point.y],
        startAngle: Math.atan2(point.y - gcy, point.x - gcx),
        startGroup: group,
        startDesigns: selected.map(item => ({ ...item, ...getInteriorObjectBounds(item) }))
      });
      return;
    }

    setInteriorDrag({
      id: design.id,
      mode,
      handle,
      startMouse: [point.x, point.y],
      startAngle: Math.atan2(point.y - centerY, point.x - centerX),
      transformCenter: [centerX, centerY],
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
    const drawingPoint = activeInteriorShapeTool && activeInteriorShapeTool !== 'eraser'
      ? activeInteriorShapeTool === 'line'
        ? getInteriorLineDrawingPoint(e, interiorShapeDraft ? { x: interiorShapeDraft.x1, y: interiorShapeDraft.y1 } : null)
        : getInteriorDrawingPoint(e, true)
      : point;
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

    if (pendingPatternPathSourceId) {
      setHoveredPatternPathEdge(findNearestPatternPathEdge(point.x, point.y, pendingPatternPathSourceId));
      return;
    }

    if (interiorSelectionBox) {
      setInteriorSelectionBox(prev => prev ? { ...prev, x2: point.x, y2: point.y } : prev);
      return;
    }

    if (interiorShapeDraft) {
      if (interiorShapeDraft.kind === 'arc') {
        setHoverSnap(drawingPoint.x !== point.x || drawingPoint.y !== point.y ? [drawingPoint.x, drawingPoint.y] : null);
        setInteriorShapeDraft(prev => prev ? { ...prev, preview: [drawingPoint.x, drawingPoint.y] } : prev);
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
        setHoverSnap(drawingPoint.x !== point.x || drawingPoint.y !== point.y ? [drawingPoint.x, drawingPoint.y] : null);
        setInteriorShapeDraft(prev => prev ? { ...prev, x2: drawingPoint.x, y2: drawingPoint.y } : prev);
        return;
      }
    }

    if (activeInteriorShapeTool && activeInteriorShapeTool !== 'eraser') {
      setHoverSnap(drawingPoint.x !== point.x || drawingPoint.y !== point.y ? [drawingPoint.x, drawingPoint.y] : null);
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

    if (interiorDrag.mode === 'multi-rotate') {
      const group = interiorDrag.startGroup;
      const [gcx, gcy] = getInteriorTransformCenter(group);
      const nextAngle = Math.atan2(point.y - gcy, point.x - gcx);
      const rotationDelta = (nextAngle - interiorDrag.startAngle) * 180 / Math.PI;
      const angle = rotationDelta * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      applyInteriorDesigns(prev => prev.map(item => {
        const startItem = interiorDrag.startDesigns.find(design => design.id === item.id);
        if (!startItem) return item;
        const [cx, cy] = getInteriorTransformCenter(startItem);
        const centerDx = cx - gcx;
        const centerDy = cy - gcy;
        const nextCx = gcx + centerDx * cos - centerDy * sin;
        const nextCy = gcy + centerDx * sin + centerDy * cos;
        const moved = applyInteriorObjectBounds(startItem, {
          x: nextCx - startItem.width / 2,
          y: nextCy - startItem.height / 2,
          width: startItem.width,
          height: startItem.height
        });
        return {
          ...item,
          ...moved,
          rotation: n(startItem.rotation, 0) + rotationDelta
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

    if (interiorDrag.mode === 'rotate') {
      const [cx, cy] = interiorDrag.transformCenter;
      const nextAngle = Math.atan2(point.y - cy, point.x - cx);
      updateInteriorDesign(interiorDrag.id, {
        rotation: n(start.rotation, 0) + (nextAngle - interiorDrag.startAngle) * 180 / Math.PI
      }, { history: false });
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
      } else if (String(interiorDrag.handle).startsWith('poly-')) {
        const pointIndex = Number(String(interiorDrag.handle).replace('poly-', ''));
        next.points = (start.points || []).map((point, index) => (
          index === pointIndex ? [point[0] + dx, point[1] + dy] : point
        ));
      } else if (String(interiorDrag.handle).startsWith('edit-')) {
        const [, contourIndexStr, pointIndexStr] = String(interiorDrag.handle).split('-');
        const contourIndex = Number(contourIndexStr);
        const pointIndex = Number(pointIndexStr);
        next.contours = (start.contours || []).map((contour, cIndex) => (
          cIndex !== contourIndex ? contour : {
            ...contour,
            points: contour.points.map((point, pIndex) => (
              pIndex === pointIndex ? [point[0] + dx, point[1] + dy] : point
            ))
          }
        ));
      } else if (String(interiorDrag.handle).startsWith('bend-')) {
        const bendIndex = Number(String(interiorDrag.handle).replace('bend-', ''));
        next.bendPoints = (start.bendPoints || []).map((point, index) => (
          index === bendIndex ? [point[0] + dx, point[1] + dy] : point
        ));
      }

      updateInteriorDesign(interiorDrag.id, { ...next, ...getInteriorObjectBounds(next) }, { history: false });
      return;
    }

    const next = { ...start };
    const handle = interiorDrag.handle;
    const ratio = Math.max(0.0001, n(start.aspectRatio, start.width / start.height || 1));
    const rotation = n(start.rotation, 0);

    if (rotation) {
      // Resize in the shape's own (rotated) frame: un-rotate the mouse delta into local axes,
      // resize there, then solve for the new center that keeps the opposite corner/edge fixed
      // in world space (the same anchor a non-rotated resize keeps fixed).
      const rotRad = rotation * Math.PI / 180;
      const cosR = Math.cos(rotRad);
      const sinR = Math.sin(rotRad);
      const localDx = dx * cosR + dy * sinR;
      const localDy = -dx * sinR + dy * cosR;

      let nextWidth = start.width;
      let nextHeight = start.height;
      if (handle.includes('e')) nextWidth = Math.max(minSize, start.width + localDx);
      if (handle.includes('w')) nextWidth = Math.max(minSize, start.width - localDx);
      if (handle.includes('s')) nextHeight = Math.max(minSize, start.height + localDy);
      if (handle.includes('n')) nextHeight = Math.max(minSize, start.height - localDy);

      if (start.aspectLocked) {
        const widthDriven = handle.includes('e') || handle.includes('w');
        const heightDriven = handle.includes('n') || handle.includes('s');
        if (widthDriven && (!heightDriven || Math.abs(localDx) >= Math.abs(localDy))) {
          nextHeight = Math.max(minSize, nextWidth / ratio);
        } else {
          nextWidth = Math.max(minSize, nextHeight * ratio);
        }
      }

      const anchorLocalX = handle.includes('e') ? -start.width / 2 : handle.includes('w') ? start.width / 2 : 0;
      const anchorLocalY = handle.includes('s') ? -start.height / 2 : handle.includes('n') ? start.height / 2 : 0;
      const [c0x, c0y] = getInteriorTransformCenter(start);
      const anchorWorldX = c0x + anchorLocalX * cosR - anchorLocalY * sinR;
      const anchorWorldY = c0y + anchorLocalX * sinR + anchorLocalY * cosR;

      const anchorLocalXNext = handle.includes('e') ? -nextWidth / 2 : handle.includes('w') ? nextWidth / 2 : 0;
      const anchorLocalYNext = handle.includes('s') ? -nextHeight / 2 : handle.includes('n') ? nextHeight / 2 : 0;
      const nextCenterX = anchorWorldX - (anchorLocalXNext * cosR - anchorLocalYNext * sinR);
      const nextCenterY = anchorWorldY - (anchorLocalXNext * sinR + anchorLocalYNext * cosR);

      updateInteriorDesign(interiorDrag.id, applyInteriorObjectBounds(start, {
        x: nextCenterX - nextWidth / 2,
        y: nextCenterY - nextHeight / 2,
        width: nextWidth,
        height: nextHeight
      }), { history: false });
      return;
    }

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
    setInteriorDimensionDrafts(prev => ({ ...prev, [field]: value }));
    if (value === '') return;
    const rawNumber = Number(value);
    if (!Number.isFinite(rawNumber)) return;

    if (selectedInteriorDesignIds.length > 1 && ['x', 'y', 'width', 'height'].includes(field)) {
      const bounds = getInteriorSelectionBounds(interiorDesigns.filter(item => selectedInteriorDesignIds.includes(item.id)));
      const nextBounds = { ...bounds, [field]: field === 'width' || field === 'height' ? Math.max(10, rawNumber) : rawNumber };
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

    const min = field === 'width' || field === 'height' ? 10 : -Infinity;
    const numericValue = Math.max(min, rawNumber);
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
    const draftedValue = interiorDimensionDrafts[field];
    if (draftedValue === '') {
      clearInteriorDimensionDraft(field);
      return;
    }

    if (selectedInteriorDesignIds.length > 1 && ['x', 'y', 'width', 'height'].includes(field)) {
      clearInteriorDimensionDraft(field);
      return;
    }

    const design = getSelectedInteriorDesign();
    if (!design) {
      clearInteriorDimensionDraft(field);
      return;
    }

    const min = field === 'width' || field === 'height' ? 10 : -Infinity;
    const numericValue = Math.max(min, n(design[field], fallback));
    const ratio = Math.max(0.0001, n(design.aspectRatio, getInteriorAspectRatio(design)));
    const bounds = getInteriorObjectBounds(design);
    const isBoundsField = ['x', 'y', 'width', 'height'].includes(field);

    if (design.aspectLocked && field === 'width') {
      updateInteriorDesign(design.id, applyInteriorObjectBounds(design, { ...bounds, width: numericValue, height: Math.max(10, numericValue / ratio) }));
      clearInteriorDimensionDraft(field);
      return;
    }

    if (design.aspectLocked && field === 'height') {
      updateInteriorDesign(design.id, applyInteriorObjectBounds(design, { ...bounds, height: numericValue, width: Math.max(10, numericValue * ratio) }));
      clearInteriorDimensionDraft(field);
      return;
    }

    if (isBoundsField) {
      updateInteriorDesign(design.id, applyInteriorObjectBounds(design, { ...bounds, [field]: numericValue }));
      clearInteriorDimensionDraft(field);
      return;
    }

    updateInteriorDesign(design.id, { [field]: numericValue });
    clearInteriorDimensionDraft(field);
  };

  const getActiveInteriorTransformIds = () => (
    selectedInteriorDesignIds.length ? selectedInteriorDesignIds : [selectedInteriorDesignId].filter(Boolean)
  );

  const transformInteriorSelection = ({ rotationDelta = 0, mirrorX = false, mirrorY = false }) => {
    const ids = getActiveInteriorTransformIds();
    if (!ids.length) return;

    const selected = interiorDesignsRef.current.filter(item => ids.includes(item.id));
    const groupBounds = getInteriorSelectionBounds(selected);
    const [gcx, gcy] = getInteriorTransformCenter(groupBounds);
    const angle = rotationDelta * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    applyInteriorDesigns(prev => prev.map(item => {
      if (!ids.includes(item.id)) return item;

      const bounds = getInteriorObjectBounds(item);
      const [cx, cy] = getInteriorTransformCenter(bounds);
      let nextCx = cx;
      let nextCy = cy;

      if (mirrorX) nextCx = gcx - (nextCx - gcx);
      if (mirrorY) nextCy = gcy - (nextCy - gcy);

      if (rotationDelta) {
        const dx = nextCx - gcx;
        const dy = nextCy - gcy;
        nextCx = gcx + dx * cos - dy * sin;
        nextCy = gcy + dx * sin + dy * cos;
      }

      const moved = applyInteriorObjectBounds(item, {
        x: nextCx - bounds.width / 2,
        y: nextCy - bounds.height / 2,
        width: bounds.width,
        height: bounds.height
      });

      return {
        ...item,
        ...moved,
        rotation: n(item.rotation, 0) + rotationDelta,
        mirrorX: mirrorX ? !item.mirrorX : Boolean(item.mirrorX),
        mirrorY: mirrorY ? !item.mirrorY : Boolean(item.mirrorY)
      };
    }));
  };

  const setInteriorSelectionRotation = (value) => {
    setInteriorDimensionDrafts(prev => ({ ...prev, rotation: value }));
    if (value === '') return;
    const target = Number(value);
    if (!Number.isFinite(target)) return;
    const current = n(selectedInteriorDesign?.rotation, 0);
    transformInteriorSelection({ rotationDelta: target - current });
  };

  const handleInteriorRotationBlur = () => {
    const ids = getActiveInteriorTransformIds();
    if (!ids.length) {
      clearInteriorDimensionDraft('rotation');
      return;
    }

    const selected = interiorDesignsRef.current.find(item => item.id === ids[ids.length - 1]);
    const value = n(selected?.rotation, 0);
    applyInteriorDesigns(prev => prev.map(item => (
      ids.includes(item.id) ? { ...item, rotation: n(item.rotation, value) } : item
    )));
    clearInteriorDimensionDraft('rotation');
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
    const [cx, cy] = getInteriorTransformCenter(bounds);
    interiorDragStartSnapshotRef.current = cloneInteriorDesigns(interiorDesignsRef.current);
    setInteriorDrag({
      mode,
      handle,
      ids: selectedInteriorDesignIdsRef.current,
      startMouse: [point.x, point.y],
      startAngle: Math.atan2(point.y - cy, point.x - cx),
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
    if (interiorSuppressNextObjectClickRef.current) {
      interiorSuppressNextObjectClickRef.current = false;
      return;
    }
    if (activeInteriorShapeTool) return;
    if (activeTool === 'measure' || activeTool === 'angle') return;

    const design = interiorDesignsRef.current.find(item => item.id === designId)
      || flattenInteriorDesigns(interiorDesignsRef.current).find(item => item.id === designId);
    if (design && (design.color || 'white') === 'white') {
      const point = getSvgPoint(e);
      if (!isInteriorPointOnWhiteDesignSurface(point, true)) return;
    }

    e.stopPropagation();
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

  const switchWorkspaceMode = (mode) => {
    const applyModeSwitch = () => {
      clearMeasureTool();
      cancelInteriorShapeTool();
      setWorkspaceMode(mode);
    };

    if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
      document.startViewTransition(applyModeSwitch);
    } else {
      applyModeSwitch();
    }
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
    if (!['measure', 'angle', 'add-ear', 'delete-ear'].includes(activeTool)) return;
    e.stopPropagation();
    if (draggingMeasurement) return;

    const { x, y } = getSvgPoint(e);

    if (activeTool === 'add-ear') {
      const target = getFrameEarAddTarget({ x, y });
      if (target) addManualFrameEar(target);
      return;
    }

    if (activeTool === 'delete-ear') {
      const target = getFrameEarDeleteTarget({ x, y });
      if (target) deleteManualFrameEar(target);
      return;
    }

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
  const DXF_OPTIMIZE_POINT_TOLERANCE = 0.02;
  const DXF_OPTIMIZE_COLINEAR_TOLERANCE = 0.015;
  const DXF_OPTIMIZE_SIMPLIFY_TOLERANCE = 0.08;
  const DXF_OPTIMIZE_DEDUPE_PRECISION = 0.02;
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

  const cleanDxfPoints = (points, closed, options = {}) => {
    const pointTolerance = options.pointTolerance ?? 0.01;
    const colinearTolerance = options.colinearTolerance ?? 0.005;
    const cleaned = [];

    points.forEach(point => {
      const last = cleaned[cleaned.length - 1];
      if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > pointTolerance) {
        cleaned.push(point);
      }
    });

    if (closed && cleaned.length > 2) {
      const first = cleaned[0];
      const last = cleaned[cleaned.length - 1];
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= pointTolerance) {
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
        const deviation = cross / base;

        // A deviation this close to zero is a genuinely straight run (safe to merge no matter how
        // long the result gets). Anything above that but still under colinearTolerance is a curve
        // sampled finely enough to look "nearly straight" locally — merging those unboundedly is
        // exactly what silently re-coarsens a smooth curve (small radius deviation, but large chord
        // for a big-radius arc) back into visible facets, so those merges stay capped at
        // MAX_CURVE_CHORD_MM.
        if (deviation < colinearTolerance && (deviation <= 0.000001 || base <= MAX_CURVE_CHORD_MM)) {
          cleaned.splice(i, 1);
          changed = true;
          break;
        }
      }
    }

    return cleaned;
  };

  const perpendicularDistanceToLine = (point, start, end) => {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy);
    if (length <= 0.000001) return Math.hypot(point[0] - start[0], point[1] - start[1]);
    return Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / length;
  };

  const simplifyOpenPolyline = (points, tolerance) => {
    if (points.length <= 2) return points;

    let maxDistance = 0;
    let splitIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const distance = perpendicularDistanceToLine(points[i], start, end);
      if (distance > maxDistance) {
        maxDistance = distance;
        splitIndex = i;
      }
    }

    // Deviation-only tolerance (classic Douglas-Peucker) has no notion of segment length, so a big
    // enough radius keeps deviation under `tolerance` for a long, visibly-straight-looking chord —
    // same "big curve, coarse facet" bug as elsewhere. A near-zero deviation is a genuinely
    // straight run (fine to keep as one long segment); anything above that gets a chord cap too.
    const chordLength = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (maxDistance <= tolerance && (maxDistance <= 0.000001 || chordLength <= MAX_CURVE_CHORD_MM)) return [start, end];

    const left = simplifyOpenPolyline(points.slice(0, splitIndex + 1), tolerance);
    const right = simplifyOpenPolyline(points.slice(splitIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  };

  const simplifyClosedPolyline = (points, tolerance) => {
    if (points.length <= 3) return points;

    let splitIndex = 1;
    let maxDistance = 0;
    for (let i = 1; i < points.length; i++) {
      const distance = Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]);
      if (distance > maxDistance) {
        maxDistance = distance;
        splitIndex = i;
      }
    }

    if (maxDistance <= tolerance) return points;

    const firstHalf = simplifyOpenPolyline(points.slice(0, splitIndex + 1), tolerance);
    const secondHalf = simplifyOpenPolyline([...points.slice(splitIndex), points[0]], tolerance);
    const simplified = [...firstHalf, ...secondHalf.slice(1, -1)];
    return simplified.length >= 3 ? simplified : points;
  };

  const optimizeDxfContourPoints = (points, closed) => {
    const cleaned = cleanDxfPoints(points, closed, {
      pointTolerance: DXF_OPTIMIZE_POINT_TOLERANCE,
      colinearTolerance: DXF_OPTIMIZE_COLINEAR_TOLERANCE
    });

    const simplified = closed
      ? simplifyClosedPolyline(cleaned, DXF_OPTIMIZE_SIMPLIFY_TOLERANCE)
      : simplifyOpenPolyline(cleaned, DXF_OPTIMIZE_SIMPLIFY_TOLERANCE);

    return cleanDxfPoints(simplified, closed, {
      pointTolerance: DXF_OPTIMIZE_POINT_TOLERANCE,
      colinearTolerance: DXF_OPTIMIZE_COLINEAR_TOLERANCE
    });
  };

  const getCanonicalContourKey = (contour) => {
    const points = contour.points || [];
    const tokens = points.map(([x, y]) => (
      `${Math.round(x / DXF_OPTIMIZE_DEDUPE_PRECISION)},${Math.round(y / DXF_OPTIMIZE_DEDUPE_PRECISION)}`
    ));
    if (!tokens.length) return `${contour.closed ? 'C' : 'O'}|empty`;

    const rotateFromSmallest = (items) => {
      let startIndex = 0;
      for (let i = 1; i < items.length; i++) {
        if (items[i] < items[startIndex]) startIndex = i;
      }
      return [...items.slice(startIndex), ...items.slice(0, startIndex)].join('|');
    };

    if (!contour.closed) {
      const forward = tokens.join('|');
      const reverse = [...tokens].reverse().join('|');
      return `O|${forward < reverse ? forward : reverse}`;
    }

    const forward = rotateFromSmallest(tokens);
    const reverse = rotateFromSmallest([...tokens].reverse());
    return `C|${forward < reverse ? forward : reverse}`;
  };

  const optimizeDxfContours = (contours) => {
    const seen = new Set();
    const optimized = [];

    contours.forEach(contour => {
      const points = optimizeDxfContourPoints(contour.points || [], contour.closed);
      if (points.length < (contour.closed ? 3 : 2)) return;

      const nextContour = {
        ...contour,
        points,
        area: contour.closed ? Math.abs(signedPolygonArea(points)) : contour.area
      };
      const key = getCanonicalContourKey(nextContour);
      if (seen.has(key)) return;

      seen.add(key);
      optimized.push(nextContour);
    });

    return optimized;
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

  const dxfContourEntity = (contour) => {
    return dxfPolylineEntity(contour.points, contour.closed, contour.layer);
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

  const invertMatrix = (matrix) => {
    const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
    if (Math.abs(determinant) < 0.000001) return null;

    return [
      matrix[3] / determinant,
      -matrix[1] / determinant,
      -matrix[2] / determinant,
      matrix[0] / determinant,
      (matrix[2] * matrix[5] - matrix[3] * matrix[4]) / determinant,
      (matrix[1] * matrix[4] - matrix[0] * matrix[5]) / determinant
    ];
  };

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

  const parseSvgLengthValue = (value, reference, fallback = 0) => {
    const raw = String(value ?? '').trim();
    if (!raw) return fallback;
    if (raw.endsWith('%')) {
      const percent = parseFloat(raw);
      return Number.isFinite(percent) ? reference * percent / 100 : fallback;
    }

    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const isSvgCanvasBackgroundRect = (node, svg) => {
    if (!node || node.tagName?.toLowerCase() !== 'rect') return false;

    const rootBox = getSvgRootBox(svg);
    const x = parseSvgLengthValue(node.getAttribute('x'), rootBox.width, rootBox.x);
    const y = parseSvgLengthValue(node.getAttribute('y'), rootBox.height, rootBox.y);
    const widthValue = parseSvgLengthValue(node.getAttribute('width'), rootBox.width, 0);
    const heightValue = parseSvgLengthValue(node.getAttribute('height'), rootBox.height, 0);
    const coversRoot = Math.abs(x - rootBox.x) <= 0.01
      && Math.abs(y - rootBox.y) <= 0.01
      && Math.abs(widthValue - rootBox.width) <= 0.01
      && Math.abs(heightValue - rootBox.height) <= 0.01;
    if (!coversRoot) return false;

    const fill = (node.getAttribute('fill') || parseStyleDeclaration(node.getAttribute('style') || '').fill || '').trim().toLowerCase();
    const stroke = (node.getAttribute('stroke') || parseStyleDeclaration(node.getAttribute('style') || '').stroke || '').trim().toLowerCase();
    return Boolean(fill) && fill !== 'none' && (!stroke || stroke === 'none');
  };

  const removeSvgCanvasBackground = (svgText) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText || '', 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg || doc.querySelector('parsererror')) return svgText;

    Array.from(svg.children).forEach(child => {
      if (isSvgCanvasBackgroundRect(child, svg)) child.remove();
    });

    return new XMLSerializer().serializeToString(svg);
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

  // A deviation-only stop condition (flatness <= tolerance) doesn't bound chord length: sagitta
  // relates to chord via sagitta ≈ chord²/(8r), so a big-radius curve (e.g. a large rounded
  // letter) can stay "flat enough" at a much longer chord than a small-radius one — same
  // radius-dependent facet-widening bug fixed elsewhere. maxChord caps it directly; a
  // near-zero-flatness span (genuinely straight) is still allowed to merge at any length.
  const addFlattenedCubic = (points, p0, p1, p2, p3, tolerance, maxChord = Infinity, depth = 0) => {
    const flatness = Math.max(distancePointToLine(p1, p0, p3), distancePointToLine(p2, p0, p3));
    const chordLength = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]);
    if (depth >= 14 || (flatness <= tolerance && (flatness <= 0.000001 || chordLength <= maxChord))) {
      points.push(p3);
      return;
    }

    const p01 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    const p12 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    const p23 = [(p2[0] + p3[0]) / 2, (p2[1] + p3[1]) / 2];
    const p012 = [(p01[0] + p12[0]) / 2, (p01[1] + p12[1]) / 2];
    const p123 = [(p12[0] + p23[0]) / 2, (p12[1] + p23[1]) / 2];
    const p0123 = [(p012[0] + p123[0]) / 2, (p012[1] + p123[1]) / 2];

    addFlattenedCubic(points, p0, p01, p012, p0123, tolerance, maxChord, depth + 1);
    addFlattenedCubic(points, p0123, p123, p23, p3, tolerance, maxChord, depth + 1);
  };

  const getInteriorFont = (fontFamily) => (
    loadedInteriorFonts[fontFamily] || loadedInteriorFonts[interiorFontOptions[0]?.value]
  );

  const buildInteriorTextPathData = (design, fontSize = 100) => {
    const font = getInteriorFont(design.fontFamily);
    const text = design.text || '';
    if (!font || !text) return null;

    const path = new opentype.Path();
    const letterSpacing = n(design.letterSpacing, 0) * (fontSize / Math.max(1, n(design.height, fontSize)));
    let cursorX = 0;

    Array.from(text).forEach(char => {
      const glyphPath = font.getPath(char, cursorX, 0, fontSize);
      path.commands.push(...glyphPath.commands);
      cursorX += font.getAdvanceWidth(char, fontSize) + letterSpacing;
    });

    const box = path.getBoundingBox();
    if (!Number.isFinite(box.x1) || !Number.isFinite(box.y1) || box.x2 - box.x1 <= 0 || box.y2 - box.y1 <= 0) {
      return null;
    }

    return {
      path,
      box: {
        x: box.x1,
        y: box.y1,
        width: box.x2 - box.x1,
        height: box.y2 - box.y1
      }
    };
  };

  const transformInteriorTextPoint = (point, textData, bounds) => {
    const sx = bounds.width / Math.max(0.001, textData.box.width);
    const sy = bounds.height / Math.max(0.001, textData.box.height);
    return [
      bounds.x + (point[0] - textData.box.x) * sx,
      bounds.y + (point[1] - textData.box.y) * sy
    ];
  };

  // Glyph curves are flattened in the FONT's own unit space (fontSize=100), well before the
  // result gets scaled up to the text design's actual physical size — a fixed tolerance here (the
  // old behavior) means large lettering inherits a proportionally large real-world deviation on
  // every curved letter (C/O/S/etc.), the same "big shape, coarse facet" bug fixed elsewhere.
  // `chordTarget` is a physical-mm deviation target; it gets converted to font-unit space using
  // this design's own font-size-to-physical-size scale before flattening.
  const flattenInteriorTextPath = (design, chordTarget = PREVIEW_CURVE_CHORD_MM) => {
    const textData = buildInteriorTextPathData(design);
    if (!textData) return [];

    const bounds = getInteriorObjectBounds(design);
    const glyphScaleX = bounds.width / Math.max(0.001, textData.box.width);
    const glyphScaleY = bounds.height / Math.max(0.001, textData.box.height);
    const tolerance = Math.max(0.005, chordTarget / Math.max(0.0001, Math.max(glyphScaleX, glyphScaleY)));
    const contours = [];
    let current = [0, 0];
    let start = [0, 0];
    let points = [];

    const pushPoint = (point) => {
      const transformed = transformInteriorTextPoint(point, textData, bounds);
      const last = points[points.length - 1];
      if (!last || Math.hypot(transformed[0] - last[0], transformed[1] - last[1]) > 0.01) {
        points.push(transformed);
      }
    };

    const closeCurrent = () => {
      if (points.length >= 3) contours.push(cleanDxfPoints(points, true));
      points = [];
    };

    textData.path.commands.forEach(command => {
      if (command.type === 'M') {
        closeCurrent();
        current = [command.x, command.y];
        start = current;
        pushPoint(current);
        return;
      }

      if (command.type === 'L') {
        current = [command.x, command.y];
        pushPoint(current);
        return;
      }

      if (command.type === 'Q') {
        const p0 = current;
        const p1 = [command.x1, command.y1];
        const p2 = [command.x, command.y];
        const cubic1 = [
          p0[0] + (2 / 3) * (p1[0] - p0[0]),
          p0[1] + (2 / 3) * (p1[1] - p0[1])
        ];
        const cubic2 = [
          p2[0] + (2 / 3) * (p1[0] - p2[0]),
          p2[1] + (2 / 3) * (p1[1] - p2[1])
        ];
        const curvePoints = [];
        addFlattenedCubic(curvePoints, p0, cubic1, cubic2, p2, tolerance, tolerance);
        curvePoints.forEach(pushPoint);
        current = p2;
        return;
      }

      if (command.type === 'C') {
        const p0 = current;
        const p1 = [command.x1, command.y1];
        const p2 = [command.x2, command.y2];
        const p3 = [command.x, command.y];
        const curvePoints = [];
        addFlattenedCubic(curvePoints, p0, p1, p2, p3, tolerance, tolerance);
        curvePoints.forEach(pushPoint);
        current = p3;
        return;
      }

      if (command.type === 'Z') {
        pushPoint(start);
        closeCurrent();
        current = start;
      }
    });

    closeCurrent();
    return contours.filter(contour => contour.length >= 3);
  };

  const getInteriorTextPreviewPath = (design) => {
    return flattenInteriorTextPath(design)
      .map(contour => (
        contour.map(([px, py], index) => `${index === 0 ? 'M' : 'L'} ${px * scale} ${py * scale}`).join(' ') + ' Z'
      ))
      .join(' ');
  };

  const getPointSetBounds = (points) => {
    if (!points.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    points.forEach(([px, py]) => {
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  const getInteriorTextBooleanContours = (design) => {
    const textPaths = cleanClipperPaths(
      flattenInteriorTextPath(design, MAX_CURVE_CHORD_MM)
        .map(points => toClipperPath(points))
    );

    return unionClipperPaths(textPaths)
      .map((path, textContourIndex) => ({
        path,
        points: fromClipperPath(path),
        textContourIndex,
        role: ClipperLib.Clipper.Orientation(path) ? 'outer' : 'hole'
      }));
  };

  const getInteriorTextBridgeContours = (design, textContours = getInteriorTextBooleanContours(design)) => {
    if (!design.textBridgesEnabled || design.color === 'black') return [];

    const bridgeWidth = Math.max(1, n(design.textBridgeWidth, 8));
    const outers = textContours.filter(contour => contour.role === 'outer');
    const holes = textContours.filter(contour => contour.role === 'hole');

    return holes.flatMap(hole => {
      const holeBounds = getPointSetBounds(hole.points);
      if (!holeBounds || holeBounds.width <= 0 || holeBounds.height <= 0) return [];

      const holeCenter = [
        holeBounds.x + holeBounds.width / 2,
        holeBounds.y + holeBounds.height / 2
      ];

      const parent = outers
        .map(outer => ({ outer, bounds: getPointSetBounds(outer.points) }))
        .filter(item => item.bounds && pointInPolygon(holeCenter, item.outer.points))
        .sort((a, b) => Math.abs(signedPolygonArea(a.outer.points)) - Math.abs(signedPolygonArea(b.outer.points)))[0];

      if (!parent) return [];

      const outerBounds = parent.bounds;
      const half = bridgeWidth / 2;
      const distances = [
        { side: 'left', value: Math.abs(holeCenter[0] - outerBounds.x) },
        { side: 'right', value: Math.abs(outerBounds.x + outerBounds.width - holeCenter[0]) },
        { side: 'top', value: Math.abs(holeCenter[1] - outerBounds.y) },
        { side: 'bottom', value: Math.abs(outerBounds.y + outerBounds.height - holeCenter[1]) }
      ].sort((a, b) => a.value - b.value);

      const side = distances[0]?.side || 'right';
      const pad = bridgeWidth;
      let rect;

      if (side === 'left') {
        rect = [
          [outerBounds.x - pad, holeCenter[1] - half],
          [holeBounds.x + holeBounds.width / 2, holeCenter[1] - half],
          [holeBounds.x + holeBounds.width / 2, holeCenter[1] + half],
          [outerBounds.x - pad, holeCenter[1] + half]
        ];
      } else if (side === 'right') {
        rect = [
          [holeBounds.x + holeBounds.width / 2, holeCenter[1] - half],
          [outerBounds.x + outerBounds.width + pad, holeCenter[1] - half],
          [outerBounds.x + outerBounds.width + pad, holeCenter[1] + half],
          [holeBounds.x + holeBounds.width / 2, holeCenter[1] + half]
        ];
      } else if (side === 'top') {
        rect = [
          [holeCenter[0] - half, outerBounds.y - pad],
          [holeCenter[0] + half, outerBounds.y - pad],
          [holeCenter[0] + half, holeBounds.y + holeBounds.height / 2],
          [holeCenter[0] - half, holeBounds.y + holeBounds.height / 2]
        ];
      } else {
        rect = [
          [holeCenter[0] - half, holeBounds.y + holeBounds.height / 2],
          [holeCenter[0] + half, holeBounds.y + holeBounds.height / 2],
          [holeCenter[0] + half, outerBounds.y + outerBounds.height + pad],
          [holeCenter[0] - half, outerBounds.y + outerBounds.height + pad]
        ];
      }

      return [cleanDxfPoints(rect, true)];
    }).filter(points => points.length >= 3);
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
        addFlattenedCubic(curvePoints, p0, p1, p2, p3, tolerance, tolerance);
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
        addFlattenedCubic(curvePoints, current, cubic1, cubic2, end, tolerance, tolerance);
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
      const offsetter = new ClipperLib.ClipperOffset(2, CLIPPER_ARC_TOLERANCE_MM * scaleFactor);
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

  // Clipper's own CleanPolygons removes near-duplicate/degenerate vertices, but its distance
  // parameter also treats finely-sampled curve points as "spikes" to flatten — the same
  // radius-dependent facet-widening bug as elsewhere, and one this library call can't be patched
  // with a chord-length cap. Kept just above the integer-grid quantization noise floor
  // (1/clipperScale mm) so it still cleans true duplicates without eating real curve resolution.
  const cleanClipperPaths = (paths, tolerance = 0.0001) => (
    ClipperLib.Clipper.CleanPolygons(paths, tolerance * clipperScale).filter(path => path.length >= 3)
  );

  const orientClipperPaths = (paths) => (
    paths.map(path => (ClipperLib.Clipper.Orientation(path) ? path : [...path].reverse()))
  );

  const offsetOpenStrokeContours = (points, strokeWidth, linecap = 'butt', linejoin = 'round') => {
    const cleaned = cleanDxfPoints(points, false);
    if (cleaned.length < 2 || strokeWidth <= 0) return [];

    const endType = {
      round: ClipperLib.EndType.etOpenRound,
      square: ClipperLib.EndType.etOpenSquare,
      butt: ClipperLib.EndType.etOpenButt
    }[(linecap || 'butt').trim().toLowerCase()] || ClipperLib.EndType.etOpenButt;

    const joinType = {
      round: ClipperLib.JoinType.jtRound,
      miter: ClipperLib.JoinType.jtMiter,
      square: ClipperLib.JoinType.jtSquare
    }[(linejoin || 'round').trim().toLowerCase()] || ClipperLib.JoinType.jtRound;

    const clipperPath = cleaned.map(([x, y]) => ({
      X: Math.round(x * clipperScale),
      Y: Math.round(y * clipperScale)
    }));
    const offsetter = new ClipperLib.ClipperOffset(2, CLIPPER_ARC_TOLERANCE_MM * clipperScale);
    offsetter.AddPath(clipperPath, joinType, endType);
    const solution = [];
    offsetter.Execute(solution, (strokeWidth / 2) * clipperScale);

    return cleanClipperPaths(solution).map(fromClipperPath);
  };

  const getImportedSvgHitMaskCacheKey = (design) => JSON.stringify({
    svgText: design.svgText || '',
    sourceBox: design.sourceBox || null
  });

  const getImportedSvgHitMaskSvgText = (design) => {
    const cleanedSvgText = removeSvgCanvasBackground(String(design.svgText || ''));

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(cleanedSvgText, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg || doc.querySelector('parsererror')) return cleanedSvgText;

      const rootBox = getSvgRootBox(svg);
      const sourceBox = design.sourceBox || rootBox;
      svg.setAttribute('viewBox', `${sourceBox.x} ${sourceBox.y} ${sourceBox.width} ${sourceBox.height}`);
      svg.setAttribute('width', String(sourceBox.width));
      svg.setAttribute('height', String(sourceBox.height));
      svg.setAttribute('preserveAspectRatio', 'none');
      return new XMLSerializer().serializeToString(svg);
    } catch {
      return cleanedSvgText;
    }
  };

  const createImportedSvgHitMask = (design) => new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('Browser APIs are not available.'));
      return;
    }

    const bounds = getInteriorObjectBounds(design);
    const aspect = Math.max(0.05, Math.min(20, bounds.width / Math.max(0.0001, bounds.height)));
    const maskWidth = aspect >= 1
      ? IMPORTED_SVG_HIT_MASK_SIZE
      : Math.max(24, Math.round(IMPORTED_SVG_HIT_MASK_SIZE * aspect));
    const maskHeight = aspect >= 1
      ? Math.max(24, Math.round(IMPORTED_SVG_HIT_MASK_SIZE / aspect))
      : IMPORTED_SVG_HIT_MASK_SIZE;
    const image = new window.Image();

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = maskWidth;
        canvas.height = maskHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Could not create hit-test canvas.'));
          return;
        }

        ctx.clearRect(0, 0, maskWidth, maskHeight);
        ctx.drawImage(image, 0, 0, maskWidth, maskHeight);
        const rgba = ctx.getImageData(0, 0, maskWidth, maskHeight).data;
        const alpha = new Uint8Array(maskWidth * maskHeight);
        for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
        resolve({ status: 'ready', width: maskWidth, height: maskHeight, alpha });
      } catch (error) {
        reject(error);
      }
    };

    image.onerror = () => reject(new Error('Could not load SVG hit-test image.'));
    image.src = svgTextToDataUrl(getImportedSvgHitMaskSvgText(design));
  });

  const ensureImportedSvgHitMask = (design) => {
    if (!isImportedInteriorSvg(design) || !design.svgText) return null;

    const cacheKey = getImportedSvgHitMaskCacheKey(design);
    const cached = importedSvgHitMaskCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const loadingRecord = { status: 'loading' };
    importedSvgHitMaskCacheRef.current.set(cacheKey, loadingRecord);

    createImportedSvgHitMask(design)
      .then(mask => {
        if (importedSvgHitMaskCacheRef.current.size > 60) importedSvgHitMaskCacheRef.current.clear();
        importedSvgHitMaskCacheRef.current.set(cacheKey, mask);
        setImportedSvgHitMaskVersion(version => version + 1);
      })
      .catch(() => {
        importedSvgHitMaskCacheRef.current.set(cacheKey, { status: 'failed' });
        setImportedSvgHitMaskVersion(version => version + 1);
      });

    return loadingRecord;
  };

  const hitTestImportedSvgMask = (design, point, toleranceMm = 0) => {
    const mask = ensureImportedSvgHitMask(design);
    const bounds = getInteriorObjectBounds(design);
    const inverseMatrix = invertMatrix(getInteriorDesignTransformMatrix(design, bounds));
    if (!inverseMatrix) return null;

    const [localX, localY] = applyMatrix(inverseMatrix, [point.x, point.y]);
    if (
      localX < bounds.x - toleranceMm
      || localX > bounds.x + bounds.width + toleranceMm
      || localY < bounds.y - toleranceMm
      || localY > bounds.y + bounds.height + toleranceMm
    ) {
      return false;
    }

    if (!mask || mask.status === 'loading') return true;
    if (mask.status !== 'ready') return null;

    const u = (localX - bounds.x) / Math.max(0.0001, bounds.width);
    const v = (localY - bounds.y) / Math.max(0.0001, bounds.height);
    const maskX = Math.round(u * (mask.width - 1));
    const maskY = Math.round(v * (mask.height - 1));
    const mmPerMaskPixel = Math.max(
      bounds.width / Math.max(1, mask.width),
      bounds.height / Math.max(1, mask.height)
    );
    const radius = Math.max(0, Math.ceil(toleranceMm / Math.max(0.0001, mmPerMaskPixel)));

    for (let y = Math.max(0, maskY - radius); y <= Math.min(mask.height - 1, maskY + radius); y++) {
      for (let x = Math.max(0, maskX - radius); x <= Math.min(mask.width - 1, maskX + radius); x++) {
        if (radius > 0 && Math.hypot(x - maskX, y - maskY) > radius) continue;
        if (mask.alpha[y * mask.width + x] > 8) return true;
      }
    }

    return false;
  };

  const getImportedSvgHitContours = (design) => {
    if (!isImportedInteriorSvg(design) || !design.svgText) return [];

    const cacheKey = JSON.stringify({
      svgText: design.svgText,
      sourceBox: design.sourceBox
    });
    let localContours = importedSvgHitCacheRef.current.get(cacheKey);
    let sourceBox = design.sourceBox;

    if (!localContours) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(design.svgText, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg || doc.querySelector('parsererror')) return [];

      const rootBox = getSvgRootBox(svg);
      sourceBox = sourceBox || rootBox;
      const pathTolerance = 0.03;
      const cssRules = parseSvgCssRules(svg);
      const contours = [];

      const addContour = (points, closed = true) => {
        const cleaned = cleanDxfPoints(points, closed);
        if (cleaned.length >= (closed ? 3 : 2)) contours.push({ points: cleaned, closed });
      };

      const walk = (node, parentMatrix = [1, 0, 0, 1, 0, 0], parentStyle = getDefaultSvgStyle(), visitedUses = new Set()) => {
        if (node.nodeType !== 1) return;

        const matrix = multiplyMatrix(parentMatrix, parseSvgTransform(node.getAttribute('transform')));
        const tag = node.tagName.toLowerCase();
        const style = resolveSvgNodeStyle(node, parentStyle, cssRules);

        if (isSvgCanvasBackgroundRect(node, svg)) return;
        if (isHiddenSvgStyle(style) || tag === 'defs' || tag === 'style' || tag === 'title' || tag === 'desc') return;

        if (tag === 'use') {
          const rawHref = node.getAttribute('href') || node.getAttribute('xlink:href') || '';
          const id = rawHref.startsWith('#') ? rawHref.slice(1) : '';
          const target = getSvgElementById(svg, id);
          if (target && !visitedUses.has(id)) {
            const x = parseFloat(node.getAttribute('x')) || 0;
            const y = parseFloat(node.getAttribute('y')) || 0;
            walk(target, multiplyMatrix(matrix, [1, 0, 0, 1, x, y]), style, new Set([...visitedUses, id]));
          }
          return;
        }

        const fillVisible = hasVisibleFill(style, tag);
        const strokeVisible = hasBlackStroke(style);
        const strokeWidth = getStrokeWidth(style, matrix);

        if (tag === 'path' && (fillVisible || strokeVisible)) {
          const d = node.getAttribute('d');
          if (d) {
            try {
              splitSvgPathSubpaths(d).forEach(subpath => {
                const points = sampleSvgPathCommands(subpath.commands, matrix, pathTolerance);
                if (fillVisible) addContour(points, shouldClosePathSubpath(style, subpath.closed));
                if (strokeVisible && strokeWidth > 0) {
                  const strokeContours = subpath.closed
                    ? offsetClosedStrokeContours(points, strokeWidth)
                    : offsetOpenStrokeContours(points, strokeWidth, style['stroke-linecap']);
                  strokeContours.forEach(outline => addContour(outline, true));
                }
              });
            } catch {
              // Skip unsupported path data for hit testing.
            }
          }
        } else if (tag === 'rect' && (fillVisible || strokeVisible)) {
          const x = parseFloat(node.getAttribute('x')) || 0;
          const y = parseFloat(node.getAttribute('y')) || 0;
          const w = parseFloat(node.getAttribute('width')) || 0;
          const h = parseFloat(node.getAttribute('height')) || 0;
          const rawRx = node.hasAttribute('rx') ? parseFloat(node.getAttribute('rx')) : parseFloat(node.getAttribute('ry')) || 0;
          const rawRy = node.hasAttribute('ry') ? parseFloat(node.getAttribute('ry')) : rawRx;
          const points = buildRoundedRectPoints(x, y, w, h, rawRx, rawRy, matrix);
          if (fillVisible) addContour(points, true);
          if (strokeVisible && strokeWidth > 0) offsetClosedStrokeContours(points, strokeWidth).forEach(outline => addContour(outline, true));
        } else if ((tag === 'circle' || tag === 'ellipse') && (fillVisible || strokeVisible)) {
          const cx = parseFloat(node.getAttribute('cx')) || 0;
          const cy = parseFloat(node.getAttribute('cy')) || 0;
          const rx = tag === 'circle' ? parseFloat(node.getAttribute('r')) || 0 : parseFloat(node.getAttribute('rx')) || 0;
          const ry = tag === 'circle' ? rx : parseFloat(node.getAttribute('ry')) || 0;
          const points = [];
          const circleSegments = getAdaptiveCircleSegments(rx, ry, matrix);
          for (let i = 0; i < circleSegments; i++) {
            const angle = i * Math.PI * 2 / circleSegments;
            points.push(applyMatrix(matrix, [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]));
          }
          if (fillVisible) addContour(points, true);
          if (strokeVisible && strokeWidth > 0) offsetClosedStrokeContours(points, strokeWidth).forEach(outline => addContour(outline, true));
        } else if ((tag === 'polygon' || tag === 'polyline') && (fillVisible || strokeVisible)) {
          const points = parseSvgPoints(node.getAttribute('points')).map(point => applyMatrix(matrix, point));
          if (fillVisible) addContour(points, tag === 'polygon');
          if (strokeVisible && strokeWidth > 0) {
            const strokeContours = tag === 'polygon'
              ? offsetClosedStrokeContours(points, strokeWidth)
              : offsetOpenStrokeContours(points, strokeWidth, style['stroke-linecap']);
            strokeContours.forEach(outline => addContour(outline, true));
          }
        } else if (tag === 'line' && strokeVisible && strokeWidth > 0) {
          const p1 = [parseFloat(node.getAttribute('x1')) || 0, parseFloat(node.getAttribute('y1')) || 0];
          const p2 = [parseFloat(node.getAttribute('x2')) || 0, parseFloat(node.getAttribute('y2')) || 0];
          offsetOpenStrokeContours([applyMatrix(matrix, p1), applyMatrix(matrix, p2)], strokeWidth, style['stroke-linecap']).forEach(outline => addContour(outline, true));
        }

        Array.from(node.children).forEach(child => walk(child, matrix, style, visitedUses));
      };

      walk(svg);
      localContours = contours.filter(contour => contour.points.length >= (contour.closed ? 3 : 2));
      if (importedSvgHitCacheRef.current.size > 40) importedSvgHitCacheRef.current.clear();
      importedSvgHitCacheRef.current.set(cacheKey, localContours);
    }

    const bounds = getInteriorObjectBounds(design);
    const safeSourceBox = sourceBox || design.sourceBox || { x: 0, y: 0, width: bounds.width, height: bounds.height };
    const scaleX = bounds.width / Math.max(0.0001, safeSourceBox.width);
    const scaleY = bounds.height / Math.max(0.0001, safeSourceBox.height);
    const placePoint = ([px, py]) => transformInteriorDesignPoint(design, [
      bounds.x + (px - safeSourceBox.x) * scaleX,
      bounds.y + (py - safeSourceBox.y) * scaleY
    ], bounds);

    return localContours.map(contour => ({
      ...contour,
      points: cleanDxfPoints(contour.points.map(placePoint), contour.closed)
    }));
  };

  // Places pre-computed LOCAL (raw SVG source-unit) contours using the same bounds/sourceBox/
  // transform math as getImportedSvgHitContours's own placement step, without re-flattening the
  // SVG markup. Lets thickened contours (computed once) be reused across many placements, e.g.
  // once per pattern-along-path instance, instead of re-walking + re-offsetting each time.
  const placeLocalSvgContours = (design, localContours, bounds = getInteriorObjectBounds(design)) => {
    const sourceBox = design.sourceBox || getInlineSvgRenderData(design.svgText)?.rootBox || { x: 0, y: 0, width: bounds.width, height: bounds.height };
    const scaleX = bounds.width / Math.max(0.0001, sourceBox.width);
    const scaleY = bounds.height / Math.max(0.0001, sourceBox.height);
    const placePoint = ([px, py]) => transformInteriorDesignPoint(design, [
      bounds.x + (px - sourceBox.x) * scaleX,
      bounds.y + (py - sourceBox.y) * scaleY
    ], bounds);

    return localContours.map(contour => ({
      ...contour,
      points: cleanDxfPoints(contour.points.map(placePoint), contour.closed)
    }));
  };

  // Flattens the design's own SVG artwork (fills + stroke bands) and, when lineThicken > 0,
  // grows every resulting black-ink contour outward by that amount via a Clipper offset — this is
  // the "thicker lines" feature. Returns polygons in the SAME LOCAL coordinate space as the raw
  // SVG source markup (identity placement), so callers can feed them through the exact same
  // per-instance translate/rotate/mirror transform used for the raw dangerouslySetInnerHTML markup.
  // `placementScale` is the caller's own local->placed scale factor (e.g. itemWidth/sourceBox.width,
  // averaged with the Y equivalent) — the requested mm amount is divided by it before offsetting in
  // this LOCAL space, so the FINAL placed/rendered growth equals lineThicken mm regardless of how
  // much the SVG (or a pattern's motif) has been scaled up or down.
  const getThickenedLocalSvgContours = (design, placementScale = 1) => {
    const svgRenderData = getInlineSvgRenderData(design.svgText);
    const sourceBox = design.sourceBox || svgRenderData?.rootBox || { x: 0, y: 0, width: 20, height: 20 };
    const identityDesign = {
      ...design,
      kind: 'svg',
      x: sourceBox.x,
      y: sourceBox.y,
      width: sourceBox.width,
      height: sourceBox.height,
      rotation: 0,
      mirrorX: false,
      mirrorY: false,
      sourceBox,
      __parentMatrix: undefined
    };
    const contours = getImportedSvgHitContours(identityDesign).filter(contour => contour.closed);
    const thicken = n(design.lineThicken, 0);
    if (thicken <= 0) return contours;

    const localThicken = thicken / Math.max(0.0001, placementScale);
    // Every contour is treated as an independent solid black region and normalized to a
    // consistent (positive) winding — without this, a path sampled in the "wrong" direction
    // would shrink instead of grow for a positive offset delta. This sacrifices correct
    // hole-shrinking for true nested-hole artwork (a rare case) in favor of predictable growth
    // for the common case (simple fills and stroke-expanded bands).
    const paths = orientClipperPaths(contours.map(contour => toClipperPath(contour.points)).filter(path => path.length >= 3));
    if (!paths.length) return contours;

    const offsetter = new ClipperLib.ClipperOffset(2, CLIPPER_ARC_TOLERANCE_MM * clipperScale);
    paths.forEach(path => offsetter.AddPath(path, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon));
    const solution = [];
    offsetter.Execute(solution, localThicken * clipperScale);

    return cleanClipperPaths(solution).map(fromClipperPath).map(points => ({ points, closed: true }));
  };

  const isPointNearImportedSvgVisibleSurface = (design, point, toleranceMm = 0) => {
    const maskHit = hitTestImportedSvgMask(design, point, toleranceMm);
    if (maskHit !== null) return maskHit;

    const contours = getImportedSvgHitContours(design);
    if (!contours.length) return true;

    const testPoint = [point.x, point.y];
    const closedContours = contours.filter(contour => contour.closed && contour.points.length >= 3);
    const containingCount = closedContours.filter(contour => pointInPolygon(testPoint, contour.points)).length;
    if (containingCount % 2 === 1) return true;

    if (toleranceMm <= 0) return false;
    return contours.some(contour => distancePointToPolyline(testPoint, contour.points, contour.closed) <= toleranceMm);
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

  const distancePointToSegment = (point, start, end) => {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= 0.000001) return Math.hypot(point[0] - start[0], point[1] - start[1]);

    const t = clamp(((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSq, 0, 1);
    return Math.hypot(point[0] - (start[0] + dx * t), point[1] - (start[1] + dy * t));
  };

  const distancePointToPolyline = (point, points, closed = true) => {
    if (!points.length) return Infinity;
    let best = Infinity;
    const segmentCount = closed ? points.length : points.length - 1;
    for (let i = 0; i < segmentCount; i++) {
      best = Math.min(best, distancePointToSegment(point, points[i], points[(i + 1) % points.length]));
    }
    return best;
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
      // The vertex average, not the first raw vertex — a hole subpath that touches/shares an edge
      // with its enclosing boundary can have its first point sit right ON that boundary, where
      // point-in-polygon tests are unreliable. The averaged point is far more likely to land
      // safely inside the shape.
      const samplePoint = contour.points.reduce(
        (sum, point) => [sum[0] + point[0] / contour.points.length, sum[1] + point[1] / contour.points.length],
        [0, 0]
      );
      // Scoped to the SAME design: nesting is only meaningful within one piece of artwork's own
      // subpaths (its fill-rule holes). Comparing across different designs would misclassify an
      // ordinary shape placed on top of a larger unrelated one (e.g. a black logo on a white
      // panel) as a "hole" just because it happens to sit inside the panel's bounds.
      const parentCount = closedContours.filter(candidate => (
        candidate !== contour
        && candidate.designId === contour.designId
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

  const getMarginFrameClipPaths = (marginBoundarySets) => {
    if (!marginBoundarySets.length) return [];
    const fullPanelPaths = getCleanMainBodyPanelVertexSets().map(panel => toClipperPath(transformPoints(panel)));
    const insetPaths = marginBoundarySets.map(toClipperPath);
    return differenceClipperPaths(fullPanelPaths, insetPaths);
  };

  const buildBooleanInteriorContours = (contours, marginFrameClipPaths = []) => {
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

      // A contour nested inside its OWN design at odd depth (role: 'hole', from
      // analyzeInteriorContours) is a fill-rule hole in that artwork — it flips the normal
      // black-subtracts/white-adds behavior, so a hole cut into black material still becomes a
      // cut, and a hole cut into an added white shape still stays uncut.
      const baseSubtracts = contour.materialColor === 'black' || contour.source === 'knockout';
      const shouldSubtract = contour.role === 'hole' ? !baseSubtracts : baseSubtracts;

      if (shouldSubtract) {
        accumulatedWhite = differenceClipperPaths(accumulatedWhite, paths);
        return;
      }

      accumulatedWhite = unionClipperPaths([...accumulatedWhite, ...paths]);
    });

    if (marginFrameClipPaths.length) {
      accumulatedWhite = differenceClipperPaths(accumulatedWhite, marginFrameClipPaths);
    }

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

  const getInteriorThreePointArcData = (design, segments = 72, chordTarget = PREVIEW_CURVE_CHORD_MM) => {
    const p1 = [n(design.x1, 0), n(design.y1, 0)];
    const pm = [n(design.x2, 0), n(design.y2, 0)];
    const p2 = [n(design.x3, 0), n(design.y3, 0)];
    const d = 2 * (
      p1[0] * (pm[1] - p2[1])
      + pm[0] * (p2[1] - p1[1])
      + p2[0] * (p1[1] - pm[1])
    );

    if (Math.abs(d) < 0.000001) {
      return {
        points: [p1, p2],
        center: null,
        radius: null,
        degenerate: true
      };
    }

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
    // `segments` acts as a floor, not a fixed total — a big-radius or wide-sweep arc needs more
    // samples to keep facets small, so scale up further from the actual physical arc length.
    const physicalArcLength = radius * Math.abs(span);
    const pointCount = Math.max(8, segments, Math.ceil(physicalArcLength / chordTarget));

    const points = Array.from({ length: pointCount + 1 }, (_, index) => {
      const angle = a1 + span * (index / pointCount);
      return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
    });

    return {
      points,
      center: [cx, cy],
      radius,
      degenerate: false
    };
  };

  const sampleInteriorThreePointArc = (design, segments = 72, chordTarget = PREVIEW_CURVE_CHORD_MM) => (
    getInteriorThreePointArcData(design, segments, chordTarget).points
  );

  // The visible-SVG render path (renderInteriorDesignBody / the main per-design render loop)
  // calls this directly and uncached, on every render — since it now scales its point count with
  // the arc's physical length (MAX_CURVE_CHORD_MM), that used to mean regenerating potentially
  // thousands of points from scratch on every re-render of the canvas (e.g. every mousemove that
  // touches any state), for every arc design, not just ones near the cursor. Cached the same way
  // as getInteriorShapeContours above.
  const getInteriorArcBandPoints = (design, segments = 96, chordTarget = PREVIEW_CURVE_CHORD_MM) => {
    const cacheKey = design?.id ? `${JSON.stringify(design)}::${segments}::${chordTarget}` : null;
    if (cacheKey) {
      const cached = interiorArcBandPointsCacheRef.current.get(design.id);
      if (cached && cached.key === cacheKey) return cached.points;
    }
    const points = computeInteriorArcBandPointsUncached(design, segments, chordTarget);
    if (cacheKey) interiorArcBandPointsCacheRef.current.set(design.id, { key: cacheKey, points });
    return points;
  };

  const computeInteriorArcBandPointsUncached = (design, segments = 96, chordTarget = PREVIEW_CURVE_CHORD_MM) => {
    const thickness = Math.max(0.5, n(design.thickness, 8));
    const arc = getInteriorThreePointArcData(design, segments, chordTarget);

    if (arc.degenerate || !arc.center || !arc.radius || arc.radius <= 0.000001) {
      return offsetOpenStrokeContours(arc.points, thickness, 'butt')[0] || arc.points;
    }

    const [cx, cy] = arc.center;
    const outerPoints = arc.points.map(([x, y]) => {
      const dx = x - cx;
      const dy = y - cy;
      const length = Math.hypot(dx, dy) || 1;
      const scaleOut = (length + thickness) / length;
      return [cx + dx * scaleOut, cy + dy * scaleOut];
    });

    return [...arc.points, ...outerPoints.reverse()];
  };

  // Normalized centerline (u = along the run 0..1, v = across the thickness 0..1) for one
  // repeat of a Greek-key/meander motif. Tiles seamlessly: the path's start (0,0) lines up
  // with the previous repeat's end (1,0) when placed back-to-back along a run.
  const MEANDER_UNIT_PATH = [
    [0, 0], [0, 1], [0.66, 1], [0.66, 0.33],
    [0.33, 0.33], [0.33, 0.66], [1, 0.66], [1, 0]
  ];

  const getPathCumulativeLengths = (points) => {
    const lengths = [0];
    for (let i = 1; i < points.length; i++) {
      lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    }
    return lengths;
  };

  const pointAndAngleAtLength = (points, lengths, target) => {
    const total = lengths[lengths.length - 1];
    const t = clamp(target, 0, total);
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < t) i++;
    const segStart = lengths[i - 1];
    const segEnd = lengths[i];
    const segLen = Math.max(0.000001, segEnd - segStart);
    const frac = (t - segStart) / segLen;
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    return {
      x: x1 + (x2 - x1) * frac,
      y: y1 + (y2 - y1) * frac,
      angle: Math.atan2(y2 - y1, x2 - x1)
    };
  };

  const rotateTranslatePoints = (localPoints, angle, originX, originY) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return localPoints.map(([x, y]) => [
      originX + x * cos - y * sin,
      originY + x * sin + y * cos
    ]);
  };

  // Builds one repeat unit's local centerline. The hook detail is always sized off `thickness`
  // (so it stays readable regardless of repeat spacing) and a straight filler segment absorbs
  // whatever length is left over up to `repeatLength`, so tiles still butt together seamlessly.
  const buildMeanderUnitLocalPath = (repeatLength, thickness) => {
    const hookWidth = Math.min(repeatLength, thickness * 2.2);
    const hookPoints = MEANDER_UNIT_PATH.map(([u, v]) => [u * hookWidth, v * thickness]);
    if (repeatLength > hookWidth + 0.01) hookPoints.push([repeatLength, 0]);
    return hookPoints;
  };

  const tileMeanderAlongRun = (runPoints, thickness, motifLength, inwardSign = 1) => {
    if (!runPoints || runPoints.length < 2) return [];
    const lengths = getPathCumulativeLengths(runPoints);
    const total = lengths[lengths.length - 1];
    if (total <= 0.01) return [];

    const gaps = Math.max(1, Math.round(total / Math.max(1, motifLength)));
    const actualLength = total / gaps;
    const barWidth = Math.min(thickness / 3, actualLength / 6);
    const results = [];

    for (let i = 0; i < gaps; i++) {
      const start = pointAndAngleAtLength(runPoints, lengths, i * actualLength);
      const localCenterline = buildMeanderUnitLocalPath(actualLength, thickness).map(([x, y]) => [x, y * inwardSign]);
      offsetOpenStrokeContours(localCenterline, barWidth, 'butt', 'miter').forEach(poly => {
        results.push(rotateTranslatePoints(poly, start.angle, start.x, start.y));
      });
    }

    return results;
  };

  const getInteriorMeanderRuns = (design) => {
    if (design.kind === 'line') {
      return [{ points: [[n(design.x1, 0), n(design.y1, 0)], [n(design.x2, 0), n(design.y2, 0)]], inwardSign: 1 }];
    }

    if (design.kind === 'arc') {
      return [{ points: getInteriorThreePointArcData(design, 96).points, inwardSign: 1 }];
    }

    return [];
  };

  const buildMeanderPatternContours = (design) => {
    const thickness = Math.max(0.5, n(design.thickness, 8));
    const motifLength = Math.max(1, n(design.meanderLength, 40));
    const runs = getInteriorMeanderRuns(design);
    const result = [];
    runs.forEach(run => {
      result.push(...tileMeanderAlongRun(run.points, thickness, motifLength, run.inwardSign));
    });
    return result;
  };

  // Every individually-pickable edge of a shape, for the "pattern along path" edge picker.
  // Unlike getInteriorMeanderRuns (deliberately narrowed to line/arc), this covers every kind
  // since the user should be able to pick any single edge of any shape as the path to follow.
  // Recomputed for every other shape on every mousemove while the pattern-along-path edge picker
  // is armed (findNearestPatternPathEdge) — cached per design id for the same reason as
  // getInteriorShapeContours above (large-ellipse/arc sampling is no longer a fixed cheap count).
  const getInteriorPatternPathEdges = (design) => {
    const cacheKey = design?.id ? JSON.stringify(design) : null;
    if (cacheKey) {
      const cached = interiorPatternPathEdgesCacheRef.current.get(design.id);
      if (cached && cached.key === cacheKey) return cached.edges;
    }
    const edges = computeInteriorPatternPathEdgesUncached(design);
    if (cacheKey) interiorPatternPathEdgesCacheRef.current.set(design.id, { key: cacheKey, edges });
    return edges;
  };

  const computeInteriorPatternPathEdgesUncached = (design) => {
    const bounds = getInteriorObjectBounds(design);

    if (design.kind === 'rect') {
      const corners = [
        [bounds.x, bounds.y],
        [bounds.x + bounds.width, bounds.y],
        [bounds.x + bounds.width, bounds.y + bounds.height],
        [bounds.x, bounds.y + bounds.height]
      ];
      const inwardSign = signedPolygonArea(corners) >= 0 ? 1 : -1;
      return corners.map((point, index) => ({
        key: `rect-${index}`,
        points: [point, corners[(index + 1) % corners.length]],
        inwardSign
      }));
    }

    if (design.kind === 'polygon') {
      const pts = design.points || [];
      if (pts.length < 2) return [];
      const inwardSign = signedPolygonArea(pts) >= 0 ? 1 : -1;
      return pts.map((point, index) => ({
        key: `polygon-${index}`,
        points: [point, pts[(index + 1) % pts.length]],
        inwardSign
      }));
    }

    if (design.kind === 'ellipse') {
      const segments = getAdaptiveCircleSegments(bounds.width / 2, bounds.height / 2, [1, 0, 0, 1, 0, 0]);
      const pts = Array.from({ length: segments + 1 }, (_, index) => {
        const angle = (index % segments) * Math.PI * 2 / segments;
        return [
          bounds.x + bounds.width / 2 + Math.cos(angle) * bounds.width / 2,
          bounds.y + bounds.height / 2 + Math.sin(angle) * bounds.height / 2
        ];
      });
      return [{ key: 'whole', points: pts, inwardSign: signedPolygonArea(pts) >= 0 ? 1 : -1 }];
    }

    if (design.kind === 'line') {
      return [{ key: 'whole', points: [[n(design.x1, 0), n(design.y1, 0)], [n(design.x2, 0), n(design.y2, 0)]], inwardSign: 1 }];
    }

    if (design.kind === 'arc') {
      return [{ key: 'whole', points: getInteriorThreePointArcData(design, 96).points, inwardSign: 1 }];
    }

    return [];
  };

  const findNearestPatternPathEdge = (x, y, excludeDesignId) => {
    let best = null;
    let bestDist = Infinity;

    flattenInteriorDesigns(interiorDesignsRef.current)
      .filter(item => item.id !== excludeDesignId && !isImportedInteriorSvg(item) && item.kind !== 'patternAlongPath' && item.kind !== 'text' && item.kind !== 'eraser')
      .forEach(item => {
        getInteriorPatternPathEdges(item).forEach(edge => {
          for (let i = 0; i < edge.points.length - 1; i++) {
            const nearest = nearestPointOnSegment([x, y], edge.points[i], edge.points[i + 1]);
            const dist = Math.hypot(nearest[0] - x, nearest[1] - y);
            if (dist < bestDist) {
              bestDist = dist;
              best = { designId: item.id, key: edge.key, points: edge.points, inwardSign: edge.inwardSign };
            }
          }
        });
      });

    const tolerancePx = 14;
    const toleranceMm = tolerancePx / Math.max(0.0001, scale * viewZoom);
    return bestDist <= toleranceMm ? best : null;
  };

  // Nearest arc-length distance along a polyline to a given point, used to anchor a new pattern's
  // first instance at wherever the source SVG actually was, instead of always starting at the
  // path's own t=0 endpoint.
  const getNearestDistanceAlongPath = (pathPoints, point) => {
    const lengths = getPathCumulativeLengths(pathPoints);
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const a = pathPoints[i];
      const b = pathPoints[i + 1];
      const nearest = nearestPointOnSegment(point, a, b);
      const dist = Math.hypot(nearest[0] - point[0], nearest[1] - point[1]);
      if (dist < bestDist) {
        bestDist = dist;
        const alongSeg = Math.hypot(nearest[0] - a[0], nearest[1] - a[1]);
        best = lengths[i] + alongSeg;
      }
    }
    return best;
  };

  const confirmPatternAlongPath = (sourceId, edge) => {
    const source = flattenInteriorDesigns(interiorDesignsRef.current).find(item => item.id === sourceId);
    if (!source) return;
    const bounds = getInteriorObjectBounds(source);
    const [sourceCx, sourceCy] = getInteriorTransformCenter(bounds);
    const patternDesign = {
      id: crypto.randomUUID(),
      kind: 'patternAlongPath',
      name: 'Pattern along path',
      color: source.color || 'white',
      exportable: true,
      warnings: [],
      aspectLocked: false,
      rotation: 0,
      mirrorX: false,
      mirrorY: false,
      svgText: source.svgText,
      sourceBox: source.sourceBox,
      href: source.href,
      motifWidth: bounds.width,
      motifHeight: bounds.height,
      pathPoints: edge.points.map(point => [...point]),
      pathInwardSign: edge.inwardSign,
      startDistance: getNearestDistanceAlongPath(edge.points, [sourceCx, sourceCy]),
      lineThicken: n(source.lineThicken, 0),
      count: 6,
      offset: 0,
      mirror: false,
      alternateMirror: false,
      scale: 1
    };
    applyInteriorDesigns(
      prev => [...prev.filter(item => item.id !== sourceId), patternDesign],
      { selectedId: patternDesign.id }
    );
  };

  // Converts an imported SVG into an editable "node" shape: flattens whatever is currently shown
  // (including any lineThicken growth) into plain point contours, each point then draggable on its
  // own via the same point-handle system polygons already use. This is a one-way conversion —
  // once converted, the design is a plain point-based shape, not a re-editable link back to the
  // original vector markup.
  const convertImportedSvgToEditablePoints = (design) => {
    if (!isImportedInteriorSvg(design)) return;
    const bounds = getInteriorObjectBounds(design);
    const sourceBox = design.sourceBox || getInlineSvgRenderData(design.svgText)?.rootBox || { width: bounds.width, height: bounds.height };
    const thicken = n(design.lineThicken, 0);
    const contours = thicken > 0
      ? placeLocalSvgContours(
        design,
        getThickenedLocalSvgContours(design, ((bounds.width / (sourceBox.width || 1)) + (bounds.height / (sourceBox.height || 1))) / 2),
        bounds
      )
      : getImportedSvgHitContours(design);

    const cleanContours = contours
      .map(contour => ({ points: contour.points.map(point => [...point]), closed: contour.closed }))
      .filter(contour => contour.points.length >= 2);
    if (!cleanContours.length) return;

    const editableDesign = {
      id: crypto.randomUUID(),
      kind: 'editableSvg',
      name: design.name,
      color: design.color,
      exportable: design.exportable,
      warnings: [],
      aspectLocked: false,
      rotation: 0,
      mirrorX: false,
      mirrorY: false,
      pointEditMode: true,
      bendPoints: null,
      contours: cleanContours
    };
    applyInteriorDesigns(
      prev => [...prev.filter(item => item.id !== design.id), editableDesign],
      { selectedId: editableDesign.id }
    );
  };

  const getContoursBoundingBox = (contours) => {
    const allPoints = contours.flatMap(contour => contour.points);
    if (!allPoints.length) return null;
    const xs = allPoints.map(point => point[0]);
    const ys = allPoints.map(point => point[1]);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  };

  // The default bend line: a flat horizontal line through the vertical center of `bbox`, spanning
  // its full width — three collinear points, so the fitted "arc" is a straight line and bending is
  // initially a no-op (see bendPointsAlongCurve's identity check for the flat case).
  const getDefaultBendPoints = (bbox) => {
    const midY = (bbox.minY + bbox.maxY) / 2;
    return [
      [bbox.minX, midY],
      [(bbox.minX + bbox.maxX) / 2, midY],
      [bbox.maxX, midY]
    ];
  };

  // Samples the circular arc fitted through the 3 bend-line control points (reusing the same
  // 3-point-arc circle fit the "3-point arc" drawing tool already uses), then arc-length
  // parametrizes it (reusing the same cumulative-length walk Pattern-along-path already uses) so
  // points can be placed at a given fraction of the way along the curve.
  const getBendCurveSamples = (bendPoints) => {
    if (!bendPoints || bendPoints.length < 3) return null;
    const [[x1, y1], [x2, y2], [x3, y3]] = bendPoints;
    const arcData = getInteriorThreePointArcData({ x1, y1, x2, y2, x3, y3 }, 72);
    const curvePoints = arcData.points;
    const lengths = getPathCumulativeLengths(curvePoints);
    const total = lengths[lengths.length - 1];
    return { curvePoints, lengths, total };
  };

  // Warps `points` (absolute mm coords) so their position along `bbox`'s width maps onto the same
  // fraction of the way along the bend curve, offset perpendicular to the curve's local tangent by
  // however far each point originally sat above/below the bend line's own (flat) starting height —
  // the same "position along the shape's width → position along a path, offset by depth" technique
  // Pattern-along-path already uses to place instances along an arbitrary picked edge.
  const bendPointsAlongCurve = (points, bendPoints, bbox, baselineY) => {
    const curve = getBendCurveSamples(bendPoints);
    if (!curve || curve.total <= 0.0001) return points;
    const { curvePoints, lengths, total } = curve;
    const width = Math.max(0.0001, bbox.maxX - bbox.minX);

    return points.map(([x, y]) => {
      const t = clamp((x - bbox.minX) / width, 0, 1);
      const { x: cx, y: cy, angle } = pointAndAngleAtLength(curvePoints, lengths, t * total);
      const perpAngle = angle + Math.PI / 2;
      const depth = y - baselineY;
      return [cx + Math.cos(perpAngle) * depth, cy + Math.sin(perpAngle) * depth];
    });
  };

  // Bends an editableSvg's flat contours along its bend line (design.bendPoints). Computed fresh
  // from the CURRENT flat contours every time (nothing is destructively warped), so resizing or
  // editing the flat points and dragging the bend control points both just work without any extra
  // bookkeeping.
  const getBentContours = (design) => {
    const contours = design.contours || [];
    if (!design.bendPoints) return contours;
    const bbox = getContoursBoundingBox(contours);
    if (!bbox) return contours;
    const baselineY = (bbox.minY + bbox.maxY) / 2;
    return contours.map(contour => ({
      ...contour,
      points: bendPointsAlongCurve(contour.points, design.bendPoints, bbox, baselineY)
    }));
  };

  // Flattens every descendant of a group (recursing through nested groups via the existing
  // flattenInteriorDesigns) into absolute-space contours, tagged with each leaf's own fill color
  // so bent output can still be rendered/exported as separate black/white regions. Covers the same
  // kinds getInteriorShapeContours already handles (rect/ellipse/polygon/editableSvg/line/arc/
  // eraser/text), plus imported SVGs (not covered by getInteriorShapeContours) via the existing
  // SVG flattener. patternAlongPath children are skipped — bending a repeated pattern isn't
  // supported in this pass.
  const getFlattenedGroupContours = (design) => {
    if (!isInteriorGroup(design)) return [];
    const leaves = flattenInteriorDesigns(design.children || []);
    const result = [];
    leaves.forEach(leaf => {
      const color = leaf.color || 'white';
      if (isImportedInteriorSvg(leaf)) {
        getImportedSvgHitContours(leaf).forEach(contour => {
          if (contour.points.length >= 2) result.push({ points: contour.points, closed: contour.closed !== false, color });
        });
        return;
      }
      if (leaf.kind === 'group' || leaf.kind === 'patternAlongPath') return;
      getInteriorShapeContours(leaf).forEach(points => {
        if (points.length >= 2) result.push({ points, closed: true, color });
      });
    });
    return result;
  };

  // Bent version of getFlattenedGroupContours, using the WHOLE group's own bounding box as the
  // bend-line reference so every child bends together along one continuous curve.
  const getBentGroupContours = (design) => {
    const flatContours = getFlattenedGroupContours(design);
    if (!design.bendPoints || !flatContours.length) return flatContours;
    const bbox = getContoursBoundingBox(flatContours);
    if (!bbox) return flatContours;
    const baselineY = (bbox.minY + bbox.maxY) / 2;
    return flatContours.map(contour => ({
      ...contour,
      points: bendPointsAlongCurve(contour.points, design.bendPoints, bbox, baselineY)
    }));
  };

  // Flattens every repeated instance of a patternAlongPath into absolute-space contours (the same
  // per-instance "fake SVG design" approach the DXF export already uses), so the whole pattern can
  // be bent as one continuous curve just like a group's children.
  const getFlattenedPatternContours = (design) => {
    if (design.kind !== 'patternAlongPath') return [];
    const designScale = n(design.scale, 1);
    const motifW = Math.max(1, n(design.motifWidth, 20)) * designScale;
    const motifH = Math.max(1, n(design.motifHeight, 20)) * designScale;
    const patternRotation = n(design.rotation, 0);
    const [pivotCx, pivotCy] = getInteriorTransformCenter(getInteriorObjectBounds(design));
    const pivotRad = patternRotation * Math.PI / 180;
    const pivotCos = Math.cos(pivotRad);
    const pivotSin = Math.sin(pivotRad);
    const patternSourceBox = design.sourceBox || getInlineSvgRenderData(design.svgText)?.rootBox || { width: 20, height: 20 };
    const motifScaleX = motifW / (patternSourceBox.width || 1);
    const motifScaleY = motifH / (patternSourceBox.height || 1);
    const localThickenedContours = n(design.lineThicken, 0) > 0
      ? getThickenedLocalSvgContours(design, (motifScaleX + motifScaleY) / 2)
      : null;
    const color = design.color || 'white';

    const result = [];
    buildPatternAlongPathInstances(design).forEach((inst, instIndex) => {
      const dx = inst.x - pivotCx;
      const dy = inst.y - pivotCy;
      const instX = pivotCx + dx * pivotCos - dy * pivotSin;
      const instY = pivotCy + dx * pivotSin + dy * pivotCos;
      const fakeInstanceDesign = {
        id: `${design.id}-instance-${instIndex}`,
        kind: 'svg',
        svgText: design.svgText,
        sourceBox: design.sourceBox,
        color: design.color,
        x: instX - motifW / 2,
        y: instY - motifH / 2,
        width: motifW,
        height: motifH,
        rotation: inst.angle * 180 / Math.PI + patternRotation,
        mirrorX: isPatternInstanceMirrored(design, instIndex),
        mirrorY: false
      };

      const instanceContours = localThickenedContours
        ? placeLocalSvgContours(fakeInstanceDesign, localThickenedContours, getInteriorObjectBounds(fakeInstanceDesign))
        : getImportedSvgHitContours(fakeInstanceDesign);

      instanceContours.forEach(contour => {
        if (contour.points.length >= 2) result.push({ points: contour.points, closed: contour.closed !== false, color });
      });
    });
    return result;
  };

  // Bent version of getFlattenedPatternContours, using the WHOLE pattern's own bounding box as the
  // bend-line reference so every repeated instance bends together along one continuous curve.
  const getBentPatternContours = (design) => {
    const flatContours = getFlattenedPatternContours(design);
    if (!design.bendPoints || !flatContours.length) return flatContours;
    const bbox = getContoursBoundingBox(flatContours);
    if (!bbox) return flatContours;
    const baselineY = (bbox.minY + bbox.maxY) / 2;
    return flatContours.map(contour => ({
      ...contour,
      points: bendPointsAlongCurve(contour.points, design.bendPoints, bbox, baselineY)
    }));
  };

  // Adds or removes the draggable 3-point bend line for an editableSvg, group, or patternAlongPath.
  // Adding it seeds a flat line (a no-op bend) through the shape's current vertical center so the
  // control points start exactly where the shape already is; removing it clears the bend entirely
  // (not just hides the handles) since there's no separate "frozen bend" state to preserve here.
  const toggleInteriorBendLine = (design) => {
    if (design.bendPoints) {
      updateInteriorDesign(design.id, { bendPoints: null });
      return;
    }
    const bbox = isInteriorGroup(design)
      ? getContoursBoundingBox(getFlattenedGroupContours(design))
      : design.kind === 'patternAlongPath'
        ? getContoursBoundingBox(getFlattenedPatternContours(design))
        : getContoursBoundingBox(design.contours || []);
    if (!bbox) return;
    updateInteriorDesign(design.id, { bendPoints: getDefaultBendPoints(bbox) });
  };

  // When "alternate" is on, every other instance is mirrored (1 normal, 1 mirrored, ...),
  // starting with a normal (unmirrored) instance at index 0; otherwise falls back to the
  // uniform "Mirror" checkbox applied to every instance.
  const isPatternInstanceMirrored = (design, index) => (
    design.alternateMirror ? index % 2 === 1 : !!design.mirror
  );

  const buildPatternAlongPathInstances = (design) => {
    const pathPoints = design.pathPoints;
    if (!pathPoints || pathPoints.length < 2) return [];
    const inwardSign = n(design.pathInwardSign, 1);

    const count = Math.max(1, Math.round(n(design.count, 6)));
    const offset = n(design.offset, 0);
    const lengths = getPathCumulativeLengths(pathPoints);
    const total = lengths[lengths.length - 1];
    if (total <= 0.01) return [];

    // Anchor the first instance at the original source SVG's position (startDistance) and space
    // the rest onward toward the path's end, rather than always spanning the whole path from t=0.
    const startDistance = clamp(n(design.startDistance, 0), 0, total);
    const remaining = total - startDistance;
    const positions = count === 1
      ? [startDistance]
      : Array.from({ length: count }, (_, index) => startDistance + (index / (count - 1)) * remaining);

    return positions.map(distance => {
      const { x, y, angle } = pointAndAngleAtLength(pathPoints, lengths, distance);
      const perpAngle = angle + Math.PI / 2;
      const shift = offset * inwardSign;
      return {
        x: x + Math.cos(perpAngle) * shift,
        y: y + Math.sin(perpAngle) * shift,
        angle
      };
    });
  };

  // Ellipse/arc contours are now sampled finely enough (MAX_CURVE_CHORD_MM) that regenerating
  // them from scratch on every mousemove hover-test (isInteriorPointOnWhiteDesignSurface runs on
  // every pixel of cursor movement, not just while dragging) became a real slowdown. Cached per
  // design id, keyed on the design's own serialized fields — any real change (move/resize/edit)
  // naturally busts the cache, so this only skips truly redundant recomputation.
  const getInteriorShapeContours = (design, chordTarget = PREVIEW_CURVE_CHORD_MM) => {
    const cacheKey = design?.id ? `${JSON.stringify(design)}::${chordTarget}` : null;
    if (cacheKey) {
      const cached = interiorShapeContoursCacheRef.current.get(design.id);
      if (cached && cached.key === cacheKey) return cached.contours;
    }
    const contours = computeInteriorShapeContoursUncached(design, chordTarget);
    if (cacheKey) interiorShapeContoursCacheRef.current.set(design.id, { key: cacheKey, contours });
    return contours;
  };

  const computeInteriorShapeContoursUncached = (design, chordTarget = PREVIEW_CURVE_CHORD_MM) => {
    const bounds = getInteriorObjectBounds(design);
    const thickness = Math.max(0.5, n(design.thickness, 8));
    const applyDesignTransform = (contours) => contours
      .map(points => transformInteriorDesignPoints(design, points, bounds))
      .filter(points => points.length >= 2);

    if (design.kind === 'rect') {
      return applyDesignTransform([[
        [bounds.x, bounds.y],
        [bounds.x + bounds.width, bounds.y],
        [bounds.x + bounds.width, bounds.y + bounds.height],
        [bounds.x, bounds.y + bounds.height]
      ]]);
    }

    if (design.kind === 'ellipse') {
      const ellipseSegments = getAdaptiveCircleSegments(bounds.width / 2, bounds.height / 2, [1, 0, 0, 1, 0, 0], chordTarget);
      return applyDesignTransform([Array.from({ length: ellipseSegments }, (_, index) => {
        const angle = index * Math.PI * 2 / ellipseSegments;
        return [
          bounds.x + bounds.width / 2 + Math.cos(angle) * bounds.width / 2,
          bounds.y + bounds.height / 2 + Math.sin(angle) * bounds.height / 2
        ];
      })]);
    }

    if (design.kind === 'polygon') {
      return applyDesignTransform([design.points || []]);
    }

    if (design.kind === 'editableSvg') {
      return applyDesignTransform(getBentContours(design).filter(contour => contour.closed).map(contour => contour.points));
    }

    if (design.kind === 'line') {
      if (design.borderPattern === 'meander') return applyDesignTransform(buildMeanderPatternContours(design));
      return applyDesignTransform(offsetOpenStrokeContours(
        [[n(design.x1, 0), n(design.y1, 0)], [n(design.x2, 0), n(design.y2, 0)]],
        thickness,
        'butt'
      ));
    }

    if (design.kind === 'arc') {
      if (design.borderPattern === 'meander') return applyDesignTransform(buildMeanderPatternContours(design));
      return applyDesignTransform([getInteriorArcBandPoints(design, 96, chordTarget)]);
    }

    if (design.kind === 'eraser') {
      return applyDesignTransform(offsetOpenStrokeContours(design.points || [], thickness, 'round'));
    }

    if (design.kind === 'text') {
      return applyDesignTransform(flattenInteriorTextPath(design, chordTarget));
    }

    return [];
  };

  // Like flattenInteriorDesigns, but a group with a bend line is kept as one leaf instead of
  // being recursed into — bent groups are exported as their own flattened+bent contours (see
  // the isInteriorGroup branch below), not as their individual (unbent) children.
  const flattenInteriorDesignsForExport = (designs, parentMatrix = null) => (
    designs.flatMap(design => {
      const inheritedDesign = parentMatrix ? { ...design, __parentMatrix: parentMatrix } : design;
      if (!isInteriorGroup(inheritedDesign)) return [inheritedDesign];
      if (inheritedDesign.bendPoints) return [inheritedDesign];
      const groupMatrix = getInteriorDesignTransformMatrix(inheritedDesign);
      return flattenInteriorDesignsForExport(inheritedDesign.children || [], groupMatrix);
    })
  );

  const collectInteriorDesignContours = (sourceDesigns = interiorDesigns, options = {}) => {
    const {
      includeLivePattern = true,
      clipEnabled = interiorClipEnabled,
      marginBoundarySets = interiorMarginBoundarySets
    } = options;
    const contours = [];
    const skipped = [];
    const parser = new DOMParser();
    const clipOptions = { sourceDesigns, clipEnabled, marginBoundarySets };

    flattenInteriorDesignsForExport(sourceDesigns).forEach((design, designIndex) => {
      if (design.exportable === false && design.kind !== 'text') {
        skipped.push(design.name);
        return;
      }

      if (isInteriorGroup(design) && design.bendPoints) {
        const layer = `SHAPE_${designIndex + 1}`;
        getBentGroupContours(design).forEach(contour => {
          const cleaned = cleanDxfPoints(contour.points, contour.closed);
          if (cleaned.length < (contour.closed ? 3 : 2)) return;
          const contourSets = contour.closed
            ? intersectClosedContourWithPaths(cleaned, getInteriorClipPolygonsForDesign(design, clipOptions))
            : [cleaned];
          contourSets.forEach(clipped => {
            if (clipped.length < (contour.closed ? 3 : 2)) return;
            contours.push({
              points: clipped,
              closed: contour.closed,
              source: 'fill',
              fillRule: 'nonzero',
              layer,
              designId: design.id,
              designName: design.name,
              materialColor: contour.color || 'white',
              zIndex: designIndex,
              contourOrder: contours.length
            });
          });
        });
        return;
      }

      if (!isImportedInteriorSvg(design)) {
        const layer = `SHAPE_${designIndex + 1}`;
        if (design.kind === 'patternAlongPath') {
          getBentPatternContours(design).forEach(contour => {
            const cleaned = cleanDxfPoints(contour.points, contour.closed);
            if (cleaned.length < (contour.closed ? 3 : 2)) return;
            contours.push({
              points: cleaned,
              closed: contour.closed,
              source: 'fill',
              fillRule: 'nonzero',
              layer,
              designId: design.id,
              designName: design.name,
              materialColor: contour.color || design.color || 'white',
              zIndex: designIndex,
              contourOrder: contours.length
            });
          });
          return;
        }

        if (design.kind === 'text') {
          const textContours = getInteriorTextBooleanContours(design);

          textContours.forEach((textContour) => {
            const cleaned = cleanDxfPoints(transformInteriorDesignPoints(design, textContour.points), true);
            if (cleaned.length < 3) return;
            const isHole = textContour.role === 'hole';
            const materialColor = design.color === 'black' || isHole ? 'black' : 'white';
            const contourSets = intersectClosedContourWithPaths(cleaned, getInteriorClipPolygonsForDesign(design, clipOptions));

            contourSets.forEach(clipped => {
              if (clipped.length < 3) return;
              contours.push({
                points: clipped,
                closed: true,
                source: isHole ? 'knockout' : 'fill',
                fillRule: 'nonzero',
                layer,
                designId: design.id,
                designName: design.name,
                materialColor,
                zIndex: designIndex,
                contourOrder: contours.length + textContour.textContourIndex / 1000
              });
            });
          });

          getInteriorTextBridgeContours(design, textContours).forEach((bridgePoints, bridgeIndex) => {
            const cleaned = cleanDxfPoints(transformInteriorDesignPoints(design, bridgePoints), true);
            if (cleaned.length < 3) return;

            contours.push({
              points: cleaned,
              closed: true,
              source: 'knockout',
              fillRule: 'nonzero',
              layer,
              designId: design.id,
              designName: `${design.name || 'Text'} bridge`,
              materialColor: 'black',
              zIndex: designIndex + 0.01,
              contourOrder: contours.length + bridgeIndex / 1000
            });
          });
          return;
        }

        getInteriorShapeContours(design, MAX_CURVE_CHORD_MM).forEach(points => {
          const cleaned = cleanDxfPoints(points, true);
          if (cleaned.length < 3) return;
          const contourSets = intersectClosedContourWithPaths(cleaned, getInteriorClipPolygonsForDesign(design, clipOptions));
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

      if (n(design.lineThicken, 0) > 0) {
        // Thickened lines are already a flattened+offset approximation (see
        // getThickenedLocalSvgContours), so export reuses that same simplified geometry directly
        // instead of re-walking the SVG DOM with the full fill-rule-aware logic below.
        const layer = `DESIGN_${designIndex + 1}`;
        const bounds = getInteriorObjectBounds(design);
        const exportSourceBox = design.sourceBox || getInlineSvgRenderData(design.svgText)?.rootBox || { width: bounds.width, height: bounds.height };
        const exportScaleX = bounds.width / (exportSourceBox.width || 1);
        const exportScaleY = bounds.height / (exportSourceBox.height || 1);
        placeLocalSvgContours(design, getThickenedLocalSvgContours(design, (exportScaleX + exportScaleY) / 2), bounds).forEach(contour => {
          const cleaned = cleanDxfPoints(contour.points, true);
          if (cleaned.length < 3) return;
          const contourSets = intersectClosedContourWithPaths(cleaned, getInteriorClipPolygonsForDesign(design, clipOptions));
          contourSets.forEach(clipped => {
            if (clipped.length < 3) return;
            contours.push({
              points: clipped,
              closed: true,
              source: 'fill',
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

      const doc = parser.parseFromString(design.svgText, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg || doc.querySelector('parsererror')) {
        skipped.push(design.name);
        return;
      }

      const rootBox = getSvgRootBox(svg);
      const sourceBox = design.sourceBox || rootBox;
      const designWidth = Math.max(10, n(design.width, 10));
      const designHeight = Math.max(10, n(design.height, 10));
      const scaleX = designWidth / (sourceBox.width || 1);
      const scaleY = designHeight / (sourceBox.height || 1);
      const pathTolerance = Math.max(0.01, 0.03 / Math.max(scaleX, scaleY));
      const bounds = getInteriorObjectBounds(design);
      const placePoint = ([x, y]) => transformInteriorDesignPoint(design, [
        n(design.x, 0) + (x - sourceBox.x) * scaleX,
        n(design.y, 0) + (y - sourceBox.y) * scaleY
      ], bounds);
      const layer = `DESIGN_${designIndex + 1}`;
      const cssRules = parseSvgCssRules(svg);

      const addContour = (points, closed = true, source = 'fill', fillRule = 'nonzero') => {
        if (points.length < 2) return;
        const placed = cleanDxfPoints(points.map(placePoint), closed);
        if (placed.length < (closed ? 3 : 2)) return;
        const clippedSets = closed
          ? intersectClosedContourWithPaths(placed, getInteriorClipPolygonsForDesign(design, clipOptions))
          : (clipEnabled ? [] : [placed]);

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

        if (isSvgCanvasBackgroundRect(node, svg)) return;
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
          const circleSegments = getAdaptiveCircleSegments(rx, ry, matrix);
          for (let i = 0; i < circleSegments; i++) {
            const angle = i * Math.PI * 2 / circleSegments;
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
      zIndex: sourceDesigns.length + 0.25,
      contourOrder: contours.length + index
    }));
    const patternContours = includeLivePattern
      ? getPatternContours().map((contour, index) => ({
          ...contour,
          materialColor: 'white',
          zIndex: -1,
          contourOrder: contours.length + clearanceContours.length + index
        }))
      : [];

    const marginFrameClipPaths = clipEnabled ? getMarginFrameClipPaths(marginBoundarySets) : [];
    const booleanContours = buildBooleanInteriorContours([
      ...withAnalysis,
      ...(includeLivePattern ? clearanceContours : []),
      ...patternContours
    ], marginFrameClipPaths);
    const optimizedContours = optimizeDxfContours(booleanContours);

    return {
      contours: optimizedContours,
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
      .map(contour => dxfContourEntity(contour))
      .join('');
  };

  const getInteriorDesignDXFLayers = (exportData = collectInteriorDesignContours()) => (
    exportData.contours.map(contour => contour.layer)
  );

  const rotateExportPointForStraightDXF = ([x, y], angleRad) => {
    if (!Number.isFinite(angleRad) || Math.abs(angleRad) < 0.000001) return [x, y];

    const cos = Math.cos(-angleRad);
    const sin = Math.sin(-angleRad);
    return [
      x * cos - y * sin,
      x * sin + y * cos
    ];
  };

  const straightenPointSetsForDXF = (pointSets, angleRad) => (
    pointSets.map(panel => panel.map(point => rotateExportPointForStraightDXF(point, angleRad)))
  );

  const straightenExportDataForDXF = (exportData, angleRad) => ({
    ...exportData,
    contours: (exportData.contours || []).map(contour => ({
      ...contour,
      points: (contour.points || []).map(point => rotateExportPointForStraightDXF(point, angleRad)),
      area: contour.closed ? Math.abs(signedPolygonArea((contour.points || []).map(point => rotateExportPointForStraightDXF(point, angleRad)))) : contour.area
    }))
  });

  const getCurrentExportStraightenAngleRad = () => (
    isAngledPanel ? Math.atan2(shearOffset, angledRun) : 0
  );

  const estimateStraightenAngleFromPointSets = (pointSets) => {
    let best = null;

    pointSets.forEach(panel => {
      for (let i = 0; i < panel.length; i++) {
        const p1 = panel[i];
        const p2 = panel[(i + 1) % panel.length];
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const length = Math.hypot(dx, dy);
        if (length < 1 || Math.abs(dx) < 1) continue;

        const score = Math.abs(dx);
        if (!best || score > best.score) {
          let angle = Math.atan2(dy, dx);
          while (angle > Math.PI / 2) angle -= Math.PI;
          while (angle < -Math.PI / 2) angle += Math.PI;
          best = { angle, score };
        }
      }
    });

    return best && Math.abs(best.angle) > 0.000001 ? best.angle : 0;
  };

  const getSavedBoardExportStraightenAngleRad = (board) => {
    const savedAngle = Number(board.frame?.exportStraightenAngleRad);
    if (Number.isFinite(savedAngle)) return savedAngle;

    if (board.framePanelSets?.length) {
      return estimateStraightenAngleFromPointSets(board.framePanelSets);
    }

    const savedCornerAngle = Number(board.frame?.cornerAngle);
    const savedWidth = Math.max(1, n(board.frame?.width, safeWidth));
    return Number.isFinite(savedCornerAngle) && Math.abs(savedCornerAngle - 90) > 0.000001
      ? Math.atan(savedWidth * Math.tan((clamp(savedCornerAngle, 30, 150) - 90) * Math.PI / 180) / savedWidth)
      : 0;
  };

  const translateExportData = (exportData, dx, dy, layerPrefix = '') => ({
    skipped: exportData.skipped || [],
    contours: (exportData.contours || []).map(contour => ({
      ...contour,
      points: (contour.points || []).map(([x, y]) => [x + dx, y + dy]),
      layer: layerPrefix ? `${layerPrefix}${contour.layer || '0'}` : contour.layer,
      designId: layerPrefix ? `${layerPrefix}${contour.designId || 'design'}` : contour.designId
    }))
  });

  const getFrameDXFPanelSets = () => (
    getPanelVertexSets().map(panel => transformPoints(panel))
  );

  const getSavedBoardFramePanelSets = (board) => (
    (board.framePanelSets?.length ? board.framePanelSets : getFrameDXFPanelSets())
      .map(panel => panel.map(([x, y]) => [x, y]))
  );

  const buildFrameDXFEntitiesFromPanelSets = (panelSets) => (
    panelSets
      .map(panel => dxfPolylineEntity(panel, true, '0'))
      .join('')
  );

  const getSavedInteriorBoardExportItems = (board) => (
    getSavedInteriorBoardImportItems(board)
  );

  const buildSavedInteriorBoardExportData = (board) => {
    const sourceDesigns = getSavedInteriorBoardExportItems(board);
    const settings = board.settings || {};
    const savedClipEnabled = settings.interiorClipEnabled ?? interiorClipEnabled;
    const savedMarginBoundarySets = savedClipEnabled
      ? (board.marginBoundarySets?.length
          ? board.marginBoundarySets.map(panel => panel.map(([x, y]) => [x, y]))
          : getInteriorMarginBoundarySetsForDistance(settings.interiorMarginInput ?? interiorMarginInput))
      : [];

    return collectInteriorDesignContours(sourceDesigns, {
      includeLivePattern: false,
      clipEnabled: savedClipEnabled,
      marginBoundarySets: savedMarginBoundarySets
    });
  };

  const downloadSavedBoardsDXF = () => {
    if (!savedInteriorBoards.length) {
      window.alert('There are no saved boards to export.');
      return;
    }

    const blocked = savedInteriorBoards.flatMap((board, boardIndex) => (
      flattenInteriorDesigns(getSavedInteriorBoardExportItems(board))
        .filter(design => design.exportable === false && design.kind !== 'text')
        .map(design => `Board ${savedInteriorBoards.length - boardIndex}: ${design.name || 'Design'}`)
    ));

    if (blocked.length) {
      window.alert(`Some saved board designs cannot be exported cleanly yet: ${blocked.join(', ')}.`);
      return;
    }

    resetDxfHandles();

    let cursorY = 0;
    const boardExports = savedInteriorBoards.map((board, boardIndex) => {
      const exportStraightenAngleRad = getSavedBoardExportStraightenAngleRad(board);
      const framePanelSets = straightenPointSetsForDXF(
        getSavedBoardFramePanelSets(board),
        exportStraightenAngleRad
      );
      const exportData = straightenExportDataForDXF(
        buildSavedInteriorBoardExportData(board),
        exportStraightenAngleRad
      );
      const boardBounds = getBoundsFromPointSets([
        ...framePanelSets,
        ...exportData.contours.map(contour => contour.points || [])
      ]);
      const offsetY = cursorY - boardBounds.y;
      cursorY += boardBounds.height + 100;

      return {
        framePanelSets: framePanelSets.map(panel => panel.map(([x, y]) => [x, y + offsetY])),
        exportData: translateExportData(exportData, 0, offsetY, `BOARD_${boardIndex + 1}_`)
      };
    });

    const skipped = boardExports.flatMap((item, index) => (
      (item.exportData.skipped || []).map(name => `Board ${savedInteriorBoards.length - index}: ${name}`)
    ));
    if (skipped.length) {
      window.alert(`Some saved board SVGs were skipped during export: ${skipped.join(', ')}.`);
      return;
    }

    const designLayers = boardExports.flatMap(item => getInteriorDesignDXFLayers(item.exportData));

    let dxf = '';
    dxf += dxfLine('0', 'SECTION', '2', 'HEADER');
    dxf += dxfLine('9', '$ACADVER', '1', 'AC1014');
    dxf += dxfLine('9', '$HANDSEED', '5', 'FFFF');
    dxf += dxfLine('9', '$INSUNITS', '70', '4');
    dxf += dxfLine('9', '$MEASUREMENT', '70', '1');
    dxf += dxfLine('0', 'ENDSEC');
    dxf += buildDxfTablesSection(designLayers);
    dxf += buildDxfBlocksSection();
    dxf += dxfLine('0', 'SECTION', '2', 'ENTITIES');
    boardExports.forEach(item => {
      dxf += buildFrameDXFEntitiesFromPanelSets(item.framePanelSets);
      dxf += buildInteriorDesignDXFEntities(item.exportData);
    });
    dxf += dxfLine('0', 'ENDSEC');
    dxf += buildDxfObjectsSection();
    dxf += dxfLine('0', 'EOF');

    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saved-boards-${savedInteriorBoards.length}-stacked.dxf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
    if (isAngledPanel || hasPanelSplit || bottomPanelEnabled || importedFrameOutline) return buildStraightDXFLwPolyline();

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

  const downloadDXF = () => {
    const blockedDesigns = interiorDesigns.filter(design => design.exportable === false);
    if (blockedDesigns.length > 0) {
      const names = blockedDesigns.map(design => design.name).join(', ');
      window.alert(`Some designs cannot be exported cleanly yet: ${names}. Remove or convert them before exporting DXF.`);
      return;
    }

    resetDxfHandles();

    let dxf = '';
    const exportStraightenAngleRad = getCurrentExportStraightenAngleRad();
    const rawInteriorExportForDownload = collectInteriorDesignContours();
    const interiorExportForDownload = straightenExportDataForDXF(rawInteriorExportForDownload, exportStraightenAngleRad);
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
    if (!importedFrameOutline && Math.abs(exportStraightenAngleRad) > 0.000001) {
      dxf += buildFrameDXFEntitiesFromPanelSets(straightenPointSetsForDXF(getFrameDXFPanelSets(), exportStraightenAngleRad));
    } else {
      dxf += hasArcTop ? buildArcTopDXFLwPolyline() : buildStraightDXFLwPolyline();
    }
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
    [showInteriorExportPreview, interiorDesigns, patternEnabled, patternMode, patternThickness, patternMinLength, patternMaxLength, patternRowSpacing, patternGap, patternSeed, patternRoundedEnds, patternRandomRowSpacing, patternRandomGap, patternRandomDirectionEnabled, patternRandomDirectionAmount, alignedSlotRows, alignedSlotBottomRows, alignedSlotBreakWidth, alignedSlotLeftInset, alignedSlotRightInset, alignedSlotMinLength, alignedSlotUseRowSpacing, alignedSlotRowSpacing, alignedSlotStaggerBreaks, alignedSlotRowOffsetInput, excludedPatternSlotIds, interiorClipEnabled, interiorMarginInput]
  );
  const interiorExportDiagnostics = useMemo(
    () => getInteriorExportDiagnostics(interiorExportData),
    [interiorExportData, interiorDesigns]
  );

  const openInteriorDesigner = () => {
    resetView();
    switchWorkspaceMode('interior');
  };

  const getBoundsFromPointSets = (sets) => {
    const points = sets.flat().filter(point => point && Number.isFinite(point[0]) && Number.isFinite(point[1]));
    if (!points.length) return { x: 0, y: 0, width: 1, height: 1 };

    const xs = points.map(point => point[0]);
    const ys = points.map(point => point[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  };

  const createPresentationSnapshot = () => {
    const panelPolygons = getPanelVertexSets().map(panel => transformPoints(panel));
    const cleanPanelPolygons = getCleanMainBodyPanelVertexSets().map(panel => transformPoints(panel));
    const outerFrameCleanPolygons = getPresentationOuterFrameCleanVertexSets().map(panel => transformPoints(panel));
    const exportData = collectInteriorDesignContours();
    const whitePolygons = exportData.contours
      .filter(contour => contour.materialColor === 'white' && contour.closed && contour.points?.length >= 3)
      .map(contour => contour.points);
    const bounds = getBoundsFromPointSets([...panelPolygons, ...whitePolygons]);
    const index = presentationItemsRef.current.length + 1;

    return {
      id: crypto.randomUUID(),
      name: `Panel ${index}`,
      x: 40 * index,
      y: 40 * index,
      width: bounds.width,
      height: bounds.height,
      rotation: 0,
      itemScale: 1,
      tint: '#000000',
      showOuterFrame: false,
      outerFrameThickness: 30,
      bounds,
      panelPolygons,
      cleanPanelPolygons,
      outerFrameCleanPolygons,
      whitePolygons,
      outerFrameEarOffset: Math.max(topEarDepth, rightEarDepth, bottomEarDepth, leftEarDepth, splitEarDepth),
      hasPanelSplitSnapshot: hasPanelSplit,
      splitFillSnapshot: hasPanelSplit
        ? {
            leftX: safeSplitPosition,
            rightX: safeRightSplitPosition,
            topY: Math.min(splitLeftBaseY, splitRightBaseY),
            bottomY: bottomBaseY
          }
        : null,
      createdAt: Date.now()
    };
  };

  const sendCurrentDesignToPresentation = () => {
    const snapshot = createPresentationSnapshot();
    applyPresentationItems(prev => [...prev, snapshot], { selectedId: snapshot.id });
    switchWorkspaceMode('presentation');
    setPresentationPosition(null);
  };

  const selectedPresentationItem = presentationItems.find(item => item.id === selectedPresentationItemId);

  const getPresentationItemWidth = (item) => Math.max(1, n(item.width, item.bounds?.width || 1));

  const getPresentationItemHeight = (item) => Math.max(1, n(item.height, item.bounds?.height || 1));

  const getPresentationItemScale = (item) => (
    isPresentationImageItem(item) ? 1 : Math.max(0.05, n(item.itemScale, 1))
  );

  const getPresentationOuterFrameThickness = (item) => (
    item?.showOuterFrame ? Math.max(0, n(item.outerFrameThickness, 30)) : 0
  );

  const isPresentationImageItem = (item) => item?.kind === 'pillar' || item?.kind === 'decoration';

  const getPresentationImageUrl = (item) => {
    if (item?.sourceDecorationId) {
      const decoration = allPresentationDecorations.find(entry => entry.id === item.sourceDecorationId);
      if (decoration?.imageUrl) return decoration.imageUrl;
    }

    return item?.imageUrl || fallbackPresentationDecorationUrl;
  };

  const builtInPresentationDecorations = projectPresentationDecorations.map(decoration => ({
    ...decoration,
    ...(presentationDecorationOverrides[decoration.id] || {}),
    imageUrl: presentationDecorationOverrides[decoration.id]?.imageUrl || decoration.imageUrl,
    naturalWidth: presentationDecorationOverrides[decoration.id]?.naturalWidth || decoration.naturalWidth,
    naturalHeight: presentationDecorationOverrides[decoration.id]?.naturalHeight || decoration.naturalHeight
  }));

  const allPresentationDecorations = [...builtInPresentationDecorations, ...presentationDecorations];

  const getPresentationBodyPolygons = (item) => isPresentationImageItem(item) ? [] : item?.panelPolygons || [];

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const loadImageElement = (src) => new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

  const removeLightImageBackground = async (src) => {
    const image = await loadImageElement(src);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, image.naturalWidth || image.width || 1);
    canvas.height = Math.max(1, image.naturalHeight || image.height || 1);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width: imageWidth, height: imageHeight } = imageData;
    const visited = new Uint8Array(imageWidth * imageHeight);
    const queue = [];
    let head = 0;

    const isLightBackground = (x, y) => {
      const index = (y * imageWidth + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const brightness = (r + g + b) / 3;
      return brightness >= 224 && max - min <= 22;
    };

    const enqueue = (x, y) => {
      if (x < 0 || y < 0 || x >= imageWidth || y >= imageHeight) return;
      const index = y * imageWidth + x;
      if (visited[index] || !isLightBackground(x, y)) return;
      visited[index] = 1;
      queue.push(index);
    };

    for (let x = 0; x < imageWidth; x++) {
      enqueue(x, 0);
      enqueue(x, imageHeight - 1);
    }
    for (let y = 0; y < imageHeight; y++) {
      enqueue(0, y);
      enqueue(imageWidth - 1, y);
    }

    while (head < queue.length) {
      const index = queue[head++];
      const x = index % imageWidth;
      const y = Math.floor(index / imageWidth);
      data[index * 4 + 3] = 0;
      enqueue(x + 1, y);
      enqueue(x - 1, y);
      enqueue(x, y + 1);
      enqueue(x, y - 1);
    }

    ctx.putImageData(imageData, 0, 0);
    let minX = imageWidth;
    let minY = imageHeight;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const alpha = data[(y * imageWidth + x) * 4 + 3];
        if (alpha <= 8) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (maxX >= minX && maxY >= minY) {
      const cropWidth = maxX - minX + 1;
      const cropHeight = maxY - minY + 1;
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropWidth;
      cropCanvas.height = cropHeight;
      const cropCtx = cropCanvas.getContext('2d');
      cropCtx.putImageData(ctx.getImageData(minX, minY, cropWidth, cropHeight), 0, 0);

      return {
        imageUrl: cropCanvas.toDataURL('image/png'),
        naturalWidth: cropWidth,
        naturalHeight: cropHeight,
        trim: {
          x: minX,
          y: minY,
          width: cropWidth,
          height: cropHeight,
          originalWidth: imageWidth,
          originalHeight: imageHeight
        }
      };
    }

    return {
      imageUrl: canvas.toDataURL('image/png'),
      naturalWidth: imageWidth,
      naturalHeight: imageHeight,
      trim: {
        x: 0,
        y: 0,
        width: imageWidth,
        height: imageHeight,
        originalWidth: imageWidth,
        originalHeight: imageHeight
      }
    };
  };

  const getTopProfileFromPanelPolygon = (points, sampleCount = 96) => {
    if (!points?.length) return [];
    const bounds = getBoundsFromPointSets([points]);
    const topProfile = [];

    for (let i = 0; i <= sampleCount; i++) {
      const x = bounds.x + (bounds.width * i) / sampleCount;
      const intersections = [];

      for (let j = 0; j < points.length; j++) {
        const a = points[j];
        const b = points[(j + 1) % points.length];
        const minX = Math.min(a[0], b[0]);
        const maxX = Math.max(a[0], b[0]);
        if (x < minX - 0.001 || x > maxX + 0.001) continue;

        if (Math.abs(a[0] - b[0]) < 0.001) {
          if (Math.abs(x - a[0]) < 0.001) {
            intersections.push(a[1], b[1]);
          }
          continue;
        }

        const t = (x - a[0]) / (b[0] - a[0]);
        if (t < -0.001 || t > 1.001) continue;
        intersections.push(a[1] + (b[1] - a[1]) * t);
      }

      if (intersections.length) {
        topProfile.push([x, Math.min(...intersections)]);
      }
    }

    const cleaned = [];
    topProfile.forEach(point => {
      const last = cleaned[cleaned.length - 1];
      if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > 0.5) cleaned.push(point);
    });

    return cleaned.length >= 2 ? cleaned : [[bounds.x, bounds.y], [bounds.x + bounds.width, bounds.y]];
  };

  const getPresentationOuterFrameRings = (item) => {
    if (isPresentationImageItem(item)) return [];
    const thickness = getPresentationOuterFrameThickness(item);
    if (thickness <= 0) return [];

    const framePanels = item.outerFrameCleanPolygons?.length
      ? item.outerFrameCleanPolygons
      : item.cleanPanelPolygons?.length
        ? item.cleanPanelPolygons
        : item.panelPolygons || [];
    const earOffset = Math.max(0, n(item.outerFrameEarOffset, 10));
    const rings = framePanels.flatMap((framePanel) => {
      const innerPaths = offsetPolygonOutward(framePanel, earOffset);
      const outerPaths = offsetPolygonOutward(framePanel, earOffset + thickness);

      return innerPaths.flatMap((inner, index) => {
        const outer = outerPaths[index] || outerPaths[0];
        return outer ? [{ outer, inner }] : [];
      });
    });

    if (item.hasPanelSplitSnapshot && item.splitFillSnapshot) {
      const split = item.splitFillSnapshot;
      rings.push({
        solid: [
          [split.leftX, split.topY],
          [split.rightX, split.topY],
          [split.rightX, split.bottomY],
          [split.leftX, split.bottomY]
        ]
      });
    }

    return rings;
  };

  const getPresentationItemCornerPoints = (item) => {
    const itemScale = getPresentationItemScale(item);
    if (isPresentationImageItem(item)) {
      const w = getPresentationItemWidth(item) * itemScale;
      const h = getPresentationItemHeight(item) * itemScale;
      const cx = item.x + w / 2;
      const cy = item.y + h / 2;
      const angle = (n(item.rotation, 0) * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      return [
        [item.x, item.y],
        [item.x + w, item.y],
        [item.x + w, item.y + h],
        [item.x, item.y + h]
      ].map(([x, y]) => {
        const dx = x - cx;
        const dy = y - cy;
        return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
      });
    }

    const frameBounds = getBoundsFromPointSets([
      [item.bounds.x, item.bounds.y],
      [item.bounds.x + item.bounds.width, item.bounds.y],
      [item.bounds.x + item.bounds.width, item.bounds.y + item.bounds.height],
      [item.bounds.x, item.bounds.y + item.bounds.height],
      ...getPresentationOuterFrameRings(item).flatMap(ring => ring.solid || [...ring.outer, ...ring.inner])
    ]);
    const localX = frameBounds.x - item.bounds.x;
    const localY = frameBounds.y - item.bounds.y;
    const w = frameBounds.width * itemScale;
    const h = frameBounds.height * itemScale;
    const x0 = item.x + localX * itemScale;
    const y0 = item.y + localY * itemScale;
    const cx = x0 + w / 2;
    const cy = y0 + h / 2;
    const angle = (n(item.rotation, 0) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return [
      [x0, y0],
      [x0 + w, y0],
      [x0 + w, y0 + h],
      [x0, y0 + h]
    ].map(([x, y]) => {
      const dx = x - cx;
      const dy = y - cy;
      return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
    });
  };

  const getPresentationBaseViewBox = () => {
    const itemSets = presentationItems.map(getPresentationItemCornerPoints);
    const bounds = itemSets.length ? getBoundsFromPointSets(itemSets) : { x: 0, y: 0, width: 1600, height: 900 };
    const pad = 220;
    return {
      x: (bounds.x - pad) * scale,
      y: (bounds.y - pad) * scale,
      width: Math.max(1200, bounds.width * scale + pad * 2 * scale),
      height: Math.max(760, bounds.height * scale + pad * 2 * scale)
    };
  };

  const getPresentationViewBox = () => {
    if (presentationPosition?.width && presentationPosition?.height) {
      return {
        x: presentationPosition.x,
        y: presentationPosition.y,
        width: presentationPosition.width,
        height: presentationPosition.height
      };
    }

    const base = getPresentationBaseViewBox();
    return {
      x: presentationPosition?.x ?? base.x,
      y: presentationPosition?.y ?? base.y,
      width: base.width / presentationZoom,
      height: base.height / presentationZoom
    };
  };

  const resetPresentationView = () => {
    setPresentationZoom(1);
    setPresentationPosition(null);
    setPresentationDrag(null);
  };

  const handlePresentationWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const current = getPresentationViewBox();
    const base = getPresentationBaseViewBox();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mouseSvgX = current.x + (mouseX / rect.width) * current.width;
    const mouseSvgY = current.y + (mouseY / rect.height) * current.height;
    const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextZoom = clamp(presentationZoom * zoomFactor, MIN_VIEW_ZOOM, MAX_VIEW_ZOOM);
    const appliedZoomFactor = presentationZoom ? nextZoom / presentationZoom : zoomFactor;
    const nextWidth = presentationPosition?.width
      ? current.width / appliedZoomFactor
      : base.width / nextZoom;
    const nextHeight = presentationPosition?.height
      ? current.height / appliedZoomFactor
      : base.height / nextZoom;

    setPresentationZoom(nextZoom);
    setPresentationPosition({
      x: mouseSvgX - (mouseX / rect.width) * nextWidth,
      y: mouseSvgY - (mouseY / rect.height) * nextHeight,
      width: nextWidth,
      height: nextHeight
    });
  };

  const getPresentationPointFromClient = (clientX, clientY, allowOutside = false) => {
    const svg = presentationSvgRef.current;
    if (!svg) return null;

    const rect = svg.getBoundingClientRect();
    if (!allowOutside && (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    )) {
      return null;
    }

    const matrix = svg.getScreenCTM?.();
    if (matrix) {
      const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
      if (Math.abs(determinant) > 0.000001) {
        const localX = clientX - matrix.e;
        const localY = clientY - matrix.f;
        const x = (matrix.d * localX - matrix.c * localY) / determinant;
        const y = (-matrix.b * localX + matrix.a * localY) / determinant;
        return { x: x / scale, y: y / scale };
      }
    }

    const viewBox = getPresentationViewBox();
    const x = viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width;
    const y = viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.height;
    return { x: x / scale, y: y / scale };
  };

  const getPresentationPoint = (e) => getPresentationPointFromClient(e.clientX, e.clientY, true) || { x: 0, y: 0 };

  const setPresentationSelection = (ids) => {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    setSelectedPresentationItemIds(uniqueIds);
    setSelectedPresentationItemId(uniqueIds[uniqueIds.length - 1] || null);
  };

  const togglePresentationItemSelection = (id) => {
    const current = selectedPresentationItemIdsRef.current;
    const next = current.includes(id)
      ? current.filter(itemId => itemId !== id)
      : [...current, id];
    setPresentationSelection(next);
  };

  const startPresentationItemDrag = (e, item, mode, handle = null) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const point = getPresentationPoint(e);

    if (mode === 'move' && e.shiftKey) {
      togglePresentationItemSelection(item.id);
      return;
    }

    const currentSelection = selectedPresentationItemIdsRef.current;
    const movingIds = mode === 'move' && currentSelection.includes(item.id)
      ? currentSelection
      : [item.id];
    if (!currentSelection.includes(item.id) || mode !== 'move') {
      setPresentationSelection([item.id]);
    }

    recordPresentationHistory();
    setPresentationDrag({
      mode,
      handle,
      id: item.id,
      ids: movingIds,
      freeScale: e.ctrlKey || e.metaKey,
      startPoint: point,
      startItem: { ...item },
      startItems: clonePresentationItems(presentationItemsRef.current)
    });
  };

  const getPresentationItemVisualBounds = (item) => {
    if (isPresentationImageItem(item)) {
      return {
        x: item.x,
        y: item.y,
        width: getPresentationItemWidth(item),
        height: getPresentationItemHeight(item)
      };
    }

    const frameBounds = getBoundsFromPointSets([
      [item.bounds.x, item.bounds.y],
      [item.bounds.x + item.bounds.width, item.bounds.y],
      [item.bounds.x + item.bounds.width, item.bounds.y + item.bounds.height],
      [item.bounds.x, item.bounds.y + item.bounds.height],
      ...getPresentationOuterFrameRings(item).flatMap(ring => ring.solid || [...ring.outer, ...ring.inner])
    ]);

    return {
      x: item.x + frameBounds.x - item.bounds.x,
      y: item.y + frameBounds.y - item.bounds.y,
      width: frameBounds.width,
      height: frameBounds.height
    };
  };

  const clearPresentationItems = () => {
    applyPresentationItems([], { selectedId: null });
    setPresentationDrag(null);
    setPresentationPosition(null);
  };

  const createPresentationDecorationItem = (decoration, point) => {
    const naturalWidth = Math.max(1, n(decoration.naturalWidth, 300));
    const naturalHeight = Math.max(1, n(decoration.naturalHeight, 300));
    const heightMm = 300;
    const widthMm = heightMm * (naturalWidth / naturalHeight);
    return {
      id: crypto.randomUUID(),
      kind: 'decoration',
      name: decoration.name || 'Decoration',
      sourceDecorationId: decoration.id,
      imageType: decoration.id === 'builtin-stone-pillar' ? 'stone-pillar' : decoration.imageType,
      x: point.x - widthMm / 2,
      y: point.y - heightMm / 2,
      width: widthMm,
      height: heightMm,
      rotation: 0,
      itemScale: 1,
      createdAt: Date.now()
    };
  };

  const fitPresentationItemToImageTrim = (item, trim) => {
    if (!trim?.originalWidth || !trim?.originalHeight) return item;

    const currentWidth = getPresentationItemWidth(item);
    const currentHeight = getPresentationItemHeight(item);
    const nextWidth = currentWidth * (trim.width / trim.originalWidth);
    const nextHeight = currentHeight * (trim.height / trim.originalHeight);

    return {
      ...item,
      x: n(item.x, 0) + currentWidth * (trim.x / trim.originalWidth),
      y: n(item.y, 0) + currentHeight * (trim.y / trim.originalHeight),
      width: Math.max(1, nextWidth),
      height: Math.max(1, nextHeight)
    };
  };

  const getFittedPresentationDecoration = async (decoration) => {
    if (!decoration?.imageUrl) return decoration;
    const existingOverride = presentationDecorationOverrides[decoration.id];
    if (existingOverride?.imageUrl) return { ...decoration, ...existingOverride };
    if (decoration.trim) return decoration;

    const cleaned = await removeLightImageBackground(decoration.imageUrl);
    const fittedDecoration = {
      ...decoration,
      imageUrl: cleaned.imageUrl,
      naturalWidth: cleaned.naturalWidth,
      naturalHeight: cleaned.naturalHeight,
      trim: cleaned.trim
    };

    if (!decoration.builtIn) {
      setPresentationDecorations(prev => prev.map(item => (
        item.id === decoration.id ? fittedDecoration : item
      )));
      return fittedDecoration;
    }

    setPresentationDecorationOverrides(prev => ({
      ...prev,
      [decoration.id]: {
        imageUrl: cleaned.imageUrl,
        naturalWidth: cleaned.naturalWidth,
        naturalHeight: cleaned.naturalHeight,
        trim: cleaned.trim
      }
    }));

    return fittedDecoration;
  };

  const addDecorationToPresentation = async (decoration, point = null) => {
    const targetPoint = point || presentationMousePointRef.current || { x: 0, y: 0 };
    const fittedDecoration = await getFittedPresentationDecoration(decoration).catch(() => decoration);
    const next = createPresentationDecorationItem(fittedDecoration, targetPoint);
    applyPresentationItems(prev => [next, ...prev], { selectedId: next.id });
  };

  const handlePresentationDecorationDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const decorationId = e.dataTransfer.getData('presentation-decoration-id');
    const decoration = allPresentationDecorations.find(item => item.id === decorationId);
    if (!decoration) return;
    addDecorationToPresentation(decoration, getPresentationPoint(e));
  };

  const handlePresentationDecorationFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    const nextDecorations = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const rawUrl = await readFileAsDataUrl(file);
        const cleaned = await removeLightImageBackground(rawUrl);
        nextDecorations.push({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^.]+$/, '') || 'Decoration',
          imageUrl: cleaned.imageUrl,
          naturalWidth: cleaned.naturalWidth,
          naturalHeight: cleaned.naturalHeight,
          createdAt: Date.now()
        });
      } catch {
        const rawUrl = await readFileAsDataUrl(file);
        nextDecorations.push({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^.]+$/, '') || 'Decoration',
          imageUrl: rawUrl,
          naturalWidth: 300,
          naturalHeight: 300,
          createdAt: Date.now()
        });
      }
    }

    if (nextDecorations.length) {
      setPresentationDecorations(prev => [...prev, ...nextDecorations]);
    }
  };

  const deletePresentationDecoration = (id) => {
    setPresentationDecorations(prev => prev.filter(item => item.id !== id));
    deletePresentationStoredImage(`decoration:${id}`).catch(() => {});
  };

  const removePresentationDecorationBackground = async (decoration) => {
    if (!decoration) return;
    try {
      const cleaned = await removeLightImageBackground(decoration.imageUrl);
      if (decoration.builtIn) {
        setPresentationDecorationOverrides(prev => ({
          ...prev,
          [decoration.id]: {
            imageUrl: cleaned.imageUrl,
            naturalWidth: cleaned.naturalWidth,
            naturalHeight: cleaned.naturalHeight,
            trim: cleaned.trim
          }
        }));
        setPresentationItems(prev => prev.map(item => (
          item.sourceDecorationId === decoration.id || item.imageType === 'stone-pillar'
            ? fitPresentationItemToImageTrim({
                ...item,
                sourceDecorationId: decoration.id,
                imageType: 'stone-pillar'
              }, cleaned.trim)
            : item
        )));
        return;
      }

      setPresentationDecorations(prev => prev.map(item => (
        item.id === decoration.id
          ? {
              ...item,
              imageUrl: cleaned.imageUrl,
              naturalWidth: cleaned.naturalWidth,
              naturalHeight: cleaned.naturalHeight,
              trim: cleaned.trim
            }
          : item
      )));
      setPresentationItems(prev => prev.map(item => (
        item.sourceDecorationId === decoration.id
          ? fitPresentationItemToImageTrim(item, cleaned.trim)
          : item
      )));
    } catch {
      // Keep the original image when cleanup cannot be applied.
    }
  };

  const reorderSelectedPresentationItem = (mode) => {
    const id = selectedPresentationItemIdRef.current;
    if (!id) return;

    applyPresentationItems(prev => {
      const index = prev.findIndex(item => item.id === id);
      if (index < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      if (mode === 'back') next.unshift(item);
      if (mode === 'front') next.push(item);
      if (mode === 'backward') next.splice(Math.max(0, index - 1), 0, item);
      if (mode === 'forward') next.splice(Math.min(next.length, index + 1), 0, item);
      return next;
    });
  };

  const handlePresentationMouseDown = (e) => {
    presentationClientMouseRef.current = { x: e.clientX, y: e.clientY };
    presentationMousePointRef.current = getPresentationPoint(e);

    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      setPresentationDrag({ mode: 'pan', startClientX: e.clientX, startClientY: e.clientY, startView: getPresentationViewBox() });
      return;
    }

    if (e.target === e.currentTarget) {
      setPresentationSelection([]);
    }
  };

  const handlePresentationMouseMove = (e) => {
    presentationClientMouseRef.current = { x: e.clientX, y: e.clientY };
    const point = getPresentationPoint(e);
    presentationMousePointRef.current = point;

    if (!presentationDrag) return;

    if (presentationDrag.mode === 'pan') {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const dxPx = e.clientX - presentationDrag.startClientX;
      const dyPx = e.clientY - presentationDrag.startClientY;
      setPresentationPosition({
        x: presentationDrag.startView.x - (dxPx / rect.width) * presentationDrag.startView.width,
        y: presentationDrag.startView.y - (dyPx / rect.height) * presentationDrag.startView.height,
        width: presentationDrag.startView.width,
        height: presentationDrag.startView.height
      });
      return;
    }

    applyPresentationItems(prev => prev.map(item => {
      const draggedIds = presentationDrag.ids || [presentationDrag.id];
      if (presentationDrag.mode === 'move') {
        if (!draggedIds.includes(item.id)) return item;
      } else if (item.id !== presentationDrag.id) {
        return item;
      }
      const dx = point.x - presentationDrag.startPoint.x;
      const dy = point.y - presentationDrag.startPoint.y;
      const start = presentationDrag.startItems?.find(startItem => startItem.id === item.id) || presentationDrag.startItem;

      if (presentationDrag.mode === 'move') {
        return { ...item, x: start.x + dx, y: start.y + dy };
      }

      if (presentationDrag.mode === 'scale') {
        const startWidth = getPresentationItemWidth(start);
        const startHeight = getPresentationItemHeight(start);
        if (isPresentationImageItem(start)) {
          const nextWidth = startWidth + dx * (presentationDrag.handle.includes('e') ? 1 : -1);
          const nextHeight = startHeight + dy * (presentationDrag.handle.includes('s') ? 1 : -1);
          const nextX = presentationDrag.handle.includes('w') ? start.x + dx : start.x;
          const nextY = presentationDrag.handle.includes('n') ? start.y + dy : start.y;

          if (!presentationDrag.freeScale) {
            const widthFactor = nextWidth / Math.max(1, startWidth);
            const heightFactor = nextHeight / Math.max(1, startHeight);
            const factor = Math.max(0.01, Math.abs(widthFactor) > Math.abs(heightFactor) ? widthFactor : heightFactor);
            const lockedWidth = Math.max(1, startWidth * factor);
            const lockedHeight = Math.max(1, startHeight * factor);
            return {
              ...item,
              x: presentationDrag.handle.includes('w') ? start.x + startWidth - lockedWidth : start.x,
              y: presentationDrag.handle.includes('n') ? start.y + startHeight - lockedHeight : start.y,
              width: lockedWidth,
              height: lockedHeight
            };
          }

          return {
            ...item,
            x: nextWidth < 1 ? item.x : nextX,
            y: nextHeight < 1 ? item.y : nextY,
            width: Math.max(1, nextWidth),
            height: Math.max(1, nextHeight)
          };
        }

        const startScale = Math.max(0.05, n(start.itemScale, 1));
        const rawScale = Math.max(
          (startWidth * startScale + dx * (presentationDrag.handle.includes('e') ? 1 : -1)) / startWidth,
          (startHeight * startScale + dy * (presentationDrag.handle.includes('s') ? 1 : -1)) / startHeight
        );
        return { ...item, itemScale: clamp(rawScale, 0.05, 20) };
      }

      if (presentationDrag.mode === 'rotate') {
        const startScale = getPresentationItemScale(start);
        const cx = start.x + (getPresentationItemWidth(start) * startScale) / 2;
        const cy = start.y + (getPresentationItemHeight(start) * startScale) / 2;
        const startAngle = Math.atan2(presentationDrag.startPoint.y - cy, presentationDrag.startPoint.x - cx);
        const nextAngle = Math.atan2(point.y - cy, point.x - cx);
        return { ...item, rotation: start.rotation + (nextAngle - startAngle) * 180 / Math.PI };
      }

      return item;
    }), { history: false });
  };

  const updateSelectedPresentationItem = (updates) => {
    if (!selectedPresentationItemId) return;
    applyPresentationItems(prev => prev.map(item => item.id === selectedPresentationItemId ? { ...item, ...updates } : item));
  };

  const getActivePresentationSelectionIds = () => (
    selectedPresentationItemIdsRef.current.length
      ? selectedPresentationItemIdsRef.current
      : [selectedPresentationItemIdRef.current].filter(Boolean)
  );

  const mirrorSelectedPresentationItems = (axis) => {
    const ids = getActivePresentationSelectionIds();
    if (!ids.length) return;

    applyPresentationItems(prev => prev.map(item => (
      ids.includes(item.id)
        ? {
            ...item,
            mirrorX: axis === 'x' ? !item.mirrorX : item.mirrorX,
            mirrorY: axis === 'y' ? !item.mirrorY : item.mirrorY
          }
        : item
    )), { selectedIds: ids });
  };

  const alignSelectedPresentationItems = (mode) => {
    const ids = getActivePresentationSelectionIds();
    if (ids.length < 2) return;

    const selectedItems = presentationItemsRef.current.filter(item => ids.includes(item.id));
    if (selectedItems.length < 2) return;

    const groupBounds = getBoundsFromPointSets(selectedItems.flatMap(item => getPresentationItemCornerPoints(item)));
    const groupCenterX = groupBounds.x + groupBounds.width / 2;
    const groupCenterY = groupBounds.y + groupBounds.height / 2;

    applyPresentationItems(prev => prev.map(item => {
      if (!ids.includes(item.id)) return item;

      const itemBounds = getBoundsFromPointSets([getPresentationItemCornerPoints(item)]);
      let dx = 0;
      let dy = 0;

      if (mode === 'left') dx = groupBounds.x - itemBounds.x;
      if (mode === 'right') dx = groupBounds.x + groupBounds.width - (itemBounds.x + itemBounds.width);
      if (mode === 'center-x') dx = groupCenterX - (itemBounds.x + itemBounds.width / 2);
      if (mode === 'top') dy = groupBounds.y - itemBounds.y;
      if (mode === 'bottom') dy = groupBounds.y + groupBounds.height - (itemBounds.y + itemBounds.height);
      if (mode === 'center-y') dy = groupCenterY - (itemBounds.y + itemBounds.height / 2);

      return {
        ...item,
        x: n(item.x, 0) + dx,
        y: n(item.y, 0) + dy
      };
    }), { selectedIds: ids });
  };

  const copySelectedPresentationItem = () => {
    const ids = selectedPresentationItemIdsRef.current.length
      ? selectedPresentationItemIdsRef.current
      : [selectedPresentationItemIdRef.current].filter(Boolean);
    const items = presentationItemsRef.current.filter(entry => ids.includes(entry.id));
    if (items.length) presentationClipboardRef.current = items.map(item => ({ ...item }));
  };

  const pastePresentationItem = () => {
    const source = presentationClipboardRef.current;
    if (!source) return;
    const sourceItems = Array.isArray(source) ? source : [source];
    const firstSource = sourceItems[0];
    const clientMouse = presentationClientMouseRef.current;
    const livePoint = clientMouse ? getPresentationPointFromClient(clientMouse.x, clientMouse.y) : null;
    const point = livePoint || presentationMousePointRef.current || { x: n(firstSource?.x, 0) + 40, y: n(firstSource?.y, 0) + 40 };
    const sourceBounds = getBoundsFromPointSets(sourceItems.flatMap(item => getPresentationItemCornerPoints(item)));
    const dx = point.x - (sourceBounds.x + sourceBounds.width / 2);
    const dy = point.y - (sourceBounds.y + sourceBounds.height / 2);
    const nextItems = sourceItems.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      name: `${item.name} copy`,
      x: item.x + dx,
      y: item.y + dy,
      createdAt: Date.now()
    }));
    applyPresentationItems(prev => [...prev, ...nextItems], { selectedIds: nextItems.map(item => item.id) });
  };

  const deleteSelectedPresentationItem = () => {
    const ids = selectedPresentationItemIdsRef.current.length
      ? selectedPresentationItemIdsRef.current
      : [selectedPresentationItemIdRef.current].filter(Boolean);
    applyPresentationItems(prev => prev.filter(item => !ids.includes(item.id)), { selectedIds: [] });
  };

  const presentationItemTransform = (item) => {
    const itemScale = getPresentationItemScale(item);
    if (isPresentationImageItem(item)) {
      const cx = (getPresentationItemWidth(item) * scale) / 2;
      const cy = (getPresentationItemHeight(item) * scale) / 2;
      const mirrorX = item.mirrorX ? -1 : 1;
      const mirrorY = item.mirrorY ? -1 : 1;
      return `translate(${item.x * scale} ${item.y * scale}) rotate(${item.rotation || 0} ${cx} ${cy}) translate(${cx} ${cy}) scale(${mirrorX} ${mirrorY}) translate(${-cx} ${-cy})`;
    }

    const cx = (item.width * itemScale * scale) / 2;
    const cy = (item.height * itemScale * scale) / 2;
    const mirrorX = item.mirrorX ? -1 : 1;
    const mirrorY = item.mirrorY ? -1 : 1;
    return `translate(${item.x * scale} ${item.y * scale}) rotate(${item.rotation || 0} ${cx} ${cy}) translate(${cx} ${cy}) scale(${mirrorX} ${mirrorY}) translate(${-cx} ${-cy}) scale(${itemScale}) translate(${-item.bounds.x * scale} ${-item.bounds.y * scale})`;
  };

  const presentationPolygonPath = (points) => (
    points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x * scale} ${y * scale}`).join(' ') + ' Z'
  );

  const renderPresentationItemArtwork = (item) => (
    <g transform={presentationItemTransform(item)}>
      {isPresentationImageItem(item) && (
        <image
          href={getPresentationImageUrl(item)}
          xlinkHref={getPresentationImageUrl(item)}
          x="0"
          y="0"
          width={getPresentationItemWidth(item) * scale}
          height={getPresentationItemHeight(item) * scale}
          preserveAspectRatio="none"
        />
      )}
      {getPresentationOuterFrameRings(item).map((ring, index) => (
        ring.solid ? (
          <polygon
            key={`outer-frame-${item.id}-${index}`}
            points={polygonPoints(ring.solid)}
            fill="#000000"
          />
        ) : (
          <path
            key={`outer-frame-${item.id}-${index}`}
            d={`${presentationPolygonPath(ring.outer)} ${presentationPolygonPath(ring.inner)}`}
            fill="#000000"
            fillRule="evenodd"
          />
        )
      ))}
      {getPresentationBodyPolygons(item).map((points, index) => (
        <polygon key={`panel-${item.id}-${index}`} points={polygonPoints(points)} fill={item.tint || '#000000'} />
      ))}
      {(item.whitePolygons || []).map((points, index) => (
        <polygon key={`white-${item.id}-${index}`} points={polygonPoints(points)} fill="#ffffff" />
      ))}
    </g>
  );

  const getPresentationExportBounds = () => {
    const sets = presentationItems.map(getPresentationItemCornerPoints);
    const bounds = getBoundsFromPointSets(sets);
    const pad = 40;
    return { x: bounds.x - pad, y: bounds.y - pad, width: bounds.width + pad * 2, height: bounds.height + pad * 2 };
  };

  const presentationPolygonPointsRaw = (points) => points.map(([x, y]) => `${roundDXF(x)},${roundDXF(y)}`).join(' ');
  const presentationPolygonPathRaw = (points) => (
    points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${roundDXF(x)} ${roundDXF(y)}`).join(' ') + ' Z'
  );
  const getPresentationLayeredItems = () => (
    presentationItems
  );

  const buildPresentationSvgMarkup = () => {
    const bounds = getPresentationExportBounds();
    const artwork = getPresentationLayeredItems().map(item => {
      const itemScale = getPresentationItemScale(item);
      if (isPresentationImageItem(item)) {
        const width = getPresentationItemWidth(item);
        const height = getPresentationItemHeight(item);
        const cx = width / 2;
        const cy = height / 2;
        const mirrorX = item.mirrorX ? -1 : 1;
        const mirrorY = item.mirrorY ? -1 : 1;
        const transform = `translate(${roundDXF(item.x)} ${roundDXF(item.y)}) rotate(${roundDXF(item.rotation || 0)} ${roundDXF(cx)} ${roundDXF(cy)}) translate(${roundDXF(cx)} ${roundDXF(cy)}) scale(${mirrorX} ${mirrorY}) translate(${-roundDXF(cx)} ${-roundDXF(cy)})`;
        const imageUrl = getPresentationImageUrl(item);
        return `<image href="${imageUrl}" xlink:href="${imageUrl}" x="0" y="0" width="${roundDXF(width)}" height="${roundDXF(height)}" preserveAspectRatio="none" transform="${transform}"/>`;
      }

      const cx = (item.width * itemScale) / 2;
      const cy = (item.height * itemScale) / 2;
      const mirrorX = item.mirrorX ? -1 : 1;
      const mirrorY = item.mirrorY ? -1 : 1;
      const transform = `translate(${roundDXF(item.x)} ${roundDXF(item.y)}) rotate(${roundDXF(item.rotation || 0)} ${roundDXF(cx)} ${roundDXF(cy)}) translate(${roundDXF(cx)} ${roundDXF(cy)}) scale(${mirrorX} ${mirrorY}) translate(${-roundDXF(cx)} ${-roundDXF(cy)}) scale(${roundDXF(itemScale)}) translate(${-roundDXF(item.bounds.x)} ${-roundDXF(item.bounds.y)})`;
      const outerFrame = getPresentationOuterFrameRings(item)
        .map(ring => ring.solid
          ? `<polygon points="${presentationPolygonPointsRaw(ring.solid)}" fill="#000000"/>`
          : `<path d="${presentationPolygonPathRaw(ring.outer)} ${presentationPolygonPathRaw(ring.inner)}" fill="#000000" fill-rule="evenodd"/>`)
        .join('');
      const panels = getPresentationBodyPolygons(item).map(points => `<polygon points="${presentationPolygonPointsRaw(points)}" fill="${item.tint || '#000000'}"/>`).join('');
      const whites = (item.whitePolygons || []).map(points => `<polygon points="${presentationPolygonPointsRaw(points)}" fill="#ffffff"/>`).join('');
      return `<g transform="${transform}">${outerFrame}${panels}${whites}</g>`;
    }).join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${roundDXF(bounds.x)} ${roundDXF(bounds.y)} ${roundDXF(bounds.width)} ${roundDXF(bounds.height)}"><rect x="${roundDXF(bounds.x)}" y="${roundDXF(bounds.y)}" width="${roundDXF(bounds.width)}" height="${roundDXF(bounds.height)}" fill="#ffffff"/>${artwork}</svg>`;
  };

  const downloadTextFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportPresentationSvg = () => {
    downloadTextFile(buildPresentationSvgMarkup(), 'presentation.svg', 'image/svg+xml');
  };

  const exportPresentationPng = () => {
    const markup = buildPresentationSvgMarkup();
    const bounds = getPresentationExportBounds();
    const blob = new Blob([markup], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const image = new window.Image();
    image.onload = () => {
      const maxSize = 5000;
      const ratio = Math.min(3, maxSize / Math.max(bounds.width, bounds.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bounds.width * ratio));
      canvas.height = Math.max(1, Math.round(bounds.height * ratio));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(pngBlob => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = 'presentation.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    };
    image.src = url;
  };

  const exportPresentationPdf = () => {
    const markup = buildPresentationSvgMarkup();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>Presentation PDF</title><style>body{margin:0;background:#fff}svg{width:100vw;height:100vh;display:block}</style></head><body>${markup}<script>window.onload=()=>window.print()</script></body></html>`);
    printWindow.document.close();
  };

  const getInlineSvgRenderData = (svgText) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(removeSvgCanvasBackground(svgText || ''), 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg || doc.querySelector('parsererror')) return null;

    const serializer = new XMLSerializer();
    return {
      rootBox: getSvgRootBox(svg),
      markup: Array.from(svg.children).map(child => serializer.serializeToString(child)).join('')
    };
  };

  const getInteriorDesignClipPathId = (designId) => `interior-design-clip-${designId}`;

  const getMeasuredTextBox = (text, fontFamily = 'Arial, sans-serif', letterSpacing = 0) => {
    const textData = buildInteriorTextPathData({ text, fontFamily, letterSpacing, height: 100 });
    if (textData) return textData.box;

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
      const bounds = getInteriorObjectBounds(design);
      const objectTransform = getInteriorSvgTransform(design, bounds);

      if (design.bendPoints) {
        // Bent groups render as flattened black/white paths instead of recursing into children —
        // this loses each child's own interactivity and exact z-order (collapsed into two color
        // layers, white under black) while bent; remove the bend line to get normal per-child
        // group editing back.
        const bentContours = getBentGroupContours(design);
        const eventProps = interactiveDesign ? {
          onMouseDown: (e) => startInteriorDesignDrag(e, interactiveDesign, 'move'),
          onClick: (e) => selectInteriorDesignFromCanvas(e, interactiveDesign.id)
        } : {};
        const cursorStyle = interactiveDesign ? { cursor: interiorDrag?.id === interactiveDesign.id && interiorDrag.mode === 'move' ? 'grabbing' : 'move' } : undefined;
        const whiteContours = bentContours.filter(contour => contour.color !== 'black');
        const blackContours = bentContours.filter(contour => contour.color === 'black');

        return (
          <g transform={objectTransform || undefined}>
            {whiteContours.length > 0 && (
              <path d={buildInteriorContoursPathD(whiteContours)} fill="#ffffff" fillRule="nonzero" {...eventProps} style={cursorStyle} />
            )}
            {blackContours.length > 0 && (
              <path d={buildInteriorContoursPathD(blackContours)} fill="#000000" fillRule="nonzero" {...eventProps} style={cursorStyle} />
            )}
          </g>
        );
      }

      return (
        <g transform={objectTransform || undefined}>
          {(design.children || []).map(child => (
            <g key={child.id} pointerEvents={interactiveDesign ? 'auto' : 'none'}>
              {renderInteriorDesignBody(child, interactiveDesign)}
            </g>
          ))}
        </g>
      );
    }

    const bounds = getInteriorObjectBounds(design);
    const x = bounds.x;
    const y = bounds.y;
    const itemWidth = bounds.width;
    const itemHeight = bounds.height;
    const commonClipPath = getInteriorClipPolygonsForDesign(design).length
      ? `url(#${getInteriorDesignClipPathId(design.id)})`
      : undefined;
    const objectTransform = getInteriorSvgTransform(design, bounds);
    const shapeFill = design.color === 'black' ? '#000000' : '#ffffff';
    const strokeWidth = Math.max(0.5, n(design.thickness, 8)) * scale;
    const arcBandPoints = design.kind === 'arc' ? getInteriorArcBandPoints(design) : [];
    const eventProps = interactiveDesign ? {
      onMouseDown: (e) => startInteriorDesignDrag(e, interactiveDesign, 'move'),
      onClick: (e) => selectInteriorDesignFromCanvas(e, interactiveDesign.id)
    } : {};
    const cursorStyle = interactiveDesign ? { cursor: interiorDrag?.id === interactiveDesign.id && interiorDrag.mode === 'move' ? 'grabbing' : 'move' } : undefined;

    if (design.kind === 'patternAlongPath') {
      const svgRenderData = getInlineSvgRenderData(design.svgText);
      if (!svgRenderData) return null;
      const sourceBox = design.sourceBox || svgRenderData.rootBox;
      const designScale = n(design.scale, 1);
      const itemW = Math.max(1, n(design.motifWidth, sourceBox.width || 20)) * designScale;
      const itemH = Math.max(1, n(design.motifHeight, sourceBox.height || 20)) * designScale;
      const sx = itemW / (sourceBox.width || 1);
      const sy = itemH / (sourceBox.height || 1);
      const localTx = -itemW / 2 - sourceBox.x * sx;
      const localTy = -itemH / 2 - sourceBox.y * sy;
      const thicken = n(design.lineThicken, 0);
      const thickenedContours = thicken > 0 ? getThickenedLocalSvgContours(design, (sx + sy) / 2) : null;
      const motifFill = design.color === 'black' ? '#000000' : '#ffffff';

      if (design.bendPoints) {
        // Bent patterns render as one flattened path instead of repeating per-instance groups —
        // this loses per-instance interactivity while bent; remove the bend line to get the
        // normal repeated-instance rendering back.
        return (
          <g clipPath={commonClipPath}>
            <path d={buildInteriorContoursPathD(getBentPatternContours(design))} fill={motifFill} fillRule="nonzero" {...eventProps} style={cursorStyle} />
          </g>
        );
      }

      return (
        // clip-path is on this outer, untransformed <g> so the margin/clip-source region stays
        // fixed in absolute board space; the design's own rotation is applied only to the inner
        // <g>, so rotating the shape no longer drags the clip mask along with it.
        <g clipPath={commonClipPath}>
          <g transform={objectTransform || undefined}>
            <rect
              x={x * scale}
              y={y * scale}
              width={itemWidth * scale}
              height={itemHeight * scale}
              fill="transparent"
              pointerEvents="all"
              {...eventProps}
              style={cursorStyle}
            />
            {buildPatternAlongPathInstances(design).map((inst, index) => {
              const mirrorFlip = isPatternInstanceMirrored(design, index) ? -1 : 1;
              return (
                <g
                  key={index}
                  transform={`translate(${inst.x * scale} ${inst.y * scale}) rotate(${inst.angle * 180 / Math.PI}) scale(${mirrorFlip} 1)`}
                  {...eventProps}
                  style={cursorStyle}
                >
                  {thickenedContours ? (
                    <g
                      transform={`translate(${localTx * scale} ${localTy * scale}) scale(${sx * scale} ${sy * scale})`}
                      pointerEvents="visiblePainted"
                    >
                      {thickenedContours.map((contour, contourIndex) => (
                        <polygon key={contourIndex} points={rawPolygonPoints(contour.points)} fill={motifFill} fillRule="nonzero" />
                      ))}
                    </g>
                  ) : (
                    <g
                      transform={`translate(${localTx * scale} ${localTy * scale}) scale(${sx * scale} ${sy * scale})`}
                      pointerEvents="visiblePainted"
                      style={{ filter: design.color === 'black' ? 'brightness(0)' : 'brightness(0) invert(1)' }}
                      dangerouslySetInnerHTML={{ __html: svgRenderData.markup }}
                    />
                  )}
                </g>
              );
            })}
          </g>
        </g>
      );
    }

    if (isImportedInteriorSvg(design)) {
      const svgRenderData = getInlineSvgRenderData(design.svgText);
      if (svgRenderData) {
        const sourceBox = design.sourceBox || svgRenderData.rootBox;
        const sx = itemWidth / (sourceBox.width || 1);
        const sy = itemHeight / (sourceBox.height || 1);
        const tx = (x - sourceBox.x * sx) * scale;
        const ty = (y - sourceBox.y * sy) * scale;
        const hitPadding = IMPORTED_SVG_HIT_TOLERANCE_PX / Math.max(0.0001, scale * viewZoom);
        const thicken = n(design.lineThicken, 0);
        const thickenedContours = thicken > 0 ? getThickenedLocalSvgContours(design, (sx + sy) / 2) : null;

        return (
          <g clipPath={commonClipPath}>
            <g transform={objectTransform || undefined}>
              <rect
                x={(x - hitPadding) * scale}
                y={(y - hitPadding) * scale}
                width={(itemWidth + hitPadding * 2) * scale}
                height={(itemHeight + hitPadding * 2) * scale}
                fill="transparent"
                pointerEvents="all"
                {...eventProps}
                style={cursorStyle}
              />
              {thickenedContours ? (
                <g
                  transform={`translate(${tx} ${ty}) scale(${sx * scale} ${sy * scale})`}
                  pointerEvents="visiblePainted"
                  {...eventProps}
                  style={cursorStyle}
                >
                  {thickenedContours.map((contour, contourIndex) => (
                    <polygon
                      key={contourIndex}
                      points={rawPolygonPoints(contour.points)}
                      fill={design.color === 'black' ? '#000000' : '#ffffff'}
                      fillRule="nonzero"
                    />
                  ))}
                </g>
              ) : (
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
              )}
            </g>
          </g>
        );
      }

      return (
        <g clipPath={commonClipPath}>
          <image
            href={design.href}
            x={x * scale}
            y={y * scale}
            width={itemWidth * scale}
            height={itemHeight * scale}
            preserveAspectRatio="none"
            transform={objectTransform || undefined}
            {...eventProps}
            style={{
              ...(cursorStyle || {}),
              filter: design.color === 'black' ? 'brightness(0)' : 'brightness(0) invert(1)'
            }}
          />
        </g>
      );
    }

    if ((design.kind === 'line' || design.kind === 'arc') && design.borderPattern === 'meander') {
      return (
        <g clipPath={commonClipPath}>
          <g transform={objectTransform || undefined} {...eventProps} style={cursorStyle}>
            {buildMeanderPatternContours(design).map((points, index) => (
              <polygon key={index} points={polygonPoints(points)} fill={shapeFill} />
            ))}
          </g>
        </g>
      );
    }

    if (design.kind === 'rect') {
      return <g clipPath={commonClipPath}><rect x={x * scale} y={y * scale} width={itemWidth * scale} height={itemHeight * scale} fill={shapeFill} transform={objectTransform || undefined} {...eventProps} style={cursorStyle} /></g>;
    }

    if (design.kind === 'ellipse') {
      return <g clipPath={commonClipPath}><ellipse cx={(x + itemWidth / 2) * scale} cy={(y + itemHeight / 2) * scale} rx={(itemWidth / 2) * scale} ry={(itemHeight / 2) * scale} fill={shapeFill} transform={objectTransform || undefined} {...eventProps} style={cursorStyle} /></g>;
    }

    if (design.kind === 'polygon') {
      return <g clipPath={commonClipPath}><polygon points={polygonPoints(design.points || [])} fill={shapeFill} transform={objectTransform || undefined} {...eventProps} style={cursorStyle} /></g>;
    }

    if (design.kind === 'editableSvg') {
      // Show the flat (unbent) points while actively point-editing, so dragging stays simple and
      // undistorted; the arc bend re-applies once you exit point-edit mode.
      const displayContours = design.pointEditMode !== false ? (design.contours || []) : getBentContours(design);
      return <g clipPath={commonClipPath}><path d={buildInteriorContoursPathD(displayContours)} fill={shapeFill} fillRule="nonzero" transform={objectTransform || undefined} {...eventProps} style={cursorStyle} /></g>;
    }

    if (design.kind === 'line') {
      return <g clipPath={commonClipPath}><line x1={n(design.x1, 0) * scale} y1={n(design.y1, 0) * scale} x2={n(design.x2, 0) * scale} y2={n(design.y2, 0) * scale} stroke={shapeFill} strokeWidth={strokeWidth} strokeLinecap="butt" transform={objectTransform || undefined} {...eventProps} style={cursorStyle} /></g>;
    }

    if (design.kind === 'arc') {
      return <g clipPath={commonClipPath}><polygon points={polygonPoints(arcBandPoints)} fill={shapeFill} transform={objectTransform || undefined} {...eventProps} style={cursorStyle} /></g>;
    }

    if (design.kind === 'eraser') {
      const path = (design.points || [])
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point[0] * scale} ${point[1] * scale}`)
        .join(' ');

      return (
        <g clipPath={commonClipPath}>
          <path
            d={path}
            fill="none"
            stroke="#000000"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            transform={objectTransform || undefined}
            {...eventProps}
            style={cursorStyle}
          />
        </g>
      );
    }

    if (design.kind === 'text') {
      const textValue = design.text ?? '';
      const outlineMarkup = getInteriorTextPreviewPath(design);
      const bridgeContours = getInteriorTextBridgeContours(design);
      return (
        <g clipPath={commonClipPath}>
          <g transform={objectTransform || undefined} {...eventProps} style={cursorStyle}>
            <rect
              x={x * scale}
              y={y * scale}
              width={itemWidth * scale}
              height={itemHeight * scale}
              fill="transparent"
            />
            {textValue && outlineMarkup && (
              <path
                d={outlineMarkup}
                fill={shapeFill}
                fillRule="nonzero"
                pointerEvents="none"
              />
            )}
            {bridgeContours.map((bridgePoints, bridgeIndex) => (
              <polygon
                key={`bridge-${bridgeIndex}`}
                points={polygonPoints(bridgePoints)}
                fill="#000000"
                pointerEvents="none"
              />
            ))}
          </g>
        </g>
      );
    }

    return null;
  };

  if (workspaceMode === 'presentation') {
    const presentationViewBox = getPresentationViewBox();

    return (
      <div className="h-[100dvh] overflow-hidden bg-slate-100 p-3">
        <div className="h-full w-full bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col min-h-0">
          <div className="shrink-0 min-h-[195px] overflow-x-auto border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <WorkspaceTabs workspaceMode={workspaceMode} onSwitch={switchWorkspaceMode} />
              <div>
                <h1 className="text-lg font-bold text-slate-800">Presentation</h1>
                <p className="text-xs text-slate-500">{presentationItems.length} saved item{presentationItems.length === 1 ? '' : 's'}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {selectedPresentationItem && (
                <>
                  {isPresentationImageItem(selectedPresentationItem) ? (
                    <>
                      <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        W
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          value={Number.isFinite(Number(selectedPresentationItem.width)) ? Number(selectedPresentationItem.width).toFixed(2) : ''}
                          onChange={e => updateSelectedPresentationItem({ width: e.target.value === '' ? '' : Number(e.target.value) })}
                          onBlur={() => updateSelectedPresentationItem({ width: Math.max(1, n(selectedPresentationItem.width, 1)) })}
                          className="w-20 rounded-md border border-slate-200 bg-white p-1.5 text-xs text-slate-900"
                        />
                      </label>
                      <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        H
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          value={Number.isFinite(Number(selectedPresentationItem.height)) ? Number(selectedPresentationItem.height).toFixed(2) : ''}
                          onChange={e => updateSelectedPresentationItem({ height: e.target.value === '' ? '' : Number(e.target.value) })}
                          onBlur={() => updateSelectedPresentationItem({ height: Math.max(1, n(selectedPresentationItem.height, 1)) })}
                          className="w-20 rounded-md border border-slate-200 bg-white p-1.5 text-xs text-slate-900"
                        />
                      </label>
                    </>
                  ) : (
                    <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      Scale
                      <input
                        type="number"
                        step="0.01"
                        min="0.05"
                        value={Number.isFinite(Number(selectedPresentationItem.itemScale)) ? Number(selectedPresentationItem.itemScale).toFixed(2) : ''}
                        onChange={e => updateSelectedPresentationItem({ itemScale: e.target.value === '' ? '' : Math.max(0.05, Number(e.target.value)) })}
                        onBlur={() => updateSelectedPresentationItem({ itemScale: Math.max(0.05, n(selectedPresentationItem.itemScale, 1)) })}
                        className="w-20 rounded-md border border-slate-200 bg-white p-1.5 text-xs text-slate-900"
                      />
                    </label>
                  )}
                  <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    Rotate
                    <input
                      type="number"
                      step="1"
                      value={Math.round(selectedPresentationItem.rotation || 0)}
                      onChange={e => updateSelectedPresentationItem({ rotation: e.target.value === '' ? '' : Number(e.target.value) })}
                      onBlur={() => updateSelectedPresentationItem({ rotation: n(selectedPresentationItem.rotation, 0) })}
                      className="w-20 rounded-md border border-slate-200 bg-white p-1.5 text-xs text-slate-900"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    Tint
                    <input
                      type="color"
                      value={selectedPresentationItem.tint || '#000000'}
                      onChange={e => updateSelectedPresentationItem({ tint: e.target.value })}
                      className="h-8 w-10 rounded-md border border-slate-200 bg-white p-1"
                    />
                  </label>
                  <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => mirrorSelectedPresentationItems('x')}
                      className="px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      title="Mirror horizontally"
                    >
                      <FlipHorizontal size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => mirrorSelectedPresentationItems('y')}
                      className="border-l border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      title="Mirror vertically"
                    >
                      <FlipVertical size={14} />
                    </button>
                  </div>
                  <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white">
                    {[
                      ['Left', 'left'],
                      ['H', 'center-x'],
                      ['Right', 'right'],
                      ['Top', 'top'],
                      ['V', 'center-y'],
                      ['Bottom', 'bottom']
                    ].map(([label, mode], index) => (
                      <button
                        key={mode}
                        type="button"
                        disabled={selectedPresentationItemIds.length < 2}
                        onClick={() => alignSelectedPresentationItems(mode)}
                        className={[
                          'px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white',
                          index > 0 ? 'border-l border-slate-200' : ''
                        ].join(' ')}
                        title={`Align ${label}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white">
                    <button type="button" onClick={() => reorderSelectedPresentationItem('back')} className="px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" title="Send to back">Back</button>
                    <button type="button" onClick={() => reorderSelectedPresentationItem('backward')} className="px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" title="Send backward"><ArrowDown size={14} /></button>
                    <button type="button" onClick={() => reorderSelectedPresentationItem('forward')} className="px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" title="Send forward"><ArrowUp size={14} /></button>
                    <button type="button" onClick={() => reorderSelectedPresentationItem('front')} className="px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" title="Send to front">Front</button>
                  </div>
                  {!isPresentationImageItem(selectedPresentationItem) && (
                    <>
                      <button
                        type="button"
                        onClick={() => updateSelectedPresentationItem({
                          showOuterFrame: !selectedPresentationItem.showOuterFrame,
                          outerFrameThickness: Math.max(0, n(selectedPresentationItem.outerFrameThickness, 30))
                        })}
                        className={[
                          'rounded-md border px-3 py-2 text-xs font-semibold transition',
                          selectedPresentationItem.showOuterFrame
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        ].join(' ')}
                      >
                        {selectedPresentationItem.showOuterFrame ? 'Frame on' : 'Add frame'}
                      </button>
                      {selectedPresentationItem.showOuterFrame && (
                        <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                          Frame mm
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={selectedPresentationItem.outerFrameThickness ?? 30}
                            onChange={e => updateSelectedPresentationItem({ outerFrameThickness: e.target.value })}
                            onBlur={() => updateSelectedPresentationItem({ outerFrameThickness: Math.max(0, n(selectedPresentationItem.outerFrameThickness, 30)) })}
                            onKeyDown={e => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                            className="w-20 rounded-md border border-slate-200 bg-white p-1.5 text-xs text-slate-900"
                          />
                        </label>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={deleteSelectedPresentationItem}
                    className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100"
                    title="Delete presentation item"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
              <button type="button" onClick={resetPresentationView} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Reset view
              </button>
              <button
                type="button"
                disabled={!presentationItems.length}
                onClick={clearPresentationItems}
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
              >
                Clear all
              </button>
              <button type="button" onClick={exportPresentationSvg} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                SVG
              </button>
              <button type="button" onClick={exportPresentationPng} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                PNG
              </button>
              <button type="button" onClick={exportPresentationPdf} className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                PDF
              </button>
            </div>
          </div>

          <div className="relative flex-1 min-h-0 bg-white flex overflow-hidden">
            <input
              ref={presentationDecorationFileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePresentationDecorationFiles}
            />
            <svg
              ref={presentationSvgRef}
              width="100%"
              height="100%"
              viewBox={`${presentationViewBox.x} ${presentationViewBox.y} ${presentationViewBox.width} ${presentationViewBox.height}`}
              className="h-full w-full flex-1"
              onWheel={handlePresentationWheel}
              onMouseDown={handlePresentationMouseDown}
              onMouseMove={handlePresentationMouseMove}
              onMouseUp={() => setPresentationDrag(null)}
              onMouseLeave={() => setPresentationDrag(null)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={handlePresentationDecorationDrop}
              style={{ cursor: presentationDrag?.mode === 'pan' ? 'grabbing' : 'default' }}
            >
              <rect
                x={presentationViewBox.x - presentationViewBox.width * 2}
                y={presentationViewBox.y - presentationViewBox.height * 2}
                width={presentationViewBox.width * 5}
                height={presentationViewBox.height * 5}
                fill="#ffffff"
                pointerEvents="none"
              />
              {getPresentationLayeredItems().map(item => {
                const itemScale = getPresentationItemScale(item);
                const presentationFrameBounds = isPresentationImageItem(item)
                  ? { x: 0, y: 0, width: getPresentationItemWidth(item), height: getPresentationItemHeight(item) }
                  : getBoundsFromPointSets([
                      [item.bounds.x, item.bounds.y],
                      [item.bounds.x + item.bounds.width, item.bounds.y],
                      [item.bounds.x + item.bounds.width, item.bounds.y + item.bounds.height],
                      [item.bounds.x, item.bounds.y + item.bounds.height],
                      ...getPresentationOuterFrameRings(item).flatMap(ring => ring.solid || [...ring.outer, ...ring.inner])
                    ]);
                const selected = selectedPresentationItemIds.includes(item.id);
                const primarySelected = item.id === selectedPresentationItemId;
                const x = (item.x + (isPresentationImageItem(item) ? 0 : presentationFrameBounds.x - item.bounds.x) * itemScale) * scale;
                const y = (item.y + (isPresentationImageItem(item) ? 0 : presentationFrameBounds.y - item.bounds.y) * itemScale) * scale;
                const w = presentationFrameBounds.width * itemScale * scale;
                const h = presentationFrameBounds.height * itemScale * scale;
                const handleSize = 10 / presentationZoom;
                const rotateY = y - 28 / presentationZoom;

                return (
                  <g key={item.id}>
                    <g
                      onMouseDown={(e) => startPresentationItemDrag(e, item, 'move')}
                      style={{ cursor: presentationDrag?.id === item.id && presentationDrag.mode === 'move' ? 'grabbing' : 'move' }}
                    >
                      {renderPresentationItemArtwork(item)}
                    </g>
                    {selected && (
                      <g>
                        <rect
                          x={x}
                          y={y}
                          width={w}
                          height={h}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth={1.5 / presentationZoom}
                          strokeDasharray={`${6 / presentationZoom} ${5 / presentationZoom}`}
                          pointerEvents="none"
                        />
                        {primarySelected && (
                          <>
                            {[
                              ['nw', x, y],
                              ['ne', x + w, y],
                              ['sw', x, y + h],
                              ['se', x + w, y + h]
                            ].map(([handle, hx, hy]) => (
                              <rect
                                key={handle}
                                x={hx - handleSize / 2}
                                y={hy - handleSize / 2}
                                width={handleSize}
                                height={handleSize}
                                fill="#2563eb"
                                stroke="#ffffff"
                                strokeWidth={1 / presentationZoom}
                                onMouseDown={(e) => startPresentationItemDrag(e, item, 'scale', handle)}
                                style={{ cursor: `${handle}-resize` }}
                              />
                            ))}
                            <line
                              x1={x + w / 2}
                              y1={y}
                              x2={x + w / 2}
                              y2={rotateY}
                              stroke="#2563eb"
                              strokeWidth={1 / presentationZoom}
                            />
                            <circle
                              cx={x + w / 2}
                              cy={rotateY}
                              r={6 / presentationZoom}
                              fill="#ffffff"
                              stroke="#2563eb"
                              strokeWidth={1.5 / presentationZoom}
                              onMouseDown={(e) => startPresentationItemDrag(e, item, 'rotate')}
                              style={{ cursor: 'grab' }}
                            />
                          </>
                        )}
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
            <aside className="w-52 shrink-0 border-l border-slate-200 bg-slate-50 p-3 overflow-y-auto">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Decor</h2>
                  <p className="text-[11px] text-slate-500">Drag into view</p>
                </div>
                <button
                  type="button"
                  onClick={() => presentationDecorationFileInputRef.current?.click()}
                  className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100"
                  title="Add image"
                >
                  <Plus size={15} />
                </button>
              </div>
              <div className="space-y-2">
                {allPresentationDecorations.map(decoration => (
                  <div
                    key={decoration.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('presentation-decoration-id', decoration.id);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onDoubleClick={() => addDecorationToPresentation(decoration)}
                    className="group rounded-lg border border-slate-200 bg-white p-2 cursor-grab active:cursor-grabbing"
                  >
                    <div className="aspect-[4/3] rounded-md border border-slate-100 bg-white flex items-center justify-center overflow-hidden">
                      <img src={decoration.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="block truncate text-[11px] font-medium text-slate-600">{decoration.name}</span>
                        <span className="block text-[9px] uppercase tracking-wide text-slate-400">
                          {decoration.projectAsset ? 'Project asset' : 'Local only'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePresentationDecorationBackground(decoration);
                          }}
                          className="rounded border border-slate-200 bg-slate-50 p-1 text-slate-600 hover:bg-slate-100"
                          title="Remove background"
                        >
                          <Eraser size={12} />
                        </button>
                        {!decoration.builtIn && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePresentationDecoration(decoration.id);
                            }}
                            className="rounded border border-red-100 bg-red-50 p-1 text-red-600 hover:bg-red-100"
                            title="Delete decoration"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  if (workspaceMode === 'interior') {
    return (
      <div className="h-[100dvh] overflow-hidden bg-slate-100 p-3">
        {pendingBoardImportId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40">
            <div className="w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
              <p className="text-sm font-semibold text-slate-800">Save your current design first?</p>
              <p className="mt-1 text-xs text-slate-500">
                Loading this board will replace your current frame and interior design. Anything not saved as a board will be lost.
              </p>
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={confirmSaveThenImportBoard}
                  className="w-full rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Save current, then load board
                </button>
                <button
                  type="button"
                  onClick={confirmDiscardAndImportBoard}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Discard and load board
                </button>
                <button
                  type="button"
                  onClick={cancelBoardImport}
                  className="w-full rounded-md px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="h-full w-full bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col min-h-0">
          <div className="shrink-0 min-h-[195px] overflow-x-auto border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <WorkspaceTabs workspaceMode={workspaceMode} onSwitch={switchWorkspaceMode} />
              <div>
                <h1 className="text-lg font-bold text-slate-800">Interior Designer</h1>
                <p className="text-xs text-slate-500">
                  {pendingPatternPathSourceId
                    ? 'Click an edge to follow (Esc to cancel)'
                    : activeInteriorShapeTool
                    ? `${getInteriorShapeName(activeInteriorShapeTool)} tool active`
                    : `${safeWidth} x ${safeHeight} mm frame`}
                </p>
              </div>
            </div>

            <div className="flex min-w-max flex-1 items-center justify-end gap-2">
              <button
                type="button"
                onClick={sendCurrentDesignToPresentation}
                className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
              >
                Send to presentation
              </button>
            </div>

            {selectedInteriorDesign && (
              <div className="flex min-w-max items-center justify-end gap-2">
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
                      value={interiorDimensionDrafts[field] ?? formatInteriorDimensionInput(selectedInteriorBounds?.[field] ?? selectedInteriorDesign[field] ?? '')}
                      onFocus={() => {
                        setInteriorDimensionDrafts(prev => ({
                          ...prev,
                          [field]: formatInteriorDimensionInput(selectedInteriorBounds?.[field] ?? selectedInteriorDesign[field] ?? '')
                        }));
                      }}
                      onChange={e => handleInteriorNumberChange(field, e.target.value)}
                      onBlur={() => handleInteriorNumberBlur(field, field === 'width' || field === 'height' ? 100 : 0)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                      className="w-20 rounded-md border bg-white p-1.5 text-xs text-slate-900"
                    />
                  </label>
                ))}

                <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  R
                  <input
                    type="number"
                    step="0.1"
                    value={interiorDimensionDrafts.rotation ?? formatInteriorDimensionInput(n(selectedInteriorDesign.rotation, 0))}
                    onFocus={() => {
                      setInteriorDimensionDrafts(prev => ({
                        ...prev,
                        rotation: formatInteriorDimensionInput(n(selectedInteriorDesign.rotation, 0))
                      }));
                    }}
                    onChange={e => setInteriorSelectionRotation(e.target.value)}
                    onBlur={handleInteriorRotationBlur}
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    className="w-16 rounded-md border bg-white p-1.5 text-xs text-slate-900"
                    title="Rotation angle"
                  />
                </label>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => transformInteriorSelection({ rotationDelta: -90 })}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    title="Rotate 90 degrees counter-clockwise"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => transformInteriorSelection({ rotationDelta: 90 })}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    title="Rotate 90 degrees clockwise"
                  >
                    <RotateCw size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => transformInteriorSelection({ mirrorX: true })}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    title="Mirror horizontally"
                  >
                    <FlipHorizontal size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => transformInteriorSelection({ mirrorY: true })}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    title="Mirror vertically"
                  >
                    <FlipVertical size={14} />
                  </button>
                </div>

                {(selectedInteriorDesign.kind === 'line' || selectedInteriorDesign.kind === 'arc') && (
                  <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    Border
                    <select
                      value={selectedInteriorDesign.borderPattern === 'meander' ? 'meander' : 'solid'}
                      onChange={e => updateInteriorDesign(selectedInteriorDesign.id, { borderPattern: e.target.value === 'meander' ? 'meander' : 'solid' })}
                      className="rounded-md border bg-white p-1.5 text-xs text-slate-900"
                    >
                      <option value="solid">Solid</option>
                      <option value="meander">Meander</option>
                    </select>
                  </label>
                )}

                {(selectedInteriorDesign.kind === 'line' || selectedInteriorDesign.kind === 'arc' || selectedInteriorDesign.kind === 'eraser' || selectedInteriorDesign.borderPattern === 'meander') && (
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

                {selectedInteriorDesign.borderPattern === 'meander' && (
                  <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    Motif
                    <input
                      type="number"
                      min="1"
                      value={selectedInteriorDesign.meanderLength ?? 40}
                      onChange={e => updateInteriorDesign(selectedInteriorDesign.id, { meanderLength: e.target.value === '' ? '' : Math.max(1, Number(e.target.value)) })}
                      onBlur={() => updateInteriorDesign(selectedInteriorDesign.id, { meanderLength: Math.max(1, n(selectedInteriorDesign.meanderLength, 40)) })}
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
                        className="w-40 rounded-md border bg-white p-1.5 text-xs text-slate-900"
                        style={{ fontFamily: selectedInteriorDesign.fontFamily || interiorFontOptions[0].value }}
                      >
                        {interiorFontOptions.map(font => (
                          <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
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
                    <button
                      type="button"
                      onClick={() => updateInteriorDesign(selectedInteriorDesign.id, { textBridgesEnabled: !selectedInteriorDesign.textBridgesEnabled })}
                      className={[
                        'inline-flex items-center rounded-md border px-2 py-1.5 text-xs font-medium transition',
                        selectedInteriorDesign.textBridgesEnabled
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      ].join(' ')}
                      title="Add black bridges through enclosed text holes"
                    >
                      Bridges
                    </button>
                    {selectedInteriorDesign.textBridgesEnabled && (
                      <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        Bridge
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          value={selectedInteriorDesign.textBridgeWidth ?? 8}
                          onChange={e => updateInteriorDesign(selectedInteriorDesign.id, { textBridgeWidth: e.target.value === '' ? '' : Number(e.target.value) })}
                          onBlur={() => updateInteriorDesign(selectedInteriorDesign.id, { textBridgeWidth: Math.max(1, n(selectedInteriorDesign.textBridgeWidth, 8)) })}
                          className="w-16 rounded-md border bg-white p-1.5 text-xs text-slate-900"
                        />
                      </label>
                    )}
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
                <button
                  type="button"
                  disabled={selectedInteriorDesignIds.length < 2}
                  onClick={applyInteriorClipFromSelection}
                  className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  title="Clip selected white design to selected black shape"
                >
                  Clip
                </button>

                {isImportedInteriorSvg(selectedInteriorDesign) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingPatternPathSourceId(selectedInteriorDesign.id);
                      setInteriorSelection([]);
                    }}
                    className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    title="Repeat this SVG along an edge you pick from another shape"
                  >
                    Pattern along path
                  </button>
                )}

                {isImportedInteriorSvg(selectedInteriorDesign) && (
                  <button
                    type="button"
                    onClick={() => convertImportedSvgToEditablePoints(selectedInteriorDesign)}
                    className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    title="Convert to an editable shape so every corner/point can be dragged independently"
                  >
                    Edit points
                  </button>
                )}

                {selectedInteriorDesign.kind === 'editableSvg' && (
                  <button
                    type="button"
                    onClick={() => updateInteriorDesign(selectedInteriorDesign.id, {
                      pointEditMode: selectedInteriorDesign.pointEditMode === false
                    })}
                    className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    title={selectedInteriorDesign.pointEditMode === false
                      ? 'Show per-point handles again to edit corners'
                      : 'Switch back to normal resize/rotate handles (keeps your point edits)'}
                  >
                    {selectedInteriorDesign.pointEditMode === false ? 'Edit points' : 'Exit edit points'}
                  </button>
                )}

                {(selectedInteriorDesign.kind === 'editableSvg' || selectedInteriorDesign.kind === 'patternAlongPath' || isInteriorGroup(selectedInteriorDesign)) && (
                  <button
                    type="button"
                    onClick={() => toggleInteriorBendLine(selectedInteriorDesign)}
                    className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    title={selectedInteriorDesign.bendPoints
                      ? 'Remove the bend line and flatten back to the original shape'
                      : (isInteriorGroup(selectedInteriorDesign)
                        ? 'Add a draggable 3-point bend line through the middle of the group — every shape inside follows it as you drag the points'
                        : selectedInteriorDesign.kind === 'patternAlongPath'
                          ? 'Add a draggable 3-point bend line through the middle of the pattern — every repeated instance follows it as you drag the points'
                          : 'Add a draggable 3-point bend line through the middle of the shape — drag the points to reshape it')}
                  >
                    {selectedInteriorDesign.bendPoints ? 'Remove bend line' : 'Add bend line'}
                  </button>
                )}

                {(isImportedInteriorSvg(selectedInteriorDesign) || selectedInteriorDesign.kind === 'patternAlongPath') && (
                  <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    Line thickness
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={selectedInteriorDesign.lineThicken ?? 0}
                      onChange={e => updateInteriorDesign(selectedInteriorDesign.id, { lineThicken: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                      onBlur={() => updateInteriorDesign(selectedInteriorDesign.id, { lineThicken: Math.max(0, n(selectedInteriorDesign.lineThicken, 0)) })}
                      className="w-16 rounded-md border bg-white p-1.5 text-xs text-slate-900"
                      title="Grows all black lines/fills of this SVG outward by this amount (mm), all around"
                    />
                  </label>
                )}

                {selectedInteriorDesign.kind === 'patternAlongPath' && (
                  <>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      Count
                      <input
                        type="number"
                        min="1"
                        value={selectedInteriorDesign.count ?? 6}
                        onChange={e => updateInteriorDesign(selectedInteriorDesign.id, { count: e.target.value === '' ? '' : Math.max(1, Math.round(Number(e.target.value))) })}
                        onBlur={() => updateInteriorDesign(selectedInteriorDesign.id, { count: Math.max(1, Math.round(n(selectedInteriorDesign.count, 6))) })}
                        className="w-14 rounded-md border bg-white p-1.5 text-xs text-slate-900"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      Offset
                      <input
                        type="number"
                        value={selectedInteriorDesign.offset ?? 0}
                        onChange={e => updateInteriorDesign(selectedInteriorDesign.id, { offset: e.target.value === '' ? '' : Number(e.target.value) })}
                        onBlur={() => updateInteriorDesign(selectedInteriorDesign.id, { offset: n(selectedInteriorDesign.offset, 0) })}
                        className="w-16 rounded-md border bg-white p-1.5 text-xs text-slate-900"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      Scale
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={selectedInteriorDesign.scale ?? 1}
                        onChange={e => updateInteriorDesign(selectedInteriorDesign.id, { scale: e.target.value === '' ? '' : Math.max(0.1, Number(e.target.value)) })}
                        onBlur={() => updateInteriorDesign(selectedInteriorDesign.id, { scale: Math.max(0.1, n(selectedInteriorDesign.scale, 1)) })}
                        className="w-14 rounded-md border bg-white p-1.5 text-xs text-slate-900"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      <input
                        type="checkbox"
                        checked={!!selectedInteriorDesign.mirror}
                        disabled={!!selectedInteriorDesign.alternateMirror}
                        onChange={e => updateInteriorDesign(selectedInteriorDesign.id, { mirror: e.target.checked })}
                      />
                      Mirror
                    </label>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      <input
                        type="checkbox"
                        checked={!!selectedInteriorDesign.alternateMirror}
                        onChange={e => updateInteriorDesign(selectedInteriorDesign.id, { alternateMirror: e.target.checked })}
                      />
                      Alternate mirror
                    </label>
                  </>
                )}

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

          <div className="flex-1 min-h-0 overflow-hidden p-3 flex gap-3">
            <div className="w-72 max-h-full min-h-0 shrink-0 overflow-y-auto rounded-lg border bg-slate-50 p-3 space-y-3">
              <Section title="Position">
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
                      className="rounded-md border border-slate-200 bg-white px-2 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
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
              </Section>

              <Section
                title="Margin & Clip"
                enabled={interiorClipEnabled}
                onToggleEnabled={setInteriorClipEnabled}
                enabledLabel="Clip white designs"
                open={interiorOverlayPanel === 'margin'}
                onOpenChange={(isOpen) => setInteriorOverlayPanel(isOpen ? 'margin' : null)}
              >
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
              </Section>

              {hasPanelSplit && isAsymmetricTop && (
                <Section title="Frame Adjustments" alwaysOpen>
                  <label className="text-[11px] text-slate-500">Right panel top offset (mm)</label>
                  <input
                    type="number"
                    min="0"
                    value={rightPanelTopOffsetInput}
                    onChange={e => setRightPanelTopOffsetInput(e.target.value === '' ? '' : +e.target.value)}
                    onBlur={() => handleNumberBlur(setRightPanelTopOffsetInput, rightPanelTopOffsetInput, 0)}
                    className="mt-1 w-full rounded-md border bg-white p-1.5 text-sm text-slate-900"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Shifts the right panel's arc top and its ears down, without reshaping the arc or affecting the left panel.</p>
                  <label className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={rightPanelTopOffsetGlueEars}
                      onChange={e => setRightPanelTopOffsetGlueEars(e.target.checked)}
                    />
                    Glue ears in place
                  </label>
                  <p className="mt-1 text-[11px] text-slate-400">When on, only the arc top and its own top ears move — the right-edge ears and split-gap ears stay exactly where they are.</p>
                </Section>
              )}

              <Section
                title="Pattern"
                enabled={patternEnabled}
                onToggleEnabled={setPatternEnabled}
                enabledLabel="Enable pattern"
                open={interiorOverlayPanel === 'pattern'}
                onOpenChange={(isOpen) => setInteriorOverlayPanel(isOpen ? 'pattern' : null)}
              >
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
                <button
                  type="button"
                  onClick={() => (patternLocked ? unlockPattern() : lockCurrentPattern())}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {patternLocked ? 'Unlock pattern' : 'Lock pattern'}
                </button>
                {patternLocked && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] font-medium text-amber-800">
                    Locked — showing frozen layout. Edit fields to preview; unlock to apply.
                  </p>
                )}
                {patternMode === 'alignedSlots' && (
                  <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 font-medium text-slate-700">
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
                    ['Position shift', patternRandomDirectionAmount, setPatternRandomDirectionAmount, 0, patternRandomDirectionEnabled, setPatternRandomDirectionEnabled],
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
                {patternMode === 'alignedSlots' && (
                  <div>
                    <label className="text-[11px] text-slate-500">Row offset (mm)</label>
                    <input
                      type="number"
                      value={alignedSlotRowOffsetInput}
                      onChange={e => setAlignedSlotRowOffsetInput(e.target.value === '' ? '' : +e.target.value)}
                      onBlur={() => handleNumberBlur(setAlignedSlotRowOffsetInput, alignedSlotRowOffsetInput, -Infinity, Infinity, 0)}
                      className="mt-1 w-full rounded-md border bg-white p-1.5 text-sm text-slate-900"
                    />
                  </div>
                )}
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
                    disabled={patternLocked}
                    onClick={() => setPatternSeed(prev => Math.max(1, n(prev, 1) + 1))}
                    className={[
                      'w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50',
                      patternLocked ? 'opacity-40 cursor-not-allowed hover:bg-white' : ''
                    ].join(' ')}
                  >
                    Regenerate
                  </button>
                )}
              </Section>

              <Section
                title="SVG Library"
                open={interiorOverlayPanel === 'svgLibrary'}
                onOpenChange={(isOpen) => setInteriorOverlayPanel(isOpen ? 'svgLibrary' : null)}
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-medium text-slate-500">Folder</label>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {visibleProjectSvgLibraryItems.length}
                  </span>
                </div>
                <select
                  value={selectedInteriorSvgLibraryFolder}
                  onChange={e => setSelectedInteriorSvgLibraryFolder(e.target.value)}
                  className="w-full rounded-md border bg-white p-1.5 text-sm text-slate-900"
                >
                  {projectSvgLibraryFolders.map(folder => (
                    <option key={folder} value={folder}>{folder}</option>
                  ))}
                </select>

                {visibleProjectSvgLibraryItems.length ? (
                  <div
                    className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1"
                    onWheel={(e) => e.stopPropagation()}
                    onWheelCapture={(e) => e.stopPropagation()}
                  >
                    {visibleProjectSvgLibraryItems.map(item => {
                      const thumbnail = svgLibraryThumbnails[item.id];
                      return (
                        <button
                          key={item.id}
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            interiorSvgLibraryDragRef.current = true;
                            interiorSvgLibraryDragItemRef.current = item.id;
                            e.dataTransfer.setData(INTERIOR_SVG_LIBRARY_DRAG_TYPE, item.id);
                            e.dataTransfer.setData('text/plain', item.id);
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          onDragEnd={() => {
                            window.setTimeout(() => {
                              interiorSvgLibraryDragRef.current = false;
                              interiorSvgLibraryDragItemRef.current = null;
                            }, 0);
                          }}
                          onClick={async () => {
                            if (interiorSvgLibraryDragRef.current) return;
                            const svgText = await loadProjectSvgLibraryItemText(item);
                            addInteriorSvgDesignFromText(svgText, item.name);
                          }}
                          onMouseDown={async (e) => {
                            if (e.button !== 1 || !thumbnail) return;
                            e.preventDefault();
                            e.stopPropagation();
                            const svgText = await loadProjectSvgLibraryItemText(item);
                            setExpandedSvgLibraryThumbnail({
                              src: svgTextToDataUrl(removeSvgCanvasBackground(svgText)),
                              name: item.name
                            });
                          }}
                          onMouseUp={(e) => {
                            if (e.button === 1) {
                              e.preventDefault();
                              e.stopPropagation();
                              setExpandedSvgLibraryThumbnail(null);
                            }
                          }}
                          onAuxClick={(e) => {
                            if (e.button === 1) {
                              e.preventDefault();
                              e.stopPropagation();
                            }
                          }}
                          className="rounded-md border border-slate-200 bg-slate-50 p-1.5 text-left text-[11px] text-slate-700 transition hover:border-blue-200 hover:bg-blue-50"
                          title="Click to insert centered, drag into the workspace, or hold middle mouse for large preview"
                        >
                          <span className="flex h-16 w-full items-center justify-center overflow-hidden rounded border border-slate-200 bg-white">
                            {thumbnail ? (
                              <img
                                src={thumbnail}
                                alt=""
                                className="h-full w-full scale-125 object-contain"
                                draggable={false}
                              />
                            ) : (
                              <span className="text-[10px] font-medium text-slate-400">Loading</span>
                            )}
                          </span>
                          <span className="mt-1 block truncate font-medium">{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-500">
                    Add SVG files to <span className="font-mono text-slate-600">src/assets/svg-library</span>.
                  </div>
                )}
              </Section>
            </div>

            <div
              ref={previewWheelBlockerRef}
              className="relative flex-1 min-w-0 min-h-0 rounded-lg border bg-slate-50 overflow-hidden"
              onWheel={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={handleInteriorSvgLibraryDrop}
            >
              <svg
                width="100%"
                height="100%"
                viewBox={`${currentViewBox.x} ${currentViewBox.y} ${currentViewBox.width} ${currentViewBox.height}`}
                className="h-full w-full"
                onWheel={handleViewportWheel}
                onMouseDown={handleInteriorCanvasMouseDown}
                onMouseMove={handleInteriorPreviewMouseMove}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={handleInteriorSvgLibraryDrop}
                onMouseUp={() => {
                  finishInteriorInteraction();
                  finishInteriorSelectionBox();
                  if (interiorShapeDraft?.kind === 'eraser') finishInteriorShapeDraft();
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
                      ? 'crosshair'
                      : (interiorSelectionBox || isInteriorPointerOnWhiteSurface)
                      ? 'crosshair'
                      : 'default'
                }}
              >
                <defs>
                  <clipPath id="interior-margin-clip" clipPathUnits="userSpaceOnUse">
                    <path d={buildInteriorMarginPath()} />
                  </clipPath>
                  {flattenInteriorDesigns(interiorDesigns).map(design => {
                    const clipPolygons = getInteriorClipPolygonsForDesign(design);
                    if (!clipPolygons.length) return null;

                    return (
                      <clipPath key={design.id} id={getInteriorDesignClipPathId(design.id)} clipPathUnits="userSpaceOnUse">
                        {clipPolygons.map((points, index) => (
                          <polygon key={`${design.id}-clip-${index}`} points={polygonPoints(points)} />
                        ))}
                      </clipPath>
                    );
                  })}
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

                {patternEnabled && (
                  <g pointerEvents={patternMode === 'random' && !activeInteriorShapeTool ? 'auto' : 'none'}>
                    {getPatternContours().map((contour, index) => (
                      <polygon
                        key={`pattern-preview-${index}`}
                        points={polygonPoints(contour.points)}
                        fill="#ffffff"
                        onMouseDown={patternMode === 'random' ? (e) => { if (!activeInteriorShapeTool) e.stopPropagation(); } : undefined}
                        onClick={patternMode === 'random' ? (e) => selectPatternSlotFromCanvas(e, contour) : undefined}
                        style={patternMode === 'random' ? { cursor: 'pointer' } : undefined}
                      />
                    ))}
                  </g>
                )}

                {interiorDesigns.map((design) => {
                  const selected = selectedInteriorDesignIds.includes(design.id) || design.id === selectedInteriorDesignId;
                  const bounds = getInteriorObjectBounds(design);
                  const x = bounds.x;
                  const y = bounds.y;
                  const itemWidth = bounds.width;
                  const itemHeight = bounds.height;
                  const commonClipPath = getInteriorClipPolygonsForDesign(design).length
                    ? `url(#${getInteriorDesignClipPathId(design.id)})`
                    : undefined;
                  const shapeFill = design.color === 'black' ? '#000000' : '#ffffff';
                  const strokeWidth = Math.max(0.5, n(design.thickness, 8)) * scale;
                  const arcBandPoints = design.kind === 'arc' ? getInteriorArcBandPoints(design) : [];
                  const objectTransform = getInteriorSvgTransform(design, bounds);
                  const rotatedOutlineBounds = getInteriorRotatedBounds(design, bounds);

                  return (
                    <g key={design.id} pointerEvents={(activeInteriorShapeTool || activeTool === 'measure' || activeTool === 'angle') ? 'none' : 'auto'}>
                      {isInteriorGroup(design) && (
                        <g>
                          {renderInteriorDesignBody(design, design)}
                        </g>
                      )}

                      {isImportedInteriorSvg(design) && (
                        renderInteriorDesignBody(design, design)
                      )}

                      {design.kind === 'patternAlongPath' && (
                        renderInteriorDesignBody(design, design)
                      )}

                      {(design.kind === 'line' || design.kind === 'arc') && design.borderPattern === 'meander' && (
                        <g clipPath={commonClipPath}>
                          <g
                            transform={objectTransform || undefined}
                            onMouseDown={(e) => startInteriorDesignDrag(e, design, 'move')}
                            onClick={(e) => selectInteriorDesignFromCanvas(e, design.id)}
                            style={{ cursor: interiorDrag?.id === design.id && interiorDrag.mode === 'move' ? 'grabbing' : 'move' }}
                          >
                            {buildMeanderPatternContours(design).map((points, index) => (
                              <polygon key={index} points={polygonPoints(points)} fill={shapeFill} />
                            ))}
                          </g>
                        </g>
                      )}

                      {design.kind === 'rect' && (
                        <g clipPath={commonClipPath}>
                          <rect
                            x={x * scale}
                            y={y * scale}
                            width={itemWidth * scale}
                            height={itemHeight * scale}
                            fill={shapeFill}
                            transform={objectTransform || undefined}
                            onMouseDown={(e) => startInteriorDesignDrag(e, design, 'move')}
                            onClick={(e) => selectInteriorDesignFromCanvas(e, design.id)}
                            style={{ cursor: interiorDrag?.id === design.id && interiorDrag.mode === 'move' ? 'grabbing' : 'move' }}
                          />
                        </g>
                      )}

                      {design.kind === 'ellipse' && (
                        <g clipPath={commonClipPath}>
                          <ellipse
                            cx={(x + itemWidth / 2) * scale}
                            cy={(y + itemHeight / 2) * scale}
                            rx={(itemWidth / 2) * scale}
                            ry={(itemHeight / 2) * scale}
                            fill={shapeFill}
                            transform={objectTransform || undefined}
                            onMouseDown={(e) => startInteriorDesignDrag(e, design, 'move')}
                            onClick={(e) => selectInteriorDesignFromCanvas(e, design.id)}
                            style={{ cursor: interiorDrag?.id === design.id && interiorDrag.mode === 'move' ? 'grabbing' : 'move' }}
                          />
                        </g>
                      )}

                      {design.kind === 'polygon' && (
                        <g clipPath={commonClipPath}>
                          <polygon
                            points={polygonPoints(design.points || [])}
                            fill={shapeFill}
                            transform={objectTransform || undefined}
                            onMouseDown={(e) => startInteriorDesignDrag(e, design, 'move')}
                            onClick={(e) => selectInteriorDesignFromCanvas(e, design.id)}
                            style={{ cursor: interiorDrag?.id === design.id && interiorDrag.mode === 'move' ? 'grabbing' : 'move' }}
                          />
                        </g>
                      )}

                      {design.kind === 'editableSvg' && (
                        renderInteriorDesignBody(design, design)
                      )}

                      {design.kind === 'line' && design.borderPattern !== 'meander' && (
                        <g clipPath={commonClipPath}>
                          <line
                            x1={n(design.x1, 0) * scale}
                            y1={n(design.y1, 0) * scale}
                            x2={n(design.x2, 0) * scale}
                            y2={n(design.y2, 0) * scale}
                            stroke={shapeFill}
                            strokeWidth={strokeWidth}
                            strokeLinecap="butt"
                            transform={objectTransform || undefined}
                            onMouseDown={(e) => startInteriorDesignDrag(e, design, 'move')}
                            onClick={(e) => selectInteriorDesignFromCanvas(e, design.id)}
                            style={{ cursor: interiorDrag?.id === design.id && interiorDrag.mode === 'move' ? 'grabbing' : 'move' }}
                          />
                        </g>
                      )}

                      {design.kind === 'arc' && design.borderPattern !== 'meander' && (
                        <g clipPath={commonClipPath}>
                          <polygon
                            points={polygonPoints(arcBandPoints)}
                            fill={shapeFill}
                            transform={objectTransform || undefined}
                            onMouseDown={(e) => startInteriorDesignDrag(e, design, 'move')}
                            onClick={(e) => selectInteriorDesignFromCanvas(e, design.id)}
                            style={{ cursor: interiorDrag?.id === design.id && interiorDrag.mode === 'move' ? 'grabbing' : 'move' }}
                          />
                        </g>
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
                            x={rotatedOutlineBounds.x * scale}
                            y={rotatedOutlineBounds.y * scale}
                            width={rotatedOutlineBounds.width * scale}
                            height={rotatedOutlineBounds.height * scale}
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth={1.5 / viewZoom}
                            strokeDasharray={`${5 / viewZoom} ${4 / viewZoom}`}
                            pointerEvents="none"
                          />
                          {getInteriorDesignHandles({ ...design, ...rotatedOutlineBounds }).map(handle => (
                            <rect
                              key={handle.id}
                              x={handle.x * scale - 5 / viewZoom}
                              y={handle.y * scale - 5 / viewZoom}
                              width={10 / viewZoom}
                              height={10 / viewZoom}
                              fill={handle.id === 'rotate' ? '#ffffff' : '#2563eb'}
                              stroke="white"
                              strokeWidth={1 / viewZoom}
                              onMouseDown={(e) => startInteriorDesignDrag(e, design, handle.id === 'rotate' ? 'rotate' : 'resize', handle.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeInteriorShapeTool) return;
                              }}
                              style={{ cursor: handle.cursor }}
                            />
                          ))}
                          {design.bendPoints && getInteriorPointHandles(design).some(handle => handle.id.startsWith('bend-')) && (
                            <polyline
                              points={polygonPoints(getBendCurveSamples(design.bendPoints)?.curvePoints || [])}
                              fill="none"
                              stroke="#f97316"
                              strokeWidth={1.5 / viewZoom}
                              strokeDasharray={`${4 / viewZoom} ${3 / viewZoom}`}
                              pointerEvents="none"
                            />
                          )}
                          {getInteriorPointHandles(design).map(handle => (
                            <circle
                              key={handle.id}
                              cx={handle.x * scale}
                              cy={handle.y * scale}
                              r={6 / viewZoom}
                              fill={handle.id.startsWith('bend-') ? '#f97316' : '#2563eb'}
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
                        fill={handle.id === 'rotate' ? '#ffffff' : '#2563eb'}
                        stroke="white"
                        strokeWidth={1 / viewZoom}
                        onMouseDown={(e) => startInteriorSelectionTransform(e, handle.id === 'rotate' ? 'multi-rotate' : 'multi-resize', handle.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: handle.cursor }}
                      />
                    ))}
                  </g>
                )}

                {interiorClipEnabled && interiorMarginBoundarySets.length > 0 && (
                  <path
                    d={`${buildOutlinePath()} ${buildInteriorMarginPath()}`}
                    fill="#000000"
                    fillRule="evenodd"
                    pointerEvents="none"
                  />
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

                {((activeTool === 'measure') || (activeInteriorShapeTool && activeInteriorShapeTool !== 'eraser')) && hoverSnap && !draggingMeasurement && (
                  <rect x={hoverSnap[0] * scale - 5 / viewZoom} y={hoverSnap[1] * scale - 5 / viewZoom} width={10 / viewZoom} height={10 / viewZoom} fill="none" stroke="#2563eb" strokeWidth={2 / viewZoom} />
                )}

                {pendingPatternPathSourceId && hoveredPatternPathEdge && (
                  <polyline
                    points={polygonPoints(hoveredPatternPathEdge.points)}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={5 / viewZoom}
                    pointerEvents="none"
                  />
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
                className="absolute right-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] items-start justify-end gap-2"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
                onWheelCapture={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={saveCurrentInteriorBoard}
                  className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white"
                >
                  Save board
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowInteriorBoardsMenu(prev => !prev)}
                    className={[
                      'rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition',
                      showInteriorBoardsMenu
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white/95 text-slate-700 hover:bg-white'
                    ].join(' ')}
                  >
                    Boards
                  </button>
                  {showInteriorBoardsMenu && (
                    <div className="absolute right-0 top-10 z-40 w-80 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-800">Saved boards</p>
                          <p className="text-[11px] text-slate-500">Click or drag into the workspace</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={!savedInteriorBoards.length}
                            onClick={downloadSavedBoardsDXF}
                            className={[
                              'rounded-md border px-2 py-1 text-[10px] font-semibold transition',
                              savedInteriorBoards.length
                                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
                            ].join(' ')}
                            title="Export all saved boards in one stacked DXF"
                          >
                            Export all boards
                          </button>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            {savedInteriorBoards.length}
                          </span>
                        </div>
                      </div>

                      {savedInteriorBoards.length ? (
                        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                          {savedInteriorBoards.map((board, index) => (
                            <div
                              key={board.id}
                              draggable
                              onDragStart={(e) => {
                                interiorBoardDragItemRef.current = board.id;
                                e.dataTransfer.setData(INTERIOR_BOARD_DRAG_TYPE, board.id);
                                e.dataTransfer.setData('text/plain', board.id);
                                e.dataTransfer.effectAllowed = 'copy';
                              }}
                              onDragEnd={() => {
                                window.setTimeout(() => {
                                  interiorBoardDragItemRef.current = null;
                                }, 0);
                              }}
                              onClick={() => requestFullBoardImport(board.id)}
                              className="group rounded-md border border-slate-200 bg-slate-50 p-2 transition hover:border-blue-200 hover:bg-blue-50"
                              title="Click to load this board's full frame and design, or drag in just the design"
                            >
                              <div className="flex items-start gap-2">
                                <div className="flex h-24 flex-1 items-center justify-center overflow-hidden rounded border border-slate-200 bg-white">
                                  {board.thumbnail ? (
                                    <img src={board.thumbnail} alt="" className="h-full w-full object-contain" draggable={false} />
                                  ) : (
                                    <span className="text-[11px] font-medium text-slate-400">No preview</span>
                                  )}
                                </div>
                                <div className="flex flex-col gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteSavedInteriorBoard(board.id);
                                    }}
                                    className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-700 opacity-80 hover:bg-red-100 group-hover:opacity-100"
                                    title="Delete saved board"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      importSavedInteriorBoard(board.id, getInteriorViewportCenterPoint());
                                    }}
                                    className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 opacity-80 hover:bg-slate-100 group-hover:opacity-100"
                                    title="Import just the design into the current workspace"
                                  >
                                    <PenLine size={13} />
                                  </button>
                                </div>
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                                <span className="font-medium text-slate-600">Board {savedInteriorBoards.length - index}</span>
                                <span>{new Date(board.createdAt || Date.now()).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
                          Press Save board to store the current interior design.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {expandedSvgLibraryThumbnail && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-50 flex h-[52vh] w-[52vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-slate-300 bg-white p-4 shadow-2xl">
                  <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <img
                      src={expandedSvgLibraryThumbnail.src}
                      alt=""
                      className="h-full w-full object-contain"
                      draggable={false}
                    />
                  </div>
                  <div className="mt-2 truncate text-center text-xs font-semibold text-slate-700">
                    {expandedSvgLibraryThumbnail.name}
                  </div>
                </div>
              )}

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

            <div className="w-56 max-h-full min-h-0 shrink-0 overflow-y-auto rounded-lg border bg-slate-50 p-3">
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

              <ViewZoomControls viewZoom={viewZoom} setViewZoom={setViewZoom} resetView={resetView} />

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
                  title="Export the current interior design as DXF"
                >
                  <Upload size={17} />
                  <span className="flex-1 text-left">Export current design</span>
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
      className="min-h-[100dvh] overflow-auto bg-slate-100 p-3 lg:h-[100dvh] lg:overflow-hidden"
      onClick={() => {
        if (activeTool === 'measure' || activeTool === 'angle') {
          setMeasurePoints([]);
          setMeasurements([]);
          setDraggingMeasurement(null);
        }
      }}
    >
      <div className="min-h-0 w-full grid gap-3 lg:h-full lg:grid-cols-[minmax(340px,420px)_1fr]" onClick={(e) => e.stopPropagation()}>

        {/* LEFT PANEL - CONTROLS */}
        <div className="min-h-0 flex flex-col bg-white rounded-xl shadow-lg border border-slate-200">
          <div className="shrink-0 border-b border-slate-200 px-4 py-3 space-y-3">
            <WorkspaceTabs workspaceMode={workspaceMode} onSwitch={switchWorkspaceMode} />
            <div>
              <h1 className="text-xl font-bold text-slate-800">Ear Pattern Generator</h1>
              <p className="text-slate-500 text-xs mt-0.5">Parametric CAD DXF generator</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-700">Import DXF as frame</p>
            {importedFrameOutline ? (
              <div className="space-y-2">
                <p className="text-[11px] leading-relaxed text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
                  Using imported outline from <span className="font-medium">{importedFrameFileName}</span>. Width/height, ears, split panel, and top-shape controls below don't apply while an imported frame is active.
                </p>
                <button
                  type="button"
                  onClick={() => { setImportedFrameOutline(null); setImportedFrameFileName(''); }}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Remove imported frame
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => frameDxfFileInputRef.current?.click()}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                title="Use a DXF file's outline as the board's outer cut shape instead of the parametric ear/split/top-shape controls below"
              >
                Import DXF...
              </button>
            )}
            <input
              ref={frameDxfFileInputRef}
              type="file"
              accept=".dxf"
              onChange={handleFrameDxfFileChange}
              className="hidden"
            />
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

          <Section title="Corner angle">
            <div className="grid grid-cols-3 gap-3">
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
          </Section>

          <Section title="Top shape" alwaysOpen>
            <label className="text-xs text-slate-500">Shape</label>
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
          </Section>

          <Section title="Ear sizes">
            <div className="grid grid-cols-4 gap-2 text-xs">
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
          </Section>

          <Section title="Split panel" enabled={splitPanelEnabled} onToggleEnabled={setSplitPanelEnabled}>
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
          </Section>

          <Section title="Add bottom panel" enabled={bottomPanelEnabled} onToggleEnabled={setBottomPanelEnabled}>
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
          </Section>

          <Section title="Manual Mode" alwaysOpen>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={manualMode} onChange={e => setManualMode(e.target.checked)} />
              Enable manual ear count
            </label>
            <p className="text-xs text-slate-500">Toggle between automatic optimization and fixed ear count</p>
          </Section>

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

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openInteriorDesigner}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-lg transition shadow-sm"
            >
              <PenLine size={17} />
              Interior
            </button>
            <button
              type="button"
              onClick={() => switchWorkspaceMode('presentation')}
              className="w-full inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold py-2.5 rounded-lg transition shadow-sm"
            >
              Presentation
            </button>
          </div>

          <div className="space-y-2">
            <button onClick={downloadDXF} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg transition shadow-sm">
              Export DXF
            </button>
          </div>

          <Section title="Notes">
            <div className="text-xs text-slate-500 leading-relaxed space-y-1">
              <p>• Auto mode: optimized spacing 240–400mm</p>
              <p>• Manual mode: fixed ear count with 80mm visible margins</p>
              <p>• N=1 centers ear perfectly</p>
              <p>• Asymmetric top: low left side, max right side, circular arc ends flat on the right</p>
              <p>• Double arc top: two connected circular arcs with editable middle point</p>
              <p>• Symmetric 3-arc top: transition height + crown width controls with optional side horizontal constraint</p>
            </div>
          </Section>
          </div>
        </div>

        {/* RIGHT AREA - PREVIEW + TOOL PANEL */}
        <div className="min-h-[520px] bg-white rounded-xl shadow-lg border border-slate-200 p-3 flex gap-3 lg:min-h-0">
          <div
            ref={previewWheelBlockerRef}
            className={[
      'bg-slate-50 rounded-lg p-2 border flex-1 min-w-0 min-h-0 overflow-hidden flex items-center justify-center',
      activeTool === 'measure' || activeTool === 'angle' || activeTool === 'add-ear' || activeTool === 'delete-ear' ? 'cursor-crosshair' : ''
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
              style={{ cursor: panState ? 'grabbing' : activeTool === 'measure' || activeTool === 'angle' || activeTool === 'add-ear' || activeTool === 'delete-ear' ? 'crosshair' : 'default' }}
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
          <div className={['max-h-full min-h-0 overflow-y-auto rounded-lg border bg-slate-50 p-2 transition-all duration-200 shrink-0', activeTool ? 'w-52' : 'w-40'].join(' ')}>
            <div className="flex items-center gap-2 mb-2">
              <Wrench size={18} className="text-slate-700" />
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Tools</h2>
                <p className="text-[11px] text-slate-500">{activeTool ? `Active: ${activeTool}` : 'No tool selected'}</p>
              </div>
            </div>

            <ViewZoomControls viewZoom={viewZoom} setViewZoom={setViewZoom} resetView={resetView} />

            <div className="space-y-1.5">
              <ToolButton id="measure" icon={Ruler} label="Measure" shortcut="M" {...toolButtonProps} />
              <ToolButton id="angle" icon={DraftingCompass} label="Angle" shortcut="A" {...toolButtonProps} />
              <ToolButton id="add-ear" icon={Plus} label="Add ear" {...toolButtonProps} />
              <ToolButton id="delete-ear" icon={Trash2} label="Delete ear" {...toolButtonProps} />
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
