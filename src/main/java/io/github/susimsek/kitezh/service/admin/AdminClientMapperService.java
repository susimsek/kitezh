package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.ClientMapperEntity;
import io.github.susimsek.kitezh.domain.RegisteredClientEntity;
import io.github.susimsek.kitezh.dto.admin.AdminClientMapperDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientMapperRequestDTO;
import io.github.susimsek.kitezh.repository.ClientMapperRepository;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.security.ProtocolMapperTypes;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminClientMapperService {

    private static final String CLIENT_TARGET = "client";

    private final ClientMapperRepository mapperRepository;
    private final ClientRepository clientRepository;
    private final AdminAuditEventService auditEventService;

    @Transactional(readOnly = true)
    public Page<AdminClientMapperDTO> findAll(String clientId, String query, Pageable pageable) {
        requireClient(clientId);
        return mapperRepository
                .findByClientIdAndNameContainingIgnoreCase(
                        clientId, query == null ? "" : query, pageable)
                .map(AdminClientMapperService::toDTO);
    }

    @Transactional
    public AdminClientMapperDTO create(String clientId, AdminClientMapperRequestDTO request) {
        RegisteredClientEntity client = requireClient(clientId);
        validate(request);
        if (mapperRepository.existsByClientIdAndNameIgnoreCase(client.getId(), request.name())) {
            throw ApiException.conflict(
                    "name",
                    ApiErrorCode.CLIENT_MAPPER_DUPLICATE_NAME,
                    "Client mapper name is already registered");
        }
        ClientMapperEntity mapper = new ClientMapperEntity();
        apply(mapper, client, request);
        ClientMapperEntity saved = mapperRepository.save(mapper);
        auditEventService.record("client.mapper.created", CLIENT_TARGET, client.getId());
        return toDTO(saved);
    }

    @Transactional
    public AdminClientMapperDTO update(
            Long id, String clientId, AdminClientMapperRequestDTO request) {
        RegisteredClientEntity client = requireClient(clientId);
        validate(request);
        ClientMapperEntity mapper = mapperRequired(id, client.getId());
        if (mapperRepository.existsByClientIdAndNameIgnoreCaseAndIdNot(
                client.getId(), request.name(), id)) {
            throw ApiException.conflict(
                    "name",
                    ApiErrorCode.CLIENT_MAPPER_DUPLICATE_NAME,
                    "Client mapper name is already registered");
        }
        apply(mapper, client, request);
        ClientMapperEntity saved = mapperRepository.save(mapper);
        auditEventService.record("client.mapper.updated", CLIENT_TARGET, client.getId());
        return toDTO(saved);
    }

    @Transactional
    public void delete(Long id, String clientId) {
        RegisteredClientEntity client = requireClient(clientId);
        ClientMapperEntity mapper = mapperRequired(id, client.getId());
        mapperRepository.delete(mapper);
        auditEventService.record("client.mapper.deleted", CLIENT_TARGET, client.getId());
    }

    private RegisteredClientEntity requireClient(String clientId) {
        return clientRepository
                .findById(clientId)
                .orElseThrow(() -> ApiException.notFound("Client not found"));
    }

    private ClientMapperEntity mapperRequired(Long id, String clientId) {
        return mapperRepository
                .findById(id)
                .filter(mapper -> mapper.getClient().getId().equals(clientId))
                .orElseThrow(() -> ApiException.notFound("Client mapper not found"));
    }

    private static void apply(
            ClientMapperEntity mapper,
            RegisteredClientEntity client,
            AdminClientMapperRequestDTO request) {
        mapper.setClient(client);
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

    private static AdminClientMapperDTO toDTO(ClientMapperEntity mapper) {
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
