package io.github.susimsek.springauthserversamples.service.admin;

import io.github.susimsek.springauthserversamples.domain.ClientRoleEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminServiceAccountDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminServiceAccountRolesRequestDTO;
import io.github.susimsek.springauthserversamples.repository.ClientRoleRepository;
import io.github.susimsek.springauthserversamples.repository.ServiceAccountRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import io.github.susimsek.springauthserversamples.service.security.EffectiveRoleService;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminServiceAccountService {

    private final ServiceAccountRepository serviceAccountRepository;
    private final UserRepository userRepository;
    private final ClientRoleRepository clientRoleRepository;
    private final AdminAuditEventService auditEventService;
    private final UserAccessInvalidationService userAccessInvalidationService;

    @Transactional(readOnly = true)
    public AdminServiceAccountDTO find(String clientId) {
        var account =
                serviceAccountRepository
                        .findByClientId(clientId)
                        .orElseThrow(() -> ApiException.notFound("Service account not found"));
        var user =
                userRepository
                        .findById(account.getUser().getId())
                        .orElseThrow(() -> ApiException.notFound("Service account user not found"));
        return toDTO(clientId, user);
    }

    @Transactional
    public AdminServiceAccountDTO replaceRoles(
            String clientId, AdminServiceAccountRolesRequestDTO request) {
        var account =
                serviceAccountRepository
                        .findByClientId(clientId)
                        .orElseThrow(() -> ApiException.notFound("Service account not found"));
        var user =
                userRepository
                        .findById(account.getUser().getId())
                        .orElseThrow(() -> ApiException.notFound("Service account user not found"));
        Set<ClientRoleEntity> roles =
                clientRoleRepository.findAllById(request.roleIds()).stream()
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
        user.setClientRoles(roles);
        userRepository.save(user);
        userAccessInvalidationService.invalidate(user.getUsername());
        auditEventService.record("client.service-account.roles.updated", "client", clientId);
        return toDTO(clientId, user);
    }

    private static AdminServiceAccountDTO toDTO(
            String clientId, io.github.susimsek.springauthserversamples.domain.UserEntity user) {
        return new AdminServiceAccountDTO(
                user.getId(),
                user.getUsername(),
                EffectiveRoleService.effectiveClientRoleNames(user)
                        .getOrDefault(clientId, Set.of()),
                user.getClientRoles().stream()
                        .map(ClientRoleEntity::getId)
                        .collect(Collectors.toSet()));
    }
}
