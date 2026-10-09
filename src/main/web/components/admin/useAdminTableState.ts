"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "@/routing/navigation";

type TableState = {
  query: string;
  page: number;
  size: number;
  status: string;
  clientId: string;
  username: string;
  scope: string;
  sort: string;
  action: string;
  targetType: string;
  targetId: string;
  from: string;
  to: string;
};

export function useAdminTableState(defaultSize = 10, includesStatus = false, defaultSort = "") {
  const pathname = usePathname();
  useEffect(() => {
    window.dispatchEvent(new Event("admin-table-state"));
  }, [pathname]);
  const location = useSyncExternalStore(
    subscribe,
    () => `${pathname}${window.location.search}`,
    () => "",
  );
  const state = readState(location, defaultSize, includesStatus, defaultSort);

  const update = (changes: Partial<TableState>) => {
    const next = { ...state, ...changes };
    const params = new URLSearchParams(window.location.search);
    setParam(params, "q", next.query);
    setParam(params, "page", next.page === 0 ? "" : String(next.page));
    setParam(params, "size", next.size === defaultSize ? "" : String(next.size));
    if (includesStatus) setParam(params, "status", next.status);
    setParam(params, "clientId", next.clientId);
    setParam(params, "username", next.username);
    setParam(params, "scope", next.scope);
    setParam(params, "sort", next.sort === defaultSort ? "" : next.sort);
    setParam(params, "action", next.action);
    setParam(params, "targetType", next.targetType);
    setParam(params, "targetId", next.targetId);
    setParam(params, "from", next.from);
    setParam(params, "to", next.to);
    const search = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
    );
    window.dispatchEvent(new Event("admin-table-state"));
  };

  return {
    ...state,
    setQuery: (query: string) => update({ query, page: 0 }),
    setPage: (page: number) => update({ page }),
    setSize: (size: number) => update({ size, page: 0 }),
    setStatus: (status: string) => update({ status, page: 0 }),
    setClientId: (clientId: string) => update({ clientId, page: 0 }),
    setUsername: (username: string) => update({ username, page: 0 }),
    setScope: (scope: string) => update({ scope, page: 0 }),
    setSort: (sort: string) => update({ sort, page: 0 }),
    setAction: (action: string) => update({ action, page: 0 }),
    setTargetType: (targetType: string) => update({ targetType, page: 0 }),
    setTargetId: (targetId: string) => update({ targetId, page: 0 }),
    setFrom: (from: string) => update({ from, page: 0 }),
    setTo: (to: string) => update({ to, page: 0 }),
    clearFilters: () =>
      update({
        query: "",
        status: "",
        clientId: "",
        username: "",
        scope: "",
        action: "",
        targetType: "",
        targetId: "",
        from: "",
        to: "",
        sort: defaultSort,
        page: 0,
      }),
  };
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("admin-table-state", onStoreChange);
  window.addEventListener("popstate", onStoreChange);
  return () => {
    window.removeEventListener("admin-table-state", onStoreChange);
    window.removeEventListener("popstate", onStoreChange);
  };
}

function readState(
  location: string,
  defaultSize: number,
  includesStatus: boolean,
  defaultSort: string,
): TableState {
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const page = Number(params.get("page"));
  const size = Number(params.get("size"));
  return {
    query: params.get("q") ?? "",
    page: Number.isInteger(page) && page > 0 ? page : 0,
    size: Number.isInteger(size) && size > 0 ? size : defaultSize,
    status: includesStatus ? (params.get("status") ?? "") : "",
    clientId: params.get("clientId") ?? "",
    username: params.get("username") ?? "",
    scope: params.get("scope") ?? "",
    sort: params.get("sort") ?? defaultSort,
    action: params.get("action") ?? "",
    targetType: params.get("targetType") ?? "",
    targetId: params.get("targetId") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };
}

function setParam(params: URLSearchParams, name: string, value: string) {
  if (value) {
    params.set(name, value);
  } else {
    params.delete(name);
  }
}
