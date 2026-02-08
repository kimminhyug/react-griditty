import { useEffect, useState } from "react";
import type { LayoutState, LayoutStore } from "@dashboardity/layout-store";

/**
 * store를 구독하고 상태 변경 시 리렌더링한다.
 * store 참조가 바뀌면(breakpoint 전환 등) useEffect에서 새 store 상태로 동기화.
 * (getState()가 매번 새 객체를 반환하므로 useSyncExternalStore는 무한 리렌더 유발)
 */
export const useLayoutState = (store: LayoutStore): LayoutState => {
  const [state, setState] = useState<LayoutState>(() => store.getState());

  useEffect(() => {
    setState(store.getState());
    const unsubscribe = store.subscribe(() => setState(store.getState()));
    return unsubscribe;
  }, [store]);

  return state;
};
