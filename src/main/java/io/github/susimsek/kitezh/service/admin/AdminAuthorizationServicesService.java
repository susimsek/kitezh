package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.AuthorizationPermissionEntity;
import io.github.susimsek.kitezh.domain.AuthorizationPolicyEntity;
import io.github.susimsek.kitezh.domain.AuthorizationResourceEntity;
import io.github.susimsek.kitezh.domain.AuthorizationResourceScopeEntity;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationPermissionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationPermissionRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationPolicyDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationPolicyRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationResourceDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationResourceRequestDTO;
import io.github.susimsek.kitezh.repository.AuthorizationPermissionRepository;
import io.github.susimsek.kitezh.repository.AuthorizationPolicyRepository;
import io.github.susimsek.kitezh.repository.AuthorizationResourceRepository;
import io.github.susimsek.kitezh.repository.AuthorizationResourceScopeRepository;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** Administrative CRUD for Authorization Services, distinct from administrator RBAC. */
@Service
@RequiredArgsConstructor
public class AdminAuthorizationServicesService {

    private static final String RESOURCE_TARGET = "authorization-resource";
    private static final String POLICY_TARGET = "authorization-policy";
    private static final String PERMISSION_TARGET = "authorization-permission";

    private final AuthorizationResourceRepository resourceRepository;
    private final AuthorizationResourceScopeRepository scopeRepository;
    private final AuthorizationPolicyRepository policyRepository;
    private final AuthorizationPermissionRepository permissionRepository;
    private final ClientRepository clientRepository;
    private final AdminAuditEventService auditEventService;

    @Transactional(readOnly = true)
    public Page<AdminAuthorizationResourceDTO> resources(String query, Pageable pageable) {
        Page<AuthorizationResourceEntity> resources =
                resourceRepository.findByNameContainingIgnoreCase(
                        normalize(query), bounded(pageable));
        Map<String, List<String>> scopesByResource = scopesByResource(resources.getContent());
        return resources.map(
                resource ->
                        resourceDto(
                                resource,
                                scopesByResource.getOrDefault(resource.getId(), List.of())));
    }

    @Transactional(readOnly = true)
    public AdminAuthorizationResourceDTO resource(String id) {
        return resourceDto(requireResource(id));
    }

    @Transactional
    public AdminAuthorizationResourceDTO createResource(
            AdminAuthorizationResourceRequestDTO request) {
        requireClient(request.resourceServerClientId());
        validateResource(request, null);
        AuthorizationResourceEntity resource = new AuthorizationResourceEntity();
        resource.setId(UUID.randomUUID().toString());
        applyResource(resource, request);
        resourceRepository.save(resource);
        replaceScopes(resource.getId(), request.scopes());
        auditEventService.record(
                "authorization.resource.created", RESOURCE_TARGET, resource.getId());
        return resourceDto(resource);
    }

    @Transactional
    public AdminAuthorizationResourceDTO updateResource(
            String id, AdminAuthorizationResourceRequestDTO request) {
        AuthorizationResourceEntity resource = requireResource(id);
        requireClient(request.resourceServerClientId());
        validateResource(request, id);
        validateScopeRemoval(resource.getId(), request.scopes());
        applyResource(resource, request);
        resourceRepository.save(resource);
        replaceScopes(resource.getId(), request.scopes());
        auditEventService.record("authorization.resource.updated", RESOURCE_TARGET, id);
        return resourceDto(resource);
    }

    @Transactional
    public void deleteResource(String id) {
        AuthorizationResourceEntity resource = requireResource(id);
        resourceRepository.delete(resource);
        auditEventService.record("authorization.resource.deleted", RESOURCE_TARGET, id);
    }

    @Transactional(readOnly = true)
    public Page<AdminAuthorizationPolicyDTO> policies(String query, Pageable pageable) {
        return policyRepository
                .findByNameContainingIgnoreCase(normalize(query), bounded(pageable))
                .map(AdminAuthorizationServicesService::policyDto);
    }

