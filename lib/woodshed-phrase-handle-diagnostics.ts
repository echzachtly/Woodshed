const TAG = "[Woodshed phrase handle diag]";
const FORCE_KEY = "woodshedPhraseHandleDiag";

type RegionLike = {
  element?: HTMLElement | null;
  on: (
    event: string,
    cb: (...args: unknown[]) => void,
  ) => void | (() => void);
};

type RegionsPluginLike = {
  regionsContainer?: HTMLElement | null;
};

type WsLike = {
  getWrapper: () => HTMLElement;
  getRenderer: () => unknown;
};

function handleByPart(
  root: HTMLElement | null,
  side: "left" | "right",
): HTMLElement | null {
  if (!root) return null;
  const sel =
    side === "left"
      ? '[part*="region-handle-left"]'
      : '[part*="region-handle-right"]';
  const hit = root.querySelector(sel);
  return hit instanceof HTMLElement ? hit : null;
}

function describeHit(hit: Element | null) {
  if (!hit) return null;
  return {
    tag: hit.tagName,
    className:
      hit instanceof HTMLElement && typeof hit.className === "string"
        ? hit.className
        : "",
    part: hit.getAttribute("part"),
  };
}

function computeCenter(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function nodeRootInfo(node: Node | null) {
  if (!node) return { kind: "null", isShadow: false, hostTag: null };
  const root = node.getRootNode();
  if (root instanceof ShadowRoot) {
    return {
      kind: "shadowRoot",
      isShadow: true,
      hostTag: root.host?.tagName ?? null,
    };
  }
  if (root instanceof Document) {
    return { kind: "document", isShadow: false, hostTag: null };
  }
  return { kind: root.nodeName, isShadow: false, hostTag: null };
}

function summarizePath(path: EventTarget[]): Array<{
  tag: string;
  part: string | null;
  className: string;
}> {
  return path
    .filter((x): x is Element => x instanceof Element)
    .slice(0, 8)
    .map((el) => ({
      tag: el.tagName,
      part: el.getAttribute("part"),
      className:
        el instanceof HTMLElement && typeof el.className === "string"
          ? el.className
          : "",
    }));
}

function getRendererScrollContainer(ws: WsLike | null): HTMLElement | null {
  if (!ws) return null;
  const r = ws.getRenderer() as { scrollContainer?: HTMLElement | null };
  return r?.scrollContainer ?? null;
}

function descendantOf(
  node: Element | null,
  parent: Element | null,
): boolean {
  if (!node || !parent) return false;
  return node === parent || parent.contains(node);
}

function styleSnapshot(el: HTMLElement | null) {
  if (!el) return null;
  const cs = window.getComputedStyle(el);
  return {
    pointerEvents: cs.pointerEvents,
    cursor: cs.cursor,
    zIndex: cs.zIndex,
  };
}

export function phraseHandleDiagnosticsEnabled(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FORCE_KEY) === "1";
  } catch {
    return false;
  }
}

