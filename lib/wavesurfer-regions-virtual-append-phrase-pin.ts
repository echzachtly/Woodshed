/**
 * WaveSurfer 7 Regions mounts each region via `virtualAppend`: it appends the region
 * element when a crude visibility test passes, otherwise calls `element.remove()`.
 *
 * That test maps start/end times to pixels using only `regionsContainer.clientWidth`,
 * but compares that to `wavesurfer.getScroll()` on the zoomed, scrollable waveform.
 * Once zoomed/panned, the check often fails for a wide phrase region, so the plugin
 * detaches the region DOM (including resize handles).
 *
 * Woodshed pins **only** the active practice phrase region while desktop phrase
 * waveform editing is unlocked (`phraseWaveformEditUnlockedById`), so handles stay
 * mounted. Segment regions keep stock virtualization.
 */

const ORIGINAL_KEY = "__woodshedOrigVirtualAppend" as const;
const PATCHED_KEY = "__woodshedVirtualAppendPatched" as const;
const WRAPPED_FN_KEY = "__woodshedPhrasePinWrappedFn" as const;
const PATCH_OWNER_KEY = "__woodshedPhrasePinPatchOwner" as const;
const DEBUG = process.env.NODE_ENV === "development";
const MODULE_INSTANCE_ID = `phrase-pin-${Math.random().toString(36).slice(2, 10)}`;

const objectRefIds = new WeakMap<object, number>();
let nextObjectRefId = 1;

function refId(value: unknown): number | null {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function")
  ) {
    return null;
  }
  const obj = value as object;
  const hit = objectRefIds.get(obj);
  if (typeof hit === "number") return hit;
  const id = nextObjectRefId++;
  objectRefIds.set(obj, id);
  return id;
}

type RegionsPluginInstance = {
  wavesurfer?: {
    on: (event: string, fn: () => void) => () => void;
    getWrapper?: () => HTMLElement;
  };
  subscriptions: Array<() => void>;
};

type SingleRegionLike = {
  id: string;
  element: HTMLElement | null;
  on: (event: string, fn: () => void) => () => void;
  once: (event: string, fn: () => void) => void;
};

export type ActivePhraseRegionPinState = {
  pinActive: boolean;
  pinnedLoopId: string | null;
};

let pinState: ActivePhraseRegionPinState = {
  pinActive: false,
  pinnedLoopId: null,
};

export function setActivePhraseRegionVirtualAppendPin(
  next: ActivePhraseRegionPinState,
): void {
  pinState = next;
  if (DEBUG) {
    console.log("[Woodshed phrase pin] set pin state", {
      moduleInstanceId: MODULE_INSTANCE_ID,
      pinActive: pinState.pinActive,
      pinnedLoopId: pinState.pinnedLoopId,
    });
  }
}

function shouldPinPhraseRegion(regionId: string): boolean {
  return (
    pinState.pinActive &&
    pinState.pinnedLoopId !== null &&
    regionId === pinState.pinnedLoopId
  );
}

type VirtualAppendFn = (
  this: RegionsPluginInstance,
  region: SingleRegionLike,
  container: HTMLElement,
  element: HTMLElement,
) => void;

function domAncestry(node: Node | null): Array<{
  tag: string;
  id: string;
  className: string;
  part: string | null;
  connected: boolean;
}> {
  const chain: Array<{
    tag: string;
    id: string;
    className: string;
    part: string | null;
    connected: boolean;
  }> = [];
  let cur: Node | null = node;
  for (let i = 0; i < 14 && cur; i++) {
    if (cur instanceof HTMLElement) {
      chain.push({
        tag: cur.tagName,
        id: cur.id,
        className: cur.className,
        part: cur.getAttribute("part"),
        connected: cur.isConnected,
      });
      cur = cur.parentNode;
      continue;
    }
    if (cur instanceof Document) {
      chain.push({
        tag: "#document",
        id: "",
        className: "",
        part: null,
        connected: true,
      });
    } else {
      chain.push({
        tag: cur.nodeName,
        id: "",
        className: "",
        part: null,
        connected: false,
      });
    }
    break;
  }
  return chain;
}

function getLiveRegionsContainer(ws: RegionsPluginInstance["wavesurfer"]): HTMLElement | null {
  if (!ws?.getWrapper) return null;
  const wrapper = ws.getWrapper();
  const hit = wrapper.querySelector('[part="regions-container"]');
  return hit instanceof HTMLElement ? hit : null;
}