    @Transactional
    public AdminAuthorizationPolicyDTO createPolicy(AdminAuthorizationPolicyRequestDTO request) {
        validatePolicy(request, null);
        AuthorizationPolicyEntity policy = new AuthorizationPolicyEntity();
        policy.setId(UUID.randomUUID().toString());
        applyPolicy(policy, request);
        policyRepository.save(policy);
        auditEventService.record("authorization.policy.created", POLICY_TARGET, policy.getId());
        return policyDto(policy);
    }

    @Transactional
    public AdminAuthorizationPolicyDTO updatePolicy(
            String id, AdminAuthorizationPolicyRequestDTO request) {
        AuthorizationPolicyEntity policy = requirePolicy(id);
        validatePolicy(request, id);
        applyPolicy(policy, request);
        policyRepository.save(policy);
        auditEventService.record("authorization.policy.updated", POLICY_TARGET, id);
        return policyDto(policy);
    }

    @Transactional
    public void deletePolicy(String id) {
        AuthorizationPolicyEntity policy = requirePolicy(id);
        List.copyOf(policy.getPermissions())
                .forEach(permission -> permission.getPolicies().remove(policy));
        policyRepository.delete(policy);
        auditEventService.record("authorization.policy.deleted", POLICY_TARGET, id);
    }

    @Transactional(readOnly = true)
    public Page<AdminAuthorizationPermissionDTO> permissions(Pageable pageable) {
        return permissionRepository
                .findAllWithPolicies(bounded(pageable))
                .map(AdminAuthorizationServicesService::permissionDto);
    }

    @Transactional
    public AdminAuthorizationPermissionDTO createPermission(
            AdminAuthorizationPermissionRequestDTO request) {
        AuthorizationResourceEntity resource = requireResource(request.resourceId());
        validatePermission(request, resource, null);
        AuthorizationPermissionEntity permission = new AuthorizationPermissionEntity();
        permission.setId(UUID.randomUUID().toString());
        applyPermission(permission, request);
        permissionRepository.save(permission);
        auditEventService.record(
                "authorization.permission.created", PERMISSION_TARGET, permission.getId());
        return permissionDto(permission);
    }

    @Transactional
    public AdminAuthorizationPermissionDTO updatePermission(
            String id, AdminAuthorizationPermissionRequestDTO request) {
        AuthorizationPermissionEntity permission = requirePermission(id);
        AuthorizationResourceEntity resource = requireResource(request.resourceId());
        validatePermission(request, resource, id);
        applyPermission(permission, request);
        permissionRepository.save(permission);
        auditEventService.record("authorization.permission.updated", PERMISSION_TARGET, id);
        return permissionDto(permission);
    }

    @Transactional
    public void deletePermission(String id) {
        AuthorizationPermissionEntity permission = requirePermission(id);
        permissionRepository.delete(permission);
        auditEventService.record("authorization.permission.deleted", PERMISSION_TARGET, id);
    }

    private void validateResource(AdminAuthorizationResourceRequestDTO request, String id) {
        boolean duplicate =
                id == null
                        ? resourceRepository.existsByResourceServerClientIdAndNameIgnoreCase(
                                request.resourceServerClientId(), request.name().trim())
                        : resourceRepository
                                .existsByResourceServerClientIdAndNameIgnoreCaseAndIdNot(
                                        request.resourceServerClientId(),
                                        request.name().trim(),
                                        id);
        if (duplicate) {
            throw ApiException.conflict(
                    ApiErrorCode.AUTHZ_RESOURCE_DUPLICATE, "Protected resource already exists");
        }
        if (request.scopes() == null
                || request.scopes().isEmpty()
                || request.scopes().stream().map(String::trim).distinct().count()
                        != request.scopes().size()) {
            throw invalid("scopes", "At least one unique scope is required");
        }
    }

