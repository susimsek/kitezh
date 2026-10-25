// Desktop owns these screens; only API contracts, icons and messages are shared.
export function groupPage(response, size = 10) {
  const content = Array.isArray(response?.content) ? response.content : [];
  const page = response?.page ?? response ?? {};
  const count = (value, fallback) =>
    Number.isSafeInteger(value) && value >= 0 ? value : fallback;
  const pageSize = count(page.size, size) || size;
  const totalElements = count(page.totalElements, content.length);
  return {
    content,
    size: pageSize,
    number: count(page.number, 0),
    totalElements,
    totalPages: count(page.totalPages, Math.ceil(totalElements / pageSize)),
  };
}

export function groupAttributes(value) {
  const parsed = value.trim() ? JSON.parse(value) : {};
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    !Object.values(parsed).every(
      (items) =>
        Array.isArray(items) && items.every((item) => typeof item === "string"),
    )
  )
    throw new Error("Invalid group attributes");
  return parsed;
}

export function createGroupScreens({
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
  action,
}) {
  const tabs = ["details", "permissions", "roles", "members"];
  const permissions = [
    "VIEW",
    "MANAGE_MEMBERS",
    "MANAGE_ROLES",
    "MANAGE_GROUP",
  ];
  const d = state.data;
  const ownerDocument = document;
  const validId = (value) =>
    /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value));
  const manage = () => d.adminAccess?.manageUsers === true;
  const roleManage = () => d.adminAccess?.manageRoles === true;
  const permissionManage = () => d.adminAccess?.isAdmin === true;
  const blocked = () => state.offline || Boolean(state.busy);
  const copy = (key) => text(`adminGroup${key}`);
  let readGeneration = 0;
  let searchGeneration = 0;
  let searchTimer;
  let candidateTimer;
  let candidatesGeneration = 0;
  let alertTimer;
  const prefix = (members) => (members ? "groupMember" : "group");
  function params(members = false) {
    const key = prefix(members);
    return new URLSearchParams({
      q: d[`${key}Query`] ?? "",
      page: String(d[`${key}Page`] ?? 0),
      size: String(d[`${key}Size`] ?? 10),
      sort: d[`${key}Sort`] ?? (members ? "username,asc" : "name,asc"),
    });
  }
  function path() {
    if (state.route === "group-create") return "/admin/groups/new";
    if (state.route === "group-detail")
      return `/admin/groups/${d.groupDetailId}/${d.groupTab ?? "details"}`;
    return "/admin/groups";
  }
  function syncUrl(replace = false) {
    const members = state.route === "group-detail" && d.groupTab === "members";
    const query =
      state.route === "groups" || members ? `?${params(members)}` : "";
    const hash = `#${path()}${query}`;
    if (window.location.hash === hash) return;
    window.history[replace ? "replaceState" : "pushState"](null, "", hash);
  }
  function restoreUrl() {
    const url = new URL(
      window.location.hash.slice(1) || "/",
      "https://native.invalid",
    );
    const match =
      /^\/admin\/groups(?:\/(new|([1-9]\d*)\/(details|permissions|roles|members)))?$/.exec(
        url.pathname,
      );
    if (!match || (match[2] && !validId(match[2]))) return false;
    state.route =
      match[1] === "new"
        ? "group-create"
        : match[2]
          ? "group-detail"
          : "groups";
    if (match[2]) {
      if (Number(match[2]) !== d.groupDetailId) {
        d.groupSelectedRoles = null;
        d.groupPermissionDraft = null;
        d.groupCandidate = null;
      }
      d.groupDetailId = Number(match[2]);
      d.groupTab = match[3];
    }
    const key = prefix(Boolean(match[2]));
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 10);
    const sort = url.searchParams.get("sort");
    d[`${key}Query`] = (url.searchParams.get("q") ?? "").slice(0, 200);
    d[`${key}Page`] =
      Number.isSafeInteger(page) && page >= 0 && page <= 1_000_000 ? page : 0;
    d[`${key}Size`] = [10, 20, 50, 100].includes(size) ? size : 10;
    d[`${key}Sort`] = (match[2]
      ? ["username,asc", "username,desc"]
      : ["name,asc", "name,desc"]
    ).includes(sort)
      ? sort
      : match[2]
        ? "username,asc"
        : "name,asc";
    return true;
  }
  const settingsFrom = (group = {}) => ({
    name: group.name ?? "",
    parentId: group.parentId == null ? "" : String(group.parentId),
    attributesJson: JSON.stringify(group.attributes ?? {}, null, 2),
    defaultGroup: Boolean(group.defaultGroup),
  });
  function resetSettings(group) {
    d.groupSettings = settingsFrom(group);
    d.groupSettingsOriginal = JSON.stringify(d.groupSettings);
    d.groupSettingsId = group.id;
    d.groupFieldErrors = {};
  }
  async function load() {
    const route = state.route;
    const id = d.groupDetailId;
    const tab = d.groupTab ?? "details";
    const generation = ++readGeneration;
    const isCurrent = () =>
      generation === readGeneration &&
      route === state.route &&
      (route !== "group-detail" ||
        (id === d.groupDetailId && tab === (d.groupTab ?? "details")));
    if (route === "groups") {
      const response = await request(`/api/admin/groups?${params()}`, {
        isCurrent,
      });
      if (!isCurrent()) return;
      d.groups = groupPage(response, d.groupSize ?? 10);
      if (d.groups.number > 0 && d.groups.number >= d.groups.totalPages) {
        d.groupPage = Math.max(0, d.groups.totalPages - 1);
        syncUrl(true);
        await load();
      }
      return;
    }
    if (route === "group-create") {
      const response = await request(
        "/api/admin/groups?page=0&size=100&sort=name,asc",
        { isCurrent },
      );
      if (isCurrent()) {
        d.groupParents = groupPage(response).content;
        d.groupCreate ??= settingsFrom();
      }
      return;
    }
    if (!validId(id)) throw new Error("Invalid group id");
    const group = await request(`/api/admin/groups/${id}`, { isCurrent });
    if (!isCurrent()) return;
    d.groupDetail = group;
    if (d.groupSettingsId !== group.id) resetSettings(group);
    if (tab === "details") {
      const response = await request(
        "/api/admin/groups?page=0&size=100&sort=name,asc",
        { isCurrent },
      );
      if (isCurrent()) d.groupParents = groupPage(response).content;
    } else if (tab === "roles") {
      const response = await request(
        "/api/admin/roles?page=0&size=100&sort=name,asc",
        { isCurrent },
      );
      if (isCurrent()) {
        d.groupRoles = groupPage(response).content;
        d.groupSelectedRoles ??= [...(group.roles ?? [])];
      }
    } else if (tab === "permissions") {
      const results = await Promise.allSettled([
        request(`/api/admin/groups/${id}/permissions`, { isCurrent }),
        ...(permissionManage()
          ? [
              request("/api/admin/users?page=0&size=100&sort=username,asc", {
                isCurrent,
              }),
            ]
          : []),
      ]);
      if (!isCurrent()) return;
      if (results[0].status === "rejected") throw results[0].reason;
      if (results[1]?.status === "rejected") throw results[1].reason;
      const saved = Array.isArray(results[0].value) ? results[0].value : [];
      d.groupPermissionDraft ??= saved.map((item) => ({
        ...item,
        userId: String(item.userId),
      }));
      d.groupPermissionUsers = groupPage(results[1]?.value).content;
      for (const item of saved)
        if (!d.groupPermissionUsers.some((user) => user.id === item.userId))
          d.groupPermissionUsers.push({
            id: item.userId,
            username: item.username,
          });
    } else {
      const response = await request(
        `/api/admin/groups/${id}/users?${params(true)}`,
        { isCurrent },
      );
      if (!isCurrent()) return;
      d.groupMembersPage = groupPage(response, d.groupMemberSize ?? 10);
      if (
        d.groupMembersPage.number > 0 &&
        d.groupMembersPage.number >= d.groupMembersPage.totalPages
      ) {
        d.groupMemberPage = Math.max(0, d.groupMembersPage.totalPages - 1);
        syncUrl(true);
        await load();
      }
    }
  }
  async function reload(key = "group-read", initial = false) {
    if (state.busy && !state.busy.startsWith("group-read")) return;
    const generation = ++searchGeneration;
    state.busy = key;
    state.loading = initial;
    state.error = null;
    render();
    try {
      await load();
    } catch {
      /* request displays localized error and retry. */
    } finally {
      if (generation === searchGeneration) {
        state.busy = null;
        state.loading = false;
        render();
      }
    }
  }
  function notice(key) {
    clearTimeout(alertTimer);
    const value = text(key);
    state.notice = value;
    alertTimer = setTimeout(() => {
      if (state.notice === value && globalThis.document === ownerDocument) {
        state.notice = null;
        render();
      }
    }, 5000);
    alertTimer.unref?.();
  }
  async function mutate(key, operation) {
    if (blocked()) return;
    state.busy = key;
    state.error = null;
    state.notice = null;
    render();
    try {
      await operation();
    } catch (error) {
      if (key === "group-save" || key === "group-create") {
        const errors = violations(error.body);
        if (errors.attributes) {
          errors.attributesJson = errors.attributes;
          delete errors.attributes;
        }
        if (error.body?.field)
          errors[
            error.body.field === "attributes"
              ? "attributesJson"
              : error.body.field
          ] = error.body.detail;
        if (error.body?.errorCode === "group_duplicate_name")
          errors.name = error.body.detail ?? copy("DuplicateName");
        d.groupFieldErrors = errors;
      }
    } finally {
      state.busy = null;
      render();
    }
  }
  const tabLabel = (tab) =>
    ({
      details: copy("Settings"),
      permissions: copy("PermissionsLabel"),
      roles: copy("RolesLabel"),
      members: copy("MembersLabel"),
    })[tab];
  function breadcrumb() {
    const name =
      state.route === "group-create"
        ? text("adminCreateGroup")
        : (d.groupDetail?.name ?? text("adminGroups"));
    return `<nav class="admin-user-detail-breadcrumb group-breadcrumb" aria-label="${esc(copy("Breadcrumb"))}"><a href="#/admin/groups" data-action="group-back">${esc(text("adminGroups"))}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(name)}</span></nav>`;
  }
  function filters(members = false) {
    const key = prefix(members);
    const query = d[`${key}Query`] ?? "";
    const sort = d[`${key}Sort`] ?? (members ? "username,asc" : "name,asc");
    const page = groupPage(members ? d.groupMembersPage : d.groups);
    const label = members ? copy("MemberSearch") : text("adminSearchGroups");
    return `<div class="admin-users-toolbar group-filters"><form id="${key}-search" role="search" class="admin-users-search" aria-busy="${Boolean(state.busy?.startsWith("group-read"))}"><label class="sr-only" for="${key}-query">${esc(label)}</label>${icon("search")}<input id="${key}-query" name="q" type="search" maxlength="200" value="${esc(query)}" placeholder="${esc(label)}"/>${spin(Boolean(state.busy?.startsWith("group-read")))}</form><label for="${key}-sort" class="sr-only">${esc(copy("Sort"))}</label><select id="${key}-sort" ${blocked() ? "disabled" : ""}>${["asc", "desc"].map((order) => `<option value="${members ? "username" : "name"},${order}" ${sort.endsWith(order) ? "selected" : ""}>${esc(copy(`${members ? "Username" : "Name"}${order === "asc" ? "Asc" : "Desc"}`))}</option>`).join("")}</select></div><div class="admin-users-count">${page.totalElements} ${esc(copy("Records"))}${query ? `<span class="group-active-filter">${esc(query)}</span>${button(copy("Clear"), { action: "group-clear", id: members ? "members" : "list", icon: "cancel", variant: "secondary", disabled: blocked() })}` : ""}</div>`;
  }
  function pagination(response, members = false) {
    const page = groupPage(response);
    const key = prefix(members);
    const control = (target, label, disabled) =>
      `<button type="button" class="secondary-button admin-pagination-control" aria-busy="${state.busy === `group-read-page:${target}`}" data-action="group-page" data-kind="${members ? "members" : "list"}" data-target="${target}" ${disabled || blocked() ? "disabled" : ""}>${spin(state.busy === `group-read-page:${target}`)}${esc(label)}</button>`;
    return `<div class="admin-users-pagination group-pagination"><div class="admin-pagination-summary">${page.totalElements ? page.number * page.size + 1 : 0}–${Math.min((page.number + 1) * page.size, page.totalElements)} / ${page.totalElements}</div><div class="admin-pagination-controls">${control(0, copy("First"), page.number === 0)}${control(page.number - 1, text("adminPrevious"), page.number === 0)}<span>${esc(text("adminPage"))} ${page.number + 1} / ${Math.max(1, page.totalPages)}</span>${control(page.number + 1, text("adminNext"), page.number + 1 >= page.totalPages)}${control(Math.max(0, page.totalPages - 1), copy("Last"), page.number + 1 >= page.totalPages)}<label for="${key}-size">${esc(copy("Rows"))}</label><select id="${key}-size" ${blocked() ? "disabled" : ""}>${[10, 20, 50, 100].map((size) => `<option value="${size}" ${size === page.size ? "selected" : ""}>${size}</option>`).join("")}</select></div></div>`;
  }
  function list() {
    const page = groupPage(d.groups);
    const rows = page.content
      .map((group) => {
        const confirming = d.groupDeleteId === group.id;
        return `<tr data-group-id="${group.id}"><td><a class="admin-user-detail-link" href="#/admin/groups/${group.id}/details" data-action="group-open" data-id="${group.id}">${esc(group.path ?? group.name)}</a></td><td>${group.roles?.length ?? 0}</td><td>${Number(group.userCount ?? 0)}</td><td class="group-row-actions"><details class="admin-user-menu group-menu"><summary aria-label="${esc(`${group.path ?? group.name} ${copy("Actions")}`)}">${icon("more")}</summary><div class="admin-user-menu-panel">${button(copy("Settings"), { action: "group-open", id: group.id, icon: "edit", variant: "secondary", disabled: blocked() })}${manage() ? button(text("adminDeleteGroup"), { action: "group-delete-request", id: group.id, icon: "delete", danger: true, disabled: blocked() }) : ""}</div></details>${confirming ? `<div class="actions group-confirm" role="alert"><span>${esc(text("adminDeleteGroupPrompt"))}</span>${button(text("adminDeleteGroup"), { action: "group-delete-confirm", id: group.id, icon: "delete", danger: true, busy: state.busy === `group-delete:${group.id}`, disabled: blocked() })}${button(text("cancel"), { action: "group-delete-cancel", variant: "secondary", icon: "cancel", disabled: blocked() })}</div>` : ""}</td></tr>`;
      })
      .join("");
    return `<section class="admin-users-panel">${filters()}<div class="admin-users-table-wrap"><table class="admin-users-table group-table"><thead><tr><th scope="col">${esc(text("adminGroupName"))}</th><th scope="col">${esc(copy("RolesLabel"))}</th><th scope="col">${esc(copy("MembersLabel"))}</th><th scope="col"><span class="sr-only">${esc(copy("Actions"))}</span></th></tr></thead><tbody>${rows || `<tr><td colspan="4"><div class="empty" role="status">${esc(text("adminNoGroups"))}</div></td></tr>`}</tbody></table></div>${pagination(page)}</section>`;
  }
  function settings(create = false) {
    const draft = create
      ? (d.groupCreate ?? settingsFrom())
      : (d.groupSettings ?? settingsFrom(d.groupDetail));
    const errors = d.groupFieldErrors ?? {};
    const disabled = !manage() || blocked();
    const attr = disabled ? "disabled" : "";
    const field = (name, label, control, help = "") =>
      `<div class="field"><label for="group-${name}">${esc(label)}</label>${control}<div class="field-error" id="group-${name}-error" role="alert">${esc(errors[name] ?? "")}</div>${help ? `<p class="muted" id="group-${name}-help">${esc(help)}</p>` : ""}</div>`;
    const accessibility = (name) =>
      `aria-invalid="${Boolean(errors[name])}" aria-describedby="group-${name}-error"`;
    return `<section class="card"><form data-form="native-group-settings" data-create="${create}" novalidate>${create ? "" : `<h2>${esc(copy("Settings"))}</h2><p class="muted">${esc(copy("SettingsHelp"))}</p>`}${field("name", text("adminGroupName"), `<input id="group-name" name="name" value="${esc(draft.name)}" maxlength="100" required ${accessibility("name")} ${attr}/>`)}${field("attributesJson", copy("Attributes"), `<textarea id="group-attributesJson" name="attributesJson" rows="4" placeholder='{"department":["finance"]}' ${accessibility("attributesJson")} ${attr}>${esc(draft.attributesJson)}</textarea>`, copy("AttributesHelp"))}<div class="group-default-field"><label class="group-default-checkbox" for="group-defaultGroup"><input id="group-defaultGroup" name="defaultGroup" type="checkbox" ${draft.defaultGroup ? "checked" : ""} ${attr}/><span>${esc(copy("Default"))}</span></label></div>${field(
      "parentId",
      copy("Parent"),
      `<select id="group-parentId" name="parentId" ${accessibility("parentId")} ${attr}><option value="">${esc(copy("Root"))}</option>${(
        d.groupParents ?? []
      )
        .filter((group) => create || group.id !== d.groupDetail?.id)
        .map(
          (group) =>
            `<option value="${group.id}" ${String(group.id) === draft.parentId ? "selected" : ""}>${esc(group.path ?? group.name)}</option>`,
        )
        .join("")}</select>`,
      copy("ParentHelp"),
    )}<div class="actions">${create ? button(text("cancel"), { action: "group-back", icon: "cancel", variant: "secondary", disabled: blocked() }) : ""}${button(create ? text("adminCreateGroup") : text("save"), { type: "submit", icon: create ? "add" : "save", busy: state.busy === (create ? "group-create" : "group-save"), disabled: disabled || (!create && JSON.stringify(draft) === d.groupSettingsOriginal) })}</div></form></section>`;
  }
  function permissionsPanel() {
    const disabled = !permissionManage() || blocked();
    const rows = (d.groupPermissionDraft ?? [])
      .map(
        (item, index) =>
          `<div class="group-permission-row"><div class="field"><label for="group-permission-user-${index}">${esc(copy("PermissionUser"))}</label><select id="group-permission-user-${index}" data-permission-index="${index}" data-permission-field="userId" ${disabled ? "disabled" : ""}><option value="">${esc(copy("SelectUser"))}</option>${(d.groupPermissionUsers ?? []).map((user) => `<option value="${user.id}" ${String(user.id) === String(item.userId) ? "selected" : ""}>${esc(user.username)}</option>`).join("")}</select><div class="field-error" role="alert">${esc(d.groupPermissionErrors?.[index] ?? "")}</div></div><div class="field"><label for="group-permission-value-${index}">${esc(copy("Permission"))}</label><select id="group-permission-value-${index}" data-permission-index="${index}" data-permission-field="permission" ${disabled ? "disabled" : ""}>${permissions.map((value) => `<option value="${value}" ${value === item.permission ? "selected" : ""}>${value}</option>`).join("")}</select></div>${permissionManage() ? button(text("adminRemoveGroupPermission"), { action: "group-permission-remove", index, icon: "remove", danger: true, disabled }) : ""}</div>`,
      )
      .join("");
    return `<section class="card"><h2>${esc(copy("PermissionsLabel"))}</h2><p class="muted">${esc(copy("PermissionsHelp"))}</p><form data-form="native-group-permissions">${rows || `<div class="empty" role="status">${esc(copy("NoPermissions"))}</div>`}${permissionManage() ? `<div class="actions">${button(text("adminAddGroupPermission"), { action: "group-permission-add", icon: "add", variant: "secondary", disabled })}${button(copy("SavePermissions"), { type: "submit", icon: "save", busy: state.busy === "group-permissions-save", disabled })}</div>` : ""}</form></section>`;
  }
  function rolesPanel() {
    return `<section class="card group-role-card"><h2>${esc(copy("RolesLabel"))}</h2><form data-form="native-group-roles"><div class="group-role-grid">${(d.groupRoles ?? []).map((role, index) => `<label class="group-role-option" for="group-role-${index}"><input id="group-role-${index}" type="checkbox" name="roles" value="${esc(role.name)}" ${(d.groupSelectedRoles ?? []).includes(role.name) ? "checked" : ""} ${!roleManage() || blocked() ? "disabled" : ""}/><span>${esc(role.name)}</span></label>`).join("")}</div>${roleManage() ? `<div class="actions group-role-actions">${button(copy("SaveRoles"), { type: "submit", icon: "save", busy: state.busy === "group-roles-save", disabled: blocked() })}</div>` : ""}</form></section>`;
  }
  function membersPanel() {
    const page = groupPage(d.groupMembersPage);
    const candidate = d.groupCandidate ?? { query: "", items: [] };
    const rows = page.content
      .map(
        (user) =>
          `<tr><td><a class="admin-user-detail-link" href="#/admin/users/${user.id}/details" data-action="group-user-open" data-id="${user.id}">${esc(user.username)}</a></td><td><span class="admin-user-status ${user.enabled ? "is-enabled" : "is-disabled"}">${esc(text(user.enabled ? "adminUserEnabled" : "adminUserDisabled"))}</span></td><td class="group-row-actions">${manage() ? button(copy("RemoveMember"), { action: "group-member-remove", id: user.id, icon: "remove", danger: true, busy: state.busy === `group-member-remove:${user.id}`, disabled: blocked() }) : ""}</td></tr>`,
      )
      .join("");
    return `<section class="card"><h2>${esc(copy("AddMember"))}</h2><div class="actions group-member-add"><div class="group-autocomplete"><label class="sr-only" for="group-candidate-query">${esc(copy("PermissionUser"))}</label><input id="group-candidate-query" type="search" role="combobox" aria-autocomplete="list" aria-expanded="${Boolean(candidate.items.length && !candidate.selected)}" aria-controls="group-candidates" maxlength="200" value="${esc(candidate.query)}" placeholder="${esc(copy("UserSearch"))}" ${!manage() || blocked() ? "disabled" : ""}/><div id="group-candidates" role="listbox" aria-label="${esc(copy("SelectUser"))}">${!candidate.selected ? candidate.items.map((user) => `<button type="button" role="option" aria-selected="false" class="text-button" data-action="group-candidate-select" data-id="${user.id}">${esc(user.username)}</button>`).join("") : ""}</div><p class="muted" role="status">${candidate.loading ? spin(true) + esc(text("loading")) : candidate.error ? esc(copy("CandidateError")) : candidate.query.trim().length < 2 ? esc(copy("MinimumSearch")) : !candidate.selected && !candidate.items.length ? esc(copy("NoCandidates")) : ""}</p>${candidate.error ? button(text("adminRetry"), { action: "group-candidate-retry", busy: candidate.loading, disabled: blocked() }) : ""}</div>${manage() ? button(copy("AddMember"), { action: "group-member-add", icon: "add", busy: state.busy === "group-member-add", disabled: blocked() || !candidate.selected }) : ""}</div></section><section class="admin-users-panel">${filters(true)}<div class="admin-users-table-wrap"><table class="admin-users-table group-members-table"><thead><tr><th scope="col">${esc(copy("PermissionUser"))}</th><th scope="col">${esc(copy("Status"))}</th><th scope="col"><span class="sr-only">${esc(copy("Actions"))}</span></th></tr></thead><tbody>${rows || `<tr><td colspan="3"><div class="empty" role="status">${esc(text("adminNoGroupMembers"))}</div></td></tr>`}</tbody></table></div>${pagination(page, true)}</section>`;
  }
  function detail() {
    if (!d.groupDetail || d.groupDetail.id !== d.groupDetailId) return "";
    const tab = d.groupTab ?? "details";
    const panel =
      tab === "details"
        ? settings()
        : tab === "permissions"
          ? permissionsPanel()
          : tab === "roles"
            ? rolesPanel()
            : membersPanel();
    return `<div class="admin-user-detail-tabs" role="tablist" aria-label="${esc(copy("Tabs"))}">${tabs.map((value) => `<button type="button" role="tab" id="group-tab-${value}" aria-selected="${value === tab}" aria-controls="group-panel" tabindex="${value === tab ? 0 : -1}" class="admin-user-detail-tab ${value === tab ? "is-active" : ""}" data-action="group-tab" data-id="${value}" ${blocked() ? "disabled" : ""}>${spin(state.busy === `group-read-tab:${value}`)}${esc(tabLabel(value))}</button>`).join("")}</div><div id="group-panel" role="tabpanel" aria-labelledby="group-tab-${tab}" class="group-panel">${panel}</div>`;
  }
  async function open(id, tab = "details") {
    if (
      !validId(id) ||
      !tabs.includes(tab) ||
      !(d.adminAccess?.queryGroups || d.adminAccess?.viewGroups)
    )
      return;
    if (Number(id) !== d.groupDetailId) {
      d.groupDetail = null;
      d.groupSettingsId = null;
      d.groupSelectedRoles = null;
      d.groupPermissionDraft = null;
      d.groupCandidate = null;
      d.groupMembersPage = null;
      d.groupMemberQuery = "";
      d.groupMemberPage = 0;
    }
    state.route = "group-detail";
    d.groupDetailId = Number(id);
    d.groupTab = tab;
    state.notice = null;
    syncUrl();
    await reload("group-read-open", true);
  }
  async function handle(name, element) {
    if (name !== "create-group" && !name.startsWith("group-")) return false;
    if (blocked()) return true;
    if (name === "create-group") {
      if (!manage()) return true;
      state.route = "group-create";
      d.groupCreate = settingsFrom();
      d.groupFieldErrors = {};
      syncUrl();
      await reload("group-read-create", true);
    } else if (name === "group-open") await open(element.dataset.id);
    else if (name === "group-back") {
      state.route = "groups";
      state.notice = null;
      syncUrl();
      await reload("group-read-back", true);
    } else if (name === "group-tab") {
      if (!tabs.includes(element.dataset.id)) return true;
      ++candidatesGeneration;
      clearTimeout(candidateTimer);
      d.groupTab = element.dataset.id;
      syncUrl();
      await reload(`group-read-tab:${d.groupTab}`, true);
      document.getElementById(`group-tab-${d.groupTab}`)?.focus();
    } else if (name === "group-page") {
      const members = element.dataset.kind === "members";
      const number = Number(element.dataset.target);
      const page = groupPage(members ? d.groupMembersPage : d.groups);
      if (
        !Number.isSafeInteger(number) ||
        number < 0 ||
        number >= page.totalPages
      )
        return true;
      d[`${prefix(members)}Page`] = number;
      syncUrl();
      await reload(`group-read-page:${number}`);
    } else if (name === "group-clear") {
      const key = prefix(element.dataset.id === "members");
      d[`${key}Query`] = "";
      d[`${key}Page`] = 0;
      syncUrl();
      await reload("group-read-clear");
    } else if (name === "group-delete-request") {
      if (
        manage() &&
        (d.groups?.content ?? []).some(
          (group) => group.id === Number(element.dataset.id),
        )
      ) {
        d.groupDeleteId = Number(element.dataset.id);
        render();
      }
    } else if (name === "group-delete-cancel") {
      d.groupDeleteId = null;
      render();
    } else if (name === "group-delete-confirm") {
      const id = Number(element.dataset.id);
      if (!manage() || !validId(id) || id !== d.groupDeleteId) return true;
      await mutate(`group-delete:${id}`, async () => {
        await request(`/api/admin/groups/${id}`, { method: "DELETE" });
        if (d.groups.content.length === 1 && (d.groupPage ?? 0) > 0)
          d.groupPage -= 1;
        d.groupDeleteId = null;
        syncUrl(true);
        await load();
        notice("adminGroupDeleted");
      });
    } else if (name === "group-permission-add") {
      if (permissionManage()) {
        (d.groupPermissionDraft ??= []).push({
          userId: "",
          permission: "VIEW",
        });
        render();
      }
    } else if (name === "group-permission-remove") {
      const index = Number(element.dataset.index);
      if (
        permissionManage() &&
        Number.isSafeInteger(index) &&
        index >= 0 &&
        index < d.groupPermissionDraft.length
      ) {
        d.groupPermissionDraft.splice(index, 1);
        d.groupPermissionErrors = {};
        render();
      }
    } else if (name === "group-candidate-select") {
      const selected = d.groupCandidate?.items.find(
        (user) => user.id === Number(element.dataset.id),
      );
      if (manage() && selected) {
        ++candidatesGeneration;
        d.groupCandidate.selected = selected;
        d.groupCandidate.query = selected.username;
        d.groupCandidate.items = [];
        render();
      }
    } else if (name === "group-candidate-retry") await candidates();
    else if (name === "group-member-add" || name === "group-member-remove") {
      const adding = name === "group-member-add";
      const id = adding
        ? d.groupCandidate?.selected?.id
        : Number(element.dataset.id);
      if (
        !manage() ||
        !validId(d.groupDetailId) ||
        !validId(id) ||
        (!adding && !d.groupMembersPage?.content.some((user) => user.id === id))
      )
        return true;
      await mutate(adding ? name : `${name}:${id}`, async () => {
        await request(
          `/api/admin/groups/${d.groupDetailId}/users${adding ? "" : `/${id}`}`,
          {
            method: adding ? "POST" : "DELETE",
            ...(adding ? { body: { userId: id } } : {}),
          },
        );
        if (adding) {
          ++candidatesGeneration;
          d.groupCandidate = { query: "", items: [] };
        } else if (
          d.groupMembersPage.content.length === 1 &&
          (d.groupMemberPage ?? 0) > 0
        )
          d.groupMemberPage -= 1;
        syncUrl(true);
        await load();
        notice(adding ? "adminGroupUserAdded" : "adminGroupUserRemoved");
      });
    } else if (name === "group-user-open") {
      if (
        !(d.adminAccess?.queryUsers || d.adminAccess?.viewUsers) ||
        !validId(element.dataset.id)
      )
        return true;
      window.history.pushState(
        null,
        "",
        `#/admin/users/${element.dataset.id}/details`,
      );
      await action("admin-user-detail-open", element);
    }
    return true;
  }
  function readSettings(form) {
    return {
      name: form.elements.namedItem("name").value,
      parentId: form.elements.namedItem("parentId").value,
      attributesJson: form.elements.namedItem("attributesJson").value,
      defaultGroup: form.elements.namedItem("defaultGroup").checked,
    };
  }
  async function submit(form) {
    if (!form.dataset.form?.startsWith("native-group-")) return false;
    if (blocked()) return true;
    if (form.dataset.form === "native-group-settings") {
      if (!manage()) return true;
      const create = form.dataset.create === "true";
      const draft = readSettings(form);
      if (create) d.groupCreate = draft;
      else d.groupSettings = draft;
      const errors = {};
      const name = draft.name.trim();
      let attributes;
      if (!name) errors.name = copy("Required");
      else if (name.length > 100) errors.name = copy("MaxName");
      try {
        attributes = groupAttributes(draft.attributesJson);
      } catch {
        errors.attributesJson = copy("AttributesInvalid");
      }
      if (
        draft.parentId &&
        (!validId(draft.parentId) ||
          (!create && Number(draft.parentId) === d.groupDetailId))
      )
        errors.parentId = copy("ParentHelp");
      d.groupFieldErrors = errors;
      if (Object.keys(errors).length) {
        render();
        document.getElementById(`group-${Object.keys(errors)[0]}`)?.focus();
        return true;
      }
      if (!create && JSON.stringify(draft) === d.groupSettingsOriginal)
        return true;
      await mutate(create ? "group-create" : "group-save", async () => {
        const group = await request(
          create ? "/api/admin/groups" : `/api/admin/groups/${d.groupDetailId}`,
          {
            method: create ? "POST" : "PUT",
            body: {
              name,
              parentId: draft.parentId ? Number(draft.parentId) : null,
              attributes,
              defaultGroup: draft.defaultGroup,
            },
          },
        );
        d.groupDetail = group;
        resetSettings(group);
        if (create) {
          d.groupCreate = null;
          d.groupSelectedRoles = null;
          d.groupPermissionDraft = null;
          d.groupDetailId = group.id;
          d.groupTab = "details";
          state.route = "group-detail";
          syncUrl();
          await load();
        }
        notice(create ? "adminGroupCreated" : "adminGroupUpdated");
      });
    } else if (form.dataset.form === "native-group-roles") {
      if (!roleManage() || !validId(d.groupDetailId)) return true;
      const roles = [
        ...form.querySelectorAll('input[name="roles"]:checked'),
      ].map((input) => input.value);
      await mutate("group-roles-save", async () => {
        const group = await request(
          `/api/admin/groups/${d.groupDetailId}/roles`,
          { method: "PUT", body: { roles } },
        );
        d.groupDetail = group;
        d.groupSelectedRoles = [...(group.roles ?? [])];
        notice("adminGroupRolesUpdated");
      });
    } else if (form.dataset.form === "native-group-permissions") {
      if (!permissionManage() || !validId(d.groupDetailId)) return true;
      const seen = new Set();
      const errors = {};
      const assignments = (d.groupPermissionDraft ?? []).map((item, index) => {
        const key = `${item.userId}:${item.permission}`;
        if (!validId(item.userId) || !permissions.includes(item.permission))
          errors[index] = copy("PermissionRequired");
        else if (seen.has(key)) errors[index] = copy("DuplicatePermission");
        seen.add(key);
        return { userId: Number(item.userId), permission: item.permission };
      });
      d.groupPermissionErrors = errors;
      if (Object.keys(errors).length) {
        render();
        document
          .getElementById(`group-permission-user-${Object.keys(errors)[0]}`)
          ?.focus();
        return true;
      }
      await mutate("group-permissions-save", async () => {
        const saved = await request(
          `/api/admin/groups/${d.groupDetailId}/permissions`,
          { method: "PUT", body: { permissions: assignments } },
        );
        d.groupPermissionDraft = saved.map((item) => ({
          ...item,
          userId: String(item.userId),
        }));
        notice("adminGroupPermissionsUpdated");
      });
    }
    return true;
  }
  async function candidates() {
    const candidate = d.groupCandidate;
    const id = d.groupDetailId;
    const generation = ++candidatesGeneration;
    const query = candidate.query.trim();
    const isCurrent = () =>
      generation === candidatesGeneration &&
      state.route === "group-detail" &&
      d.groupTab === "members" &&
      id === d.groupDetailId &&
      d.groupCandidate === candidate &&
      candidate.query.trim() === query;
    if (!manage() || state.offline || query.length < 2 || candidate.selected)
      return;
    candidate.loading = true;
    candidate.error = false;
    render();
    try {
      const response = await request(
        `/api/admin/groups/${id}/available-users?q=${encodeURIComponent(query)}&page=0&size=10`,
        { isCurrent },
      );
      if (isCurrent()) candidate.items = groupPage(response).content;
    } catch {
      if (isCurrent()) {
        candidate.error = true;
        candidate.items = [];
      }
    } finally {
      if (isCurrent()) {
        candidate.loading = false;
        render();
      }
    }
  }
  function bind(document) {
    for (const members of [false, true]) {
      const key = prefix(members);
      const search = document.getElementById(`${key}-query`);
      const schedule = () => {
        clearTimeout(searchTimer);
        ++readGeneration;
        searchTimer = setTimeout(() => {
          if (
            globalThis.document === ownerDocument &&
            state.route === (members ? "group-detail" : "groups")
          ) {
            syncUrl(true);
            void reload("group-read-search");
          }
        }, 300);
      };
      search?.addEventListener("input", (event) => {
        if (state.busy && !state.busy.startsWith("group-read")) return;
        d[`${key}Query`] = event.currentTarget.value;
        d[`${key}Page`] = 0;
        if (!event.isComposing) schedule();
      });
      search?.addEventListener("compositionend", schedule);
      document
        .getElementById(`${key}-search`)
        ?.addEventListener("submit", (event) => {
          event.preventDefault();
          schedule();
        });
      for (const [type, suffix] of [
        ["Sort", "sort"],
        ["Size", "size"],
      ])
        document
          .getElementById(`${key}-${suffix}`)
          ?.addEventListener("change", (event) => {
            if (blocked()) return;
            d[`${key}${type}`] =
              type === "Size" ? Number(event.target.value) : event.target.value;
            d[`${key}Page`] = 0;
            syncUrl();
            void reload(`group-read-${suffix}`);
          });
    }
    const form = document.querySelector('[data-form="native-group-settings"]');
    for (const event of ["input", "change"])
      form?.addEventListener(event, (event) => {
        if (!manage() || blocked()) return;
        const draft = readSettings(form);
        if (form.dataset.create === "true") d.groupCreate = draft;
        else d.groupSettings = draft;
        delete d.groupFieldErrors?.[event.target.name];
        const error = document.getElementById(
          `group-${event.target.name}-error`,
        );
        if (error) error.textContent = "";
        event.target.setAttribute("aria-invalid", "false");
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled =
          form.dataset.create !== "true" &&
          JSON.stringify(draft) === d.groupSettingsOriginal;
      });
    document.querySelectorAll("[data-permission-field]").forEach((select) =>
      select.addEventListener("change", () => {
        if (!permissionManage() || blocked()) return;
        d.groupPermissionDraft[Number(select.dataset.permissionIndex)][
          select.dataset.permissionField
        ] = select.value;
        d.groupPermissionErrors = {};
      }),
    );
    document
      .querySelector('[data-form="native-group-roles"]')
      ?.addEventListener("change", (event) => {
        if (roleManage() && !blocked())
          d.groupSelectedRoles = [
            ...event.currentTarget.querySelectorAll(
              'input[name="roles"]:checked',
            ),
          ].map((input) => input.value);
      });
    document
      .getElementById("group-candidate-query")
      ?.addEventListener("input", (event) => {
        if (!manage() || blocked()) return;
        clearTimeout(candidateTimer);
        ++candidatesGeneration;
        d.groupCandidate = {
          query: event.target.value,
          items: [],
          selected: null,
          loading: false,
        };
        render();
        if (!event.isComposing && event.target.value.trim().length >= 2)
          candidateTimer = setTimeout(() => {
            if (globalThis.document === ownerDocument) void candidates();
          }, 300);
      });
    document
      .getElementById("group-candidate-query")
      ?.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          document.querySelector('#group-candidates [role="option"]')?.focus();
        }
        if (event.key === "Escape") {
          ++candidatesGeneration;
          clearTimeout(candidateTimer);
          d.groupCandidate.items = [];
          render();
        }
      });
    const tabButtons = [
      ...document.querySelectorAll('[data-action="group-tab"]'),
    ];
    tabButtons.forEach((element, index) =>
      element.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabButtons.length - 1
              : (index +
                  (event.key === "ArrowLeft" ? -1 : 1) +
                  tabButtons.length) %
                tabButtons.length;
        tabButtons[next].click();
      }),
    );
    document
      .querySelectorAll("a[data-action^='group-']")
      .forEach((link) =>
        link.addEventListener("click", (event) => event.preventDefault()),
      );
  }
  window.addEventListener("popstate", () => {
    if (state.console !== "admin" || !state.session) return;
    if (state.busy && !state.busy.startsWith("group-read")) {
      if (["groups", "group-detail", "group-create"].includes(state.route))
        syncUrl(true);
      return;
    }
    ++readGeneration;
    ++candidatesGeneration;
    clearTimeout(candidateTimer);
    clearTimeout(searchTimer);
    if (restoreUrl()) void loadRoute();
    else {
      const user = /^#\/admin\/users\/([1-9]\d*)\/details$/.exec(
        window.location.hash,
      );
      if (user && validId(user[1])) {
        state.route = "user-detail";
        d.adminUserDetailId = Number(user[1]);
        d.adminUserDetailTab = "details";
        void loadRoute();
      }
    }
  });
  return {
    load,
    list,
    detail,
    create: () => settings(true),
    breadcrumb,
    handle,
    submit,
    bind,
    syncUrl,
    restoreUrl,
    subtitle: () =>
      state.route === "group-detail"
        ? `${d.groupDetail?.userCount ?? 0} ${copy("MembersLabel").toLowerCase()}`
        : state.route === "group-create"
          ? copy("CreateHelp")
          : copy("Subtitle"),
  };
}