function listDocumentRegionsContainers(doc: Document | null): Array<{
  refId: number | null;
  connected: boolean;
  inBody: boolean;
  parentTag: string | null;
  parentClass: string | null;
}> {
  if (!doc) return [];
  return Array.from(doc.querySelectorAll('[part="regions-container"]')).map((el) => ({
    refId: refId(el),
    connected: el.isConnected,
    inBody: Boolean(doc.body?.contains(el)),
    parentTag: el.parentElement?.tagName ?? null,
    parentClass: el.parentElement?.className ?? null,
  }));
}

export function logRegionElementMountProbe(args: {
  label: string;
  regionId: string;
  element: HTMLElement | null | undefined;
  ws?: { getWrapper?: () => HTMLElement } | null;
}): void {
  if (!DEBUG) return;
  const el = args.element ?? null;
  const doc = el?.ownerDocument ?? document;
  const parent = el?.parentElement ?? null;
  const liveContainer = getLiveRegionsContainer(
    (args.ws ?? null) as RegionsPluginInstance["wavesurfer"],
  );
  console.log("[Woodshed phrase pin] region mount probe", {
    moduleInstanceId: MODULE_INSTANCE_ID,
    label: args.label,
    regionId: args.regionId,
    elementRefId: refId(el),
    elementConnected: el?.isConnected ?? false,
    elementInDocument: Boolean(el && doc.body?.contains(el)),
    parentRefId: refId(parent),
    parentTag: parent?.tagName ?? null,
    parentClass: parent?.className ?? null,
    parentPart: parent?.getAttribute("part") ?? null,
    liveContainerRefId: refId(liveContainer),
    sameAsLiveContainer: Boolean(parent && liveContainer && parent === liveContainer),
    containersInDocument: listDocumentRegionsContainers(doc),
    elementAncestry: domAncestry(el),
    parentAncestry: domAncestry(parent),
  });
}

export function logRegionsPinProbe(regions: unknown, label: string): void {
  if (!DEBUG) return;
  const instance = regions as { virtualAppend?: unknown } | null;
  const proto =
    instance && typeof instance === "object"
      ? (Object.getPrototypeOf(instance) as { virtualAppend?: unknown } | null)
      : null;
  const instanceMethod = instance?.virtualAppend;
  const protoMethod = proto?.virtualAppend;
  const ws = (instance as { wavesurfer?: RegionsPluginInstance["wavesurfer"] } | null)
    ?.wavesurfer;
  const liveContainer = getLiveRegionsContainer(ws);
  const doc = liveContainer?.ownerDocument ?? document;
  console.log("[Woodshed phrase pin] probe", {
    moduleInstanceId: MODULE_INSTANCE_ID,
    label,
    instanceRefId: refId(instance),
    protoRefId: refId(proto),
    instanceMethodRefId: refId(instanceMethod),
    protoMethodRefId: refId(protoMethod),
    instanceMethodIsFunction: typeof instanceMethod === "function",
    protoMethodIsFunction: typeof protoMethod === "function",
    methodMarkedWrapped: Boolean(
      protoMethod &&
        typeof protoMethod === "function" &&
        (protoMethod as unknown as Record<string, unknown>)[WRAPPED_FN_KEY],
    ),
    patchOwner:
      proto && typeof proto === "object"
        ? (proto as Record<string, unknown>)[PATCH_OWNER_KEY]
        : null,
    patchInstalled:
      proto && typeof proto === "object"
        ? Boolean((proto as Record<string, unknown>)[PATCHED_KEY])
        : false,
    liveContainerRefId: refId(liveContainer),
    liveContainerConnected: liveContainer?.isConnected ?? false,
    liveContainerInBody: Boolean(liveContainer && doc.body?.contains(liveContainer)),
    liveContainerAncestry: domAncestry(liveContainer),
    containersInDocument: listDocumentRegionsContainers(doc),
  });
}

