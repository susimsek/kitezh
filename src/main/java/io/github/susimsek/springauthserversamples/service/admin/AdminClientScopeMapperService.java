package io.github.susimsek.springauthserversamples.service.admin;

import io.github.susimsek.springauthserversamples.domain.ClientScopeEntity;
import io.github.susimsek.springauthserversamples.domain.ClientScopeMapperEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientMapperDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientMapperRequestDTO;
import io.github.susimsek.springauthserversamples.repository.ClientScopeMapperRepository;
import io.github.susimsek.springauthserversamples.repository.ClientScopeRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.security.ProtocolMapperTypes;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminClientScopeMapperService {

    private final ClientScopeMapperRepository mapperRepository;
    private final ClientScopeRepository clientScopeRepository;
    private final AdminAuditEventService auditEventService;
    private final UserRepository userRepository;
    private final UserAccessInvalidationService userAccessInvalidationService;

    @Transactional(readOnly = true)
    public Page<AdminClientMapperDTO> findAll(String scopeId, String query, Pageable pageable) {
        requireScope(scopeId);
        return mapperRepository
                .findByClientScopeIdAndNameContainingIgnoreCase(
                        scopeId, query == null ? "" : query.trim(), pageable)
                .map(AdminClientScopeMapperService::toDTO);
    }

    @Transactional
    @CacheEvict(
            cacheNames = {
                ClientScopeEntity.CACHE_NAME,
                ClientScopeRepository.CLIENT_SCOPE_BY_NAME_CACHE
            },
            allEntries = true)
    public AdminClientMapperDTO create(String scopeId, AdminClientMapperRequestDTO request) {
        ClientScopeEntity scope = requireScope(scopeId);
        ensureMutable(scope);
        validate(request);
        if (mapperRepository.existsByClientScopeIdAndNameIgnoreCase(scopeId, request.name())) {
            throw ApiException.conflict(
                    "name",
                    ApiErrorCode.CLIENT_MAPPER_DUPLICATE_NAME,
                    "Client mapper name is already registered");
        }
        ClientScopeMapperEntity mapper = new ClientScopeMapperEntity();
        apply(mapper, scope, request);
        ClientScopeMapperEntity saved = mapperRepository.save(mapper);
        auditEventService.record("client-scope.mapper.created", "client-scope", scopeId);
        invalidateUsers();
        return toDTO(saved);
    }

    @Transactional
    @CacheEvict(
            cacheNames = {
                ClientScopeEntity.CACHE_NAME,
                ClientScopeRepository.CLIENT_SCOPE_BY_NAME_CACHE
            },
            allEntries = true)
    public AdminClientMapperDTO update(
            String scopeId, Long id, AdminClientMapperRequestDTO request) {
        ClientScopeEntity scope = requireScope(scopeId);
        ensureMutable(scope);
        validate(request);
        ClientScopeMapperEntity mapper = mapperRequired(id, scopeId);
        if (mapperRepository.existsByClientScopeIdAndNameIgnoreCaseAndIdNot(
                scopeId, request.name(), id)) {
            throw ApiException.conflict(
                    "name",
                    ApiErrorCode.CLIENT_MAPPER_DUPLICATE_NAME,
                    "Client mapper name is already registered");
        }
        apply(mapper, scope, request);
        ClientScopeMapperEntity saved = mapperRepository.save(mapper);
        auditEventService.record("client-scope.mapper.updated", "client-scope", scopeId);
        invalidateUsers();
        return toDTO(saved);
    }

    @Transactional
    @CacheEvict(
            cacheNames = {
                ClientScopeEntity.CACHE_NAME,
                ClientScopeRepository.CLIENT_SCOPE_BY_NAME_CACHE
            },
            allEntries = true)
    public void delete(String scopeId, Long id) {
        ClientScopeEntity scope = requireScope(scopeId);
        ensureMutable(scope);
        mapperRepository.delete(mapperRequired(id, scopeId));
        auditEventService.record("client-scope.mapper.deleted", "client-scope", scopeId);
        invalidateUsers();
    }

    private ClientScopeEntity requireScope(String id) {
        return clientScopeRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("Client scope not found"));
    }

    private static void ensureMutable(ClientScopeEntity scope) {
        if (scope.isBuiltIn()) {
            throw ApiException.badRequest(
                    ApiErrorCode.CLIENT_SCOPE_PROTECTED,
                    "Built-in client scopes cannot be changed");
        }
    }

    private ClientScopeMapperEntity mapperRequired(Long id, String scopeId) {
        return mapperRepository
                .findById(id)
                .filter(mapper -> mapper.getClientScope().getId().equals(scopeId))
                .orElseThrow(() -> ApiException.notFound("Client scope mapper not found"));
    }

    private static void apply(
            ClientScopeMapperEntity mapper,
            ClientScopeEntity scope,
            AdminClientMapperRequestDTO request) {
        mapper.setClientScope(scope);
        mapper.setName(request.name().trim());
        String mapperType = ProtocolMapperTypes.canonicalize(request.mapperType());
        mapper.setMapperType(mapperType);
        mapper.setSource(request.source() == null ? null : request.source().trim());
        mapper.setValue(request.value() == null ? null : request.value().trim());
        mapper.setClaimName(
                ProtocolMapperTypes.usesAudienceClaim(mapperType)
                        ? "aud"
                        : request.claimName().trim());
        mapper.setPriority(request.priority() == null ? 100 : request.priority());
        mapper.setAddToIdToken(request.addToIdToken());
        mapper.setAddToAccessToken(request.addToAccessToken());
    }

    private static void validate(AdminClientMapperRequestDTO request) {
        if (request == null) {
            throw ApiException.badRequest(
                    ApiErrorCode.CLIENT_INVALID_REQUEST, "Request body is required");
        }
        String type = ProtocolMapperTypes.canonicalize(request.mapperType());
        if (!ProtocolMapperTypes.isSupported(type)) {
            throw ApiException.badRequest(
                    "mapperType", ApiErrorCode.CLIENT_INVALID_REQUEST, "Unsupported mapper type");
        }
        if (ProtocolMapperTypes.requiresSource(type)
                && (request.source() == null || request.source().isBlank())) {
            throw ApiException.badRequest(
                    "source",
                    ApiErrorCode.CLIENT_MAPPER_SOURCE_REQUIRED,
                    "A source is required for this mapper type");
        }
        if (ProtocolMapperTypes.requiresValue(type)
                && (request.value() == null || request.value().isBlank())) {
            throw ApiException.badRequest(
                    "value",
                    ApiErrorCode.CLIENT_MAPPER_SOURCE_REQUIRED,
                    "A value is required for this mapper type");
        }
        if (!ProtocolMapperTypes.usesAudienceClaim(type)
                && (request.claimName() == null || request.claimName().isBlank())) {
            throw ApiException.badRequest(
                    "claimName", ApiErrorCode.CLIENT_INVALID_REQUEST, "A claim name is required");
        }
        if (!request.addToIdToken() && !request.addToAccessToken()) {
            throw ApiException.badRequest(
                    "addToAccessToken",
                    ApiErrorCode.CLIENT_MAPPER_TARGET_REQUIRED,
                    "Select at least one token target");
        }
    }

    private void invalidateUsers() {
        userRepository.findAll().stream()
                .map(user -> user.getUsername())
                .forEach(userAccessInvalidationService::invalidate);
    }

    private static AdminClientMapperDTO toDTO(ClientScopeMapperEntity mapper) {
        return new AdminClientMapperDTO(
                mapper.getId(),
                mapper.getName(),
                mapper.getMapperType(),
                mapper.getSource(),
                mapper.getClaimName(),
                mapper.isAddToIdToken(),
                mapper.isAddToAccessToken(),
                mapper.getValue(),
                mapper.getPriority());
    }
}
