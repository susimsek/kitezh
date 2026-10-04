package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.ClientRoleEntity;
import io.github.susimsek.kitezh.domain.ClientScopeEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.admin.AdminClientRoleDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientScopeRoleMappingDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientScopeRoleMappingRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminRoleDTO;
import io.github.susimsek.kitezh.repository.AuthorityRepository;
import io.github.susimsek.kitezh.repository.ClientRoleRepository;
import io.github.susimsek.kitezh.repository.ClientScopeRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminClientScopeRoleMappingService {

    private final ClientScopeRepository clientScopeRepository;
    private final AuthorityRepository authorityRepository;
    private final ClientRoleRepository clientRoleRepository;
    private final UserRepository userRepository;
    private final UserAccessInvalidationService userAccessInvalidationService;
    private final AdminAuditEventService adminAuditEventService;

    @Transactional(readOnly = true)
    public AdminClientScopeRoleMappingDTO find(String scopeId) {
        return toDTO(required(scopeId));
    }

    @Transactional
    @CacheEvict(
            cacheNames = {
                ClientScopeEntity.CACHE_NAME,
                ClientScopeRepository.CLIENT_SCOPE_BY_NAME_CACHE
            },
            allEntries = true)
    public AdminClientScopeRoleMappingDTO update(
            String scopeId, AdminClientScopeRoleMappingRequestDTO request) {
        ClientScopeEntity scope = required(scopeId);
        ensureMutable(scope);
        Set<String> roleNames = normalizedNames(request.applicationRoles());
        List<AuthorityEntity> applicationRoles = authorityRepository.findByNameIn(roleNames);
        if (applicationRoles.size() != roleNames.size()) {
            throw ApiException.badRequest(
                    ApiErrorCode.CLIENT_SCOPE_ROLE_UNKNOWN,
                    "One or more application roles do not exist");
        }
        Set<Long> roleIds = request.clientRoleIds();
        List<ClientRoleEntity> clientRoles = clientRoleRepository.findAllById(roleIds);
        if (clientRoles.size() != roleIds.size()) {
            throw ApiException.badRequest(
                    ApiErrorCode.CLIENT_SCOPE_ROLE_UNKNOWN,
                    "One or more client roles do not exist");
        }
        scope.getApplicationRoles().clear();
        scope.getApplicationRoles().addAll(applicationRoles);
        scope.getClientRoles().clear();
        scope.getClientRoles().addAll(clientRoles);
        adminAuditEventService.record(
                "client-scope.role-mappings.updated", "client-scope", scopeId);
        invalidateUsers();
        return toDTO(scope);
    }

    @Transactional(readOnly = true)
    public Page<AdminRoleDTO> applicationRoleCandidates(
            String scopeId, String query, Pageable pageable) {
        required(scopeId);
        return authorityRepository
                .findByNameContainingIgnoreCase(query == null ? "" : query.trim(), pageable)
                .map(role -> new AdminRoleDTO(role.getName(), role.getDescription()));
    }

    @Transactional(readOnly = true)
    public Page<AdminClientRoleDTO> clientRoleCandidates(
            String scopeId, String query, Pageable pageable) {
        required(scopeId);
        return clientRoleRepository
                .findAllByNameOrClientIdContainingIgnoreCase(
                        query == null ? "" : query.trim(), pageable)
                .map(AdminClientScopeRoleMappingService::toDTO);
    }

    private ClientScopeEntity required(String id) {
        return clientScopeRepository
                .findDetailedById(id)
                .orElseThrow(() -> ApiException.notFound("Client scope not found"));
    }

    private static void ensureMutable(ClientScopeEntity scope) {
        if (scope.isBuiltIn()) {
            throw ApiException.badRequest(
                    ApiErrorCode.CLIENT_SCOPE_PROTECTED,
                    "Built-in client scopes cannot be changed");
        }
    }

    private void invalidateUsers() {
        userRepository.findAll().stream()
                .map(UserEntity::getUsername)
                .forEach(userAccessInvalidationService::invalidate);
    }

    private static AdminClientScopeRoleMappingDTO toDTO(ClientScopeEntity scope) {
        Set<String> applicationRoles =
                scope.getApplicationRoles().stream()
                        .map(AuthorityEntity::getName)
                        .sorted()
                        .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        Set<AdminClientRoleDTO> clientRoles =
                scope.getClientRoles().stream()
                        .map(AdminClientScopeRoleMappingService::toDTO)
                        .sorted(
                                java.util.Comparator.comparing(AdminClientRoleDTO::clientId)
                                        .thenComparing(AdminClientRoleDTO::name))
                        .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        return new AdminClientScopeRoleMappingDTO(applicationRoles, clientRoles);
    }

    private static AdminClientRoleDTO toDTO(ClientRoleEntity role) {
        return new AdminClientRoleDTO(
                role.getId(),
                role.getClient().getClientId(),
                role.getName(),
                role.getDescription());
    }

    private static Set<String> normalizedNames(Set<String> values) {
        return values.stream()
                .map(String::trim)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }
}
