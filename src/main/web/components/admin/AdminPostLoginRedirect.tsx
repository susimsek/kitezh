"use client";

import { useEffect } from "react";
import { useRouter } from "@/routing/navigation";

const ADMIN_RETURN_TO = "AUTH_ADMIN_RETURN_TO";

export function AdminPostLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    const returnTo = sessionStorage.getItem(ADMIN_RETURN_TO);
    if (!returnTo || !returnTo.startsWith("/")) {
      return;
    }

    sessionStorage.removeItem(ADMIN_RETURN_TO);
    router.replace(returnTo);
  }, [router]);

  return null;
}
