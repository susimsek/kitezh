package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AuthorizationPermissionEntity;
import io.github.susimsek.kitezh.domain.AuthorizationPolicyEntity;
import io.github.susimsek.kitezh.domain.AuthorizationResourceEntity;
import io.github.susimsek.kitezh.domain.AuthorizationResourceScopeEntity;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationPermissionRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationPolicyRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationResourceRequestDTO;
import io.github.susimsek.kitezh.repository.AuthorizationPermissionRepository;
import io.github.susimsek.kitezh.repository.AuthorizationPolicyRepository;
import io.github.susimsek.kitezh.repository.AuthorizationResourceRepository;
import io.github.susimsek.kitezh.repository.AuthorizationResourceScopeRepository;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

@ExtendWith(MockitoExtension.class)
class AdminAuthorizationServicesServiceTest {

    private static final String CLIENT_ID = "orders-api";
    private static final String RESOURCE_ID = "resource-1";
    private static final String POLICY_ID = "policy-1";
    private static final String PERMISSION_ID = "permission-1";

    @Mock private AuthorizationResourceRepository resourceRepository;
    @Mock private AuthorizationResourceScopeRepository scopeRepository;
    @Mock private AuthorizationPolicyRepository policyRepository;
    @Mock private AuthorizationPermissionRepository permissionRepository;
    @Mock private ClientRepository clientRepository;
    @Mock private AdminAuditEventService auditEventService;

    private AdminAuthorizationServicesService service;

    @BeforeEach
    void setUp() {
        service =
                new AdminAuthorizationServicesService(
                        resourceRepository,
                        scopeRepository,
                        policyRepository,
                        permissionRepository,
                        clientRepository,
                        auditEventService);
    }

    @Test
    void pagesAndLoadsResourcesWithSortedScopesAndNormalizedQuery() {
        AuthorizationResourceEntity resource = resource();
        when(resourceRepository.findByNameContainingIgnoreCase("Orders", PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(resource)));
        when(scopeRepository.findByResourceIdIn(List.of(RESOURCE_ID)))
                .thenReturn(List.of(scope("view"), scope("edit")));
        assertThat(
                        service.resources(" Orders ", PageRequest.of(0, 20))
                                .getContent()
                                .getFirst()
                                .scopes())
                .containsExactly("edit", "view");

        when(resourceRepository.findById(RESOURCE_ID)).thenReturn(Optional.of(resource));
        when(scopeRepository.findByResourceId(RESOURCE_ID)).thenReturn(List.of(scope("view")));
        assertThat(service.resource(RESOURCE_ID).scopes()).containsExactly("view");
        assertThatThrownBy(() -> service.resource("missing")).isInstanceOf(ApiException.class);
    }

    @Test
    void createsAndUpdatesResourceAndAuditsChanges() {
        when(clientRepository.existsByClientId(CLIENT_ID)).thenReturn(true);
        when(resourceRepository.existsByResourceServerClientIdAndNameIgnoreCase(
                        CLIENT_ID, "Orders"))
                .thenReturn(false);
        when(scopeRepository.existsByResourceIdAndName(any(), any())).thenReturn(false);
        when(scopeRepository.findByResourceId(any())).thenReturn(List.of());
        var created =
                service.createResource(
                        new AdminAuthorizationResourceRequestDTO(
                                CLIENT_ID,
                                " Orders ",
                                " type ",
                                " uri ",
                                " alice ",
                                true,
                                List.of("view", "edit")));
        assertThat(created.name()).isEqualTo("Orders");
        assertThat(created.type()).isEqualTo("type");
        verify(auditEventService)
                .record("authorization.resource.created", "authorization-resource", created.id());

        AuthorizationResourceEntity resource = resource();
        when(resourceRepository.findById(RESOURCE_ID)).thenReturn(Optional.of(resource));
        when(resourceRepository.existsByResourceServerClientIdAndNameIgnoreCaseAndIdNot(
                        CLIENT_ID, "Orders Updated", RESOURCE_ID))
                .thenReturn(false);
        when(scopeRepository.findByResourceId(RESOURCE_ID)).thenReturn(List.of(scope("view")));
        when(permissionRepository.existsByResourceIdAndScopeName(RESOURCE_ID, "view"))
                .thenReturn(false);
        when(scopeRepository.existsByResourceIdAndName(RESOURCE_ID, "edit")).thenReturn(true);
        var updated =
                service.updateResource(
                        RESOURCE_ID,
                        new AdminAuthorizationResourceRequestDTO(
                                CLIENT_ID,
                                "Orders Updated",
                                " ",
                                null,
                                "alice",
                                false,
                                List.of("edit")));
        assertThat(updated.name()).isEqualTo("Orders Updated");
        assertThat(updated.type()).isNull();
        verify(auditEventService)
                .record("authorization.resource.updated", "authorization-resource", RESOURCE_ID);
        service.deleteResource(RESOURCE_ID);
        verify(resourceRepository).delete(resource);
        verify(auditEventService)
                .record("authorization.resource.deleted", "authorization-resource", RESOURCE_ID);
    }

