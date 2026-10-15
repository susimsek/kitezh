package io.github.susimsek.kitezh.service.authz;

import io.github.susimsek.kitezh.config.security.UmaTicketTokens;
import io.github.susimsek.kitezh.domain.AuthorizationPermissionTicketEntity;
import io.github.susimsek.kitezh.domain.AuthorizationResourceEntity;
import io.github.susimsek.kitezh.domain.AuthorizationResourceScopeEntity;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationResourceDTO;
import io.github.susimsek.kitezh.dto.authz.UmaPermissionRequestDTO;
import io.github.susimsek.kitezh.dto.authz.UmaPermissionTicketDTO;
import io.github.susimsek.kitezh.dto.authz.UmaResourceRegistrationRequestDTO;
import io.github.susimsek.kitezh.repository.AuthorizationPermissionRepository;
import io.github.susimsek.kitezh.repository.AuthorizationPermissionTicketRepository;
import io.github.susimsek.kitezh.repository.AuthorizationResourceRepository;
import io.github.susimsek.kitezh.repository.AuthorizationResourceScopeRepository;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** UMA Protection API for resource-server-owned registrations and permission tickets. */
@Service
@RequiredArgsConstructor
public class UmaProtectionService {

    private static final long TICKET_TTL_SECONDS = 60;

    private final AuthorizationResourceRepository resourceRepository;
    private final AuthorizationResourceScopeRepository scopeRepository;
    private final AuthorizationPermissionRepository permissionRepository;
    private final AuthorizationPermissionTicketRepository ticketRepository;
    private final ClientRepository clientRepository;

    @Transactional(readOnly = true)
    public Page<AdminAuthorizationResourceDTO> resources(Jwt token, Pageable pageable) {
        String clientId = resourceServerClientId(token);
        Page<AuthorizationResourceEntity> resources =
                resourceRepository.findAllByResourceServerClientId(clientId, bounded(pageable));
        if (resources.isEmpty()) {
            return resources.map(resource -> resourceDto(resource, List.of()));
        }
        Map<String, List<String>> scopesByResource = scopesByResource(resources.getContent());
        return resources.map(
                resource ->
                        resourceDto(
                                resource,
                                scopesByResource.getOrDefault(resource.getId(), List.of())));
    }

    @Transactional(readOnly = true)
    public AdminAuthorizationResourceDTO resource(Jwt token, String id) {
        return resourceDto(requireOwnedResource(token, id));
    }

    @Transactional
    public AdminAuthorizationResourceDTO createResource(
            Jwt token, UmaResourceRegistrationRequestDTO request) {
        String clientId = resourceServerClientId(token);
        validateResourceRequest(request);
        if (resourceRepository.existsByResourceServerClientIdAndNameIgnoreCase(
                clientId, request.name().trim())) {
            throw ApiException.conflict(
                    ApiErrorCode.AUTHZ_RESOURCE_DUPLICATE, "Protected resource already exists");
        }
        AuthorizationResourceEntity resource = new AuthorizationResourceEntity();
        resource.setId(UUID.randomUUID().toString());
        resource.setResourceServerClientId(clientId);
        resource.setName(request.name().trim());
        resource.setType(normalize(request.type()));
        resource.setUri(normalize(request.uri()));
        resource.setOwnerSubject(token.getSubject());
        resource.setOwnerManagedAccess(false);
        resourceRepository.save(resource);
        replaceScopes(resource.getId(), request.scopes());
        return resourceDto(resource);
    }

    @Transactional
    public AdminAuthorizationResourceDTO updateResource(
            Jwt token, String id, UmaResourceRegistrationRequestDTO request) {
        validateResourceRequest(request);
        AuthorizationResourceEntity resource = requireOwnedResource(token, id);
        String name = request.name().trim();
        if (!resource.getName().equalsIgnoreCase(name)
                && resourceRepository.existsByResourceServerClientIdAndNameIgnoreCase(
                        resource.getResourceServerClientId(), name)) {
            throw ApiException.conflict(
                    ApiErrorCode.AUTHZ_RESOURCE_DUPLICATE, "Protected resource already exists");
        }
        validateScopeRemoval(resource.getId(), request.scopes());
        resource.setName(name);
        resource.setType(normalize(request.type()));
        resource.setUri(normalize(request.uri()));
        resourceRepository.save(resource);
        replaceScopes(resource.getId(), request.scopes());
        return resourceDto(resource);
    }

    @Transactional
    public void deleteResource(Jwt token, String id) {
        resourceRepository.delete(requireOwnedResource(token, id));
    }

    @Transactional
    public UmaPermissionTicketDTO issueTicket(Jwt token, UmaPermissionRequestDTO request) {
        AuthorizationResourceEntity resource = requireOwnedResource(token, request.resourceId());
        if (request.scopes() == null
                || request.scopes().isEmpty()
                || request.scopes().stream().map(String::trim).distinct().count()
                        != request.scopes().size()) {
            throw invalid("scopes", "At least one unique permission scope is required");
        }
        List<String> scopes = request.scopes().stream().map(String::trim).toList();
        boolean unknownScope =
                scopes.stream()
                        .anyMatch(
                                scope ->
                                        !scopeRepository.existsByResourceIdAndName(
                                                resource.getId(), scope));
        if (unknownScope) {
            throw invalid("scopes", "A requested scope is not registered for this resource");
        }
        Instant now = Instant.now();
        ticketRepository.deleteByExpiresAtBefore(now);
        String rawTicket = UmaTicketTokens.generate();
        AuthorizationPermissionTicketEntity ticket = new AuthorizationPermissionTicketEntity();
        ticket.setId(UmaTicketTokens.digest(rawTicket));
        ticket.setResourceServerClientId(resource.getResourceServerClientId());
        ticket.setResourceId(resource.getId());
        ticket.setRequestedScopes(String.join(" ", scopes));
        ticket.setIssuedAt(now);
        ticket.setExpiresAt(now.plusSeconds(TICKET_TTL_SECONDS));
        ticketRepository.save(ticket);
        return new UmaPermissionTicketDTO(rawTicket, TICKET_TTL_SECONDS);
    }

    private AuthorizationResourceEntity requireOwnedResource(Jwt token, String id) {
        String clientId = resourceServerClientId(token);
        return resourceRepository
                .findByIdAndResourceServerClientId(id, clientId)
                .orElseThrow(() -> ApiException.notFound("Protected resource not found"));
    }

    private String resourceServerClientId(Jwt token) {
        String clientId = token.getClaimAsString("client_id");
        if (!StringUtils.hasText(clientId) || !clientRepository.existsByClientId(clientId)) {
            throw ApiException.forbidden(
                    ApiErrorCode.FORBIDDEN, "UMA resource-server client is invalid");
        }
        return clientId;
    }

    private void validateScopeRemoval(String resourceId, List<String> requestedScopes) {
        List<String> names = requestedScopes.stream().map(String::trim).toList();
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

    private static void validateResourceRequest(UmaResourceRegistrationRequestDTO request) {
        if (request.scopes() == null
                || request.scopes().isEmpty()
                || request.scopes().stream().map(String::trim).distinct().count()
                        != request.scopes().size()) {
            throw invalid("scopes", "At least one unique resource scope is required");
        }
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

    private static Pageable bounded(Pageable pageable) {
        return PageRequest.of(
                pageable.getPageNumber(),
                Math.min(pageable.getPageSize(), 100),
                pageable.getSort());
    }

    private static String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private static ApiException invalid(String field, String message) {
        return ApiException.badRequest(field, ApiErrorCode.AUTHZ_INVALID_REQUEST, message);
    }
}
