"use client";

import { ConsoleAuthorizationCallback } from "@/components/auth/ConsoleAuthorizationCallback";
import { useDictionary } from "@/i18n/client";

import { useAccountAuth } from "./AccountAuthProvider";

export function AccountAuthorizationCallback() {
  const dictionary = useDictionary();
  const { completeAuthorization } = useAccountAuth();
  return (
    <ConsoleAuthorizationCallback
      completeAuthorization={completeAuthorization}
      errorMessage={dictionary.account.common.authorizationCallbackError}
    />
  );
}
