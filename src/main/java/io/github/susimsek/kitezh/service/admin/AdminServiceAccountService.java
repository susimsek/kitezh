package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.ClientRoleEntity;
import io.github.susimsek.kitezh.dto.admin.AdminServiceAccountDTO;
import io.github.susimsek.kitezh.dto.admin.AdminServiceAccountRolesRequestDTO;
import io.github.susimsek.kitezh.repository.AuthorityRepository;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.repository.ClientRoleRepository;
import io.github.susimsek.kitezh.repository.ServiceAccountRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.security.EffectiveRoleService;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminServiceAccountService {

    private static final String SERVICE_ACCOUNT_NOT_FOUND = "Service account not found";

    private final ServiceAccountRepository serviceAccountRepository;
    private final UserRepository userRepository;
    private final AuthorityRepository authorityRepository;
    private final ClientRepository clientRepository;
    private final ClientRoleRepository clientRoleRepository;
    private final AdminAuditEventService auditEventService;
    private final UserAccessInvalidationService userAccessInvalidationService;

    @Transactional(readOnly = true)
    public AdminServiceAccountDTO find(String clientId) {
        var account =
                serviceAccountRepository
                        .findByClientId(clientId)
                        .orElseThrow(() -> ApiException.notFound(SERVICE_ACCOUNT_NOT_FOUND));
        var user =
                userRepository
                        .findById(account.getUser().getId())
                        .orElseThrow(() -> ApiException.notFound("Service account user not found"));
        String publicClientId =
                clientRepository == null
                        ? clientId
                        : clientRepository
                                .findById(clientId)
                                .map(client -> client.getClientId())
                                .orElse(clientId);
        return toDTO(publicClientId, user);
    }

    @Transactional
    public AdminServiceAccountDTO replaceRoles(
            String clientId, AdminServiceAccountRolesRequestDTO request) {
        var account =
                serviceAccountRepository
                        .findByClientId(clientId)
                        .orElseThrow(() -> ApiException.notFound(SERVICE_ACCOUNT_NOT_FOUND));
        var user =
                userRepository
                        .findById(account.getUser().getId())
                        .orElseThrow(() -> ApiException.notFound("Service account user not found"));
        var requestedRoles = clientRoleRepository.findAllById(request.roleIds());
        if (requestedRoles.size() != request.roleIds().size()) {
            throw ApiException.badRequest(
                    "roleIds", ApiErrorCode.CLIENT_INVALID_REQUEST, "All client roles must exist");
        }
        Set<ClientRoleEntity> roles =
                requestedRoles.stream()
                        .filter(
                                role ->
                                        role.getClient() != null
                                                && clientId.equals(role.getClient().getId()))
                        .collect(Collectors.toSet());
        if (roles.size() != request.roleIds().size()) {
            throw ApiException.badRequest(
                    "roleIds",
                    ApiErrorCode.CLIENT_INVALID_REQUEST,
                    "All roles must belong to this client");
        }
        Set<AuthorityEntity> applicationRoles =
                applicationRoles(
                        request.applicationRoles() == null ? Set.of() : request.applicationRoles());
        user.setAuthorities(applicationRoles);
        user.setClientRoles(roles);
        userRepository.save(user);
        userAccessInvalidationService.invalidate(user.getUsername());
        auditEventService.record("client.service-account.roles.updated", "client", clientId);
        String publicClientId =
                clientRepository == null
                        ? clientId
                        : clientRepository
                                .findById(clientId)
                                .map(client -> client.getClientId())
                                .orElse(clientId);
        return toDTO(publicClientId, user);
    }

    @Transactional
    public void revokeTokens(String clientId) {
        var account =
                serviceAccountRepository
                        .findByClientId(clientId)
                        .orElseThrow(() -> ApiException.notFound(SERVICE_ACCOUNT_NOT_FOUND));
        var user = account.getUser();
        userAccessInvalidationService.invalidate(user.getUsername());
        auditEventService.record("client.service-account.tokens.revoked", "client", clientId);
    }

    private Set<AuthorityEntity> applicationRoles(Set<String> roleNames) {
        if (roleNames.isEmpty()) {
            return new HashSet<>();
        }
        if (authorityRepository == null) {
            throw ApiException.badRequest(
                    "applicationRoles",
                    ApiErrorCode.CLIENT_INVALID_REQUEST,
                    "Application roles are unavailable");
        }
        Set<AuthorityEntity> roles = new HashSet<>(authorityRepository.findByNameIn(roleNames));
        if (roles.size() != roleNames.size()) {
            throw ApiException.badRequest(
                    "applicationRoles",
                    ApiErrorCode.CLIENT_INVALID_REQUEST,
                    "All application roles must exist");
        }
        return roles;
    }

    private static AdminServiceAccountDTO toDTO(
            String clientId, io.github.susimsek.kitezh.domain.UserEntity user) {
        Map<String, Set<String>> clientRoles = EffectiveRoleService.effectiveClientRoleNames(user);
        return new AdminServiceAccountDTO(
                user.getId(),
                user.getUsername(),
                clientRoles.getOrDefault(clientId, Set.of()),
                user.getClientRoles().stream()
                        .map(ClientRoleEntity::getId)
                        .collect(Collectors.toSet()),
                user.getAuthorities().stream()
                        .map(AuthorityEntity::getName)
                        .collect(Collectors.toSet()),
                clientRoles);
    }
}
