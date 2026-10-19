import {
  classifyApiError,
  createSingleFlight,
  type NativeApiRequest,
  type NativeApiResponse,
  type NativeSession,
  type NativeSessionNamespace,
} from "@kitezh/shared";

type DesktopSession = NativeSession & { version: 1 };

type AdapterOptions = {
  apiBaseUrl: string;
  readSession: (
    namespace: NativeSessionNamespace,
  ) => Promise<DesktopSession | null>;
  writeSession: (
    namespace: NativeSessionNamespace,
    session: DesktopSession,
  ) => Promise<void>;
  clearSession: (namespace: NativeSessionNamespace) => Promise<void>;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

type TokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  id_token?: unknown;
  refresh_token?: unknown;
};

const CLIENT_IDS: Record<NativeSessionNamespace, string> = {
  account: "desktop-account-console",
  admin: "desktop-admin-console",
};

const ACCOUNT_ALLOWED_PATHS = [
  "/api/account",
  "/api/auth/localization/me",
  "/api/ciba/",
];

function isAllowedApiPath(
  namespace: NativeSessionNamespace,
  method: string,
  path: string,
) {
  const notificationsPath =
    namespace === "admin"
      ? "/api/admin/notifications"
      : "/api/account/notifications";
  if (
    path === notificationsPath ||
    path.startsWith(`${notificationsPath}?`) ||
    path.startsWith(`${notificationsPath}/`)
  ) {
    try {
      const url = new URL(path, "https://desktop.invalid");
      if (url.origin !== "https://desktop.invalid" || url.hash) return false;
      const keys = [...url.searchParams.keys()];
      if (
        [...new Set(keys)].some(
          (key) => url.searchParams.getAll(key).length !== 1,
        ) ||
        keys.some((key) => !["page", "size", "sort"].includes(key))
      )
        return false;
      if (url.pathname === notificationsPath) {
        const page = url.searchParams.get("page");
        const size = url.searchParams.get("size");
        const sort = url.searchParams.get("sort");
        return (
          method === "GET" &&
          (page === null || /^(0|[1-9]\d{0,6})$/.test(page)) &&
          (size === null ||
            (/^[1-9]\d{0,2}$/.test(size) && Number(size) <= 100)) &&
          (sort === null || sort === "createdAt,desc")
        );
      }
      if (url.pathname === `${notificationsPath}/unread-count`)
        return method === "GET" && keys.length === 0;
      return (
        method === "PUT" &&
        new RegExp(
          `^${notificationsPath}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/read$`,
          "i",
        ).test(url.pathname) &&
        keys.length === 0
      );
    } catch {
      return false;
    }
  }
  if (namespace === "admin") {
    if (path.startsWith("/api/admin/organizations")) {
      try {
        const url = new URL(path, "https://desktop.invalid");
        if (
          url.origin !== "https://desktop.invalid" ||
          url.hash ||
          url.pathname !== "/api/admin/organizations"
        )
          return false;
        if (method === "POST") return !url.search;
        if (method !== "GET") return false;
        const keys = [...url.searchParams.keys()];
        const page = url.searchParams.get("page");
        const size = url.searchParams.get("size");
        const sort = url.searchParams.get("sort");
        return (
          keys.every((key) => ["q", "page", "size", "sort"].includes(key)) &&
          [...new Set(keys)].every(
            (key) => url.searchParams.getAll(key).length === 1,
          ) &&
          (page === null || /^(0|[1-9]\d{0,6})$/.test(page)) &&
          Number(page ?? 0) <= 1_000_000 &&
          (size === null ||
            (/^[1-9]\d{0,2}$/.test(size) && Number(size) <= 100)) &&
          (sort === null || ["name,asc", "name,desc"].includes(sort)) &&
          (url.searchParams.get("q")?.length ?? 0) <= 200
        );
      } catch {
        return false;
      }
    }
    // Client detail contracts are exact and bounded independently of global resources.
    const clientDetailRoute =
      /^\/api\/admin\/clients\/[A-Za-z0-9_-]{1,100}\/(scope-evaluation|secret|sessions(?:\/[A-Za-z0-9_-]{1,100})?|consents|events)(?:\?|#|$)/.exec(
        path,
      );
    if (clientDetailRoute) {
      try {
        const url = new URL(path, "https://desktop.invalid");
        if (url.origin !== "https://desktop.invalid" || url.hash) return false;
        const suffix = clientDetailRoute[1];
        const expected = `/api/admin/clients/${url.pathname.split("/")[4]}/${suffix}`;
        if (url.pathname !== expected) return false;
        const keys = [...url.searchParams.keys()];
        if (keys.some((key) => url.searchParams.getAll(key).length !== 1))
          return false;
        if (suffix === "secret") return method === "POST" && keys.length === 0;
        if (suffix === "scope-evaluation")
          return (
            method === "GET" &&
            keys.every((key) => ["scopes", "subject"].includes(key)) &&
            (url.searchParams.get("scopes") ?? "").length <= 2000 &&
            (url.searchParams.get("subject") ?? "").length <= 100
          );
        if (suffix.startsWith("sessions") && method === "DELETE")
          return keys.length === 0;
        if (
          !["sessions", "consents", "events"].includes(suffix) ||
          method !== "GET"
        )
          return false;
        const page = url.searchParams.get("page");
        const size = url.searchParams.get("size");
        return (
          keys.every((key) => ["page", "size"].includes(key)) &&
          (page === null || /^(0|[1-9]\d{0,6})$/.test(page)) &&
          (size === null ||
            (/^[1-9]\d{0,2}$/.test(size) && Number(size) <= 100))
        );
      } catch {
        return false;
      }
    }
    if (method === "GET" && path === "/api/admin/whoami") return true;
    if (method === "POST" && path === "/api/admin/keys/rotate") return true;
    if (method === "GET" && path === "/api/admin/profile-attributes")
      return true;
    const userRequiredActionMatch =
      /^\/api\/admin\/required-actions\/users\/([1-9]\d*)(?:\/([A-Z][A-Z0-9_]{0,99}))?$/.exec(
        path,
      );
    if (
      userRequiredActionMatch &&
      Number.isSafeInteger(Number(userRequiredActionMatch[1]))
    )
      return userRequiredActionMatch[2] === undefined
        ? method === "GET"
        : method === "POST" || method === "DELETE";
    if (method === "POST" && path === "/api/admin/users") return true;
    const userAvatarMatch = /^\/api\/admin\/users\/([1-9]\d*)\/avatar$/.exec(
      path,
    );
    if (
      userAvatarMatch &&
      Number.isSafeInteger(Number(userAvatarMatch[1])) &&
      ["PUT", "DELETE"].includes(method)
    )
      return true;
    if (method === "POST" && path === "/api/admin/users/bulk") return true;
    const userDetailMatch = /^\/api\/admin\/users\/([1-9]\d*)$/.exec(path);
    if (
      method === "GET" &&
      userDetailMatch &&
      Number.isSafeInteger(Number(userDetailMatch[1]))
    )
      return true;
    const userRelatedListMatch =
      /^\/api\/admin\/users\/([1-9]\d*)\/(groups|sessions|consents|events)$/.exec(
        path.split("?", 1)[0],
      );
    if (
      method === "GET" &&
      userRelatedListMatch &&
      Number.isSafeInteger(Number(userRelatedListMatch[1]))
    ) {
      try {
        const url = new URL(path, "https://desktop.invalid");
        const [, , resource] = userRelatedListMatch;
        const allowedParameters = new Set([
          "page",
          "size",
          "sort",
          ...(resource === "groups" ? ["q"] : []),
        ]);
        const sortValues: Record<string, string[]> = {
          groups: ["name,asc", "name,desc"],
          sessions: ["lastAccessTime,asc", "lastAccessTime,desc"],
          consents: ["id.registeredClientId,asc", "id.registeredClientId,desc"],
          events: ["occurredAt,asc", "occurredAt,desc"],
        };
        const params = url.searchParams;
        const keys = [...params.keys()];
        return (
          url.origin === "https://desktop.invalid" &&
          !url.hash &&
          keys.every((key) => allowedParameters.has(key)) &&
          [...new Set(keys)].every((key) => params.getAll(key).length === 1) &&
          /^(0|[1-9]\d{0,6})$/.test(params.get("page") ?? "0") &&
          Number(params.get("page") ?? 0) <= 1_000_000 &&
          /^(?:[1-9]\d?|100)$/.test(params.get("size") ?? "20") &&
          sortValues[resource].includes(
            params.get("sort") ?? sortValues[resource][0],
          ) &&
          (params.get("q")?.length ?? 0) <= 200
        );
      } catch {
        return false;
      }
    }
    const userUpdateMatch = /^\/api\/admin\/users\/([1-9]\d*)$/.exec(path);
    if (
      method === "PUT" &&
      userUpdateMatch &&
      Number.isSafeInteger(Number(userUpdateMatch[1]))
    )
      return true;
    const userProfileAttributesMatch =
      /^\/api\/admin\/users\/([1-9]\d*)\/profile-attributes$/.exec(path);
    if (
      userProfileAttributesMatch &&
      Number.isSafeInteger(Number(userProfileAttributesMatch[1])) &&
      ["GET", "PUT"].includes(method)
    )
      return true;
    const userEnabledMatch = /^\/api\/admin\/users\/([1-9]\d*)\/enabled$/.exec(
      path,
    );
    if (
      method === "PUT" &&
      userEnabledMatch &&
      Number.isSafeInteger(Number(userEnabledMatch[1]))
    )
      return true;
    const userActionEmailMatch =
      /^\/api\/admin\/users\/([1-9]\d*)\/execute-actions-email\?lifespan=(1800|3600|43200|86400)$/.exec(
        path,
      );
    if (
      method === "PUT" &&
      userActionEmailMatch &&
      Number.isSafeInteger(Number(userActionEmailMatch[1]))
    )
      return true;
    const userTotpResetMatch = /^\/api\/admin\/users\/([1-9]\d*)\/totp$/.exec(
      path,
    );
    if (
      method === "DELETE" &&
      userTotpResetMatch &&
      Number.isSafeInteger(Number(userTotpResetMatch[1]))
    )
      return true;
    const userUnlockMatch = /^\/api\/admin\/users\/([1-9]\d*)\/unlock$/.exec(
      path,
    );
    if (
      method === "POST" &&
      userUnlockMatch &&
      Number.isSafeInteger(Number(userUnlockMatch[1]))
    )
      return true;
    const userPasswordResetMatch =
      /^\/api\/admin\/users\/([1-9]\d*)\/password$/.exec(path);
    if (
      method === "PUT" &&
      userPasswordResetMatch &&
      Number.isSafeInteger(Number(userPasswordResetMatch[1]))
    )
      return true;
    const userPasskeyListMatch =
      /^\/api\/admin\/users\/([1-9]\d*)\/webauthn\/credentials(?:\?page=(0|[1-9]\d*)&size=(\d+))?$/.exec(
        path,
      );
    if (
      method === "GET" &&
      userPasskeyListMatch &&
      Number.isSafeInteger(Number(userPasskeyListMatch[1])) &&
      (userPasskeyListMatch[2] === undefined ||
        (Number.isSafeInteger(Number(userPasskeyListMatch[2])) &&
          Number(userPasskeyListMatch[3]) >= 1 &&
          Number(userPasskeyListMatch[3]) <= 100))
    )
      return true;
    const userPasskeyMatch =
      /^\/api\/admin\/users\/([1-9]\d*)\/webauthn\/credentials\/([A-Za-z0-9_-]{1,300})$/.exec(
        path,
      );
    if (
      userPasskeyMatch &&
      Number.isSafeInteger(Number(userPasskeyMatch[1])) &&
      ["PUT", "DELETE"].includes(method)
    )
      return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/users\/[1-9]\d*$/.test(path) &&
      Number.isSafeInteger(Number(path.split("/").at(-1)))
    )
      return true;
    if (method === "POST" && path === "/api/admin/roles") return true;
    const roleMembershipMatch =
      /^\/api\/admin\/roles\/(ROLE_[A-Z0-9_]{1,45})(?:\/(available-users|users)(?:\/([1-9]\d*))?)?$/.exec(
        path.split("?", 1)[0],
      );
    if (roleMembershipMatch) {
      const [, , resource, userId] = roleMembershipMatch;
      if (!resource && method !== "GET") {
        // Description PUT and role DELETE retain their exact query-free rules below.
      } else {
        try {
          const url = new URL(path, "https://desktop.invalid");
          const params = url.searchParams;
          const keys = [...params.keys()];
          const sorts = [
            "username,asc",
            "username,desc",
            "email,asc",
            "email,desc",
          ];
          if (
            url.origin !== "https://desktop.invalid" ||
            url.hash ||
            keys.some(
              (key) => !["q", "enabled", "page", "size", "sort"].includes(key),
            ) ||
            [...new Set(keys)].some((key) => params.getAll(key).length !== 1) ||
            !/^(0|[1-9]\d{0,6})$/.test(params.get("page") ?? "0") ||
            Number(params.get("page") ?? 0) > 1_000_000 ||
            !/^(?:[1-9]\d?|100)$/.test(params.get("size") ?? "20") ||
            !sorts.includes(params.get("sort") ?? "username,asc") ||
            (params.get("q")?.length ?? 0) > 200 ||
            (params.has("enabled") &&
              !["true", "false"].includes(params.get("enabled") ?? ""))
          )
            return false;
          if (!resource) return method === "GET";
          if (resource === "available-users")
            return method === "GET" && !userId && !params.has("enabled");
          if (keys.some((key) => ["q", "enabled"].includes(key))) return false;
          return (
            (!userId && method === "POST") ||
            (Boolean(userId) &&
              method === "DELETE" &&
              Number.isSafeInteger(Number(userId)))
          );
        } catch {
          return false;
        }
      }
    }
    const roleCompositeMutationMatch =
      /^\/api\/admin\/roles\/(ROLE_[A-Z0-9_]{1,45})\/composites\/(ROLE_[A-Z0-9_]{1,45})(?:\?|$)/.exec(
        path,
      );
    if (roleCompositeMutationMatch && ["POST", "DELETE"].includes(method)) {
      try {
        const url = new URL(path, "https://desktop.invalid");
        return (
          url.origin === "https://desktop.invalid" &&
          url.searchParams.get("page") === "0" &&
          url.searchParams.get("size") === "20" &&
          url.searchParams.get("sort") === "username,asc" &&
          [...url.searchParams.keys()].every((key) =>
            ["page", "size", "sort"].includes(key),
          ) &&
          [...new Set(url.searchParams.keys())].every(
            (key) => url.searchParams.getAll(key).length === 1,
          ) &&
          !url.hash
        );
      } catch {
        return false;
      }
    }
    if (
      method === "PUT" &&
      /^\/api\/admin\/roles\/ROLE_[A-Z0-9_]{1,45}$/.test(path)
    )
      return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/roles\/ROLE_[A-Z0-9_]{1,45}$/.test(path)
    )
      return true;
    const clientRoleMutationMatch =
      /^\/api\/admin\/clients\/([A-Za-z0-9_-]{1,100})\/roles(?:\/([1-9]\d*))?$/.exec(
        path,
      );
    if (clientRoleMutationMatch) {
      if (method === "POST" && clientRoleMutationMatch[2] === undefined)
        return true;
      if (
        ["PUT", "DELETE"].includes(method) &&
        clientRoleMutationMatch[2] !== undefined &&
        Number.isSafeInteger(Number(clientRoleMutationMatch[2]))
      )
        return true;
    }
    const clientRoleCompositeMatch =
      /^\/api\/admin\/clients\/([A-Za-z0-9_-]{1,100})\/roles\/([1-9]\d*)\/(composites\/([1-9]\d*)|realm-composites\/(ROLE_[A-Z0-9_]{1,45}))(?:\?|$)/.exec(
        path,
      );
    if (clientRoleCompositeMatch && ["POST", "DELETE"].includes(method)) {
      try {
        const url = new URL(path, "https://desktop.invalid");
        const [, , parentId, , childId] = clientRoleCompositeMatch;
        const idsAreSafe = [parentId, childId]
          .filter(Boolean)
          .every((value) => Number.isSafeInteger(Number(value)));
        const keys = [...url.searchParams.keys()];
        return (
          idsAreSafe &&
          url.origin === "https://desktop.invalid" &&
          url.searchParams.get("page") === "0" &&
          url.searchParams.get("size") === "20" &&
          url.searchParams.get("sort") === "username,asc" &&
          keys.length === 3 &&
          keys.every((key) => ["page", "size", "sort"].includes(key)) &&
          [...new Set(keys)].every(
            (key) => url.searchParams.getAll(key).length === 1,
          ) &&
          !url.hash
        );
      } catch {
        return false;
      }
    }
    const clientRoleAssignmentPathMatch =
      /^\/api\/admin\/clients\/([A-Za-z0-9_-]{1,100})\/roles\/([1-9]\d*)(?:\/(available-users|available-groups|users(?:\/([1-9]\d*))?|groups(?:\/([1-9]\d*))?))?(?:\?|$)/.exec(
        path,
      );
    if (clientRoleAssignmentPathMatch) {
      try {
        const url = new URL(path, "https://desktop.invalid");
        const suffix = clientRoleAssignmentPathMatch[3] ?? "";
        const userId = clientRoleAssignmentPathMatch[4];
        const groupId = clientRoleAssignmentPathMatch[5];
        const safeIds = [clientRoleAssignmentPathMatch[2], userId, groupId]
          .filter(Boolean)
          .every((value) => Number.isSafeInteger(Number(value)));
        if (!safeIds || url.origin !== "https://desktop.invalid" || url.hash)
          return false;
        const params = url.searchParams;
        const keys = [...params.keys()];
        if (
          [...new Set(keys)].some((key) => params.getAll(key).length !== 1) ||
          keys.some((key) => !["q", "page", "size", "sort"].includes(key))
        )
          return false;
        if (suffix === "available-users" || suffix === "available-groups") {
          return (
            method === "GET" &&
            params.get("page") === "0" &&
            params.get("size") === "10" &&
            params.get("sort") ===
              (suffix === "available-users" ? "username,asc" : "name,asc") &&
            (params.get("q")?.length ?? 0) >= 2 &&
            (params.get("q")?.length ?? 0) <= 100
          );
        }
        const hasBoundedDetailPage =
          params.get("page") === "0" &&
          params.get("size") === "20" &&
          params.get("sort") === "username,asc" &&
          keys.length === 3;
        if (suffix === "")
          return (
            method === "GET" && (keys.length === 0 || hasBoundedDetailPage)
          );
        if (suffix === "users" && method === "POST")
          return hasBoundedDetailPage;
        if (suffix.startsWith("groups/") && method === "POST")
          return hasBoundedDetailPage;
        if (suffix.startsWith("users/") && method === "DELETE")
          return hasBoundedDetailPage;
        if (suffix.startsWith("groups/") && method === "DELETE")
          return hasBoundedDetailPage;
        return false;
      } catch {
        return false;
      }
    }
    const roleClientCompositeMatch =
      /^\/api\/admin\/roles\/(ROLE_[A-Z0-9_]{1,45})\/client-composites\/([1-9]\d*)(?:\?|$)/.exec(
        path,
      );
    if (roleClientCompositeMatch && ["POST", "DELETE"].includes(method)) {
      try {
        const url = new URL(path, "https://desktop.invalid");
        return (
          url.origin === "https://desktop.invalid" &&
          url.searchParams.get("page") === "0" &&
          url.searchParams.get("size") === "20" &&
          url.searchParams.get("sort") === "username,asc" &&
          [...url.searchParams.keys()].every((key) =>
            ["page", "size", "sort"].includes(key),
          ) &&
          [...new Set(url.searchParams.keys())].every(
            (key) => url.searchParams.getAll(key).length === 1,
          ) &&
          !url.hash
        );
      } catch {
        return false;
      }
    }
    if (method === "POST" && path === "/api/admin/groups") return true;
    const groupDetailMatch = /^\/api\/admin\/groups\/([1-9]\d*)$/.exec(path);
    if (
      groupDetailMatch &&
      Number.isSafeInteger(Number(groupDetailMatch[1])) &&
      ["GET", "PUT"].includes(method)
    )
      return true;
    const groupPermissionsMatch =
      /^\/api\/admin\/groups\/([1-9]\d*)\/permissions$/.exec(path);
    if (
      groupPermissionsMatch &&
      Number.isSafeInteger(Number(groupPermissionsMatch[1])) &&
      ["GET", "PUT"].includes(method)
    )
      return true;
    if (
      method === "PUT" &&
      /^\/api\/admin\/groups\/[1-9]\d*\/name$/.test(path) &&
      Number.isSafeInteger(Number(path.split("/").at(-2)))
    )
      return true;
    if (
      method === "PUT" &&
      /^\/api\/admin\/groups\/[1-9]\d*\/roles$/.test(path) &&
      Number.isSafeInteger(Number(path.split("/").at(-2)))
    )
      return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/groups\/[1-9]\d*$/.test(path) &&
      Number.isSafeInteger(Number(path.split("/").at(-1)))
    )
      return true;
    const groupMembershipMatch =
      /^\/api\/admin\/groups\/([1-9]\d*)\/users(?:\/([1-9]\d*))?$/.exec(path);
    if (
      groupMembershipMatch &&
      groupMembershipMatch
        .slice(1)
        .every((id) =>
          id === undefined ? true : Number.isSafeInteger(Number(id)),
        ) &&
      ((method === "POST" && groupMembershipMatch[2] === undefined) ||
        (method === "DELETE" && groupMembershipMatch[2] !== undefined))
    )
      return true;
    if (method === "POST" && path === "/api/admin/client-scopes") return true;
    if (method === "POST" && path === "/api/admin/clients") return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/client-scopes\/[A-Za-z0-9_-]{1,100}$/.test(path)
    )
      return true;
    if (
      method === "PUT" &&
      /^\/api\/admin\/client-scopes\/[A-Za-z0-9_-]{1,100}\/role-mappings$/.test(
        path,
      )
    )
      return true;
    if (
      method === "PUT" &&
      /^\/api\/admin\/clients\/[A-Za-z0-9_-]{1,100}\/scope-assignments$/.test(
        path,
      )
    )
      return true;
    const clientMapperPath =
      /^\/api\/admin\/clients\/([A-Za-z0-9_-]{1,100})\/mappers(?:\/([1-9]\d*))?$/.exec(
        path,
      );
    if (
      clientMapperPath &&
      (method === "POST" || method === "PUT" || method === "DELETE") &&
      (method === "POST"
        ? clientMapperPath[2] === undefined
        : clientMapperPath[2] !== undefined &&
          Number.isSafeInteger(Number(clientMapperPath[2])))
    )
      return true;
    const clientScopeMapperPath =
      /^\/api\/admin\/client-scopes\/([A-Za-z0-9_-]{1,100})\/mappers(?:\/([1-9]\d*))?$/.exec(
        path,
      );
    if (
      clientScopeMapperPath &&
      (method === "POST" || method === "PUT" || method === "DELETE") &&
      (method === "POST"
        ? clientScopeMapperPath[2] === undefined
        : clientScopeMapperPath[2] !== undefined &&
          Number.isSafeInteger(Number(clientScopeMapperPath[2])))
    )
      return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/offline-sessions\/[A-Za-z0-9_-]{1,100}$/.test(path)
    )
      return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}$/.test(path)
    )
      return true;
    if (
      (method === "GET" || method === "PUT") &&
      /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}$/.test(path)
    )
      return true;
    if (method === "POST" && path === "/api/admin/identity-providers")
      return true;
    if (
      method === "PUT" &&
      /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}\/native-policy$/.test(
        path,
      )
    )
      return true;
    if (
      method === "PUT" &&
      /^\/api\/admin\/clients\/[A-Za-z0-9_-]{1,100}$/.test(path)
    )
      return true;
    if (
      method === "PUT" &&
      /^\/api\/admin\/clients\/[A-Za-z0-9_-]{1,100}\/native-metadata$/.test(
        path,
      )
    )
      return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/clients\/[A-Za-z0-9_-]{1,100}$/.test(path)
    )
      return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}\/mappers\/[A-Za-z0-9_-]{1,100}$/.test(
        path,
      )
    )
      return true;
    if (
      method === "POST" &&
      /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}\/mappers$/.test(
        path,
      )
    )
      return true;
    if (
      method === "PUT" &&
      /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}\/mappers\/[A-Za-z0-9_-]{1,100}$/.test(
        path,
      )
    )
      return true;
    const consentRevokeMatch =
      /^\/api\/admin\/consents\/([^/]{1,300})\/([^/]{1,300})$/.exec(path);
    if (method === "DELETE" && consentRevokeMatch) {
      try {
        const clientId = decodeURIComponent(consentRevokeMatch[1]);
        const username = decodeURIComponent(consentRevokeMatch[2]);
        return [clientId, username].every(
          (segment) =>
            segment.length > 0 &&
            segment.length <= 100 &&
            !segment.includes("/") &&
            !segment.includes("\\") &&
            segment !== "." &&
            segment !== "..",
        );
      } catch {
        return false;
      }
    }
    if (
      method === "PUT" &&
      /^\/api\/admin\/client-scopes\/[A-Za-z0-9_-]{1,100}$/.test(path)
    )
      return true;
    if (
      method === "GET" &&
      /^\/api\/admin\/client-scopes\/[A-Za-z0-9_-]{1,100}$/.test(path)
    )
      return true;
    if (
      method === "PUT" &&
      (path === "/api/admin/settings/ciba-policy" ||
        path === "/api/admin/settings/offline-access" ||
        path === "/api/admin/settings/branding" ||
        path === "/api/admin/settings/localization" ||
        path === "/api/admin/settings/email" ||
        path === "/api/admin/settings/login/native")
    )
      return true;
    if (
      method === "POST" &&
      (path === "/api/admin/settings/offline-access/revoke-all" ||
        path === "/api/admin/sessions/revoke-all")
    )
      return true;
    const localizationMessageMatch =
      /^\/api\/admin\/settings\/localization\/messages\/([1-9]\d*)$/.exec(path);
    if (
      method === "POST" &&
      path === "/api/admin/settings/localization/messages"
    )
      return true;
    if (
      method === "PUT" &&
      localizationMessageMatch &&
      Number.isSafeInteger(Number(localizationMessageMatch[1]))
    )
      return true;
    if (
      method === "DELETE" &&
      localizationMessageMatch &&
      Number.isSafeInteger(Number(localizationMessageMatch[1]))
    )
      return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/sessions\/[A-Za-z0-9_-]{1,100}$/.test(path)
    )
      return true;
    if (method === "DELETE" && path === "/api/admin/events") return true;
    if (method !== "GET") return false;
    if (
      /^\/(?:[^?#]+\/)?\.well-known\/openid-configuration$/.test(path) ||
      /^\/(?:[^?#]+\/)?oauth2\/jwks$/.test(path)
    )
      return true;
    if (path === "/api/admin/dashboard") return true;
    if (path === "/actuator/health/readiness") return true;
    if (
      path === "/api/admin/settings/ciba-policy" ||
      path === "/api/admin/settings/offline-access" ||
      path === "/api/admin/settings/branding" ||
      path === "/api/admin/server-info" ||
      path === "/api/admin/settings/login" ||
      path === "/api/admin/settings/email" ||
      path === "/api/admin/settings/ldap" ||
      path === "/api/admin/settings/login/native"
    )
      return true;
    if (path === "/api/admin/settings/localization") return true;
    if (
      path === "/api/admin/authentication/bindings" ||
      path === "/api/admin/authentication/execution-providers"
    )
      return true;
    try {
      const url = new URL(path, "https://desktop.invalid");
      if (
        /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}\/native-policy$/.test(
          url.pathname,
        )
      )
        return (
          url.origin === "https://desktop.invalid" && !url.search && !url.hash
        );
      if (/^\/api\/admin\/clients\/[A-Za-z0-9_-]{1,100}$/.test(url.pathname))
        return (
          url.origin === "https://desktop.invalid" && !url.search && !url.hash
        );
      if (
        /^\/api\/admin\/clients\/[A-Za-z0-9_-]{1,100}\/native-metadata$/.test(
          url.pathname,
        )
      )
        return (
          url.origin === "https://desktop.invalid" && !url.search && !url.hash
        );
      const isUsers = url.pathname === "/api/admin/users";
      const isRoles = url.pathname === "/api/admin/roles";
      const roleDetailMatch =
        /^\/api\/admin\/roles\/(ROLE_[A-Z0-9_]{1,45})$/.exec(url.pathname);
      const roleCompositeCandidatesMatch =
        /^\/api\/admin\/roles\/(ROLE_[A-Z0-9_]{1,45})\/available-composites$/.exec(
          url.pathname,
        );
      const roleClientCompositeCandidatesMatch =
        /^\/api\/admin\/roles\/(ROLE_[A-Z0-9_]{1,45})\/available-client-composites$/.exec(
          url.pathname,
        );
      const clientRoleCompositeCandidatesMatch =
        /^\/api\/admin\/clients\/[A-Za-z0-9_-]{1,100}\/roles\/([1-9]\d*)\/available-(?:composites|realm-composites)$/.exec(
          url.pathname,
        );
      const isRoleDetail = Boolean(roleDetailMatch);
      const isRoleCompositeCandidates = Boolean(
        roleCompositeCandidatesMatch || roleClientCompositeCandidatesMatch,
      );
      const isGroups = url.pathname === "/api/admin/groups";
      const groupMemberSearchMatch =
        /^\/api\/admin\/groups\/([1-9]\d*)\/(?:users|available-users)$/.exec(
          url.pathname,
        );
      const isGroupMemberSearch = Boolean(
        groupMemberSearchMatch &&
        Number.isSafeInteger(Number(groupMemberSearchMatch[1])),
      );
      const isClientScopes = url.pathname === "/api/admin/client-scopes";
      const isClientScopeAssignments =
        /^\/api\/admin\/clients\/[A-Za-z0-9_-]{1,100}\/scope-assignments$/.test(
          url.pathname,
        );
      const isClientMappers =
        /^\/api\/admin\/clients\/[A-Za-z0-9_-]{1,100}\/mappers$/.test(
          url.pathname,
        );
      const isClientScopeRoleMappings =
        /^\/api\/admin\/client-scopes\/[A-Za-z0-9_-]{1,100}\/role-mappings$/.test(
          url.pathname,
        );
      const isClientScopeMappers =
        /^\/api\/admin\/client-scopes\/[A-Za-z0-9_-]{1,100}\/mappers$/.test(
          url.pathname,
        );
      const isClientScopeRoleCandidates =
        /^\/api\/admin\/client-scopes\/[A-Za-z0-9_-]{1,100}\/role-mappings\/(?:application-roles|client-roles)$/.test(
          url.pathname,
        );
      const isClients = url.pathname === "/api/admin/clients";
      const clientRoleListMatch =
        /^\/api\/admin\/clients\/([A-Za-z0-9_-]{1,100})\/roles$/.exec(
          url.pathname,
        );
      const isClientRoleList = Boolean(clientRoleListMatch);
      const isIdentityProviders =
        url.pathname === "/api/admin/identity-providers";
      const providerMappersMatch =
        /^\/api\/admin\/identity-providers\/([A-Za-z0-9_-]{1,100})\/mappers$/.exec(
          url.pathname,
        );
      const isProviderMappers = Boolean(providerMappersMatch);
      const isSessions = url.pathname === "/api/admin/sessions";
      const isConsents = url.pathname === "/api/admin/consents";
      const isOfflineSessions = url.pathname === "/api/admin/offline-sessions";
      const isEvents = url.pathname === "/api/admin/events";
      const isKeys = url.pathname === "/api/admin/keys";
      const isLocalizationMessages =
        url.pathname === "/api/admin/settings/localization/messages";
      const isAuthenticationFlows =
        url.pathname === "/api/admin/authentication/flows";
      if (
        isRoleDetail &&
        method === "GET" &&
        url.origin === "https://desktop.invalid" &&
        !url.search &&
        !url.hash
      )
        return true;
      const allowedParameters = new Set([
        "q",
        "page",
        "size",
        "sort",
        ...(isUsers ? ["enabled"] : []),
        ...(isLocalizationMessages ? ["locale", "bundle"] : []),
        ...(isSessions ? ["status"] : []),
        ...(isConsents ? ["clientId", "username", "scope"] : []),
        ...(isEvents ? ["action", "targetType", "targetId", "from", "to"] : []),
        ...(isKeys ? ["active"] : []),
      ]);
      const sortConfigurations = [
        {
          matches: isUsers,
          fields: ["username,asc", "username,desc"],
          defaultSort: "username,asc",
        },
        {
          matches: isClients,
          fields: [
            "clientId,asc",
            "clientId,desc",
            "clientName,asc",
            "clientName,desc",
          ],
          defaultSort: "clientId,asc",
        },
        {
          matches: isClientRoleList,
          fields: ["name,asc", "name,desc"],
          defaultSort: "name,asc",
        },
        {
          matches: isIdentityProviders,
          fields: ["guiOrder,asc", "guiOrder,desc"],
          defaultSort: "guiOrder,desc",
        },
        {
          matches: isSessions,
          fields: ["lastAccessTime,asc", "lastAccessTime,desc"],
          defaultSort: "lastAccessTime,desc",
        },
        {
          matches: isConsents,
          fields: ["id.principalName,asc", "id.principalName,desc"],
          defaultSort: "id.principalName,asc",
        },
        {
          matches: isOfflineSessions,
          fields: ["refreshTokenIssuedAt,asc", "refreshTokenIssuedAt,desc"],
          defaultSort: "refreshTokenIssuedAt,desc",
        },
        {
          matches: isEvents,
          fields: ["occurredAt,asc", "occurredAt,desc"],
          defaultSort: "occurredAt,desc",
        },
        {
          matches: isKeys,
          fields: ["createdAt,asc", "createdAt,desc"],
          defaultSort: "createdAt,desc",
        },
        {
          matches: isLocalizationMessages,
          fields: [
            "locale,asc",
            "locale,desc",
            "messageKey,asc",
            "messageKey,desc",
          ],
          defaultSort: "name,asc",
        },
        {
          matches: isAuthenticationFlows,
          fields: ["name,asc", "name,desc"],
          defaultSort: "name,asc",
        },
        {
          matches: isGroupMemberSearch,
          fields: ["username,asc", "username,desc"],
          defaultSort: "username,asc",
        },
      ];
      const sortConfiguration = sortConfigurations.find(
        ({ matches }) => matches,
      );
      const sortFields = sortConfiguration?.fields ?? ["name,asc", "name,desc"];
      return (
        (isUsers ||
          isRoles ||
          isRoleCompositeCandidates ||
          Boolean(clientRoleCompositeCandidatesMatch) ||
          isGroups ||
          isGroupMemberSearch ||
          isClientScopes ||
          isClientScopeAssignments ||
          isClientMappers ||
          isClientScopeRoleMappings ||
          isClientScopeMappers ||
          isClientScopeRoleCandidates ||
          isClients ||
          isClientRoleList ||
          isIdentityProviders ||
          isProviderMappers ||
          isSessions ||
          isConsents ||
          isOfflineSessions ||
          isEvents ||
          isKeys ||
          isLocalizationMessages ||
          isAuthenticationFlows) &&
        url.origin === "https://desktop.invalid" &&
        !url.hash &&
        (!isClientScopeAssignments || !url.search) &&
        [...url.searchParams.keys()].every((key) =>
          allowedParameters.has(key),
        ) &&
        (!isAuthenticationFlows || !url.searchParams.has("q")) &&
        (!isRoleCompositeCandidates ||
          (url.searchParams.get("page") === "0" &&
            url.searchParams.get("size") === "10" &&
            url.searchParams.get("sort") === "name,asc" &&
            (url.searchParams.get("q")?.length ?? 0) >= 2 &&
            (url.searchParams.get("q")?.length ?? 0) <= 100)) &&
        (!clientRoleCompositeCandidatesMatch ||
          (Number.isSafeInteger(
            Number(clientRoleCompositeCandidatesMatch[1]),
          ) &&
            url.searchParams.get("page") === "0" &&
            url.searchParams.get("size") === "10" &&
            url.searchParams.get("sort") === "name,asc" &&
            (url.searchParams.get("q")?.length ?? 0) >= 2 &&
            (url.searchParams.get("q")?.length ?? 0) <= 100)) &&
        [...allowedParameters].every(
          (key) => url.searchParams.getAll(key).length <= 1,
        ) &&
        (url.searchParams.get("q")?.length ?? 0) <= 200 &&
        (!isConsents ||
          ["clientId", "username", "scope"].every(
            (key) => (url.searchParams.get(key)?.length ?? 0) <= 100,
          )) &&
        (!isEvents ||
          ((url.searchParams.get("action")?.length ?? 0) <= 100 &&
            (url.searchParams.get("targetId")?.length ?? 0) <= 100 &&
            [
              "",
              "client",
              "user",
              "session",
              "consent",
              "key",
              "role",
              "client-scope",
            ].includes(url.searchParams.get("targetType") ?? "") &&
            ["from", "to"].every((key) => {
              const value = url.searchParams.get(key);
              return (
                value === null ||
                (value.length <= 64 &&
                  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
                    value,
                  ) &&
                  Number.isFinite(Date.parse(value)))
              );
            }))) &&
        (!isUsers ||
          !url.searchParams.has("enabled") ||
          ["true", "false"].includes(url.searchParams.get("enabled") ?? "")) &&
        (!isLocalizationMessages ||
          (/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(
            url.searchParams.get("locale") ?? "en",
          ) &&
            /^[A-Za-z0-9_-]{1,64}$/.test(
              url.searchParams.get("bundle") ?? "backend",
            ))) &&
        /^\d+$/.test(url.searchParams.get("page") ?? "0") &&
        Number(url.searchParams.get("page") ?? 0) <= 1_000_000 &&
        /^(?:[1-9]\d?|100)$/.test(url.searchParams.get("size") ?? "20") &&
        sortFields.includes(
          url.searchParams.get("sort") ??
            sortConfiguration?.defaultSort ??
            "name,asc",
        ) &&
        ["active", "expired"].includes(
          url.searchParams.get("status") ?? "active",
        ) &&
        (!isKeys ||
          ["", "true", "false"].includes(
            url.searchParams.get("active") ?? "true",
          ))
      );
    } catch {
      return false;
    }
  }
  return (
    namespace === "account" &&
    ACCOUNT_ALLOWED_PATHS.some(
      (prefix) => path === prefix || path.startsWith(prefix),
    )
  );
}

function parseJsonBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return Promise.resolve(null);
  return response.json().catch(() => null);
}

function tokenResponseToSession(
  value: TokenResponse,
  previous: DesktopSession,
): DesktopSession | null {
  if (
    typeof value.access_token !== "string" ||
    typeof value.expires_in !== "number" ||
    !Number.isFinite(value.expires_in) ||
    value.expires_in <= 0
  ) {
    return null;
  }
  return {
    accessToken: value.access_token,
    expiresAt: Date.now() + value.expires_in * 1000,
    idToken:
      typeof value.id_token === "string" ? value.id_token : previous.idToken,
    refreshToken:
      typeof value.refresh_token === "string"
        ? value.refresh_token
        : previous.refreshToken,
    version: 1,
  };
}

function avatarFormData(body: unknown) {
  if (!body || typeof body !== "object")
    throw new Error("Invalid native avatar payload");
  const payload = body as Record<string, unknown>;
  if (
    Object.keys(payload).length !== 2 ||
    !["image/jpeg", "image/png"].includes(String(payload.contentType)) ||
    typeof payload.dataBase64 !== "string" ||
    payload.dataBase64.length > 2_796_204 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      payload.dataBase64,
    )
  )
    throw new Error("Invalid native avatar payload");
  const bytes = Buffer.from(payload.dataBase64, "base64");
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > 2 * 1024 * 1024 ||
    bytes.toString("base64") !== payload.dataBase64
  )
    throw new Error("Invalid native avatar payload");
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: String(payload.contentType) }),
    String(payload.contentType) === "image/png" ? "avatar.png" : "avatar.jpg",
  );
  return form;
}

