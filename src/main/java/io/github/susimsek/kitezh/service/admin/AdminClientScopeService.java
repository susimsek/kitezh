package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.ClientScopeEntity;
import io.github.susimsek.kitezh.dto.admin.AdminClientScopeAssignmentRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientScopeDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientScopeRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminScopeAssignmentsDTO;
import io.github.susimsek.kitezh.mapper.AdminClientScopeMapper;
import io.github.susimsek.kitezh.mapper.AuthorizationServerMapperSupport;
import io.github.susimsek.kitezh.mapper.RegisteredClientMapper;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.repository.ClientScopeRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class AdminClientScopeService {

    private static final String CLIENT_SCOPE_TARGET = "client-scope";

    private final ClientScopeRepository clientScopeRepository;
    private final ClientRepository clientRepository;
    private final RegisteredClientMapper registeredClientMapper;
    private final AuthorizationServerMapperSupport mapperSupport;
    private final AdminAuditEventService adminAuditEventService;
    private final AdminClientScopeMapper adminClientScopeMapper;

    @Transactional(readOnly = true)
    public Page<AdminClientScopeDTO> findAll(String query, Pageable pageable) {
        String q = query == null ? "" : query.trim();
        return clientScopeRepository
                .findByNameContainingIgnoreCaseOrDisplayNameContainingIgnoreCase(q, q, pageable)
                .map(adminClientScopeMapper::toDTO);
    }

    @Transactional(readOnly = true)
    public List<AdminClientScopeDTO> findAll() {
        return findAllInternal();
    }

    private List<AdminClientScopeDTO> findAllInternal() {
        return clientScopeRepository
                .findAll(org.springframework.data.domain.Sort.by("name"))
                .stream()
                .map(adminClientScopeMapper::toDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public AdminClientScopeDTO findOne(String id) {
        return adminClientScopeMapper.toDTO(required(id));
    }

    @Transactional
    @CacheEvict(cacheNames = ClientScopeRepository.CLIENT_SCOPE_BY_NAME_CACHE, allEntries = true)
    public AdminClientScopeDTO create(AdminClientScopeRequestDTO request) {
        String name = normalizeName(request.name());
        if (clientScopeRepository.existsByName(name)) {
            throw ApiException.conflict(
                    "name", ApiErrorCode.CLIENT_SCOPE_DUPLICATE, "Client scope already exists");
        }
        ClientScopeEntity entity =
                adminClientScopeMapper.toEntity(
                        new AdminClientScopeMapper.MappingData(
                                UUID.randomUUID().toString(),
                                name,
                                trimToNull(request.displayName()),
                                trimToNull(request.description()),
                                request.displayOnConsentScreenValue(),
                                request.consentScreenTextValue(),
                                request.includeInTokenScopeValue(),
                                request.groupMapperEnabledValue(),
                                request.groupClaimNameValue(),
                                request.groupMapperFullPathValue()));
        ClientScopeEntity saved = clientScopeRepository.save(entity);
        adminAuditEventService.record("client-scope.created", CLIENT_SCOPE_TARGET, saved.getId());
        return adminClientScopeMapper.toDTO(saved);
    }

    @Transactional
    @CacheEvict(
            cacheNames = {
                ClientRepository.REGISTERED_CLIENT_BY_CLIENT_ID_CACHE,
                ClientScopeRepository.CLIENT_SCOPE_BY_NAME_CACHE
            },
            allEntries = true)
    public AdminClientScopeDTO update(String id, AdminClientScopeRequestDTO request) {
        ClientScopeEntity entity = required(id);
        ensureMutable(entity);
        String name = normalizeName(request.name());
        clientScopeRepository
                .findByName(name)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(
                        ignored -> {
                            throw ApiException.conflict(
                                    "name",
                                    ApiErrorCode.CLIENT_SCOPE_DUPLICATE,
                                    "Client scope already exists");
                        });
        if (!entity.getName().equals(name)) {
            renameAssignedScope(entity.getName(), name);
        }
        adminClientScopeMapper.update(
                new AdminClientScopeMapper.MappingData(
                        null,
                        name,
                        trimToNull(request.displayName()),
                        trimToNull(request.description()),
                        request.displayOnConsentScreenValue(entity.isDisplayOnConsentScreen()),
                        request.consentScreenTextValue(entity.getConsentScreenText()),
                        request.includeInTokenScopeValue(entity.isIncludeInTokenScope()),
                        request.groupMapperEnabledValue(entity.isGroupMapperEnabled()),
                        request.groupClaimNameValue(entity.getGroupClaimName()),
                        request.groupMapperFullPathValue(entity.isGroupMapperFullPath())),
                entity);
        ClientScopeEntity saved = clientScopeRepository.save(entity);
        adminAuditEventService.record("client-scope.updated", CLIENT_SCOPE_TARGET, id);
        return adminClientScopeMapper.toDTO(saved);
    }

    @Transactional
    @CacheEvict(cacheNames = ClientScopeRepository.CLIENT_SCOPE_BY_NAME_CACHE, allEntries = true)
    public void delete(String id) {
        ClientScopeEntity entity = required(id);
        ensureMutable(entity);
        boolean assigned =
                clientRepository.findAll().stream()
                        .anyMatch(
                                client ->
                                        mapperSupport
                                                .readCollection(client.getScopes())
                                                .contains(entity.getName()));
        if (assigned) {
            throw ApiException.badRequest(
                    ApiErrorCode.CLIENT_SCOPE_ASSIGNED, "Assigned client scopes cannot be deleted");
        }
        clientScopeRepository.delete(entity);
        adminAuditEventService.record("client-scope.deleted", CLIENT_SCOPE_TARGET, id);
    }

    @Transactional(readOnly = true)
    public AdminScopeAssignmentsDTO assignments(String clientId) {
        RegisteredClient client = clientRequired(clientId);
        Set<String> defaults = ClientScopeSettings.defaultScopes(client);
        Set<String> optional = ClientScopeSettings.optionalScopes(client);
        List<AdminClientScopeDTO> scopes = findAllInternal();
        return adminClientScopeMapper.toAssignmentsDTO(defaults, optional, scopes);
    }

    @Transactional
    @CacheEvict(
            cacheNames = ClientRepository.REGISTERED_CLIENT_BY_CLIENT_ID_CACHE,
            allEntries = true)
    public AdminScopeAssignmentsDTO updateAssignments(
            String clientId, AdminClientScopeAssignmentRequestDTO request) {
        Set<String> defaults = normalized(request.defaultScopes());
        Set<String> optional = normalized(request.optionalScopes());
        Set<String> intersection = new LinkedHashSet<>(defaults);
        intersection.retainAll(optional);
        if (!intersection.isEmpty()) {
            throw ApiException.badRequest(
                    ApiErrorCode.CLIENT_SCOPE_ASSIGNMENT_OVERLAP,
                    "A scope cannot be both default and optional");
        }
        Set<String> union = new LinkedHashSet<>(defaults);
        union.addAll(optional);
        if (union.isEmpty()) {
            throw ApiException.badRequest(
                    ApiErrorCode.CLIENT_INVALID_SCOPES, "At least one client scope is required");
        }
        long known = clientScopeRepository.countByNameIn(union);
        if (known != union.size()) {
            throw ApiException.badRequest(
                    ApiErrorCode.CLIENT_SCOPE_UNKNOWN, "One or more client scopes do not exist");
        }

        RegisteredClient existing = clientRequired(clientId);
        RegisteredClient.Builder builder = RegisteredClient.from(existing);
        builder.scopes(
                scopes -> {
                    scopes.clear();
                    scopes.addAll(union);
                });
        builder.clientSettings(
                ClientScopeSettings.withAssignments(
                        existing.getClientSettings(), defaults, optional));
        RegisteredClient updated = builder.build();
        clientRepository.save(registeredClientMapper.toEntity(updated, mapperSupport));
        adminAuditEventService.record("client.scopes.updated", "client", clientId);
        return adminClientScopeMapper.toAssignmentsDTO(defaults, optional, findAllInternal());
    }

    private void renameAssignedScope(String oldName, String newName) {
        clientRepository
                .findAll()
                .forEach(
                        entity -> {
                            RegisteredClient client =
                                    registeredClientMapper.toObject(entity, mapperSupport);
                            if (!client.getScopes().contains(oldName)) {
                                return;
                            }
                            Set<String> defaults =
                                    replace(
                                            ClientScopeSettings.defaultScopes(client),
                                            oldName,
                                            newName);
                            Set<String> optional =
                                    replace(
                                            ClientScopeSettings.optionalScopes(client),
                                            oldName,
                                            newName);
                            Set<String> scopes =
                                    replace(
                                            new LinkedHashSet<>(client.getScopes()),
                                            oldName,
                                            newName);
                            RegisteredClient updated =
                                    RegisteredClient.from(client)
                                            .scopes(
                                                    values -> {
                                                        values.clear();
                                                        values.addAll(scopes);
                                                    })
                                            .clientSettings(
                                                    ClientScopeSettings.withAssignments(
                                                            client.getClientSettings(),
                                                            defaults,
                                                            optional))
                                            .build();
                            clientRepository.save(
                                    registeredClientMapper.toEntity(updated, mapperSupport));
                        });
    }

    private RegisteredClient clientRequired(String id) {
        return clientRepository
                .findById(id)
                .map(entity -> registeredClientMapper.toObject(entity, mapperSupport))
                .orElseThrow(() -> ApiException.notFound("Client not found"));
    }

    private ClientScopeEntity required(String id) {
        return clientScopeRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("Client scope not found"));
    }

    private static void ensureMutable(ClientScopeEntity entity) {
        if (entity.isBuiltIn()) {
            throw ApiException.badRequest(
                    ApiErrorCode.CLIENT_SCOPE_PROTECTED,
                    "Built-in client scopes cannot be changed");
        }
    }

    private static Set<String> normalized(Set<String> values) {
        Set<String> result = new LinkedHashSet<>();
        if (values != null) {
            values.stream().map(AdminClientScopeService::normalizeName).forEach(result::add);
        }
        return result;
    }

    private static Set<String> replace(Set<String> values, String oldName, String newName) {
        Set<String> result = new LinkedHashSet<>();
        values.forEach(value -> result.add(value.equals(oldName) ? newName : value));
        return result;
    }

    private static String normalizeName(String value) {
        String name = value == null ? "" : value.trim();
        if (!StringUtils.hasText(name)
                || name.length() > 100
                || name.chars().anyMatch(Character::isWhitespace)) {
            throw ApiException.badRequest(
                    "name", ApiErrorCode.CLIENT_SCOPE_INVALID_NAME, "Client scope name is invalid");
        }
        return name;
    }

    private static String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