    @Test
    void rejectsResourceWhenClientDuplicateScopesOrAssignedScopeIsInvalid() {
        when(clientRepository.existsByClientId(CLIENT_ID)).thenReturn(false);
        assertThatThrownBy(() -> service.createResource(resourceRequest(List.of("view"))))
                .isInstanceOf(ApiException.class);
        when(clientRepository.existsByClientId(CLIENT_ID)).thenReturn(true);
        when(resourceRepository.existsByResourceServerClientIdAndNameIgnoreCase(any(), any()))
                .thenReturn(true);
        assertThatThrownBy(() -> service.createResource(resourceRequest(List.of("view"))))
                .isInstanceOf(ApiException.class);
        when(resourceRepository.existsByResourceServerClientIdAndNameIgnoreCase(any(), any()))
                .thenReturn(false);
        assertThatThrownBy(() -> service.createResource(resourceRequest(List.of("view", " view "))))
                .isInstanceOf(ApiException.class);

        AuthorizationResourceEntity resource = resource();
        when(resourceRepository.findById(RESOURCE_ID)).thenReturn(Optional.of(resource));
        when(clientRepository.existsByClientId(CLIENT_ID)).thenReturn(true);
        when(resourceRepository.existsByResourceServerClientIdAndNameIgnoreCaseAndIdNot(
                        CLIENT_ID, "Changed", RESOURCE_ID))
                .thenReturn(false);
        when(scopeRepository.findByResourceId(RESOURCE_ID)).thenReturn(List.of(scope("view")));
        when(permissionRepository.existsByResourceIdAndScopeName(RESOURCE_ID, "view"))
                .thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service.updateResource(
                                        RESOURCE_ID,
                                        new AdminAuthorizationResourceRequestDTO(
                                                CLIENT_ID,
                                                "Changed",
                                                null,
                                                null,
                                                "alice",
                                                false,
                                                List.of("edit"))))
                .isInstanceOf(ApiException.class);
        verify(resourceRepository, never()).save(any());
    }

    @Test
    void createsUpdatesAndDeletesPoliciesWithTypeValueRules() {
        when(clientRepository.existsByClientId(CLIENT_ID)).thenReturn(true);
        when(policyRepository.existsByResourceServerClientIdAndNameIgnoreCase(any(), any()))
                .thenReturn(false);
        var created = service.createPolicy(policyRequest("ROLE", "ROLE_EDITOR"));
        assertThat(created.type()).isEqualTo("ROLE");
        verify(auditEventService)
                .record("authorization.policy.created", "authorization-policy", created.id());

        when(policyRepository.findById(POLICY_ID)).thenReturn(Optional.of(policy()));
        when(policyRepository.existsByResourceServerClientIdAndNameIgnoreCaseAndIdNot(
                        CLIENT_ID, "Updated", POLICY_ID))
                .thenReturn(false);
        var updated = service.updatePolicy(POLICY_ID, policyRequest("PUBLIC", null));
        assertThat(updated.subjectValue()).isNull();
        verify(auditEventService)
                .record("authorization.policy.updated", "authorization-policy", POLICY_ID);
        service.deletePolicy(POLICY_ID);
        verify(policyRepository).delete(any(AuthorizationPolicyEntity.class));
        verify(auditEventService)
                .record("authorization.policy.deleted", "authorization-policy", POLICY_ID);
        assertThatThrownBy(() -> service.updatePolicy("missing", policyRequest("PUBLIC", null)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsPolicyValueMismatchUnregisteredClientAndDuplicateName() {
        when(clientRepository.existsByClientId(CLIENT_ID)).thenReturn(false);
        assertThatThrownBy(() -> service.createPolicy(policyRequest("PUBLIC", null)))
                .isInstanceOf(ApiException.class);
        when(clientRepository.existsByClientId(CLIENT_ID)).thenReturn(true);
        when(policyRepository.existsByResourceServerClientIdAndNameIgnoreCase(any(), any()))
                .thenReturn(false);
        assertThatThrownBy(() -> service.createPolicy(policyRequest("ROLE", null)))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.createPolicy(policyRequest("PUBLIC", "unexpected")))
                .isInstanceOf(ApiException.class);
        when(policyRepository.existsByResourceServerClientIdAndNameIgnoreCase(any(), any()))
                .thenReturn(true);
        assertThatThrownBy(() -> service.createPolicy(policyRequest("PUBLIC", null)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void createsUpdatesAndDeletesPermissionWithValidatedScopeAndPolicies() {
        AuthorizationResourceEntity resource = resource();
        AuthorizationPolicyEntity policy = policy();
        when(resourceRepository.findById(RESOURCE_ID)).thenReturn(Optional.of(resource));
        when(scopeRepository.existsByResourceIdAndName(RESOURCE_ID, "view")).thenReturn(true);
        when(policyRepository.findAllById(org.mockito.ArgumentMatchers.<Iterable<String>>any()))
                .thenReturn(List.of(policy));
        when(permissionRepository.existsByResourceIdAndNameIgnoreCase(any(), any()))
                .thenReturn(false);
        var created = service.createPermission(permissionRequest());
        assertThat(created.policyIds()).containsExactly(POLICY_ID);
        verify(auditEventService)
                .record(
                        "authorization.permission.created",
                        "authorization-permission",
                        created.id());

        AuthorizationPermissionEntity permission = permission();
        when(permissionRepository.findById(PERMISSION_ID)).thenReturn(Optional.of(permission));
        when(permissionRepository.existsByResourceIdAndNameIgnoreCaseAndIdNot(
                        RESOURCE_ID, "Read updated", PERMISSION_ID))
                .thenReturn(false);
        var updated =
                service.updatePermission(
                        PERMISSION_ID,
                        new AdminAuthorizationPermissionRequestDTO(
                                RESOURCE_ID,
                                "Read updated",
                                "view",
                                "AFFIRMATIVE",
                                List.of(POLICY_ID)));
        assertThat(updated.name()).isEqualTo("Read updated");
        verify(auditEventService)
                .record(
                        "authorization.permission.updated",
                        "authorization-permission",
                        PERMISSION_ID);
        service.deletePermission(PERMISSION_ID);
        verify(permissionRepository).delete(permission);
        verify(auditEventService)
                .record(
                        "authorization.permission.deleted",
                        "authorization-permission",
                        PERMISSION_ID);
    }

    @Test
    void rejectsPermissionForUnknownResourceScopeDuplicateOrForeignPolicy() {
        when(resourceRepository.findById(RESOURCE_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.createPermission(permissionRequest()))
                .isInstanceOf(ApiException.class);
        when(resourceRepository.findById(RESOURCE_ID)).thenReturn(Optional.of(resource()));
        when(permissionRepository.existsByResourceIdAndNameIgnoreCase(any(), any()))
                .thenReturn(true);
        assertThatThrownBy(() -> service.createPermission(permissionRequest()))
                .isInstanceOf(ApiException.class);
        when(permissionRepository.existsByResourceIdAndNameIgnoreCase(any(), any()))
                .thenReturn(false);
        when(scopeRepository.existsByResourceIdAndName(RESOURCE_ID, "view")).thenReturn(false);
        assertThatThrownBy(() -> service.createPermission(permissionRequest()))
                .isInstanceOf(ApiException.class);
        when(scopeRepository.existsByResourceIdAndName(RESOURCE_ID, "view")).thenReturn(true);
        AuthorizationPolicyEntity foreignPolicy = policy();
        foreignPolicy.setResourceServerClientId("other-api");
        when(policyRepository.findAllById(org.mockito.ArgumentMatchers.<Iterable<String>>any()))
                .thenReturn(List.of(foreignPolicy));
        assertThatThrownBy(() -> service.createPermission(permissionRequest()))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(
                        () ->
                                service.createPermission(
                                        new AdminAuthorizationPermissionRequestDTO(
                                                RESOURCE_ID,
                                                "Read",
                                                null,
                                                "AFFIRMATIVE",
                                                List.of(POLICY_ID, " " + POLICY_ID))))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void pagesPoliciesAndPermissionsAndReportsMissingItems() {
        when(policyRepository.findByNameContainingIgnoreCase("", PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(policy())));
        assertThat(service.policies(null, PageRequest.of(0, 20)).getContent()).hasSize(1);
        AuthorizationPermissionEntity permission = permission();
        when(permissionRepository.findAllWithPolicies(PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(permission)));
        assertThat(service.permissions(PageRequest.of(0, 20)).getContent().getFirst().policyIds())
                .containsExactly(POLICY_ID);
        when(policyRepository.findById("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.deletePolicy("missing")).isInstanceOf(ApiException.class);
        when(permissionRepository.findById("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.deletePermission("missing"))
                .isInstanceOf(ApiException.class);
    }

    private static AdminAuthorizationResourceRequestDTO resourceRequest(List<String> scopes) {
        return new AdminAuthorizationResourceRequestDTO(
                CLIENT_ID, "Orders", null, null, "alice", false, scopes);
    }

    private static AdminAuthorizationPolicyRequestDTO policyRequest(String type, String value) {
        return new AdminAuthorizationPolicyRequestDTO(CLIENT_ID, "Updated", type, value, "ALLOW");
    }

    private static AdminAuthorizationPermissionRequestDTO permissionRequest() {
        return new AdminAuthorizationPermissionRequestDTO(
                RESOURCE_ID, "Read", "view", "AFFIRMATIVE", List.of(POLICY_ID));
    }

    private static AuthorizationResourceEntity resource() {
        AuthorizationResourceEntity resource = new AuthorizationResourceEntity();
        resource.setId(RESOURCE_ID);
        resource.setResourceServerClientId(CLIENT_ID);
        resource.setName("Orders");
        resource.setOwnerSubject("alice");
        return resource;
    }

    private static AuthorizationResourceScopeEntity scope(String name) {
        AuthorizationResourceScopeEntity scope = new AuthorizationResourceScopeEntity();
        scope.setResourceId(RESOURCE_ID);
        scope.setName(name);
        return scope;
    }

    private static AuthorizationPolicyEntity policy() {
        AuthorizationPolicyEntity policy = new AuthorizationPolicyEntity();
        policy.setId(POLICY_ID);
        policy.setResourceServerClientId(CLIENT_ID);
        policy.setName("Updated");
        policy.setType("ROLE");
        policy.setSubjectValue("ROLE_EDITOR");
        policy.setEffect("ALLOW");
        policy.setPermissions(new LinkedHashSet<>());
        return policy;
    }

    private static AuthorizationPermissionEntity permission() {
        AuthorizationPermissionEntity permission = new AuthorizationPermissionEntity();
        permission.setId(PERMISSION_ID);
        permission.setResourceId(RESOURCE_ID);
        permission.setName("Read");
        permission.setScopeName("view");
        permission.setDecisionStrategy("AFFIRMATIVE");
        permission.setPolicies(new LinkedHashSet<>(List.of(policy())));
        return permission;
    }
}