    private void validateScopeRemoval(String resourceId, List<String> requestedScopes) {
        Set<String> names = normalizedSet(requestedScopes);
        boolean removesAssignedScope =
                scopeRepository.findByResourceId(resourceId).stream()
                        .map(AuthorizationResourceScopeEntity::getName)
                        .filter(name -> !names.contains(name))
                        .anyMatch(
                                name ->
                                        permissionRepository.existsByResourceIdAndScopeName(
                                                resourceId, name));
        if (removesAssignedScope) {
            throw ApiException.conflict(
                    ApiErrorCode.AUTHZ_SCOPE_ASSIGNED,
                    "Remove permissions before removing a protected scope");
        }
    }

    private void validatePolicy(AdminAuthorizationPolicyRequestDTO request, String id) {
        requireClient(request.resourceServerClientId());
        boolean duplicate =
                id == null
                        ? policyRepository.existsByResourceServerClientIdAndNameIgnoreCase(
                                request.resourceServerClientId(), request.name().trim())
                        : policyRepository.existsByResourceServerClientIdAndNameIgnoreCaseAndIdNot(
                                request.resourceServerClientId(), request.name().trim(), id);
        if (duplicate) {
            throw ApiException.conflict(
                    ApiErrorCode.AUTHZ_POLICY_DUPLICATE, "Authorization policy already exists");
        }
        String type = request.type();
        boolean valueRequired = Set.of("USER", "ROLE", "GROUP", "CLIENT").contains(type);
        if (valueRequired != StringUtils.hasText(request.subjectValue())) {
            throw invalid("subjectValue", "This policy type requires a subject value");
        }
    }

    private void validatePermission(
            AdminAuthorizationPermissionRequestDTO request,
            AuthorizationResourceEntity resource,
            String id) {
        boolean duplicate =
                id == null
                        ? permissionRepository.existsByResourceIdAndNameIgnoreCase(
                                request.resourceId(), request.name().trim())
                        : permissionRepository.existsByResourceIdAndNameIgnoreCaseAndIdNot(
                                request.resourceId(), request.name().trim(), id);
        if (duplicate) {
            throw ApiException.conflict(
                    ApiErrorCode.AUTHZ_PERMISSION_DUPLICATE,
                    "Authorization permission already exists");
        }
        if (StringUtils.hasText(request.scopeName())
                && !scopeRepository.existsByResourceIdAndName(
                        resource.getId(), request.scopeName().trim())) {
            throw invalid("scopeName", "Scope does not belong to the selected resource");
        }
        Set<String> ids = normalizedSet(request.policyIds());
        List<AuthorizationPolicyEntity> policies = policyRepository.findAllById(ids);
        if (ids.size() != request.policyIds().size()
                || policies.size() != ids.size()
                || policies.stream()
                        .anyMatch(
                                policy ->
                                        !resource.getResourceServerClientId()
                                                .equals(policy.getResourceServerClientId()))) {
            throw invalid("policyIds", "All policies must belong to the resource server");
        }
    }

    private void replaceScopes(String resourceId, List<String> requestedScopes) {
        List<String> names = requestedScopes.stream().map(String::trim).toList();
        scopeRepository.deleteByResourceIdAndNameNotIn(resourceId, names);
        for (String name : names) {
            if (!scopeRepository.existsByResourceIdAndName(resourceId, name)) {
                AuthorizationResourceScopeEntity scope = new AuthorizationResourceScopeEntity();
                scope.setId(UUID.randomUUID().toString());
                scope.setResourceId(resourceId);
                scope.setName(name);
                scopeRepository.save(scope);
            }
        }
    }

    private static void applyResource(
            AuthorizationResourceEntity entity, AdminAuthorizationResourceRequestDTO request) {
        entity.setResourceServerClientId(request.resourceServerClientId().trim());
        entity.setName(request.name().trim());
        entity.setType(normalizeNullable(request.type()));
        entity.setUri(normalizeNullable(request.uri()));
        entity.setOwnerSubject(request.ownerSubject().trim());
        entity.setOwnerManagedAccess(request.ownerManagedAccess());
    }

    private static void applyPolicy(
            AuthorizationPolicyEntity entity, AdminAuthorizationPolicyRequestDTO request) {
        entity.setResourceServerClientId(request.resourceServerClientId().trim());
        entity.setName(request.name().trim());
        entity.setType(request.type());
        entity.setSubjectValue(normalizeNullable(request.subjectValue()));
        entity.setEffect(request.effect());
    }