export function schedulePhraseHandleDiagnostics(args: {
  regionId: string;
  region: RegionLike;
  ws: WsLike;
  regionsPlugin: RegionsPluginLike;
  host: HTMLElement | null;
}): () => void {
  if (!phraseHandleDiagnosticsEnabled()) {
    return () => undefined;
  }

  let cancelled = false;
  let rafA = 0;
  let rafB = 0;
  const cleanup: Array<() => void> = [];

  const inspect = () => {
    if (cancelled) return;
    const root = args.region.element ?? null;
    const left = handleByPart(root, "left");
    const right = handleByPart(root, "right");
    const doc =
      args.host?.ownerDocument ?? root?.ownerDocument ?? document;
    const host = args.host;
    const shadow = host?.shadowRoot ?? null;
    const wrapper = args.ws.getWrapper();
    const scrollContainer = getRendererScrollContainer(args.ws);
    const regionsContainer = args.regionsPlugin.regionsContainer ?? null;
    const shadowHandles = shadow
      ? Array.from(shadow.querySelectorAll('[part*="region-handle"]'))
      : [];
    const shadowRegions = shadow
      ? Array.from(shadow.querySelectorAll('[part="regions-container"]'))
      : [];

    const leftCenter = left ? computeCenter(left) : null;
    const rightCenter = right ? computeCenter(right) : null;
    const leftHit = leftCenter
      ? doc.elementFromPoint(leftCenter.x, leftCenter.y)
      : null;
    const rightHit = rightCenter
      ? doc.elementFromPoint(rightCenter.x, rightCenter.y)
      : null;

    const rootStyle = styleSnapshot(root);
    const leftStyle = styleSnapshot(left);
    const rightStyle = styleSnapshot(right);

    const checks = {
      regionConnected: Boolean(root?.isConnected),
      regionInHostShadow: Boolean(shadow && root && shadow.contains(root)),
      leftHandleLive: Boolean(left && left.isConnected),
      rightHandleLive: Boolean(right && right.isConnected),
      leftHandleInShadow: Boolean(shadow && left && shadow.contains(left)),
      rightHandleInShadow: Boolean(shadow && right && shadow.contains(right)),
      leftPointerAuto: leftStyle?.pointerEvents === "auto",
      rightPointerAuto: rightStyle?.pointerEvents === "auto",
      leftCursorResize: Boolean(
        leftStyle?.cursor &&
          (leftStyle.cursor.includes("resize") || leftStyle.cursor === "ew-resize"),
      ),
      rightCursorResize: Boolean(
        rightStyle?.cursor &&
          (rightStyle.cursor.includes("resize") || rightStyle.cursor === "ew-resize"),
      ),
      leftHitHandle:
        Boolean(leftHit && left && (leftHit === left || left.contains(leftHit))),
      rightHitHandle: Boolean(
        rightHit && right && (rightHit === right || right.contains(rightHit)),
      ),
      wrapperContainsRegions: Boolean(
        wrapper && regionsContainer && wrapper.contains(regionsContainer),
      ),
    };

    console.groupCollapsed(`${TAG} region=${args.regionId}`);
    console.log("0 host/shadow", {
      hostExists: Boolean(host),
      hostConnected: host?.isConnected ?? false,
      hostShadowRootExists: Boolean(shadow),
      hostShadowMode: shadow?.mode ?? null,
      hostRoot: nodeRootInfo(host),
    });
    console.log("1 internal nodes", {
      wrapperConnected: wrapper?.isConnected ?? false,
      wrapperRoot: nodeRootInfo(wrapper),
      scrollContainerConnected: scrollContainer?.isConnected ?? false,
      scrollContainerRoot: nodeRootInfo(scrollContainer),
      regionsContainerConnected: regionsContainer?.isConnected ?? false,
      regionsContainerRoot: nodeRootInfo(regionsContainer),
      wrapperContainsRegions: checks.wrapperContainsRegions,
      regionsContainersInShadow: shadowRegions.length,
      handlesInShadow: shadowHandles.length,
    });
    console.log("1 region exists/connected", {
      exists: Boolean(root),
      isConnected: root?.isConnected ?? false,
      rootNode: nodeRootInfo(root),
      inHostShadow: checks.regionInHostShadow,
      regionParentPart: root?.parentElement?.getAttribute("part") ?? null,
    });
    console.log("2 left/right handles exist", {
      leftExists: Boolean(left),
      rightExists: Boolean(right),
      leftInShadow: checks.leftHandleInShadow,
      rightInShadow: checks.rightHandleInShadow,
      leftQueryableInShadow: Boolean(left && shadowHandles.includes(left)),
      rightQueryableInShadow: Boolean(right && shadowHandles.includes(right)),
    });
    console.log("3 handle identity", {
      left:
        left && {
          outerHTML: left.outerHTML,
          tag: left.tagName,
          className: left.className,
          part: left.getAttribute("part"),
        },
      right:
        right && {
          outerHTML: right.outerHTML,
          tag: right.tagName,
          className: right.className,
          part: right.getAttribute("part"),
        },
    });
    console.log("4 computed pointer-events/cursor/z-index", {
      phraseRoot: rootStyle,
      leftHandle: leftStyle,
      rightHandle: rightStyle,
    });
    console.log("6/7 elementFromPoint @ handle centers", {
      leftCenter,
      leftHit: describeHit(leftHit),
      leftHitIsHandle: checks.leftHitHandle,
      leftHitInWrapper: descendantOf(leftHit, wrapper),
      leftHitInRegionsContainer: descendantOf(leftHit, regionsContainer),
      rightCenter,
      rightHit: describeHit(rightHit),
      rightHitIsHandle: checks.rightHitHandle,
      rightHitInWrapper: descendantOf(rightHit, wrapper),
      rightHitInRegionsContainer: descendantOf(rightHit, regionsContainer),
    });
    console.log("runtime checks", checks);
    if (!Object.values(checks).every(Boolean)) {
      console.warn(`${TAG} failing conditions`, checks);
    } else {
      console.info(`${TAG} all checks passing`);
    }
    console.groupEnd();

    const logPointer = (label: string) => (event: PointerEvent) => {
      const path = event.composedPath();
      console.log(label, {
        target: describeHit(event.target as Element | null),
        currentTarget: describeHit(event.currentTarget as Element | null),
        composedPath: summarizePath(path),
        reachesLeftHandle: Boolean(left && path.includes(left)),
        reachesRightHandle: Boolean(right && path.includes(right)),
        reachesRegionRoot: Boolean(root && path.includes(root)),
        reachesRegionsContainer: Boolean(
          regionsContainer && path.includes(regionsContainer),
        ),
        reachesWrapper: Boolean(wrapper && path.includes(wrapper)),
      });
    };

    if (left) {
      const onLeftDown = (event: PointerEvent) => {
        console.log("phrase left handle pointerdown", {
          x: event.clientX,
          y: event.clientY,
          pointerId: event.pointerId,
        });
        logPointer("pointerdown detail:left-handle")(event);
      };
      left.addEventListener("pointerdown", onLeftDown, { capture: true });
      cleanup.push(() =>
        left.removeEventListener("pointerdown", onLeftDown, { capture: true }),
      );
    }
    if (right) {
      const onRightDown = (event: PointerEvent) => {
        console.log("phrase right handle pointerdown", {
          x: event.clientX,
          y: event.clientY,
          pointerId: event.pointerId,
        });
        logPointer("pointerdown detail:right-handle")(event);
      };
      right.addEventListener("pointerdown", onRightDown, { capture: true });
      cleanup.push(() =>
        right.removeEventListener("pointerdown", onRightDown, { capture: true }),
      );
    }
    if (root) {
      const onRootDown = logPointer("pointerdown detail:phrase-root");
      root.addEventListener("pointerdown", onRootDown, { capture: true });
      cleanup.push(() =>
        root.removeEventListener("pointerdown", onRootDown, { capture: true }),
      );
    }
    if (regionsContainer) {
      const onRegionsDown = logPointer("pointerdown detail:regions-container");
      regionsContainer.addEventListener("pointerdown", onRegionsDown, {
        capture: true,
      });
      cleanup.push(() =>
        regionsContainer.removeEventListener("pointerdown", onRegionsDown, {
          capture: true,
        }),
      );
    }
    if (wrapper) {
      const onWrapperDown = logPointer("pointerdown detail:wrapper");
      wrapper.addEventListener("pointerdown", onWrapperDown, { capture: true });
      cleanup.push(() =>
        wrapper.removeEventListener("pointerdown", onWrapperDown, {
          capture: true,
        }),
      );
    }

    if (shadow && left && right) {
      const selector = '.woodshed-region-editing [part*="region-handle"]';
      const shadowMatches = Array.from(shadow.querySelectorAll(selector));
      console.log("6 CSS selector verification (shadow-aware)", {
        selector,
        shadowMatches: shadowMatches.length,
        includesLeft: shadowMatches.includes(left),
        includesRight: shadowMatches.includes(right),
        note:
          "Rules in app/globals.css do not pierce shadow descendants; use ::part or shadow style injection if custom styling is required.",
      });
    } else {
      console.log("6 CSS selector verification (shadow-aware)", {
        note: "Missing shadow root or handles.",
      });
    }

    const offUpdate = args.region.on("update", (...evt: unknown[]) => {
      console.log(`${TAG} update`, ...evt);
    });
    if (typeof offUpdate === "function") cleanup.push(offUpdate);
    const offUpdateEnd = args.region.on("update-end", (...evt: unknown[]) => {
      console.log(`${TAG} update-end`, ...evt);
    });
    if (typeof offUpdateEnd === "function") cleanup.push(offUpdateEnd);
  };

  rafA = requestAnimationFrame(() => {
    rafB = requestAnimationFrame(inspect);
  });

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafA);
    cancelAnimationFrame(rafB);
    for (const fn of cleanup) {
      try {
        fn();
      } catch {
        /* noop */
      }
    }
  };
}
