"use client";

import { ConsoleAuthorizationCallback } from "@/components/auth/ConsoleAuthorizationCallback";
import { useDictionary } from "@/i18n/client";

import { useAdminAuth } from "./AdminAuthProvider";

export function AdminAuthorizationCallback() {
  const dictionary = useDictionary();
  const { completeAuthorization } = useAdminAuth();
  return (
    <ConsoleAuthorizationCallback
      completeAuthorization={completeAuthorization}
      errorMessage={dictionary.admin.common.authorizationCallbackError}
    />
  );
}
