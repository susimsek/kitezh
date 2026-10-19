// Desktop owns organization presentation and uses only the authenticated API bridge.
export function organizationPage(response, defaultSize = 10) {
  const content = Array.isArray(response?.content) ? response.content : [];
  const metadata = response?.page ?? response ?? {};
  const count = (value, fallback) =>
    Number.isSafeInteger(value) && value >= 0 ? value : fallback;
  const size = count(metadata.size, defaultSize) || defaultSize;
  const totalElements = count(metadata.totalElements, content.length);
  return {
    content,
    size,
    number: count(metadata.number, 0),
    totalElements,
    totalPages: count(metadata.totalPages, Math.ceil(totalElements / size)),
  };
}

export function createOrganizationScreens({
  state,
  text,
  escapeHtml: esc,
  button,
  icon,
  spin,
  violations,
  render,
  request,
  loadRoute,
}) {
  const data = state.data;
  let generation = 0;
  let searchTimer;
  let popstateBound = false;
  const validPageSizes = [10, 20, 50, 100];
  const canView = () =>
    data.adminAccess?.queryOrganizations === true ||
    data.adminAccess?.viewOrganizations === true;
  const canManage = () =>
    data.adminAccess?.manageOrganizations === true ||
    data.adminAccess?.isAdmin === true;
  const blocked = () => state.offline || Boolean(state.busy);

  function searchParams() {
    return new URLSearchParams({
      q: data.organizationQuery ?? "",
      page: String(data.organizationPage ?? 0),
      size: String(data.organizationSize ?? 10),
      sort: data.organizationSort ?? "name,asc",
    });
  }

  function syncUrl(replace = false) {
    const path =
      state.route === "organization-create"
        ? "/admin/organizations/new"
        : state.route === "organization-detail"
          ? `/admin/organizations/${data.organizationDetailId}`
          : "/admin/organizations";
    const query =
      state.route === "organizations" ? `?${searchParams().toString()}` : "";
    const hash = `#${path}${query}`;
    if (window.location.hash === hash) return;
    window.history[replace ? "replaceState" : "pushState"](null, "", hash);
  }

  function restoreUrl() {
    if (state.console !== "admin") return false;
    const url = new URL(
      window.location.hash.slice(1) || "/",
      "https://native.invalid",
    );
    if (!/^\/admin\/organizations(?:\/new|\/[1-9]\d*)?$/.test(url.pathname))
      return false;
    const detailMatch = /^\/admin\/organizations\/([1-9]\d*)$/.exec(
      url.pathname,
    );
    const detailId = detailMatch ? Number(detailMatch[1]) : null;
    if (detailMatch && !Number.isSafeInteger(detailId)) return false;
    state.route = url.pathname.endsWith("/new")
      ? "organization-create"
      : detailMatch
        ? "organization-detail"
        : "organizations";
    if (detailId !== null) data.organizationDetailId = detailId;
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 10);
    const sort = url.searchParams.get("sort");
    data.organizationQuery = (url.searchParams.get("q") ?? "").slice(0, 200);
    data.organizationSearchDraft = data.organizationQuery;
    data.organizationPage =
      Number.isSafeInteger(page) && page >= 0 && page <= 1_000_000 ? page : 0;
    data.organizationSize = validPageSizes.includes(size) ? size : 10;
    data.organizationSort = ["name,asc", "name,desc"].includes(sort)
      ? sort
      : "name,asc";
    if (state.route === "organization-create") {
      data.organizationCreate ??= emptyDraft();
      data.organizationFieldErrors ??= {};
    }
    return true;
  }

  function emptyDraft() {
    return {
      alias: "",
      name: "",
      displayName: "",
      description: "",
      enabled: true,
    };
  }

  async function load() {
    if (state.route === "organization-detail") {
      const id = data.organizationDetailId;
      if (!Number.isSafeInteger(id) || id < 1) {
        data.organizationDetailLoadError = true;
        return;
      }
      try {
        const base = `/api/admin/organizations/${id}`;
        const [
          organization,
          members,
          domains,
          invitations,
          groups,
          claims,
          providers,
        ] = await Promise.all([
          request(base),
          request(`${base}/members?page=0&size=20&sort=user.username,asc`),
          request(`${base}/domains`),
          request(`${base}/invitations?page=0&size=20&sort=createdAt,desc`),
          request(`${base}/groups?page=0&size=20&sort=name,asc`),
          request(`${base}/claims`),
          request(`${base}/identity-providers`),
        ]);
        data.organizationDetail = organization;
        data.organizationMembers = organizationPage(members, 20).content;
        data.organizationDomains = Array.isArray(domains) ? domains : [];
        data.organizationInvitations = organizationPage(
          invitations,
          20,
        ).content;
        data.organizationGroups = organizationPage(groups, 20).content;
        data.organizationClaims = Array.isArray(claims) ? claims : [];
        data.organizationProviders = Array.isArray(providers) ? providers : [];
        data.organizationDetailLoadError = false;
      } catch {
        data.organizationDetail = null;
        data.organizationDetailLoadError = true;
      }
      return;
    }
    if (state.route !== "organizations") return;
    const currentGeneration = ++generation;
    const route = state.route;
    const params = searchParams();
    data.organizationLoadError = false;
    try {
      const response = await request(
        `/api/admin/organizations?${params.toString()}`,
        {
          isCurrent: () =>
            currentGeneration === generation && route === state.route,
        },
      );
      if (currentGeneration !== generation || route !== state.route) return;
      data.organizations = organizationPage(
        response,
        Number(params.get("size")),
      );
      data.organizationLoadError = false;
    } catch {
      if (currentGeneration === generation && route === state.route)
        data.organizationLoadError = true;
    }
  }

  function list() {
    const page = organizationPage(
      data.organizations,
      data.organizationSize ?? 10,
    );
    const query = data.organizationSearchDraft ?? data.organizationQuery ?? "";
    const sort = data.organizationSort ?? "name,asc";
    const rows = page.content
      .map((organization) => {
        const enabled = organization.enabled === true;
        return `<tr><td data-label="${esc(text("adminOrganizationName"))}"><button type="button" class="organization-detail-link" data-action="organization-open" data-id="${esc(organization.id)}" ${blocked() ? "disabled" : ""}>${esc(organization.displayName || organization.name || "—")}</button></td><td data-label="${esc(text("adminOrganizationAlias"))}">${esc(organization.alias || "—")}</td><td data-label="${esc(text("adminOrganizationMembers"))}">${Number.isSafeInteger(organization.memberCount) ? organization.memberCount : 0}</td><td data-label="${esc(text("adminOrganizationDomains"))}">${Number.isSafeInteger(organization.domainCount) ? organization.domainCount : 0}</td><td data-label="${esc(text("adminOrganizationGroups"))}">${Number.isSafeInteger(organization.groupCount) ? organization.groupCount : 0}</td><td data-label="${esc(text("adminOrganizationStatus"))}"><span class="admin-user-status ${enabled ? "is-enabled" : "is-disabled"}">${esc(text(enabled ? "adminOrganizationEnabled" : "adminOrganizationDisabled"))}</span></td></tr>`;
      })
      .join("");
    const control = (target, key, label, disabled) =>
      button(text(label), {
        action: "organization-page",
        target,
        icon: key,
        variant: "secondary",
        busy: state.busy === `organization-page:${target}`,
        disabled: disabled || blocked(),
      });
    const pagination =
      page.totalElements > 0
        ? `<div class="admin-users-pagination organization-pagination"><div class="admin-pagination-summary">${page.number * page.size + 1}–${Math.min((page.number + 1) * page.size, page.totalElements)} / ${page.totalElements}</div><div class="admin-pagination-controls">${control(0, "firstPage", "adminOrganizationFirst", page.number === 0)}${control(Math.max(0, page.number - 1), "previousPage", "adminPrevious", page.number === 0)}<span>${esc(text("adminPage"))} ${page.number + 1} / ${Math.max(1, page.totalPages)}</span>${control(Math.min(page.totalPages - 1, page.number + 1), "nextPage", "adminNext", page.number + 1 >= page.totalPages)}${control(Math.max(0, page.totalPages - 1), "lastPage", "adminOrganizationLast", page.number + 1 >= page.totalPages)}<label for="organization-size">${esc(text("adminRowsPerPage"))}</label><select id="organization-size" ${blocked() ? "disabled" : ""}>${validPageSizes.map((size) => `<option value="${size}" ${size === page.size ? "selected" : ""}>${size}</option>`).join("")}</select></div></div>`
        : "";
    const error =
      data.organizationLoadError && canView()
        ? `<div class="notice error" role="alert">${esc(text("adminOrganizationLoadError"))}${button(text("adminRetry"), { action: "organization-retry", busy: state.busy === "organization-retry", disabled: blocked() })}</div>`
        : "";
    return `<section class="admin-users-panel organization-panel"><form id="organization-search" role="search" class="admin-users-toolbar organization-filters" aria-busy="${state.busy === "organization-search"}"><label class="sr-only" for="organization-query">${esc(text("adminOrganizationSearch"))}</label><div class="admin-users-search">${icon("search")}<input id="organization-query" name="q" type="search" maxlength="200" value="${esc(query)}" placeholder="${esc(text("adminOrganizationSearch"))}" ${blocked() ? "disabled" : ""}/>${spin(state.busy === "organization-search")}</div><label class="sr-only" for="organization-sort">${esc(text("adminSort"))}</label><select id="organization-sort" ${blocked() ? "disabled" : ""}><option value="name,asc" ${sort === "name,asc" ? "selected" : ""}>${esc(text("adminOrganizationNameAsc"))}</option><option value="name,desc" ${sort === "name,desc" ? "selected" : ""}>${esc(text("adminOrganizationNameDesc"))}</option></select></form>${error}<div class="admin-users-count">${page.totalElements} ${esc(text("adminOrganizationRecords"))}${data.organizationQuery ? `<span class="group-active-filter">${esc(data.organizationQuery)}</span>${button(text("adminClearFilters"), { action: "organization-clear", variant: "secondary", icon: "cancel", disabled: blocked() })}` : ""}</div><div class="admin-users-table-wrap"><table class="admin-users-table organization-table"><thead><tr><th scope="col">${esc(text("adminOrganizationName"))}</th><th scope="col">${esc(text("adminOrganizationAlias"))}</th><th scope="col">${esc(text("adminOrganizationMembers"))}</th><th scope="col">${esc(text("adminOrganizationDomains"))}</th><th scope="col">${esc(text("adminOrganizationGroups"))}</th><th scope="col">${esc(text("adminOrganizationStatus"))}</th></tr></thead><tbody>${rows || `<tr><td colspan="6"><div class="empty" role="status">${esc(text("adminOrganizationEmpty"))}</div></td></tr>`}</tbody></table></div>${pagination}</section>`;
  }

  function create() {
    const draft = data.organizationCreate ?? emptyDraft();
    const errors = data.organizationFieldErrors ?? {};
    const disabled = !canManage() || blocked();
    const field = (name, labelKey, type = "text", maxlength) =>
      `<div class="field"><label for="organization-${name}">${esc(text(labelKey))}</label><input id="organization-${name}" name="${name}" type="${type}" value="${esc(draft[name] ?? "")}" ${maxlength ? `maxlength="${maxlength}"` : ""} ${["alias", "name"].includes(name) ? "required" : ""} aria-invalid="${Boolean(errors[name])}" aria-describedby="organization-${name}-error" ${disabled ? "disabled" : ""}/><div class="field-error" id="organization-${name}-error" role="alert">${esc(errors[name] ?? "")}</div></div>`;
    return `<section class="card organization-create-card"><form data-form="organization-create" novalidate><div class="organization-create-fields">${field("alias", "adminOrganizationAlias", "text", 100)}${field("name", "adminOrganizationName", "text", 200)}${field("displayName", "adminOrganizationDisplayName", "text", 200)}<div class="field"><label for="organization-description">${esc(text("adminOrganizationDescription"))}</label><textarea id="organization-description" name="description" rows="3" maxlength="2000" aria-invalid="${Boolean(errors.description)}" aria-describedby="organization-description-error" ${disabled ? "disabled" : ""}>${esc(draft.description ?? "")}</textarea><div class="field-error" id="organization-description-error" role="alert">${esc(errors.description ?? "")}</div></div></div><label class="admin-user-detail-switch organization-enabled"><input name="enabled" type="checkbox" ${draft.enabled ? "checked" : ""} ${disabled ? "disabled" : ""}/><span class="admin-user-detail-switch-control" aria-hidden="true"></span><span>${esc(text("adminOrganizationEnabled"))}</span></label><div class="actions">${button(text("adminOrganizationCancel"), { action: "organization-cancel", icon: "cancel", className: "secondary-button organization-cancel-button", disabled: Boolean(state.busy) })}${button(text("adminOrganizationCreate"), { type: "submit", icon: "add", busy: state.busy === "organization-create", disabled })}</div></form></section>`;
  }

  function breadcrumb() {
    if (state.route === "organization-detail") {
      const organization = data.organizationDetail;
      return `<nav class="admin-user-detail-breadcrumb organization-breadcrumb" aria-label="${esc(text("adminOrganizationBreadcrumb"))}"><a href="#/admin/organizations" data-action="organization-cancel">${esc(text("adminOrganizationTitle"))}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(organization?.displayName || organization?.name || text("adminOrganizationDetailTitle"))}</span></nav>`;
    }
    return `<nav class="admin-user-detail-breadcrumb organization-breadcrumb" aria-label="${esc(text("adminOrganizationBreadcrumb"))}"><a href="#/admin/organizations" data-action="organization-cancel">${esc(text("adminOrganizationTitle"))}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(text("adminOrganizationCreateTitle"))}</span></nav>`;
  }

  function detail() {
    const organization = data.organizationDetail;
    if (!organization || data.organizationDetailLoadError)
      return `<section class="card organization-detail-card"><p role="alert">${esc(text("adminOrganizationDetailLoadError"))}</p>${button(text("adminRetry"), { action: "organization-retry", busy: state.busy === "organization-retry", disabled: blocked(), variant: "secondary", icon: "reset" })}</section>`;
    const canEdit = canManage() && !blocked();
    const draft = data.organizationDetailDraft ?? {};
    const errors = data.organizationDetailErrors ?? {};
    const rows = (items, columns) =>
      `<div class="organization-detail-table-wrap"><table class="organization-detail-table"><thead><tr>${columns.map((column) => `<th scope="col">${esc(text(column.label))}</th>`).join("")}</tr></thead><tbody>${items.map((item) => `<tr>${columns.map((column) => `<td>${column.value(item)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    const field = (name, key, options = {}) => {
      const type = options.type ?? "text";
      return `<div class="organization-detail-field"><input name="${esc(name)}" type="${type}" maxlength="${options.maxlength}" placeholder="${esc(text(key))}" value="${esc(draft[name] ?? "")}" aria-label="${esc(text(key))}" aria-invalid="${Boolean(errors[name])}" aria-describedby="organization-detail-${name}-error" ${canEdit ? "" : "disabled"}/><div class="field-error" id="organization-detail-${name}-error" role="alert">${esc(errors[name] ?? "")}</div></div>`;
    };
    const roleSelect = `<div class="organization-detail-role-field"><select name="role" aria-label="${esc(text("adminOrganizationMemberRole"))}" aria-invalid="${Boolean(errors.role)}" aria-describedby="organization-detail-role-error" ${canEdit ? "" : "disabled"}><option value="MEMBER" ${(draft.role ?? "MEMBER") === "MEMBER" ? "selected" : ""}>MEMBER</option><option value="ADMIN" ${draft.role === "ADMIN" ? "selected" : ""}>ADMIN</option><option value="OWNER" ${draft.role === "OWNER" ? "selected" : ""}>OWNER</option></select><div class="field-error" id="organization-detail-role-error" role="alert">${esc(errors.role ?? "")}</div></div>`;
    const form = (key, content, labelKey, extraClass = "") =>
      canManage()
        ? `<form data-organization-form="${key}" class="organization-detail-form ${extraClass}" novalidate>${content}${button(text(labelKey), { type: "submit", icon: "add", busy: state.busy === `organization-mutation:${key}`, disabled: blocked() })}</form>`
        : "";
    const section = (title, content) =>
      `<section class="card organization-detail-section"><h2>${esc(text(title))}</h2>${content}</section>`;
    const memberForm = form(
      "member",
      `${field("userId", "adminOrganizationUserId", { type: "number", maxlength: 16 })}${roleSelect}`,
      "adminOrganizationAddMember",
    );
    const domainForm = form(
      "domain",
      field("domain", "adminOrganizationDomain", { maxlength: 255 }),
      "adminOrganizationAddDomain",
    );
    const invitationForm = form(
      "invitation",
      `${field("email", "adminOrganizationInviteEmail", { type: "email", maxlength: 254 })}${roleSelect}`,
      "adminOrganizationInvite",
    );
    const groupForm = form(
      "group",
      field("name", "adminOrganizationGroupName", { maxlength: 100 }),
      "adminOrganizationAddGroup",
    );
    const claimForm = form(
      "claim",
      `${field("claimName", "adminOrganizationClaimName", { maxlength: 200 })}${field("claimValue", "adminOrganizationClaimValue", { maxlength: 2000 })}`,
      "adminOrganizationAddClaim",
      "is-stacked",
    );
    const providerForm = form(
      "provider",
      field("providerAlias", "adminOrganizationProviderAlias", {
        maxlength: 100,
      }),
      "adminOrganizationLinkProvider",
    );
    const memberRows = (data.organizationMembers ?? []).map((member) => ({
      ...member,
      username: esc(member.username ?? "—"),
      role: esc(member.role ?? "—"),
    }));
    const domainRows = (data.organizationDomains ?? []).map((domain) => ({
      ...domain,
      domain: esc(domain.domain ?? "—"),
      verifiedLabel: esc(domain.verified ? "✓" : "—"),
      action:
        canManage() && !domain.verified
          ? button(text("adminOrganizationVerify"), {
              action: "organization-domain-verify",
              id: domain.id,
              busy: state.busy === `organization-mutation:verify:${domain.id}`,
              disabled: blocked(),
              className: "primary-button small-button",
            })
          : "",
    }));
    const invitationRows = (data.organizationInvitations ?? []).map(
      (invitation) => ({
        ...invitation,
        email: esc(invitation.email ?? "—"),
        role: esc(invitation.role ?? "—"),
        status: esc(
          invitation.revokedAt ? text("adminOrganizationRevoked") : "",
        ),
      }),
    );
    const groupRows = (data.organizationGroups ?? []).map((group) => ({
      ...group,
      name: esc(group.name ?? "—"),
      memberCount: Number.isSafeInteger(group.memberCount)
        ? group.memberCount
        : 0,
    }));
    const claimRows = (data.organizationClaims ?? []).map((claim) => ({
      ...claim,
      claimName: esc(claim.claimName ?? "—"),
      claimValue: esc(claim.claimValue ?? "—"),
    }));
    const providerRows = (data.organizationProviders ?? []).map((provider) => ({
      ...provider,
      displayName: esc(provider.displayName || provider.providerAlias || "—"),
      enabledLabel: esc(provider.enabled ? "✓" : "—"),
    }));
    const alert = data.organizationMutationError
      ? `<p role="alert" class="notice error organization-detail-error">${esc(text("adminOrganizationOperationError"))}</p>`
      : "";
    return `${alert}<div class="organization-detail-grid">${section(
      "adminOrganizationMembers",
      `${memberForm}${rows(memberRows, [
        { label: "adminOrganizationUsername", value: (item) => item.username },
        { label: "adminOrganizationMemberRole", value: (item) => item.role },
        {
          label: "adminOrganizationActions",
          value: (item) =>
            canManage()
              ? button(text("adminOrganizationRemoveMember"), {
                  action: "organization-member-remove",
                  id: item.userId,
                  busy:
                    state.busy ===
                    `organization-mutation:remove:${item.userId}`,
                  disabled: blocked(),
                  danger: true,
                  className: "danger-button small-button",
                })
              : "",
        },
      ])}`,
    )}${section(
      "adminOrganizationDomains",
      `${domainForm}${rows(domainRows, [
        { label: "adminOrganizationDomain", value: (item) => item.domain },
        {
          label: "adminOrganizationVerified",
          value: (item) => item.verifiedLabel,
        },
        { label: "adminOrganizationActions", value: (item) => item.action },
      ])}`,
    )}${section(
      "adminOrganizationInvitations",
      `${invitationForm}${rows(invitationRows, [
        { label: "adminOrganizationInviteEmail", value: (item) => item.email },
        { label: "adminOrganizationMemberRole", value: (item) => item.role },
        { label: "adminOrganizationStatus", value: (item) => item.status },
      ])}`,
    )}${section(
      "adminOrganizationGroups",
      `${groupForm}${rows(groupRows, [
        { label: "adminOrganizationGroupName", value: (item) => item.name },
        {
          label: "adminOrganizationMembers",
          value: (item) => item.memberCount,
        },
      ])}`,
    )}${section(
      "adminOrganizationClaims",
      `${claimForm}${rows(claimRows, [
        {
          label: "adminOrganizationClaimName",
          value: (item) => item.claimName,
        },
        {
          label: "adminOrganizationClaimValue",
          value: (item) => item.claimValue,
        },
      ])}`,
    )}${section(
      "adminOrganizationProviders",
      `${providerForm}${rows(providerRows, [
        {
          label: "adminOrganizationProviderAlias",
          value: (item) => item.displayName,
        },
        {
          label: "adminOrganizationEnabled",
          value: (item) => item.enabledLabel,
        },
      ])}`,
    )}</div>`;
  }

  async function reload(busy, keepContent = false) {
    if (blocked()) return;
    state.busy = busy;
    state.error = null;
    render();
    try {
      await loadRoute({ keepContent });
    } finally {
      if (state.busy === busy) state.busy = null;
      render();
    }
  }

  async function openCreate() {
    if (blocked() || !canManage()) return;
    data.organizationCreate = emptyDraft();
    data.organizationFieldErrors = {};
    state.route = "organization-create";
    state.notice = null;
    syncUrl();
    await reload("organization-create-route", true);
    document.getElementById("organization-alias")?.focus();
  }

  async function submit(form) {
    if (blocked() || !canManage()) return;
    const values = Object.fromEntries(new FormData(form));
    const draft = {
      alias: String(values.alias ?? "").trim(),
      name: String(values.name ?? "").trim(),
      displayName: String(values.displayName ?? "").trim(),
      description: String(values.description ?? "").trim(),
      enabled: values.enabled === "on",
    };
    data.organizationCreate = draft;
    const errors = {};
    if (!draft.alias) errors.alias = text("adminOrganizationRequired");
    else if (
      draft.alias.length > 100 ||
      !/^[a-z0-9][a-z0-9-]*$/.test(draft.alias)
    )
      errors.alias = text("adminOrganizationAliasInvalid");
    if (!draft.name) errors.name = text("adminOrganizationRequired");
    else if (draft.name.length > 200)
      errors.name = text("adminOrganizationNameTooLong");
    if (draft.displayName.length > 200)
      errors.displayName = text("adminOrganizationDisplayTooLong");
    if (draft.description.length > 2000)
      errors.description = text("adminOrganizationDescriptionTooLong");
    if (Object.keys(errors).length) {
      data.organizationFieldErrors = errors;
      render();
      return;
    }
    data.organizationFieldErrors = {};
    state.busy = "organization-create";
    state.error = null;
    state.notice = null;
    render();
    try {
      const response = await request("/api/admin/organizations", {
        method: "POST",
        body: draft,
      });
      if (!Number.isSafeInteger(response?.id) || response.id < 1)
        throw new Error("Invalid organization create response");
      state.route = "organization-detail";
      data.organizationDetailId = response.id;
      data.organizationDetail = response;
      data.organizationDetailLoadError = false;
      data.organizationQuery = "";
      data.organizationSearchDraft = "";
      data.organizationPage = 0;
      state.notice = text("adminOrganizationCreated");
      syncUrl();
      await loadRoute();
    } catch {
      const fieldErrors = violations(state.error?.body);
      data.organizationFieldErrors = Object.fromEntries(
        ["alias", "name", "displayName", "description"].flatMap((key) =>
          fieldErrors[key] ? [[key, fieldErrors[key]]] : [],
        ),
      );
    } finally {
      state.busy = null;
      render();
    }
  }

  async function mutate(path, method = "POST", body, busyKey, draftKey) {
    if (blocked() || !canManage()) return;
    state.busy = `organization-mutation:${busyKey}`;
    state.error = null;
    data.organizationMutationError = false;
    render();
    try {
      await request(path, { method, ...(body === undefined ? {} : { body }) });
      if (draftKey) {
        data.organizationDetailDraft ??= {};
        const fields = {
          member: ["userId", "role"],
          domain: ["domain"],
          invitation: ["email", "role"],
          group: ["name"],
          claim: ["claimName", "claimValue"],
          provider: ["providerAlias"],
        }[draftKey] ?? [draftKey];
        for (const fieldName of fields)
          delete data.organizationDetailDraft[fieldName];
        if (["member", "invitation"].includes(draftKey))
          data.organizationDetailDraft.role = "MEMBER";
      }
      data.organizationDetailErrors = {};
      await loadRoute({ keepContent: true });
    } catch {
      const fieldErrors = violations(state.error?.body);
      const allowedFields = [
        "userId",
        "role",
        "domain",
        "email",
        "name",
        "claimName",
        "claimValue",
        "providerAlias",
      ];
      data.organizationDetailErrors = Object.fromEntries(
        allowedFields.flatMap((fieldName) =>
          fieldErrors[fieldName] ? [[fieldName, fieldErrors[fieldName]]] : [],
        ),
      );
      data.organizationMutationError =
        Object.keys(data.organizationDetailErrors).length === 0;
      state.error = null;
    } finally {
      state.busy = null;
      render();
    }
  }

  function submitDetailForm(form) {
    if (blocked() || !canManage()) return;
    const kind = form.dataset.organizationForm;
    const values = Object.fromEntries(new FormData(form));
    const draft = (data.organizationDetailDraft ??= {});
    for (const [key, value] of Object.entries(values))
      draft[key] = String(value);
    const errors = {};
    const required = (key) => {
      const value = String(values[key] ?? "").trim();
      if (!value) errors[key] = text("adminOrganizationRequired");
      return value;
    };
    const id = data.organizationDetailId;
    if (kind === "member") {
      const userId = Number(required("userId"));
      if (!errors.userId && (!Number.isSafeInteger(userId) || userId < 1))
        errors.userId = text("adminOrganizationUserIdInvalid");
      if (!["OWNER", "ADMIN", "MEMBER"].includes(values.role))
        errors.role = text("adminOrganizationRoleInvalid");
      if (!errors.userId && !errors.role)
        void mutate(
          `/api/admin/organizations/${id}/members`,
          "POST",
          { userId, role: values.role },
          kind,
          kind,
        );
    } else if (kind === "domain") {
      const domain = required("domain");
      if (!errors.domain && domain.length > 255)
        errors.domain = text("adminOrganizationDomainTooLong");
      if (!errors.domain)
        void mutate(
          `/api/admin/organizations/${id}/domains`,
          "POST",
          { domain },
          kind,
          kind,
        );
    } else if (kind === "invitation") {
      const email = required("email").trim();
      if (
        !errors.email &&
        (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      )
        errors.email = text("adminOrganizationEmailInvalid");
      if (!["OWNER", "ADMIN", "MEMBER"].includes(values.role))
        errors.role = text("adminOrganizationRoleInvalid");
      if (!errors.email && !errors.role)
        void mutate(
          `/api/admin/organizations/${id}/invitations`,
          "POST",
          { email, role: values.role },
          kind,
          kind,
        );
    } else if (kind === "group") {
      const name = required("name");
      if (!errors.name && name.length > 100)
        errors.name = text("adminOrganizationGroupTooLong");
      if (!errors.name)
        void mutate(
          `/api/admin/organizations/${id}/groups`,
          "POST",
          { name },
          kind,
          kind,
        );
    } else if (kind === "claim") {
      const claimName = required("claimName");
      const claimValue = required("claimValue");
      if (!errors.claimName && claimName.length > 200)
        errors.claimName = text("adminOrganizationClaimNameTooLong");
      if (!errors.claimValue && claimValue.length > 2000)
        errors.claimValue = text("adminOrganizationClaimValueTooLong");
      if (!Object.keys(errors).length)
        void mutate(
          `/api/admin/organizations/${id}/claims`,
          "POST",
          { claimName, claimValue, addToAccessToken: true },
          kind,
          kind,
        );
    } else if (kind === "provider") {
      const providerAlias = required("providerAlias");
      if (!errors.providerAlias && providerAlias.length > 100)
        errors.providerAlias = text("adminOrganizationProviderAliasTooLong");
      if (!errors.providerAlias)
        void mutate(
          `/api/admin/organizations/${id}/identity-providers`,
          "POST",
          { providerAlias },
          kind,
          kind,
        );
    }
    data.organizationDetailErrors = errors;
    if (Object.keys(errors).length) render();
  }

  async function handle(name, element) {
    if (name === "create-organization") await openCreate();
    else if (name === "organization-open") {
      if (blocked()) return;
      const id = Number(element.dataset.id);
      if (!Number.isSafeInteger(id) || id < 1) return;
      data.organizationDetailId = id;
      data.organizationDetail = null;
      data.organizationDetailLoadError = false;
      state.route = "organization-detail";
      state.notice = null;
      syncUrl();
      await reload("organization-detail-route");
    } else if (name === "organization-cancel") {
      if (blocked()) return;
      state.route = "organizations";
      state.notice = null;
      syncUrl();
      await reload("organization-read-back", true);
    } else if (name === "organization-retry") {
      await reload("organization-retry", true);
    } else if (name === "organization-member-remove") {
      const userId = Number(element.dataset.id);
      if (Number.isSafeInteger(userId) && userId > 0)
        await mutate(
          `/api/admin/organizations/${data.organizationDetailId}/members/${userId}`,
          "DELETE",
          undefined,
          `remove:${userId}`,
        );
    } else if (name === "organization-domain-verify") {
      const domainId = Number(element.dataset.id);
      if (Number.isSafeInteger(domainId) && domainId > 0)
        await mutate(
          `/api/admin/organizations/${data.organizationDetailId}/domains/${domainId}/verify`,
          "POST",
          {},
          `verify:${domainId}`,
        );
    } else if (name === "organization-clear") {
      if (blocked()) return;
      data.organizationQuery = "";
      data.organizationSearchDraft = "";
      data.organizationPage = 0;
      syncUrl();
      await reload("organization-clear", true);
    } else if (name === "organization-page") {
      if (blocked()) return;
      const target = Number(element.dataset.target);
      const page = organizationPage(
        data.organizations,
        data.organizationSize ?? 10,
      );
      if (
        !Number.isSafeInteger(target) ||
        target < 0 ||
        target >= page.totalPages
      )
        return;
      data.organizationPage = target;
      syncUrl();
      await reload(`organization-page:${target}`, true);
    } else return false;
    return true;
  }

  async function search() {
    if (state.route !== "organizations" || state.offline) return;
    if (state.busy) {
      scheduleSearch(100);
      return;
    }
    const query = String(data.organizationSearchDraft ?? "")
      .trim()
      .slice(0, 200);
    if (query === (data.organizationQuery ?? "")) return;
    data.organizationQuery = query;
    data.organizationPage = 0;
    syncUrl();
    await reload("organization-search", true);
  }

  function scheduleSearch(delay = 300) {
    clearTimeout(searchTimer);
    if (state.route !== "organizations" || !state.session || state.offline)
      return;
    searchTimer = setTimeout(() => void search(), delay);
  }

  function bind(root = document) {
    root.querySelectorAll("[data-organization-form]").forEach((form) => {
      form.addEventListener("input", (event) => {
        const target = event.target;
        if (!target?.name) return;
        data.organizationDetailDraft ??= {};
        data.organizationDetailDraft[target.name] = target.value;
        if (data.organizationDetailErrors?.[target.name]) {
          delete data.organizationDetailErrors[target.name];
          target.setAttribute("aria-invalid", "false");
          const feedback = root.getElementById(
            `organization-detail-${target.name}-error`,
          );
          if (feedback) feedback.textContent = "";
        }
      });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        submitDetailForm(event.currentTarget);
      });
    });
    root
      .querySelectorAll(
        '[data-action="organization-member-remove"], [data-action="organization-domain-verify"]',
      )
      .forEach((element) => {
        element.addEventListener(
          "click",
          () => void handle(element.dataset.action, element),
        );
      });
    root
      .getElementById("organization-query")
      ?.addEventListener("input", (event) => {
        data.organizationSearchDraft = event.currentTarget.value;
        if (!event.isComposing) scheduleSearch();
      });
    root
      .getElementById("organization-query")
      ?.addEventListener("compositionend", (event) => {
        data.organizationSearchDraft = event.currentTarget.value;
        scheduleSearch();
      });
    root
      .getElementById("organization-search")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        data.organizationSearchDraft = String(
          new FormData(event.currentTarget).get("q") ?? "",
        );
        clearTimeout(searchTimer);
        void search();
      });
    root
      .getElementById("organization-sort")
      ?.addEventListener("change", (event) => {
        const sort = event.currentTarget.value;
        if (blocked() || !["name,asc", "name,desc"].includes(sort)) return;
        data.organizationSort = sort;
        data.organizationPage = 0;
        syncUrl();
        void reload("organization-sort", true);
      });
    root
      .getElementById("organization-size")
      ?.addEventListener("change", (event) => {
        const size = Number(event.currentTarget.value);
        if (blocked() || !validPageSizes.includes(size)) return;
        data.organizationSize = size;
        data.organizationPage = 0;
        syncUrl();
        void reload("organization-size", true);
      });
    root
      .querySelector('[data-form="organization-create"]')
      ?.addEventListener("input", (event) => {
        const target = event.target;
        if (
          !target?.name ||
          !["alias", "name", "displayName", "description"].includes(target.name)
        )
          return;
        data.organizationCreate ??= emptyDraft();
        data.organizationCreate[target.name] = target.value;
        if (data.organizationFieldErrors?.[target.name]) {
          delete data.organizationFieldErrors[target.name];
          target.setAttribute("aria-invalid", "false");
          const feedback = root.getElementById(
            `organization-${target.name}-error`,
          );
          if (feedback) feedback.textContent = "";
        }
      });
    root
      .querySelector('[data-form="organization-create"] input[name="enabled"]')
      ?.addEventListener("change", (event) => {
        data.organizationCreate ??= emptyDraft();
        data.organizationCreate.enabled = event.currentTarget.checked;
      });
    root
      .querySelector('[data-form="organization-create"]')
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      });
    if (!popstateBound && root.defaultView) {
      popstateBound = true;
      root.defaultView.addEventListener("popstate", () => {
        if (state.console !== "admin" || !state.session) return;
        if (state.busy) {
          if (["organizations", "organization-create"].includes(state.route))
            syncUrl(true);
          return;
        }
        if (restoreUrl()) void loadRoute();
      });
    }
  }

  return {
    load,
    list,
    create,
    detail,
    breadcrumb,
    handle,
    bind,
    restoreUrl,
    syncUrl,
  };
}
