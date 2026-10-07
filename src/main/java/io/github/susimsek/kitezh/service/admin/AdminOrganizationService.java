package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationRequestDTO;
import io.github.susimsek.kitezh.mapper.AdminOrganizationMapper;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminOrganizationService {

    private static final String ORGANIZATION_TARGET = "organization";

    private final OrganizationRepository organizationRepository;
    private final AdminOrganizationMapper organizationMapper;
    private final AdminAuditEventService adminAuditEventService;

    @Transactional(readOnly = true)
    public Page<AdminOrganizationDTO> findAll(String query, Pageable pageable) {
        String normalized = query == null ? "" : query.strip();
        return organizationRepository
                .findByAliasContainingIgnoreCaseOrNameContainingIgnoreCase(
                        normalized, normalized, pageable)
                .map(organizationMapper::toDTO);
    }

    @Transactional(readOnly = true)
    public AdminOrganizationDTO findById(Long id) {
        return organizationMapper.toDTO(findOrganization(id));
    }

    @Transactional
    @CacheEvict(cacheNames = OrganizationRepository.ORGANIZATION_BY_ALIAS_CACHE, allEntries = true)
    public AdminOrganizationDTO create(AdminOrganizationRequestDTO request) {
        String alias = normalizeAlias(request.alias());
        validateAlias(alias);
        if (organizationRepository.existsByAliasIgnoreCase(alias)) {
            throw ApiException.conflict(
                    "alias",
                    ApiErrorCode.ORGANIZATION_DUPLICATE_ALIAS,
                    "Organization alias is already registered");
        }
        validateRedirectUrl(request.redirectUrl());
        OrganizationEntity organization = organizationMapper.toEntity(request);
        organization.setAlias(alias);
        organization.setEnabled(request.enabledValue());
        organizationMapper.updateAttributes(request.attributes(), organization);
        OrganizationEntity saved = organizationRepository.save(organization);
        adminAuditEventService.record(
                "organization.created", ORGANIZATION_TARGET, saved.getId().toString());
        return organizationMapper.toDTO(saved);
    }

    @Transactional
    @CacheEvict(cacheNames = OrganizationRepository.ORGANIZATION_BY_ALIAS_CACHE, allEntries = true)
    public AdminOrganizationDTO update(Long id, AdminOrganizationRequestDTO request) {
        OrganizationEntity organization = findOrganization(id);
        String alias = normalizeAlias(request.alias());
        validateAlias(alias);
        if (!organization.getAlias().equalsIgnoreCase(alias)) {
            throw ApiException.badRequest(
                    "alias",
                    ApiErrorCode.ORGANIZATION_ALIAS_IMMUTABLE,
                    "Organization alias cannot be changed");
        }
        validateRedirectUrl(request.redirectUrl());
        organizationMapper.update(request, organization);
        organization.setEnabled(request.enabledValue());
        organizationMapper.updateAttributes(request.attributes(), organization);
        adminAuditEventService.record("organization.updated", ORGANIZATION_TARGET, id.toString());
        return organizationMapper.toDTO(organization);
    }

    private OrganizationEntity findOrganization(Long id) {
        return organizationRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("Organization not found"));
    }

    private static String normalizeAlias(String alias) {
        return alias == null ? "" : alias.strip().toLowerCase(java.util.Locale.ROOT);
    }

    private static void validateAlias(String alias) {
        if (!alias.matches("[a-z0-9](?:[a-z0-9._-]{0,98}[a-z0-9])?")) {
            throw ApiException.badRequest(
                    "alias",
                    ApiErrorCode.ORGANIZATION_INVALID_ALIAS,
                    "Organization alias has an invalid format");
        }
    }

    private static void validateRedirectUrl(String redirectUrl) {
        if (redirectUrl == null || redirectUrl.isBlank()) {
            return;
        }
        try {
            URI uri = URI.create(redirectUrl.strip());
            if (!uri.isAbsolute() || uri.getHost() == null) {
                throw new IllegalArgumentException("not absolute");
            }
        } catch (IllegalArgumentException exception) {
            throw ApiException.badRequest(
                    "redirectUrl",
                    ApiErrorCode.ORGANIZATION_INVALID_REDIRECT_URL,
                    "Organization redirect URL is invalid");
        }
    }
}
