// Native role screens share the existing bridge, controls and mutation handlers.
// Spring Data's real wire format is { content, page: { ... } }.
export function rolePage(response, defaultSize = 10) {
  const metadata = response?.page ?? response ?? {};
  const content = Array.isArray(response?.content) ? response.content : [];
  const size = Number.isSafeInteger(metadata.size)
    ? metadata.size
    : defaultSize;
  const totalElements = Number.isSafeInteger(metadata.totalElements)
    ? metadata.totalElements
    : content.length;
  return {
    content,
    size,
    number: metadata.number ?? 0,
    totalElements,
    totalPages: metadata.totalPages ?? Math.ceil(totalElements / size),
  };
}

export function createRoleScreens({
  state,
  text,
  escapeHtml: esc,
  button,
  spin,
  violations,
  render,
  request,
  loadRoute,
  action,
}) {
  const catalog = {
    en: {
      subtitle: "Manage the roles that can be assigned to users.",
      protected: "Protected",
      details: "Details",
      users: "Users in role",
      assigned: "assigned users",
      edit: "Edit",
      sort: "Sort",
      records: "records",
      clear: "Clear filters",
      first: "First page",
      last: "Last page",
      rows: "Rows per page",
      nameAsc: "Role name · A–Z",
      nameDesc: "Role name · Z–A",
      descriptionHelp:
        "Explain what this role allows. Use up to 500 characters.",
      saveDescription: "Save description",
      nameHelp:
        "Use ROLE_ followed by uppercase letters, numbers or underscores. Maximum 50 characters.",
      actions: "Role actions",
      assign: "Assign",
      select: "Select a candidate",
      minimum: "Enter at least two characters to search.",
      noCandidates: "No matching candidates found.",
      userSearch: "Search by username, email or name",
      all: "All",
      status: "Status",
      usernameAsc: "Username · A–Z",
      usernameDesc: "Username · Z–A",
      emailAsc: "Email · A–Z",
      emailDesc: "Email · Z–A",
      removeUser: "Remove role",
      removePrompt:
        "Remove this user's role? Their sessions and authorizations will be invalidated.",
      userAssigned: "User assigned to role.",
      userRemoved: "User removed from role.",
      notFound: "This role could not be found.",
      loadError: "Role data could not be loaded.",
      permission: "You do not have permission to view this role.",
    },
    tr: {
      subtitle: "Kullanıcılara atanabilecek rolleri yönetin.",
      protected: "Korumalı",
      details: "Ayrıntılar",
      users: "Roldaki kullanıcılar",
      assigned: "atanmış kullanıcı",
      edit: "Düzenle",
      sort: "Sıralama",
      records: "kayıt",
      clear: "Filtreleri temizle",
      first: "İlk sayfa",
      last: "Son sayfa",
      rows: "Sayfa başına",
      nameAsc: "Rol adı · A–Z",
      nameDesc: "Rol adı · Z–A",
      descriptionHelp:
        "Bu rolün neye izin verdiğini açıklayın. En fazla 500 karakter.",
      saveDescription: "Açıklamayı kaydet",
      nameHelp:
        "ROLE_ önekinden sonra büyük harf, rakam veya alt çizgi kullanın. En fazla 50 karakter.",
      actions: "Rol işlemleri",
      assign: "Ata",
      select: "Bir aday seçin",
      minimum: "Aramak için en az iki karakter yazın.",
      noCandidates: "Eşleşen aday bulunamadı.",
      userSearch: "Kullanıcı adı, e-posta veya ad ile ara",
      all: "Tümü",
      status: "Durum",
      usernameAsc: "Kullanıcı adı · A–Z",
      usernameDesc: "Kullanıcı adı · Z–A",
      emailAsc: "E-posta · A–Z",
      emailDesc: "E-posta · Z–A",
      removeUser: "Rolü kaldır",
      removePrompt:
        "Bu kullanıcının rolü kaldırılsın mı? Oturumları ve yetkilendirmeleri geçersiz kılınacak.",
      userAssigned: "Kullanıcı role atandı.",
      userRemoved: "Kullanıcı rolden kaldırıldı.",
      notFound: "Bu rol bulunamadı.",
      loadError: "Rol verileri yüklenemedi.",
      permission: "Bu rolü görüntüleme yetkiniz yok.",
    },
  };
  const copy = (key) => catalog[state.locale][key];
  const manage = () => state.data.adminAccess?.manageRoles === true;
  const blocked = () => state.offline || Boolean(state.busy);
  const protectedRole = (role) =>
    role?.protectedRole || ["ROLE_ADMIN", "ROLE_USER"].includes(role?.name);
  const badge = (role) =>
    protectedRole(role)
      ? `<span class="admin-user-role">${esc(copy("protected"))}</span>`
      : "";
  const validName = (name) => /^ROLE_[A-Z0-9_]{1,45}$/.test(name ?? "");
  const timers = new Map();
  const generations = new Map();
  function invalidate(key) {
    clearTimeout(timers.get(key));
    const value = (generations.get(key) ?? 0) + 1;
    generations.set(key, value);
    return value;
  }
  function current(key, value, route, name) {
    return (
      generations.get(key) === value &&
      state.route === route &&
      (route !== "role-detail" || state.data.roleDetailName === name)
    );
  }
  function params(users = false) {
    const prefix = users ? "roleUsers" : "role";
    const query = new URLSearchParams({
      q: state.data[`${prefix}Query`] ?? "",
      page: String(state.data[`${prefix}Page`] ?? 0),
      size: String(state.data[`${prefix}Size`] ?? 10),
      sort:
        state.data[`${prefix}Sort`] ?? (users ? "username,asc" : "name,asc"),
    });
    if (users && state.data.roleUsersEnabled)
      query.set("enabled", state.data.roleUsersEnabled);
    return query.toString();
  }
  async function load() {
    const route = state.route;
    const name = state.data.roleDetailName;
    const users = route === "role-detail";
    const key = users ? "members" : "list";
    const generation = invalidate(key);
    const isCurrent = () => current(key, generation, route, name);
    const data = await request(
      users
        ? `/api/admin/roles/${encodeURIComponent(name)}?${params(true)}`
        : `/api/admin/roles?${params()}`,
      { isCurrent },
    );
    if (!isCurrent()) return;
    if (users) {
      state.data.roleDetail = data;
      state.data.adminRoleCompositions ??= {};
      const previous = state.data.adminRoleCompositions[name] ?? {};
      state.data.adminRoleCompositions[name] = {
        ...previous,
        ...data,
        open: true,
      };
      state.data.roleUsersError = null;
    } else state.data.roles = rolePage(data, state.data.roleSize ?? 10);
    const page = rolePage(
      users ? data.users : data,
      state.data[users ? "roleUsersSize" : "roleSize"] ?? 10,
    );
    if (page.number >= page.totalPages && page.number > 0) {
      state.data[users ? "roleUsersPage" : "rolePage"] = Math.max(
        0,
        page.totalPages - 1,
      );
      await load();
    }
  }
  let reloadGeneration = 0;
  async function reload(key = "role-read", initial = false) {
    if (state.busy && !state.busy.startsWith("role-read")) return;
    const generation = ++reloadGeneration;
    state.busy = key;
    state.loading = initial;
    state.error = null;
    render();
    try {
      await load();
    } catch (error) {
      if (state.route === "role-detail") state.data.roleUsersError = error;
    } finally {
      if (generation === reloadGeneration && state.busy === key) {
        state.busy = null;
        state.loading = false;
        render();
      }
    }
  }
  function pagination(response, users = false) {
    const page = rolePage(
      response,
      state.data[users ? "roleUsersSize" : "roleSize"] ?? 10,
    );
    const first = page.totalElements ? page.number * page.size + 1 : 0;
    const last = Math.min((page.number + 1) * page.size, page.totalElements);
    const control = (label, number, symbol, disabled) =>
      `<button type="button" class="secondary-button admin-pagination-control" data-action="role-page" data-kind="${users ? "users" : "roles"}" data-target="${number}" aria-label="${esc(label)}" title="${esc(label)}" ${disabled || blocked() ? "disabled" : ""}>${spin(state.busy === `role-read-page:${number}`)}${symbol}</button>`;
    return `<div class="admin-users-pagination" aria-label="${esc(text("adminPage"))}"><div class="admin-pagination-summary" aria-live="polite"><strong>${first}–${last}</strong><span> / ${page.totalElements}</span></div><div class="admin-pagination-controls"><label>${esc(copy("rows"))} <select id="${users ? "role-users-size" : "role-size"}" ${blocked() ? "disabled" : ""}>${[10, 20, 50, 100].map((size) => `<option value="${size}" ${size === page.size ? "selected" : ""}>${size}</option>`).join("")}</select>${spin(state.busy === "role-read-size")}</label>${control(copy("first"), 0, "«", page.number === 0)}${control(text("adminPrevious"), page.number - 1, "‹", page.number === 0)}<span>${esc(text("adminPage"))} <strong>${page.totalElements ? page.number + 1 : 0}</strong> / ${page.totalPages}</span>${control(text("adminNext"), page.number + 1, "›", page.number + 1 >= page.totalPages)}${control(copy("last"), Math.max(0, page.totalPages - 1), "»", page.number + 1 >= page.totalPages)}</div></div>`;
  }
  function filters(users = false) {
    const prefix = users ? "roleUsers" : "role";
    const id = users ? "role-users" : "role";
    const query =
      state.data[`${prefix}SearchDraft`] ?? state.data[`${prefix}Query`] ?? "";
    const sort =
      state.data[`${prefix}Sort`] ?? (users ? "username,asc" : "name,asc");
    const enabled = state.data.roleUsersEnabled ?? "";
    const options = users
      ? [
          ["username,asc", "usernameAsc"],
          ["username,desc", "usernameDesc"],
          ["email,asc", "emailAsc"],
          ["email,desc", "emailDesc"],
        ]
      : [
          ["name,asc", "nameAsc"],
          ["name,desc", "nameDesc"],
        ];
    const page = rolePage(
      users ? state.data.roleDetail?.users : state.data.roles,
    );
    return `<div class="admin-users-toolbar"><form id="${users ? "role-users-search" : "admin-role-search"}" class="admin-users-search" role="search" aria-busy="${Boolean(state.busy?.startsWith("role-read"))}">${spin(Boolean(state.busy?.startsWith("role-read")))}<input id="${users ? "role-users-query" : "admin-role-query"}" name="q" type="search" aria-label="${esc(users ? copy("userSearch") : text("adminSearchRoles"))}" placeholder="${esc(users ? copy("userSearch") : text("adminSearchRoles"))}" value="${esc(query)}" maxlength="200"/></form><select id="${id}-sort" aria-label="${esc(copy("sort"))}" ${blocked() ? "disabled" : ""}>${options.map(([value, label]) => `<option value="${value}" ${value === sort ? "selected" : ""}>${esc(copy(label))}</option>`).join("")}</select>${users ? `<select id="role-users-enabled" aria-label="${esc(copy("status"))}" ${blocked() ? "disabled" : ""}><option value="">${esc(copy("all"))}</option>${["true", "false"].map((value) => `<option value="${value}" ${enabled === value ? "selected" : ""}>${esc(text(value === "true" ? "adminUserEnabled" : "adminUserDisabled"))}</option>`).join("")}</select>` : ""}</div><div class="admin-users-count">${page.totalElements} ${esc(copy("records"))}${query || (users && enabled) || state.busy === "role-read-clear" ? `<span class="role-active-filter">${esc(query)} ${users && enabled ? esc(text(enabled === "true" ? "adminUserEnabled" : "adminUserDisabled")) : ""}</span>${button(copy("clear"), { action: "role-clear", id: users ? "users" : "roles", variant: "secondary", busy: state.busy === "role-read-clear", disabled: blocked() })}` : ""}</div>`;
  }
  function loadError() {
    const error = state.data.roleUsersError ?? state.error;
    const key =
      error?.status === 404
        ? "notFound"
        : error?.kind === "forbidden"
          ? "permission"
          : "loadError";
    return `<section class="card" role="alert">${esc(copy(key))}</section>`;
  }
  function list() {
    if (state.error && !state.busy?.startsWith("role-delete"))
      return loadError();
    const page = rolePage(state.data.roles);
    const rows = page.content
      .map((role) => {
        const confirming = state.data.roleDeleteConfirmName === role.name;
        const deleting = state.busy === `role-delete:${role.name}`;
        const deleteControls =
          manage() && !protectedRole(role)
            ? button(text("adminDeleteRole"), {
                action: "admin-role-delete-request",
                id: role.name,
                danger: true,
                disabled: blocked(),
              })
            : "";
        return `<tr data-role-name="${esc(role.name)}"><td><button class="admin-user-detail-link role-name" type="button" data-action="role-open" data-id="${esc(role.name)}" ${blocked() ? "disabled" : ""}>${esc(role.name)}</button><p class="muted role-description">${esc(role.description ?? "")}</p></td><td class="role-row-actions">${badge(role)}<details class="admin-user-menu role-menu"><summary aria-label="${esc(role.name + " " + copy("actions"))}">⋮</summary><div class="admin-user-menu-panel">${button(copy("edit"), { action: "role-open", id: role.name, icon: "edit", variant: "secondary", disabled: blocked() })}${deleteControls}</div></details>${confirming ? `<div class="actions" role="alert"><span>${esc(text("adminDeleteRolePrompt"))}</span>${button(text("adminDeleteRole"), { action: "admin-role-delete-confirm", id: role.name, danger: true, busy: deleting, disabled: blocked() })}${button(text("cancel"), { action: "admin-role-delete-cancel", variant: "secondary", disabled: blocked() })}</div>` : ""}</td></tr>`;
      })
      .join("");
    return `<section class="admin-users-panel">${filters()}${rows ? `<div class="admin-users-table-wrap"><table class="admin-users-table role-table"><thead><tr><th>${esc(text("adminRoleName"))}</th><th><span class="sr-only">${esc(copy("actions"))}</span></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty" role="status">${esc(text("adminNoRoles"))}</div>`}${pagination(page)}</section>`;
  }
  function breadcrumb(name) {
    return `<nav class="admin-user-detail-breadcrumb role-breadcrumb" aria-label="Breadcrumb">${button(text("adminRoles"), { action: "role-back", variant: "secondary", icon: "arrowLeft", busy: state.busy === "role-read-back", disabled: blocked() })}<span>/</span><span class="role-name">${esc(name)}</span></nav>`;
  }
  function descriptionField(value, error, disabled = false) {
    return `<div class="field"><label for="role-description">${esc(text("adminRoleDescription"))}</label><textarea id="role-description" name="description" rows="3" maxlength="500" aria-describedby="role-description-help role-description-error" aria-invalid="${Boolean(error)}" ${disabled ? "disabled" : ""}>${esc(value ?? "")}</textarea><div id="role-description-error" class="field-error" role="alert">${esc(error ?? "")}</div><p id="role-description-help" class="muted">${esc(copy("descriptionHelp"))}</p></div>`;
  }
  function create() {
    const draft = state.data.adminRoleCreateDraft ?? {};
    const errors = violations(state.error?.body);
    if (state.error?.status === 409 && !errors.name)
      errors.name = state.error.body?.detail ?? text("adminRoleNameFormat");
    return `<section class="card"><form data-form="admin-role-create" novalidate><div class="field"><label for="role-name">${esc(text("adminRoleName"))}</label><input id="role-name" name="name" maxlength="50" autocomplete="off" placeholder="ROLE_AUDITOR" value="${esc(draft.name ?? "")}" aria-describedby="role-name-error role-name-help" aria-invalid="${Boolean(errors.name)}" required/><div id="role-name-error" class="field-error" role="alert">${esc(errors.name ?? "")}</div><p id="role-name-help" class="muted">${esc(copy("nameHelp"))}</p></div>${descriptionField(draft.description, errors.description)}<div class="actions">${button(text("cancel"), { action: "role-back", icon: "arrowLeft", variant: "secondary", disabled: blocked() })}${button(text("adminCreateRole"), { type: "submit", icon: "add", busy: state.busy === "role-create", disabled: blocked() || !manage() })}</div></form></section>`;
  }
  function candidateState(kind) {
    state.data.roleCandidates ??= {};
    return (state.data.roleCandidates[kind] ??= {
      query: "",
      items: [],
      selected: "",
      loading: false,
      error: false,
    });
  }
  function candidatePicker(kind, title) {
    if (!manage()) return "";
    const candidate = candidateState(kind);
    const selected = candidate.items.find(
      (item) =>
        String(kind === "realm" ? item.name : item.id) === candidate.selected,
    );
    const label = (item) =>
      kind === "client"
        ? `${item.clientId} / ${item.name}`
        : kind === "user"
          ? item.username
          : item.name;
    const actionName =
      kind === "realm"
        ? "admin-role-composite-add"
        : kind === "client"
          ? "admin-role-client-composite-add"
          : "role-user-add";
    const name = state.data.roleDetailName;
    const busyKey =
      kind === "realm"
        ? `role-composite-add:${name}:${candidate.selected}`
        : kind === "client"
          ? `role-client-composite-add:${name}:${candidate.selected}`
          : "role-user-add";
    return `<div class="role-candidate" data-role-candidate="${kind}"><label for="role-candidate-${kind}">${esc(title)}</label><div class="actions"><input id="role-candidate-${kind}" type="search" name="${kind === "client" ? "client-q" : "q"}" data-role-candidate-query="${kind}" maxlength="100" value="${esc(candidate.query)}" placeholder="${esc(title)}" ${state.busy && !state.busy.startsWith("role-read") ? "disabled" : ""}/>${spin(candidate.loading)}</div><p class="muted" role="status">${esc(candidate.query.trim().length < 2 ? copy("minimum") : candidate.loading ? text("loading") : candidate.error ? copy("loadError") : candidate.items.length ? "" : copy("noCandidates"))}</p>${candidate.error || candidate.retrying ? button(text("adminRetry"), { action: "role-candidate-retry", id: kind, busy: candidate.loading, disabled: blocked() }) : ""}<div class="actions"><select id="role-candidate-select-${kind}" data-role-candidate-select="${kind}" aria-label="${esc(copy("select"))}" ${blocked() || candidate.loading || !candidate.items.length ? "disabled" : ""}><option value="">${esc(copy("select"))}</option>${candidate.items.map((item) => `<option value="${esc(kind === "realm" ? item.name : item.id)}" ${candidate.selected === String(kind === "realm" ? item.name : item.id) ? "selected" : ""}>${esc(label(item))}</option>`).join("")}</select>${button(copy("assign"), { action: actionName, id: name, child: kind === "realm" ? selected?.name : undefined, clientRoleId: kind === "client" ? selected?.id : undefined, memberId: kind === "user" ? selected?.id : undefined, icon: "add", busy: state.busy === busyKey, disabled: blocked() || candidate.loading || !selected })}</div></div>`;
  }
  function compositionPanel(name, composition) {
    const roleNames = (composition.compositeRoles ?? []).filter(validName);
    const clients = composition.compositeClientRoles ?? [];
    const remove = (kind, item) => {
      if (!manage()) return "";
      const client = kind === "client";
      const id = client ? String(item.id) : item;
      const confirming = client
        ? composition.removeClientConfirmId === id
        : composition.removeConfirmName === id;
      const prefix = client
        ? "admin-role-client-composite-remove"
        : "admin-role-composite-remove";
      return `<div class="actions">${confirming ? `<span role="alert">${esc(text(client ? "adminRoleCompositeClientRemoveConfirm" : "adminRoleCompositeRemoveConfirm"))}</span>` : ""}${button(text(client ? "adminRoleCompositeClientRemove" : "adminRoleCompositeRemove"), { action: `${prefix}-${confirming ? "confirm" : "request"}`, id: name, child: client ? undefined : id, clientRoleId: client ? id : undefined, danger: true, icon: "delete", busy: state.busy === `${client ? "role-client-composite-remove" : "role-composite-remove"}:${name}:${id}`, disabled: blocked() })}${confirming ? button(text("cancel"), { action: `${prefix}-cancel`, id: name, variant: "secondary", disabled: blocked() }) : ""}</div>`;
    };
    return `<section class="card" data-role-composition="${esc(name)}"><h2>${esc(text("adminRoleCompositesTitle"))}</h2><p class="muted">${esc(text("adminRoleCompositesHelp"))}</p>${candidatePicker("realm", text("adminRoleCompositeSearch"))}<div class="list">${roleNames.map((role) => `<article class="list-item"><strong class="role-name">${esc(role)}</strong>${remove("realm", role)}</article>`).join("") || `<p class="empty">${esc(text("adminRoleCompositeEmpty"))}</p>`}</div></section><section class="card"><h2>${esc(text("adminRoleCompositeClientTitle"))}</h2>${candidatePicker("client", text("adminRoleCompositeClientSearch"))}<div class="list">${clients.map((role) => `<article class="list-item"><div><strong class="role-name">${esc(role.clientId)} / ${esc(role.name)}</strong><span class="muted">${esc(role.description ?? "")}</span></div>${remove("client", role)}</article>`).join("") || `<p class="empty">${esc(text("adminRoleCompositeClientEmpty"))}</p>`}</div></section>`;
  }
  function users() {
    if (state.data.roleUsersError) return loadError();
    const detail = state.data.roleDetail;
    const page = rolePage(detail.users, state.data.roleUsersSize ?? 10);
    const rows = page.content
      .map((user) => {
        const confirming = Number(state.data.roleUserRemoveConfirm) === user.id;
        return `<tr><td><button class="admin-user-detail-link" type="button" data-action="role-user-open" data-id="${user.id}" ${blocked() || !(state.data.adminAccess?.viewUsers || state.data.adminAccess?.queryUsers) ? "disabled" : ""}>${esc(user.username)}</button></td><td><span class="admin-user-status ${user.enabled ? "is-enabled" : "is-disabled"}">${esc(text(user.enabled ? "adminUserEnabled" : "adminUserDisabled"))}</span></td><td>${manage() ? `<div class="actions">${confirming ? `<span role="alert">${esc(copy("removePrompt"))}</span>` : ""}${button(copy("removeUser"), { action: confirming ? "role-user-remove-confirm" : "role-user-remove", id: user.id, danger: true, icon: "remove", busy: state.busy === `role-user-remove:${user.id}`, disabled: blocked() })}${confirming ? button(text("cancel"), { action: "role-user-remove-cancel", variant: "secondary", disabled: blocked() }) : ""}</div>` : ""}</td></tr>`;
      })
      .join("");
    return `${manage() ? `<section class="card"><h2>${esc(copy("assign"))}</h2>${candidatePicker("user", copy("userSearch"))}</section>` : ""}<section class="admin-users-panel">${filters(true)}${rows ? `<div class="admin-users-table-wrap"><table class="admin-users-table"><thead><tr><th>${esc(text("adminUsername"))}</th><th>${esc(copy("status"))}</th><th><span class="sr-only">${esc(copy("actions"))}</span></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="empty" role="status">${esc(text("adminNoUsers"))}</p>`}${pagination(page, true)}</section>`;
  }
  function detail() {
    if (state.data.roleUsersError || !state.data.roleDetail) return loadError();
    const role = state.data.roleDetail;
    const name = role.name;
    const tab = state.data.roleDetailTab ?? "details";
    const draft = state.data.adminRoleDrafts?.[name];
    const error =
      state.data.adminRoleErrorName === name
        ? violations(state.error?.body).description
        : "";
    return `<div class="role-detail-summary"><span>${role.userCount} ${esc(copy("assigned"))}</span>${badge(role)}</div><div class="admin-user-detail-tabs" role="tablist">${["details", "users"].map((value) => `<button type="button" role="tab" id="role-tab-${value}" aria-controls="role-tab-panel" aria-selected="${value === tab}" class="admin-user-detail-tab ${value === tab ? "is-active" : ""}" data-action="role-tab" data-id="${value}" ${blocked() ? "disabled" : ""}>${spin(state.busy === "role-read-tab" && value === tab)}${esc(copy(value))}</button>`).join("")}</div><div id="role-tab-panel" role="tabpanel" aria-labelledby="role-tab-${tab}">${tab === "users" ? users() : `<form class="card" data-form="admin-role-edit" data-role-name="${esc(name)}" novalidate><h2>${esc(copy("details"))}</h2>${descriptionField(draft?.description ?? role.description, error, !manage() || blocked())}${manage() ? button(copy("saveDescription"), { type: "submit", icon: "save", busy: state.busy === `role-update:${name}`, disabled: blocked() }) : ""}</form>${compositionPanel(name, state.data.adminRoleCompositions?.[name] ?? role)}`}</div>`;
  }
  async function searchCandidates(kind) {
    if (!manage() || state.offline || state.route !== "role-detail") return;
    const candidate = candidateState(kind);
    const query = candidate.query.trim();
    const generation = invalidate(kind);
    const name = state.data.roleDetailName;
    candidate.items = [];
    candidate.selected = "";
    candidate.error = false;
    if (query.length < 2) {
      candidate.loading = false;
      render();
      return;
    }
    candidate.loading = true;
    state.error = null;
    render();
    const isCurrent = () => current(kind, generation, "role-detail", name);
    try {
      const endpoint =
        kind === "realm"
          ? "available-composites"
          : kind === "client"
            ? "available-client-composites"
            : "available-users";
      const page = await request(
        `/api/admin/roles/${encodeURIComponent(name)}/${endpoint}?q=${encodeURIComponent(query)}&page=0&size=10&sort=${kind === "user" ? "username" : "name"},asc`,
        { isCurrent },
      );
      if (!isCurrent()) return;
      const composition = state.data.adminRoleCompositions[name];
      candidate.items = rolePage(page).content.filter((item) =>
        kind === "realm"
          ? validName(item.name) &&
            item.name !== name &&
            !composition.compositeRoles.includes(item.name)
          : kind === "client"
            ? Number.isSafeInteger(item.id) &&
              item.id > 0 &&
              /^[A-Za-z0-9_-]{1,100}$/.test(item.clientId ?? "") &&
              typeof item.name === "string" &&
              !composition.compositeClientRoles.some(
                (role) => role.id === item.id,
              )
            : Number.isSafeInteger(item.id) &&
              item.id > 0 &&
              !rolePage(state.data.roleDetail.users).content.some(
                (user) => user.id === item.id,
              ),
      );
      // Existing POST handlers validate the selected item against these collections.
      if (kind === "realm") composition.candidates = candidate.items;
      if (kind === "client") composition.clientCandidates = candidate.items;
    } catch {
      if (isCurrent()) candidate.error = true;
    } finally {
      if (isCurrent()) {
        candidate.retrying = false;
        candidate.loading = false;
        render();
      }
    }
  }
  async function open(name) {
    if (!validName(name) || !state.data.adminAccess?.viewRoles) return;
    for (const key of generations.keys()) invalidate(key);
    state.route = "role-detail";
    state.data.roleDetailName = name;
    state.data.roleDetailTab = "details";
    state.data.roleDetail = null;
    state.data.roleUsersError = null;
    state.data.roleUsersPage = 0;
    state.data.roleUsersQuery = "";
    state.data.roleUsersSearchDraft = "";
    state.data.roleUsersEnabled = "";
    state.data.roleUsersSort = "username,asc";
    state.data.roleCandidates = {};
    await reload("role-read-open", true);
  }
  async function handle(name, element) {
    if (!name.startsWith("role-")) return false;
    if (name === "role-open") {
      if (!blocked()) await open(element.dataset.id);
      return true;
    }
    if (name === "role-back") {
      if (blocked()) return true;
      for (const key of generations.keys()) invalidate(key);
      state.route = "roles";
      state.error = null;
      state.notice = null;
      await reload("role-read-back");
      return true;
    }
    if (name === "role-tab") {
      if (blocked() || !["details", "users"].includes(element.dataset.id))
        return true;
      state.data.roleDetailTab = element.dataset.id;
      state.data.roleFocusTab = `role-tab-${element.dataset.id}`;
      await reload("role-read-tab");
      return true;
    }
    if (name === "role-page") {
      if (blocked()) return true;
      const users = element.dataset.kind === "users";
      const page = Number(element.dataset.target);
      const metadata = rolePage(
        users ? state.data.roleDetail.users : state.data.roles,
      );
      if (
        !Number.isSafeInteger(page) ||
        page < 0 ||
        page >= metadata.totalPages
      )
        return true;
      state.data[users ? "roleUsersPage" : "rolePage"] = page;
      await reload(`role-read-page:${page}`);
      return true;
    }
    if (name === "role-clear") {
      if (blocked()) return true;
      const prefix = element.dataset.id === "users" ? "roleUsers" : "role";
      state.data[`${prefix}Query`] = "";
      state.data[`${prefix}SearchDraft`] = "";
      state.data[`${prefix}Page`] = 0;
      if (prefix === "roleUsers") state.data.roleUsersEnabled = "";
      await reload("role-read-clear");
      return true;
    }
    if (name === "role-candidate-retry") {
      if (candidateState(element.dataset.id).loading) return true;
      candidateState(element.dataset.id).retrying = true;
      await searchCandidates(element.dataset.id);
      return true;
    }
    if (name === "role-user-open") {
      if (blocked()) return true;
      state.data.roleReturnFromUser = true;
      await action("admin-user-detail-open", element);
      return true;
    }
    if (name === "role-user-remove-cancel") {
      if (!blocked()) {
        state.data.roleUserRemoveConfirm = null;
        render();
      }
      return true;
    }
    if (
      [
        "role-user-add",
        "role-user-remove",
        "role-user-remove-confirm",
      ].includes(name)
    ) {
      if (!manage() || blocked()) return true;
      const adding = name === "role-user-add";
      const candidate = candidateState("user");
      const id = Number(adding ? element.dataset.memberId : element.dataset.id);
      if (!Number.isSafeInteger(id) || id <= 0) return true;
      if (
        adding &&
        !candidate.items.some(
          (item) => item.id === id && String(id) === candidate.selected,
        )
      )
        return true;
      if (
        !adding &&
        !rolePage(state.data.roleDetail.users).content.some(
          (item) => item.id === id,
        )
      )
        return true;
      if (name === "role-user-remove") {
        state.data.roleUserRemoveConfirm = id;
        render();
        return true;
      }
      if (!adding && state.data.roleUserRemoveConfirm !== id) return true;
      state.busy = adding ? name : `role-user-remove:${id}`;
      state.error = null;
      render();
      try {
        await request(
          `/api/admin/roles/${encodeURIComponent(state.data.roleDetailName)}/users${adding ? "" : `/${id}`}`,
          {
            method: adding ? "POST" : "DELETE",
            ...(adding ? { body: { userId: id } } : {}),
          },
        );
        candidate.items = [];
        candidate.selected = "";
        candidate.query = "";
        state.data.roleUserRemoveConfirm = null;
        await load();
        state.notice = copy(adding ? "userAssigned" : "userRemoved");
      } catch {
        /* The shared request handler displays localized API errors. */
      } finally {
        state.busy = null;
        render();
      }
      return true;
    }
    return false;
  }
  function bind(document) {
    if (!["roles", "role-detail", "role-create"].includes(state.route)) {
      for (const key of generations.keys()) invalidate(key);
      return;
    }
    for (const users of [false, true]) {
      const prefix = users ? "roleUsers" : "role";
      const queryId = users ? "role-users-query" : "admin-role-query";
      const schedule = (input, immediate = false) => {
        state.data[`${prefix}SearchDraft`] = input.value;
        const key = users ? "members" : "list";
        invalidate(key);
        const run = () => {
          if (blocked() && !state.busy?.startsWith("role-read")) {
            timers.set(key, setTimeout(run, 100));
            return;
          }
          state.data[`${prefix}Query`] = input.value.trim();
          state.data[`${prefix}Page`] = 0;
          void reload("role-read-search");
        };
        timers.set(key, setTimeout(run, immediate ? 0 : 300));
      };
      document.getElementById(queryId)?.addEventListener("input", (event) => {
        state.data[`${prefix}SearchDraft`] = event.currentTarget.value;
        invalidate(users ? "members" : "list");
        if (!event.isComposing) schedule(event.currentTarget);
      });
      document
        .getElementById(queryId)
        ?.addEventListener("compositionend", (event) =>
          schedule(event.currentTarget),
        );
      document
        .getElementById(users ? "role-users-search" : "admin-role-search")
        ?.addEventListener("submit", (event) => {
          event.preventDefault();
          schedule(event.currentTarget.querySelector("input"), true);
        });
      for (const type of ["sort", "size", ...(users ? ["enabled"] : [])]) {
        document
          .getElementById(`${users ? "role-users" : "role"}-${type}`)
          ?.addEventListener("change", (event) => {
            if (blocked()) return;
            const value = event.currentTarget.value;
            if (type === "size" && ![10, 20, 50, 100].includes(Number(value)))
              return;
            state.data[
              type === "enabled"
                ? "roleUsersEnabled"
                : `${prefix}${type === "size" ? "Size" : "Sort"}`
            ] = type === "size" ? Number(value) : value;
            state.data[`${prefix}Page`] = 0;
            void reload(`role-read-${type}`);
          });
      }
    }
    document
      .querySelectorAll("[data-role-candidate-query]")
      .forEach((input) => {
        input.addEventListener("input", (event) => {
          const kind = input.dataset.roleCandidateQuery;
          const candidate = candidateState(kind);
          candidate.query = input.value;
          candidate.selected = "";
          candidate.items = [];
          candidate.loading = false;
          invalidate(kind);
          const selected = document.getElementById(
            `role-candidate-select-${kind}`,
          );
          if (selected) {
            selected.value = "";
            selected.disabled = true;
          }
          const assign = input
            .closest("[data-role-candidate]")
            .querySelector("button:last-child");
          if (assign) assign.disabled = true;
          if (!event.isComposing)
            timers.set(
              kind,
              setTimeout(() => void searchCandidates(kind), 300),
            );
        });
        input.addEventListener("compositionend", () => {
          invalidate(input.dataset.roleCandidateQuery);
          timers.set(
            input.dataset.roleCandidateQuery,
            setTimeout(
              () => void searchCandidates(input.dataset.roleCandidateQuery),
              300,
            ),
          );
        });
      });
    document
      .querySelectorAll("[data-role-candidate-select]")
      .forEach((select) =>
        select.addEventListener("change", () => {
          candidateState(select.dataset.roleCandidateSelect).selected =
            select.value;
          render();
          document.getElementById(select.id)?.focus();
        }),
      );
    document.querySelectorAll(".role-menu").forEach((menu) =>
      menu.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          menu.open = false;
          menu.querySelector("summary").focus();
        }
        if (["ArrowDown", "ArrowUp"].includes(event.key)) {
          event.preventDefault();
          menu.open = true;
          const items = [...menu.querySelectorAll("button:not(:disabled)")];
          const index = items.indexOf(document.activeElement);
          items[
            (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
              items.length
          ]?.focus();
        }
      }),
    );
    document
      .querySelectorAll(
        '[data-form="admin-role-create"] input, [data-form="admin-role-create"] textarea, [data-form="admin-role-edit"] textarea',
      )
      .forEach((input) =>
        input.addEventListener("input", () => {
          const error = input.closest(".field")?.querySelector(".field-error");
          if (error) error.textContent = "";
          input.setAttribute("aria-invalid", "false");
          if (state.error?.body?.violations)
            state.error.body.violations = state.error.body.violations.filter(
              (item) => item.field !== input.name,
            );
          if (input.name === "name" && state.error?.status === 409)
            state.error = null;
        }),
      );
    if (
      state.route === "role-create" &&
      !state.data.roleCreateFocused &&
      !state.loading
    ) {
      document.getElementById("role-name")?.focus();
      state.data.roleCreateFocused = true;
    }
    const tabs = [...document.querySelectorAll('[data-action="role-tab"]')];
    if (state.data.roleFocusTab && !state.busy) {
      document
        .getElementById(state.data.roleFocusTab)
        ?.focus({ preventScroll: true });
      state.data.roleFocusTab = null;
    }
    tabs.forEach((tab, index) =>
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        const target =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : (index + 1) % tabs.length;
        tabs[target]?.focus();
        tabs[target]?.click();
      }),
    );
  }
  return {
    list,
    detail,
    create,
    compositionPanel,
    load,
    open,
    handle,
    bind,
    breadcrumb: () =>
      breadcrumb(
        state.route === "role-create"
          ? text("adminCreateRole")
          : state.data.roleDetailName,
      ),
    subtitle: () => copy("subtitle"),
  };
}
