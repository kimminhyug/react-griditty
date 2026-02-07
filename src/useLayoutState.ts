import { useEffect, useState } from "react";
import type { LayoutState, LayoutStore } from "@dashboardity/layout-store";

/**
 * store를 구독하고 상태 변경 시 리렌더링한다.
 */
export const useLayoutState = (store: LayoutStore): LayoutState => {
  const [state, setState] = useState<LayoutState>(() => store.getState());

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setState(store.getState()));
    return unsubscribe;
  }, [store]);

  return state;
};