export function createDesktopApiAdapter(options: AdapterOptions) {
  const fetcher = options.fetcher ?? ((...args) => globalThis.fetch(...args));
  const timeoutMs = options.timeoutMs ?? 10_000;
  const refreshFlights = new Map<
    NativeSessionNamespace,
    ReturnType<typeof createSingleFlight<string | null>>
  >();

  function refreshFlight(namespace: NativeSessionNamespace) {
    let flight = refreshFlights.get(namespace);
    if (!flight) {
      flight = createSingleFlight<string | null>();
      refreshFlights.set(namespace, flight);
    }
    return flight;
  }

  async function refresh(namespace: NativeSessionNamespace) {
    return refreshFlight(namespace).run(async () => {
      const current = await options.readSession(namespace);
      if (!current?.refreshToken) {
        await options.clearSession(namespace);
        return null;
      }
      try {
        const response = await fetcher(`${options.apiBaseUrl}/oauth2/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: CLIENT_IDS[namespace],
            grant_type: "refresh_token",
            refresh_token: current.refreshToken,
          }),
        });
        if (!response.ok) throw new Error("refresh_failed");
        const next = tokenResponseToSession(
          (await response.json()) as TokenResponse,
          current,
        );
        if (!next) throw new Error("invalid_refresh_response");
        await options.writeSession(namespace, next);
        return next.accessToken;
      } catch {
        await options.clearSession(namespace);
        return null;
      }
    });
  }

  async function send(
    request: NativeApiRequest,
    accessToken: string,
  ): Promise<NativeApiResponse> {
    const method = request.method ?? "GET";
    const avatarUpload =
      method === "PUT" &&
      /^\/api\/admin\/users\/[1-9]\d*\/avatar$/.test(request.path);
    let body: FormData | string | undefined;
    if (avatarUpload) {
      body = avatarFormData(request.body);
    } else if (request.body !== undefined) {
      body = JSON.stringify(request.body);
    }
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetcher(`${options.apiBaseUrl}${request.path}`, {
        method,
        headers: {
          Accept: "application/json",
          "Accept-Language": request.locale === "tr" ? "tr" : "en",
          Authorization: `Bearer ${accessToken}`,
          ...(request.body === undefined || avatarUpload
            ? {}
            : { "Content-Type": "application/json" }),
        },
        body,
        signal: controller.signal,
      });
      return {
        status: response.status,
        kind: response.ok ? null : classifyApiError(response.status),
        body: await parseJsonBody(response),
      };
    } catch (cause) {
      const transportError = timedOut
        ? Object.assign(new Error("Request timed out"), {
            name: "TimeoutError",
          })
        : cause;
      return {
        status: 0,
        kind: classifyApiError(0, transportError),
        body: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async request(request: NativeApiRequest): Promise<NativeApiResponse> {
      if (
        request.console === "admin" &&
        request.method === "POST" &&
        /^\/api\/admin\/roles\/ROLE_[A-Z0-9_]{1,45}\/users(?:\?|$)/.test(
          request.path,
        )
      ) {
        const body = request.body as Record<string, unknown> | null;
        if (
          !body ||
          typeof body !== "object" ||
          Array.isArray(body) ||
          Object.keys(body).length !== 1 ||
          typeof body.userId !== "number" ||
          !Number.isSafeInteger(body.userId) ||
          body.userId <= 0
        )
          throw new Error("Invalid role user assignment");
      }
      if (
        !request.path.startsWith("/") ||
        !isAllowedApiPath(
          request.console,
          request.method ?? "GET",
          request.path,
        )
      ) {
        throw new Error("Native API path is not allowed");
      }
      const namespace = request.console;
      const current = await options.readSession(namespace);
      if (!current) {
        return { status: 401, kind: "unauthorized", body: null };
      }
      let response = await send(request, current.accessToken);
      if (response.status !== 401) return response;
      const accessToken = await refresh(namespace);
      if (!accessToken) {
        return { status: 401, kind: "unauthorized", body: null };
      }
      response = await send(request, accessToken);
      if (response.status === 401) await options.clearSession(namespace);
      return response;
    },
  };
}
