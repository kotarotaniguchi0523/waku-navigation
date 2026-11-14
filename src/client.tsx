/// <reference types="dom-navigation" />
/// <reference types="vite/client" />

'use client';

import {
  createContext,
  startTransition,
  use,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from 'react';
import type { AnchorHTMLAttributes, ReactNode, Ref } from 'react';
import { preloadModule } from 'react-dom';
import {
  Root_UNSTABLE as Root,
  Slot_UNSTABLE as Slot,
  unstable_combineElements as combineElements,
  unstable_isBuildIdMismatch as isBuildIdMismatch,
  useElementsPromise_UNSTABLE as useElementsPromise,
  useMergeElements_UNSTABLE as useMergeElements,
  useRegisterRscReloadListener_UNSTABLE as useRegisterRscReloadListener,
} from 'waku/minimal/client';
import type { LinkProps as WakuLinkProps } from 'waku/router/client';
import {
  RouterHostContext_UNSTABLE as RouterHostContext,
  Slice_UNSTABLE as Slice,
  unstable_INTENT_ID as INTENT_ID,
  unstable_MAX_FOLLOWS_PER_NAVIGATION as MAX_FOLLOWS_PER_NAVIGATION,
  unstable_ROUTE_ID as ROUTE_ID,
  unstable_buildMergePatch as buildMergePatch,
  unstable_createServerFunctionRouting as createServerFunctionRouting,
  unstable_decideRouteIntent as decideRouteIntent,
  unstable_encodeRoutePath as encodeRoutePath,
  unstable_getRouteFromElements as getRouteFromElements,
  unstable_getRouteSlotId as getRouteSlotId,
  unstable_getRouteUrl as getRouteUrl,
  unstable_has404FromElements as has404FromElements,
  unstable_isSameRoute as isSameRoute,
  unstable_isStaticFromElements as isStaticFromElements,
  unstable_parseRoute as parseRoute,
  useHmrRefetch_UNSTABLE as useHmrRefetch,
  useInitialRoute_UNSTABLE as useInitialRoute,
  useInitialRscParams_UNSTABLE as useInitialRscParams,
  useParams_UNSTABLE,
  useRouterCache_UNSTABLE as useRouterCache,
  useSearch_UNSTABLE,
  useServerFunctionRouting_UNSTABLE as useServerFunctionRouting,
  useSetSearch_UNSTABLE,
} from 'waku/router/client-core';
import type {
  Unstable_Loaded as Loaded,
  Unstable_RouteIntentData as RouteIntentData,
  Unstable_RouterHost as RouterHost,
} from 'waku/router/client-core';

export { Slice, useParams_UNSTABLE, useSearch_UNSTABLE, useSetSearch_UNSTABLE };

type Route = { path: string; query: string; hash: string };
type NavigationHref = WakuLinkProps['to'];

const getBase = () =>
  (import.meta.env?.WAKU_CONFIG_BASE_PATH as string | undefined) || '/';

// A protocol-relative href ('//host/path') names another origin, not a path.
const addBase = (href: string) => {
  const base = getBase();
  return base !== '/' && href.startsWith('/') && !href.startsWith('//')
    ? base.slice(0, -1) + href
    : href;
};

// Undefined for another origin or a path outside the base path.
const toRoute = (url: URL): Route | undefined =>
  url.origin === window.location.origin && url.pathname.startsWith(getBase())
    ? parseRoute(url)
    : undefined;

const NOT_FOUND_PATH = '/404';

type NavigationStatus = { pending?: boolean };

type NavStatusEntry = {
  getElement: () => HTMLAnchorElement | null;
  href: string;
  scroll: boolean | undefined;
  setOptimisticStatus: (status: NavigationStatus) => void;
};
type RegisterFn = (id: string, entry: NavStatusEntry) => () => void;

// Defaults apply during SSR, where waku's INTERNAL_ServerRouter provides only
// the RouterHost.
const RouterContext = createContext<{
  register: RegisterFn;
  prefetchRoute: (route: Route | undefined) => void;
}>({
  register: () => () => {},
  prefetchRoute: () => {},
});

const NavigationStatusContext = createContext<NavigationStatus>({});

/**
 * Navigation status of the enclosing {@link Link}, like React's
 * `useFormStatus`. `pending` is `true` while the link's navigation is in
 * flight, until the destination route's async components resolve. Returns `{}`
 * outside a `<Link>`.
 */
export const useNavigationStatus_UNSTABLE = (): NavigationStatus =>
  useContext(NavigationStatusContext);

/** Typed destinations, prefetch triggers, and native anchor attributes. */
export type LinkProps = {
  /**
   * Destination, type-checked against generated routes. Construct parameterized
   * hrefs with `unstable_createRouteHref` from `waku/router`.
   */
  to: NavigationHref;
  children: ReactNode;
  /**
   * Whether to scroll on navigation. `false` keeps the current scroll
   * position; otherwise the browser's default after-navigation scroll applies.
   */
  scroll?: boolean;
  /** Prefetch the route when the pointer enters the link. */
  unstable_prefetchOnEnter?: boolean;
  /** Prefetch the route when the link scrolls into view. */
  unstable_prefetchOnView?: boolean;
  ref?: Ref<HTMLAnchorElement> | undefined;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>;

/**
 * A type-safe, prefetching, status-aware link. A plain `<a>` already navigates
 * client-side, so `<Link>` is an enhancement: it adds a type-checked `to`,
 * prefetching, and per-link navigation status (read by descendants via
 * {@link useNavigationStatus_UNSTABLE}).
 */
export function Link({
  to,
  children,
  scroll,
  unstable_prefetchOnEnter,
  unstable_prefetchOnView,
  ref: refProp,
  ...props
}: LinkProps) {
  const resolvedTo = addBase(to);
  const { register, prefetchRoute } = useContext(RouterContext);
  const [status, setOptimisticStatus] = useOptimistic<NavigationStatus>({});
  const elementRef = useRef<HTMLAnchorElement | null>(null);
  const setRef = useCallback(
    (node: HTMLAnchorElement | null) => {
      elementRef.current = node;
      if (typeof refProp === 'function') refProp(node);
      else if (refProp)
        (refProp as { current: HTMLAnchorElement | null }).current = node;
    },
    [refProp],
  );
  const id = useId();
  useLayoutEffect(
    () =>
      register(id, {
        getElement: () => elementRef.current,
        href: resolvedTo,
        scroll,
        setOptimisticStatus,
      }),
    [id, resolvedTo, scroll, register, setOptimisticStatus],
  );
  useEffect(() => {
    if (!unstable_prefetchOnView || !elementRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const url = new URL(resolvedTo, window.location.href);
          if (url.href !== window.location.href) {
            prefetchRoute(toRoute(url));
          }
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [unstable_prefetchOnView, resolvedTo, prefetchRoute]);
  const onMouseEnter: AnchorHTMLAttributes<HTMLAnchorElement>['onMouseEnter'] =
    unstable_prefetchOnEnter
      ? (event) => {
          const url = new URL(resolvedTo, window.location.href);
          if (url.href !== window.location.href) {
            prefetchRoute(toRoute(url));
          }
          props.onMouseEnter?.(event);
        }
      : props.onMouseEnter;
  // No onClick: the browser fires the navigate event for the plain <a>, and
  // InnerRouter's handler correlates it back to this instance.
  return (
    <NavigationStatusContext.Provider value={status}>
      <a {...props} href={resolvedTo} ref={setRef} onMouseEnter={onMouseEnter}>
        {children}
      </a>
    </NavigationStatusContext.Provider>
  );
}

type NavigateOptions = { scroll?: boolean };
/**
 * Imperative router handle: the current `path` / `query` / `hash`, plus
 * `push` / `replace` / `reload` / `back` / `forward` / `prefetch`. Same shape
 * as `waku/router/client`'s `useRouter`.
 */
export function useRouter() {
  const host = useContext(RouterHostContext);
  const { prefetchRoute } = useContext(RouterContext);
  const route: Route = host?.route ?? { path: '/', query: '', hash: '' };
  return {
    path: route.path,
    query: route.query,
    hash: route.hash,
    push: (to: NavigationHref, options?: NavigateOptions) =>
      navigate(addBase(to), 'push', { scroll: options?.scroll }),
    replace: (to: NavigationHref, options?: NavigateOptions) =>
      navigate(addBase(to), 'replace', { scroll: options?.scroll }),
    reload: () => navigate(window.location.href, 'reload', {}),
    back: () => {
      window.navigation.back();
    },
    forward: () => {
      window.navigation.forward();
    },
    prefetch: (to: NavigationHref) => {
      prefetchRoute(toRoute(new URL(addBase(to), window.location.href)));
    },
  };
}

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

// The promise to observe for a navigation's outcome. `committed` rejects with
// the same error as `finished`, so it is only marked as handled.
const finishedOf = (result: NavigationResult): Promise<unknown> => {
  result.committed?.catch(() => {});
  return result.finished!;
};

const DOCUMENT_LOAD = 'waku-document-load';

// Resolves once the URL has committed and the response is applied, not on
// `finished`: that follows the DOM commit, which React holds while an action
// is pending, so an action awaiting it would wait on itself.
const navigate = (
  href: string,
  history: 'push' | 'replace' | 'reload',
  info: NavigateInfo,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const applied = () => resolve();
    const options = { info: { ...info, applied } satisfies NavigateInfo };
    const result =
      history === 'reload'
        ? window.navigation.reload(options)
        : window.navigation.navigate(href, { history, ...options });
    finishedOf(result).then(applied, (error: unknown) =>
      isAbortError(error) ? resolve() : reject(error),
    );
  });

// Follows a redirect found after its entry committed, keeping its state.
const replaceEntry = (href: string, info: NavigateInfo) => {
  finishedOf(
    window.navigation.navigate(href, {
      history: 'replace',
      state: window.navigation.currentEntry?.getState(),
      info,
    }),
  ).catch(() => {});
};

const navigateHost: RouterHost['navigate'] = (href, { history, scroll }) =>
  navigate(href, history, { scroll });

type Elements = Readonly<Record<string | symbol, unknown>>;

// Metadata this router attaches to the navigations it starts.
type NavigateInfo = {
  scroll?: boolean | undefined;
  // Position in a redirect / custom-404 follow chain.
  follows?: number;
  // The route to load when it differs from the destination URL (a custom 404).
  target?: Route;
  // A response to apply instead of fetching.
  adopt?: Promise<Elements>;
  // Called once the URL has committed and the response is applied.
  applied?: () => void;
};

// An in-flight navigation. `commit` lets its intercept handler finish.
type Pending = { route: Route; commit: () => void };

// The committed navigation. `gen` is the navigation generation its elements
// came from, `follows` its follow count, and `pending` the in-flight
// navigation it settles.
type Committed = {
  route: Route;
  gen: number;
  follows: number;
  pending?: Pending;
};

type IntentOutcome = { value: string | undefined } | { error: unknown };
type IntentScope = { gen: number; follows: number };

const observeIntent = (
  pending: PromiseLike<string | undefined>,
  listener: (outcome: IntentOutcome) => void,
) => {
  let active = true;
  Promise.resolve(pending).then(
    (value) => active && listener({ value }),
    (error: unknown) => active && listener({ error }),
  );
  return () => {
    active = false;
  };
};

// ROUTE_ID names the route the server rendered: '/404' for a missing route, or
// the target of a redirect it resolved. Mirrors waku's history binding.
const getLanded = ({
  route,
  url,
  elements,
}: Loaded): { route: Route; url: URL } => {
  const served = getRouteFromElements(elements);
  if (
    served &&
    served.path !== NOT_FOUND_PATH &&
    (served.path !== route.path ||
      (!isStaticFromElements(elements) && served.query !== route.query))
  ) {
    return { route: served, url: getRouteUrl(served) };
  }
  return {
    route: {
      path: served?.path ?? route.path,
      query: route.query,
      hash: url.hash,
    },
    url,
  };
};

// Same origin + path + query (not pathname; fragment ignored). Malformed input
// returns false rather than throwing.
const routeMatchesHref = (href: string, route: Route): boolean => {
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }
  const parsed = toRoute(url);
  return parsed?.path === route.path && parsed.query === route.query;
};

// Routes server function responses: an origin rerender, another route, or a
// redirect. Created before React renders because Root keys its initial payload
// by the enhancer array, which must survive StrictMode's double render.
const serverFunctionRouting = createServerFunctionRouting();
const rscEnhancers = [serverFunctionRouting.enhancer];

function InnerRouter({ fallbackRoute }: { fallbackRoute: Route }) {
  const elements = use(useElementsPromise());
  const mergeElements = useMergeElements();
  const registerRscReloadListener = useRegisterRscReloadListener();
  const cache = useRouterCache();
  // Resolves an unknown URL the server answered with the /404 page to '/404',
  // and restores the hash (SSR sends no fragment) after hydration.
  const initialRoute = useInitialRoute(fallbackRoute);
  const [nav, setNav] = useState<Committed>();
  const committed: Committed = nav ?? {
    route: initialRoute,
    gen: 0,
    follows: 0,
  };
  const route = committed.route;
  // Rethrow during render so the user's <ErrorBoundary> catches failures;
  // cleared by the next successful navigation.
  const [renderError, setRenderError] = useState<unknown>(null);
  if (renderError) throw renderError;
  const elementsRef = useRef(elements);
  const committedRef = useRef(committed);
  useLayoutEffect(() => {
    elementsRef.current = elements;
    committedRef.current = committed;
  });
  const mountedRef = useRef(false);
  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // Bumped by every navigation this router handles. A late route intent acts
  // only while the navigation it arrived with is still the latest one.
  const generationRef = useRef(0);
  // The destination of the in-flight navigation, until it commits or stops.
  const pendingRef = useRef<Pending>(undefined);
  // The destination is in the DOM: let the intercept handler settle.
  useLayoutEffect(() => {
    if (!nav) return;
    if (nav.pending && pendingRef.current === nav.pending) {
      pendingRef.current = undefined;
    }
    nav.pending?.commit();
  }, [nav]);
  useEffect(() => {
    cache.learnStaticFromElements(elements);
  }, [cache, elements]);
  const registryRef = useRef(new Map<string, NavStatusEntry>());
  const register = useCallback<RegisterFn>((id, entry) => {
    registryRef.current.set(id, entry);
    return () => {
      registryRef.current.delete(id);
    };
  }, []);
  const prefetchRoute = useCallback(
    (next: Route | undefined) => {
      if (!next || cache.canReuseStaticRoute(next, elementsRef.current)) return;
      cache.prefetchRoute(next);
      // When the build publishes it, __WAKU_ROUTER_PREFETCH__ yields the
      // route's JS chunk ids to preload.
      (
        globalThis as {
          __WAKU_ROUTER_PREFETCH__?: (
            path: string,
            preload: (id: string) => void,
          ) => void;
        }
      ).__WAKU_ROUTER_PREFETCH__?.(next.path, (id) =>
        preloadModule(id, { as: 'script' }),
      );
    },
    [cache],
  );
  // Vite HMR (dev only): the replacing no-op retires Root's own listener, which
  // would refetch the initial route; useHmrRefetch refetches the current one.
  useEffect(
    () => registerRscReloadListener(() => {}, { replace: true }),
    [registerRscReloadListener],
  );
  const getSettledRoute = useCallback(() => committedRef.current.route, []);
  useHmrRefetch({ getSettledRoute });

  const followIntent = useCallback(
    (outcome: IntentOutcome, scope: IntentScope) => {
      if (!mountedRef.current || generationRef.current !== scope.gen) return;
      if ('error' in outcome) {
        setRenderError(outcome.error);
        return;
      }
      if (outcome.value === undefined) return;
      const intent = JSON.parse(outcome.value) as RouteIntentData;
      const current = committedRef.current.route;
      if (intent.status === 404 && current.path === NOT_FOUND_PATH) return;
      const decision = decideRouteIntent(
        intent,
        {
          route: current,
          url: new URL(window.location.href),
          follows: scope.follows,
        },
        {
          has404: has404FromElements(elementsRef.current),
          maxFollows: MAX_FOLLOWS_PER_NAVIGATION,
        },
      );
      switch (decision.type) {
        case 'stop':
          setRenderError(decision.error);
          return;
        case 'none':
          setRenderError(
            Object.assign(new Error('Not Found'), {
              cause: new Response(null, { status: 404 }),
            }),
          );
          return;
        case 'leave':
          window.location.replace(decision.url.href);
          return;
        case 'follow':
          replaceEntry(decision.url.href, {
            scroll: false,
            follows: scope.follows + 1,
            target: decision.target,
          });
      }
    },
    [],
  );

  // A committed payload can carry a route intent that is still pending.
  const observedRef = useRef<{ pending: unknown; stop: () => void }>(undefined);
  useLayoutEffect(() => {
    const pending = elements[INTENT_ID] as
      | PromiseLike<string | undefined>
      | null
      | undefined;
    if (observedRef.current?.pending === pending) return;
    observedRef.current?.stop();
    observedRef.current = undefined;
    if (!pending) return;
    const scope = { gen: committed.gen, follows: committed.follows };
    observedRef.current = {
      pending,
      stop: observeIntent(pending, (outcome) => followIntent(outcome, scope)),
    };
  });
  useLayoutEffect(
    () => () => {
      observedRef.current?.stop();
      observedRef.current = undefined;
    },
    [],
  );
  // Responses without route metadata (server function calls, slices) carry
  // their intents here instead of into the elements.
  useLayoutEffect(
    () =>
      cache.connectRouteIntentObserver((signal) => {
        const scope = {
          gen: generationRef.current,
          follows: committedRef.current.follows,
        };
        return (responseElements) => {
          const pending = responseElements[INTENT_ID] as
            | PromiseLike<string | undefined>
            | null
            | undefined;
          if (!pending || getRouteFromElements(responseElements)) {
            return responseElements;
          }
          observeIntent(pending, (outcome) => {
            if (!signal?.aborted) followIntent(outcome, scope);
          });
          return combineElements({}, responseElements, {
            filter: (key) => key !== INTENT_ID,
          });
        };
      }),
    [cache, followIntent],
  );

  const getPendingRoute = useCallback(() => pendingRef.current?.route, []);
  const applyRouteResponse = useCallback(async (responseElements: Elements) => {
    const next = getRouteFromElements(responseElements)!;
    const current = committedRef.current.route;
    const sameRoute =
      current.path === next.path &&
      (isStaticFromElements(responseElements) || current.query === next.query);
    const target = sameRoute ? current : next;
    // A response for the current entry reloads it, keeping its state. The
    // entry names another route when a navigation has already moved the URL.
    const stays =
      next.path === NOT_FOUND_PATH ||
      isSameRoute(parseRoute(new URL(window.location.href)), target);
    const history = stays ? 'reload' : sameRoute ? 'replace' : 'push';
    await navigate(getRouteUrl(target).href, history, {
      scroll: false,
      target,
      adopt: Promise.resolve(responseElements),
    });
  }, []);
  useServerFunctionRouting(serverFunctionRouting, {
    getSettledRoute,
    getPendingRoute,
    applyRouteResponse,
  });

  useEffect(() => {
    const callback = (event: NavigateEvent) => {
      if (!event.canIntercept) return;
      if (event.downloadRequest !== null || event.formData) return;
      // React >=19.2's default transition indicator fires fake navigations.
      if (event.info === 'react-transition') return;
      if (event.info === DOCUMENT_LOAD) return;
      const info = event.info as NavigateInfo | undefined;
      const destination = new URL(event.destination.url);
      const nextRoute = info?.target ?? toRoute(destination);
      if (!nextRoute) return;
      const gen = ++generationRef.current;
      const follows = info?.follows ?? 0;
      const source = (event as NavigateEvent & { sourceElement?: Element })
        .sourceElement;
      const clickedAnchor = source?.closest?.('a') ?? null;
      // Match the navigating <Link>(s): the clicked one by element identity (so
      // two same-`to` links stay independent), or -- with no source element
      // (programmatic / back-forward) -- every <Link> whose `to` hits the dest.
      const matched: NavStatusEntry[] = [];
      for (const entry of registryRef.current.values()) {
        const hit = clickedAnchor
          ? entry.getElement() === clickedAnchor
          : !source && routeMatchesHref(entry.href, nextRoute);
        if (hit) matched.push(entry);
      }
      const resolvedScroll =
        info?.scroll ?? (matched.length ? matched[0]!.scroll : undefined);
      const suppressScroll = resolvedScroll === false;
      if (event.hashChange && !info?.target && !info?.adopt) {
        // Hash-only: no refetch; intercept only to suppress the browser scroll.
        const update = () =>
          setNav((prev) => ({
            route: nextRoute,
            gen: prev?.gen ?? 0,
            follows: 0,
          }));
        if (suppressScroll) {
          event.intercept({
            scroll: 'manual',
            handler: async () => update(),
          });
        } else {
          update();
        }
        return;
      }
      const signal = event.signal;
      let commit!: () => void;
      const committed = new Promise<void>((resolve) => {
        commit = resolve;
      });
      const pending: Pending = { route: nextRoute, commit };
      pendingRef.current = pending;
      const settlePending = () => {
        if (pendingRef.current === pending) pendingRef.current = undefined;
        commit();
      };
      signal.addEventListener('abort', settlePending);
      // A document load. The listener stays: the user can cancel the unload.
      const leaveDocument = (url: URL) => {
        const left =
          url.href === window.location.href
            ? window.navigation.reload({ info: DOCUMENT_LOAD })
            : window.navigation.navigate(url.href, {
                history: 'replace',
                info: DOCUMENT_LOAD,
              });
        finishedOf(left).catch(() => {});
      };
      const load = () =>
        new Promise<void>((resolve, reject) => {
          // Run in a transition: keeps the previous page visible while the
          // next tree suspends, and scopes the optimistic pending updates so
          // React reverts them on commit/abort/error.
          startTransition(async () => {
            try {
              for (const { setOptimisticStatus } of matched) {
                setOptimisticStatus({ pending: true });
              }
              const settled = committedRef.current.route;
              const base = elementsRef.current;
              // Reuses a static route or a prefetch, and follows a 404 or
              // redirect the fetch reports.
              const outcome = await cache.load(nextRoute, {
                signal,
                has404: has404FromElements(base),
                base,
                url: destination,
                follows,
                ...(info?.adopt ? { adopt: info.adopt } : {}),
              });
              if (outcome.type === 'aborted') {
                settlePending();
                return resolve();
              }
              if (outcome.type === 'leave') {
                settlePending();
                leaveDocument(outcome.location);
                return resolve();
              }
              if (outcome.type === 'failed') {
                settlePending();
                if (isBuildIdMismatch(outcome.error)) {
                  leaveDocument(outcome.url);
                  return resolve();
                }
                setRenderError(outcome.error);
                throw outcome.error;
              }
              const landed =
                outcome.type === 'loaded'
                  ? getLanded(outcome)
                  : { route: outcome.route, url: outcome.url };
              if (landed.url.href !== destination.href) {
                // The entry is committed: replace it in a navigation that
                // adopts this response, which also aborts this one.
                replaceEntry(landed.url.href, {
                  scroll: info?.scroll,
                  follows: outcome.follows,
                  target: landed.route,
                  ...(outcome.type === 'loaded'
                    ? { adopt: Promise.resolve(outcome.elements) }
                    : {}),
                });
                return resolve();
              }
              // Updates after the first await lose the transition scope
              // (https://react.dev/reference/react/startTransition#caveats),
              // so re-wrap the commit.
              startTransition(() => {
                setRenderError(null);
                void mergeElements(
                  outcome.type === 'loaded'
                    ? buildMergePatch(outcome, elementsRef.current, base, {
                        settled,
                      })
                    : {
                        [ROUTE_ID]: [outcome.route.path, outcome.route.query],
                        [INTENT_ID]: null,
                      },
                );
                setNav({
                  route: landed.route,
                  gen,
                  follows: outcome.follows,
                  pending,
                });
              });
              resolve();
            } catch (err) {
              settlePending();
              reject(err);
            }
          });
        });
      let failure: { error: unknown } | undefined;
      const run = () =>
        load().catch((error: unknown) => {
          failure = { error };
        });
      const finish = async () => {
        if (failure) throw failure.error;
        info?.applied?.();
        await committed;
      };
      // The handler settles after the destination commits, so the browser
      // scrolls, restores and resets focus against the new DOM. A reload keeps
      // both as they are: the browser would restore a stale saved position.
      const reload = event.navigationType === 'reload';
      event.intercept({
        scroll: suppressScroll || reload ? 'manual' : 'after-transition',
        focusReset: reload ? 'manual' : 'after-transition',
        handler: () => run().then(finish),
      });
    };
    window.navigation.addEventListener('navigate', callback);
    return () => {
      window.navigation.removeEventListener('navigate', callback);
      // Nothing will commit the in-flight navigation any more.
      pendingRef.current?.commit();
    };
  }, [cache, mergeElements]);
  // The same RouterHost waku's INTERNAL_ServerRouter provides during SSR, which
  // the re-exported hooks and useRouter read.
  const host = useMemo<RouterHost>(
    () => ({ route, navigate: navigateHost }),
    [route],
  );
  const routerCtxValue = useMemo(
    () => ({ register, prefetchRoute }),
    [register, prefetchRoute],
  );
  return (
    <RouterHostContext.Provider value={host}>
      <RouterContext.Provider value={routerCtxValue}>
        <Slot id="root">
          <Slot id={getRouteSlotId(route.path)} />
        </Slot>
      </RouterContext.Provider>
    </RouterHostContext.Provider>
  );
}

/**
 * The client router. Reads the initial route from `window.navigation`, listens
 * for navigate events, and renders the current page. Takes no props.
 */
export function Router() {
  const initialRoute = parseRoute(
    new URL(window.navigation.currentEntry!.url!),
  );
  const initialRscPath = encodeRoutePath(initialRoute.path);
  const initialRscParams = useInitialRscParams(
    initialRscPath,
    initialRoute.query,
  );
  return (
    <Root
      initialRscPath={initialRscPath}
      initialRscParams={initialRscParams}
      rscEnhancers={rscEnhancers}
    >
      <InnerRouter fallbackRoute={initialRoute} />
    </Root>
  );
}