    private void applyPermission(
            AuthorizationPermissionEntity entity, AdminAuthorizationPermissionRequestDTO request) {
        entity.setResourceId(request.resourceId());
        entity.setName(request.name().trim());
        entity.setScopeName(normalizeNullable(request.scopeName()));
        entity.setDecisionStrategy(request.decisionStrategy());
        entity.setPolicies(new LinkedHashSet<>(policyRepository.findAllById(request.policyIds())));
    }

    private AdminAuthorizationResourceDTO resourceDto(AuthorizationResourceEntity resource) {
        List<String> scopes =
                scopeRepository.findByResourceId(resource.getId()).stream()
                        .map(AuthorizationResourceScopeEntity::getName)
                        .sorted()
                        .toList();
        return resourceDto(resource, scopes);
    }

    private AdminAuthorizationResourceDTO resourceDto(
            AuthorizationResourceEntity resource, List<String> scopes) {
        return new AdminAuthorizationResourceDTO(
                resource.getId(),
                resource.getResourceServerClientId(),
                resource.getName(),
                resource.getType(),
                resource.getUri(),
                resource.getOwnerSubject(),
                resource.isOwnerManagedAccess(),
                scopes);
    }

    private Map<String, List<String>> scopesByResource(
            List<AuthorizationResourceEntity> resources) {
        if (resources.isEmpty()) {
            return Map.of();
        }
        List<String> resourceIds =
                resources.stream().map(AuthorizationResourceEntity::getId).toList();
        return scopeRepository.findByResourceIdIn(resourceIds).stream()
                .collect(
                        Collectors.groupingBy(
                                AuthorizationResourceScopeEntity::getResourceId,
                                Collectors.mapping(
                                        AuthorizationResourceScopeEntity::getName,
                                        Collectors.collectingAndThen(
                                                Collectors.toList(),
                                                names -> names.stream().sorted().toList()))));
    }

    private static AdminAuthorizationPolicyDTO policyDto(AuthorizationPolicyEntity policy) {
        return new AdminAuthorizationPolicyDTO(
                policy.getId(),
                policy.getResourceServerClientId(),
                policy.getName(),
                policy.getType(),
                policy.getSubjectValue(),
                policy.getEffect());
    }

    private static AdminAuthorizationPermissionDTO permissionDto(
            AuthorizationPermissionEntity permission) {
        return new AdminAuthorizationPermissionDTO(
                permission.getId(),
                permission.getResourceId(),
                permission.getName(),
                permission.getScopeName(),
                permission.getDecisionStrategy(),
                permission.getPolicies().stream()
                        .map(AuthorizationPolicyEntity::getId)
                        .sorted()
                        .toList());
    }

    private AuthorizationResourceEntity requireResource(String id) {
        return resourceRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("Protected resource not found"));
    }

    private AuthorizationPolicyEntity requirePolicy(String id) {
        return policyRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("Authorization policy not found"));
    }

    private AuthorizationPermissionEntity requirePermission(String id) {
        return permissionRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("Authorization permission not found"));
    }

    private void requireClient(String clientId) {
        if (!clientRepository.existsByClientId(clientId)) {
            throw invalid("resourceServerClientId", "Resource server client is not registered");
        }
    }

    private static Pageable bounded(Pageable pageable) {
        return PageRequest.of(
                pageable.getPageNumber(),
                Math.min(pageable.getPageSize(), 100),
                pageable.getSort());
    }

    private static String normalize(String query) {
        return query == null ? "" : query.trim();
    }

    private static String normalizeNullable(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private static Set<String> normalizedSet(List<String> values) {
        return values.stream().map(String::trim).collect(java.util.stream.Collectors.toSet());
    }

    private static ApiException invalid(String field, String message) {
        return ApiException.badRequest(field, ApiErrorCode.AUTHZ_INVALID_REQUEST, message);
    }
}
