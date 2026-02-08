import type { GridItem, LayoutStore } from "@dashboardity/layout-store";
import React, { useCallback, useRef, useState } from "react";
import { useLayoutState } from "./useLayoutState";

export type GridLayoutProps = {
  store: LayoutStore;
  /** 그리드 한 칸 너비(px). 픽셀 ↔ 그리드 변환에 사용 */
  cellWidth: number;
  /** 그리드 한 칸 높이(px) */
  cellHeight: number;
  /** 레이아웃에 쓴 실제 컨테이너 너비(px). 지정 시 컨테이너 width를 이 값으로 고정해 % 기반 위치가 올바르게 계산됨 */
  containerWidth?: number;
  /** 지정 시 store.columns 대신 이 값으로 열 수 사용(반응형 breakpoint와 표시 일치용) */
  columns?: number;
  /** 각 패널을 감쌀 추가 컨텐츠(children). (item) => ReactNode */
  children?: (item: GridItem) => React.ReactNode;
  /** 리사이즈 핸들에 표시할 커스텀 아이콘/요소. 미지정 시 기본 스타일 div 사용 */
  resizeHandle?: React.ReactNode;
  /** 격자선 표시 여부 */
  showGrid?: boolean;
  /** 드래그 허용 (view 모드에서는 false) */
  draggable?: boolean;
  /** 리사이즈 허용 (view 모드에서는 false) */
  resizable?: boolean;
};

const toPx = (n: number): string => `${n}px`;

/**
 * store를 구독해 items를 그리드로 렌더링하고, drag → move, resize → resize 로 LayoutAction을 dispatch한다.
 * computeLayout은 호출하지 않으며, 모든 변경은 store.dispatch로만 일어난다.
 */
