"use client";

import { useMemo } from "react";
import {
  useLocation,
  useNavigate,
  useSearchParams as useRouterSearchParams,
} from "react-router-dom";

export { useParams } from "react-router-dom";

export function usePathname() {
  return useLocation().pathname;
}

export function useSearchParams() {
  return useRouterSearchParams()[0];
}

/** Keep the consoles' navigation interface while using browser-only History routing. */
export function useRouter() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      push: (path: string) => navigate(path),
      replace: (path: string) => navigate(path, { replace: true }),
    }),
    [navigate],
  );
}
