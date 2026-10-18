import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const rolePath = "/api/admin/roles/ROLE_USER";
const detailPath = `${rolePath}?q=&page=0&size=10&sort=username%2Casc`;
const emit = (document, element, type = "click") =>
  element.dispatchEvent(
    new document.defaultView.Event(type, { bubbles: true, cancelable: true }),
  );
const delay = () => new Promise((resolve) => setTimeout(resolve, 360));

async function openRole(harness) {
  harness.setResponse(detailPath, "GET", () => ({
    name: "ROLE_USER",
    description: "Users",
    userCount: 2,
    protectedRole: true,
    compositeRoles: ["ROLE_EDITOR"],
    compositeClientRoles: [{ id: 42, clientId: "reports", name: "READ" }],
    users: { content: [], page: { number: 0, size: 10, totalElements: 0, totalPages: 0 } },
  }));
  await settle();
  harness.document.querySelector('[data-route="roles"]').click();
  await settle();
  harness.document
    .querySelector('[data-action="role-open"][data-id="ROLE_USER"]')
    .click();
  await settle();
}

async function searchCandidate(harness, kind, query, memberId) {
  const searchPath =
    kind === "realm"
      ? `${rolePath}/available-composites?q=${query}&page=0&size=10&sort=name,asc`
      : `${rolePath}/available-client-composites?q=${query}&page=0&size=10&sort=name,asc`;
  harness.setResponse(searchPath, "GET", () => ({
    content:
      kind === "realm"
        ? [{ name: memberId }, { name: "not a valid role" }]
        : [{ id: Number(memberId), clientId: "reports", name: "WRITE" }],
  }));
  const search = harness.document.getElementById(`role-candidate-${kind}`);
  search.value = query;
  emit(harness.document, search, "input");
  await delay();
  await settle();
  const select = harness.document.getElementById(`role-candidate-select-${kind}`);
  select.value = memberId;
  emit(harness.document, select, "change");
  await settle();
}

test("role composite membership add and remove flows cover realm and client roles", async () => {
  const harness = await renderConsole("admin");
  try {
    await openRole(harness);

    const realmAddPath = `${rolePath}/composites/ROLE_REVIEWER?page=0&size=20&sort=username,asc`;
    harness.setResponse(realmAddPath, "POST", () => ({
      compositeRoles: ["ROLE_EDITOR", "ROLE_REVIEWER"],
      userCount: 3,
    }));
    await searchCandidate(harness, "realm", "ROLE", "ROLE_REVIEWER");
    const realmAdd = harness.document.querySelector(
      '[data-action="admin-role-composite-add"][data-child="ROLE_REVIEWER"]',
    );
    assert.equal(realmAdd.disabled, false);
    emit(harness.document, realmAdd);
    await settle();
    assert.ok(
      harness.calls.some(({ path, method }) => path === realmAddPath && method === "POST"),
    );
    assert.match(harness.document.querySelector('[data-role-composition="ROLE_USER"]').textContent, /ROLE_REVIEWER/);

    const realmRemovePath = `${rolePath}/composites/ROLE_EDITOR?page=0&size=20&sort=username,asc`;
    harness.setResponse(realmRemovePath, "DELETE", () => ({
      compositeRoles: ["ROLE_REVIEWER"],
      userCount: 1,
    }));
    emit(
      harness.document,
      harness.document.querySelector(
        '[data-action="admin-role-composite-remove-request"][data-child="ROLE_EDITOR"]',
      ),
    );
    await settle();
    assert.equal(
      harness.calls.some(({ path, method }) => path === realmRemovePath && method === "DELETE"),
      false,
    );
    emit(
      harness.document,
      harness.document.querySelector('[data-action="admin-role-composite-remove-cancel"]'),
    );
    await settle();
    emit(
      harness.document,
      harness.document.querySelector(
        '[data-action="admin-role-composite-remove-request"][data-child="ROLE_EDITOR"]',
      ),
    );
    await settle();
    emit(
      harness.document,
      harness.document.querySelector(
        '[data-action="admin-role-composite-remove-confirm"][data-child="ROLE_EDITOR"]',
      ),
    );
    await settle();
    assert.ok(
      harness.calls.some(({ path, method }) => path === realmRemovePath && method === "DELETE"),
    );

    const clientAddPath = `${rolePath}/client-composites/43?page=0&size=20&sort=username,asc`;
    harness.setResponse(clientAddPath, "POST", () => ({
      compositeClientRoles: [
        { id: 42, clientId: "reports", name: "READ" },
        { id: 43, clientId: "reports", name: "WRITE" },
      ],
      userCount: 4,
    }));
    await searchCandidate(harness, "client", "client", "43");
    const clientAdd = harness.document.querySelector(
      '[data-action="admin-role-client-composite-add"][data-client-role-id="43"]',
    );
    assert.equal(clientAdd.disabled, false);
    emit(harness.document, clientAdd);
    await settle();
    assert.ok(
      harness.calls.some(({ path, method }) => path === clientAddPath && method === "POST"),
    );

    const clientRemovePath = `${rolePath}/client-composites/42?page=0&size=20&sort=username,asc`;
    harness.setResponse(clientRemovePath, "DELETE", () => ({
      compositeClientRoles: [{ id: 43, clientId: "reports", name: "WRITE" }],
      userCount: 2,
    }));
    emit(
      harness.document,
      harness.document.querySelector(
        '[data-action="admin-role-client-composite-remove-request"][data-client-role-id="42"]',
      ),
    );
    await settle();
    emit(
      harness.document,
      harness.document.querySelector(
        '[data-action="admin-role-client-composite-remove-confirm"][data-client-role-id="42"]',
      ),
    );
    await settle();
    assert.ok(
      harness.calls.some(({ path, method }) => path === clientRemovePath && method === "DELETE"),
    );
    assert.match(harness.document.body.textContent, /WRITE/);
  } finally {
    harness.restore();
  }
});