export const GridLayout: React.FC<GridLayoutProps> = ({
  store,
  cellWidth,
  cellHeight,
  containerWidth,
  columns: columnsProp,
  children,
  resizeHandle,
  showGrid,
  draggable = true,
  resizable = true,
}) => {
  const { items, columns: columnsFromStore } = useLayoutState(store);
  const columns = columnsProp ?? columnsFromStore;
  const containerRef = useRef<HTMLDivElement>(null);
  /** 드래그 시 store는 drop 시에만 갱신. 이동 중에는 preview 위치만 state로 보관 */
  const [drag, setDrag] = useState<{
    id: string;
    startX: number;
    startY: number;
    gridX: number;
    gridY: number;
  } | null>(null);
  const [resize, setResize] = useState<{
    id: string;
    startW: number;
    startH: number;
    startPixelX: number;
    startPixelY: number;
  } | null>(null);

  const pixelToGridY = useCallback(
    (pixelY: number) => Math.max(0, Math.round(pixelY / cellHeight)),
    [cellHeight],
  );
  const pixelToGridH = useCallback(
    (pixelH: number) => Math.max(1, Math.round(pixelH / cellHeight)),
    [cellHeight],
  );

  /** 드래그/리사이즈 시 컨테이너 실제 너비로 픽셀→그리드 변환 (반응형 유지) */
  const getCellWidthFromRect = useCallback(
    (rect: DOMRect) => (columns > 0 ? rect.width / columns : cellWidth),
    [columns, cellWidth],
  );

  const handleMove = useCallback(
    (e: MouseEvent) => {
      if (!drag || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cw = getCellWidthFromRect(rect);
      const pixelX = e.clientX - rect.left;
      const pixelY = e.clientY - rect.top;
      const gridX = Math.max(0, Math.min(columns - 1, Math.round(pixelX / cw)));
      const gridY = pixelToGridY(pixelY);
      setDrag((prev) => (prev ? { ...prev, gridX, gridY } : null));
    },
    [drag, columns, getCellWidthFromRect, pixelToGridY],
  );
  const handleMoveEnd = useCallback(() => {
    if (drag) {
      store.dispatch({
        type: "move",
        id: drag.id,
        x: drag.gridX,
        y: drag.gridY,
      });
      setDrag(null);
    }
  }, [drag, store]);

  const handleResize = useCallback(
    (e: MouseEvent) => {
      if (!resize || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cw = getCellWidthFromRect(rect);
      const pixelX = e.clientX - rect.left;
      const pixelY = e.clientY - rect.top;
      const item = items.find((i) => i.id === resize.id);
      if (!item) return;
      const baseLeft = item.x * cw;
      const baseTop = item.y * cellHeight;
      const pixelW = Math.max(cw, pixelX - baseLeft);
      const pixelH = Math.max(cellHeight, pixelY - baseTop);
      const w = Math.min(
        columns - item.x,
        Math.max(1, Math.round(pixelW / cw)),
      );
      const h = pixelToGridH(pixelH);
      store.dispatch({ type: "resize", id: resize.id, w, h });
    },
    [
      resize,
      items,
      getCellWidthFromRect,
      cellHeight,
      columns,
      pixelToGridH,
      store,
    ],
  );
  const handleResizeEnd = useCallback(() => setResize(null), []);

  React.useEffect(() => {
    if (!drag) return;
    const onUp = () => {
      handleMoveEnd();
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, handleMove, handleMoveEnd]);

  React.useEffect(() => {
    if (!resize) return;
    const onUp = () => {
      handleResizeEnd();
      window.removeEventListener("mousemove", handleResize);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", handleResize);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", handleResize);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resize, handleResize, handleResizeEnd]);

  const onPanelMouseDown = useCallback(
    (e: React.MouseEvent, item: GridItem) => {
      if (!draggable || e.button !== 0) return;
      e.preventDefault();
      setDrag({
        id: item.id,
        startX: e.clientX,
        startY: e.clientY,
        gridX: item.x,
        gridY: item.y,
      });
    },
    [draggable],
  );
  const onResizeHandleMouseDown = useCallback(
    (e: React.MouseEvent, item: GridItem) => {
      if (!resizable || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setResize({
        id: item.id,
        startW: item.w,
        startH: item.h,
        startPixelX: e.clientX,
        startPixelY: e.clientY,
      });
    },
    [resizable],
  );

  const totalH =
    items.length > 0
      ? Math.max(...items.map((i) => i.y + i.h)) * cellHeight
      : 0;

  const isDragging = (item: GridItem) => Boolean(drag && item.id === drag.id);

  const pct = (n: number) => `${n}%`;
  const colPct = (gridUnits: number) =>
    columns > 0 ? (gridUnits / columns) * 100 : 0;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        ...(containerWidth != null
          ? { width: toPx(containerWidth), maxWidth: "100%" }
          : { width: "100%", maxWidth: "100%" }),
        minWidth: 0,
        height: toPx(totalH),
        overflow: "hidden",
      }}
    >
      {Boolean(showGrid) && (
        <div
          aria-hidden
          className="grid-layout-grid"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            backgroundImage: `
              linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)
            `,
            backgroundSize: `${pct(colPct(1))} ${cellHeight}px`,
            pointerEvents: "none",
          }}
        />
      )}
      {items.map((item) => {
        const dragging = isDragging(item);
        const showPlaceholder = dragging;
        const displayX = dragging ? drag!.gridX : item.x;
        const displayY = dragging ? drag!.gridY : item.y;
        return (
          <React.Fragment key={item.id}>
            {showPlaceholder && (
              <div
                role="gridcell"
                aria-hidden
                style={{
                  position: "absolute",
                  left: pct(colPct(item.x)),
                  top: toPx(item.y * cellHeight),
                  width: pct(colPct(item.w)),
                  height: toPx(item.h * cellHeight),
                  boxSizing: "border-box",
                  border: "2px dashed rgba(0,0,0,0.2)",
                  borderRadius: 6,
                  pointerEvents: "none",
                }}
              />
            )}
            <div
              role="gridcell"
              style={{
                position: "absolute",
                left: pct(colPct(displayX)),
                top: toPx(displayY * cellHeight),
                width: pct(colPct(item.w)),
                height: toPx(item.h * cellHeight),
                boxSizing: "border-box",
                cursor: draggable
                  ? drag?.id === item.id
                    ? "grabbing"
                    : "grab"
                  : "default",
                userSelect: "none",
                opacity: dragging ? 0.85 : 1,
                boxShadow: dragging ? "0 4px 12px rgba(0,0,0,0.15)" : undefined,
                zIndex: dragging ? 2 : 1,
              }}
              onMouseDown={(e) => onPanelMouseDown(e, item)}
            >
              {children ? (
                children(item)
              ) : (
                <div style={{ width: "100%", height: "100%" }} />
              )}
              {resizable && (
                <div
                  role="button"
                  aria-label="Resize"
                  style={{
                    position: "absolute",
                    right: 0,
                    bottom: 0,
                    width: 12,
                    height: 12,
                    cursor: "nwse-resize",
                    background:
                      resizeHandle == null ? "rgba(0,0,0,0.2)" : undefined,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onMouseDown={(e) => onResizeHandleMouseDown(e, item)}
                >
                  {resizeHandle}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