export function installRegionsVirtualAppendPhrasePin(
  RegionsPlugin: { prototype: { virtualAppend: VirtualAppendFn } },
): void {
  const proto = RegionsPlugin.prototype as unknown as Record<string, unknown>;
  const currentVirtualAppend = proto.virtualAppend as VirtualAppendFn | undefined;
  if (DEBUG) {
    console.log("[Woodshed phrase pin] install requested", {
      moduleInstanceId: MODULE_INSTANCE_ID,
      protoRefId: refId(proto),
      currentVirtualAppendRefId: refId(currentVirtualAppend),
      alreadyPatched: Boolean(proto[PATCHED_KEY]),
      patchOwner: proto[PATCH_OWNER_KEY] ?? null,
      hasOriginalStored: typeof proto[ORIGINAL_KEY] === "function",
      hasVirtualAppend: typeof currentVirtualAppend === "function",
      currentIsWrapped: Boolean(
        currentVirtualAppend &&
          typeof currentVirtualAppend === "function" &&
          (currentVirtualAppend as unknown as Record<string, unknown>)[WRAPPED_FN_KEY],
      ),
    });
  }
  if (typeof currentVirtualAppend !== "function") {
    if (DEBUG) {
      console.warn("[Woodshed phrase pin] install aborted: no virtualAppend fn");
    }
    return;
  }
  if (!proto[ORIGINAL_KEY]) {
    proto[ORIGINAL_KEY] = currentVirtualAppend;
  }
  if (proto[PATCHED_KEY] && proto[PATCH_OWNER_KEY] === MODULE_INSTANCE_ID) {
    if (DEBUG) {
      console.log("[Woodshed phrase pin] already installed on this module instance");
    }
    return;
  }

  const original = proto[ORIGINAL_KEY] as VirtualAppendFn;
  const wrappedVirtualAppend: VirtualAppendFn = function (
    this: RegionsPluginInstance,
    region: SingleRegionLike,
    container: HTMLElement,
    element: HTMLElement,
  ) {
    const shouldPin = shouldPinPhraseRegion(region.id);
    const liveContainer = getLiveRegionsContainer(this.wavesurfer);
    const containerDoc = container.ownerDocument ?? null;
    if (DEBUG && (pinState.pinActive || region.id === pinState.pinnedLoopId)) {
      console.log("[Woodshed phrase pin] virtualAppend call", {
        moduleInstanceId: MODULE_INSTANCE_ID,
        regionId: region.id,
        pinnedLoopId: pinState.pinnedLoopId,
        pinActive: pinState.pinActive,
        shouldPin,
        containerRefId: refId(container),
        containerTag: container.tagName,
        containerClass: container.className,
        containerConnected: container.isConnected,
        containerInBody: Boolean(containerDoc?.body?.contains(container)),
        containerAncestry: domAncestry(container),
        liveContainerRefId: refId(liveContainer),
        liveContainerConnected: liveContainer?.isConnected ?? false,
        liveContainerInBody: Boolean(
          liveContainer && liveContainer.ownerDocument?.body?.contains(liveContainer),
        ),
        liveContainerAncestry: domAncestry(liveContainer),
        sameContainerAsLive: Boolean(liveContainer && liveContainer === container),
        containersInDocument: listDocumentRegionsContainers(containerDoc),
        elementConnectedBefore: element.isConnected,
        elementAncestryBefore: domAncestry(element),
      });
    }
    if (shouldPin) {
      const ensureMounted = () => {
        if (!region.element) return;
        const live = getLiveRegionsContainer(this.wavesurfer);
        const targetContainer = live && live.isConnected ? live : container;
        const parent = element.parentElement;
        const appendNeeded =
          !parent || parent !== targetContainer || !parent.isConnected;
        if (appendNeeded) {
          if (DEBUG) {
            console.log("[Woodshed phrase pin] appendChild attempt", {
              moduleInstanceId: MODULE_INSTANCE_ID,
              regionId: region.id,
              hadParent: Boolean(parent),
              parentTag: parent?.tagName ?? null,
              parentClass: parent?.className ?? null,
              parentConnected: parent?.isConnected ?? false,
              containerRefId: refId(container),
              containerTag: container.tagName,
              containerClass: container.className,
              containerConnected: container.isConnected,
              targetContainerRefId: refId(targetContainer),
              targetContainerTag: targetContainer.tagName,
              targetContainerClass: targetContainer.className,
              targetContainerConnected: targetContainer.isConnected,
              targetContainerInBody: Boolean(
                targetContainer.ownerDocument?.body?.contains(targetContainer),
              ),
              sameAsLiveContainer: Boolean(live && targetContainer === live),
              targetContainerAncestry: domAncestry(targetContainer),
            });
          }
          targetContainer.appendChild(element);
          if (DEBUG) {
            const doc = element.ownerDocument;
            console.log("[Woodshed phrase pin] appendChild result", {
              moduleInstanceId: MODULE_INSTANCE_ID,
              regionId: region.id,
              elementIsConnected: element.isConnected,
              inDocument: Boolean(doc?.body?.contains(element)),
              parentRefId: refId(element.parentElement),
              parentTag: element.parentElement?.tagName ?? null,
              parentClass: element.parentElement?.className ?? null,
              parentAncestry: domAncestry(element.parentElement),
              elementAncestry: domAncestry(element),
              containersInDocument: listDocumentRegionsContainers(doc ?? null),
            });
          }
        }
      };

      globalThis.setTimeout(() => {
        if (!this.wavesurfer || !region.element) return;
        if (DEBUG) {
          console.log("[Woodshed phrase pin] pinned branch entered", {
            regionId: region.id,
          });
        }
        ensureMounted();
        const ws = this.wavesurfer;
        const offScroll = ws.on("scroll", ensureMounted);
        const offZoom = ws.on("zoom", ensureMounted);
        const offResize = ws.on("resize", ensureMounted);
        const offRender = region.on("render", ensureMounted);
        this.subscriptions.push(offScroll, offZoom, offResize, offRender);
        if (DEBUG) {
          globalThis.setTimeout(() => {
            if (!region.element) return;
            const doc = region.element.ownerDocument;
            console.log("[Woodshed phrase pin] post-mount check", {
              regionId: region.id,
              elementIsConnected: region.element.isConnected,
              inDocument: Boolean(doc?.body?.contains(region.element)),
              parentTag: region.element.parentElement?.tagName ?? null,
              parentClass: region.element.parentElement?.className ?? null,
            });
          }, 0);
        }
        let observer: MutationObserver | null = null;
        if (DEBUG && typeof MutationObserver !== "undefined") {
          observer = new MutationObserver((records) => {
            for (const record of records) {
              for (const removed of Array.from(record.removedNodes)) {
                if (removed === element) {
                  console.warn("[Woodshed phrase pin] pinned element removed", {
                    moduleInstanceId: MODULE_INSTANCE_ID,
                    regionId: region.id,
                    containerRefId: refId(container),
                    containerTag: container.tagName,
                    containerClass: container.className,
                    elementConnected: element.isConnected,
                    elementInBody: Boolean(
                      element.ownerDocument?.body?.contains(element),
                    ),
                    elementAncestry: domAncestry(element),
                    containersInDocument: listDocumentRegionsContainers(
                      element.ownerDocument ?? null,
                    ),
                  });
                }
              }
            }
          });
          observer.observe(container, { childList: true });
        }
        const elementWithDebug = element as HTMLElement & {
          __woodshedOriginalRemove?: () => void;
          __woodshedRemovePatched?: true;
        };
        if (DEBUG && !elementWithDebug.__woodshedRemovePatched) {
          const originalRemove = element.remove.bind(element);
          elementWithDebug.__woodshedOriginalRemove = originalRemove;
          elementWithDebug.__woodshedRemovePatched = true;
          element.remove = () => {
            console.warn("[Woodshed phrase pin] element.remove() called", {
              moduleInstanceId: MODULE_INSTANCE_ID,
              regionId: region.id,
              elementConnectedBefore: element.isConnected,
              elementInBodyBefore: Boolean(
                element.ownerDocument?.body?.contains(element),
              ),
              parentTag: element.parentElement?.tagName ?? null,
              parentClass: element.parentElement?.className ?? null,
              parentAncestry: domAncestry(element.parentElement),
            });
            originalRemove();
          };
        }
        region.once("remove", () => {
          offScroll();
          offZoom();
          offResize();
          offRender();
          observer?.disconnect();
        });
      }, 0);
      return;
    }

    if (DEBUG && (pinState.pinActive || region.id === pinState.pinnedLoopId)) {
      console.log("[Woodshed phrase pin] stock virtualAppend path", {
        regionId: region.id,
      });
    }
    original.call(this, region, container, element);
  };
  (wrappedVirtualAppend as unknown as Record<string, unknown>)[WRAPPED_FN_KEY] = true;
  proto.virtualAppend = wrappedVirtualAppend;
  proto[PATCHED_KEY] = true;
  proto[PATCH_OWNER_KEY] = MODULE_INSTANCE_ID;
  if (DEBUG) {
    console.log("[Woodshed phrase pin] virtualAppend wrapper installed", {
      moduleInstanceId: MODULE_INSTANCE_ID,
      protoRefId: refId(proto),
      originalRefId: refId(original),
      wrappedRefId: refId(wrappedVirtualAppend),
    });
  }
}
