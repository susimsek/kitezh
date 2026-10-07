package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.OrganizationDomainEntity;
import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDomainRequestDTO;
import io.github.susimsek.kitezh.repository.OrganizationDomainRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminOrganizationDomainService {

    private static final String ORGANIZATION_TARGET = "organization";

    private final OrganizationRepository organizationRepository;
    private final OrganizationDomainRepository domainRepository;
    private final AdminAuditEventService adminAuditEventService;

    @Transactional(readOnly = true)
    public Page<AdminOrganizationDomainDTO> findAll(Long organizationId, Pageable pageable) {
        findOrganization(organizationId);
        return domainRepository.findByOrganizationId(organizationId, pageable).map(this::toDTO);
    }

    @Transactional
    public AdminOrganizationDomainDTO add(
            Long organizationId, AdminOrganizationDomainRequestDTO request) {
        OrganizationEntity organization = findOrganization(organizationId);
        String domain = normalize(request.domain());
        validateDomain(domain);
        if (domainRepository.existsByDomainIgnoreCase(domain)) {
            throw ApiException.conflict(
                    "domain",
                    ApiErrorCode.ORGANIZATION_DUPLICATE_DOMAIN,
                    "Domain is already associated with an organization");
        }
        OrganizationDomainEntity entity = new OrganizationDomainEntity();
        entity.setOrganization(organization);
        entity.setDomain(domain);
        OrganizationDomainEntity saved = domainRepository.save(entity);
        adminAuditEventService.record(
                "organization.domain.added",
                ORGANIZATION_TARGET,
                organizationId.toString(),
                "domain=" + domain);
        return toDTO(saved);
    }

    @Transactional
    public void remove(Long organizationId, Long domainId) {
        findOrganization(organizationId);
        OrganizationDomainEntity domain =
                domainRepository
                        .findById(domainId)
                        .filter(entity -> entity.getOrganization().getId().equals(organizationId))
                        .orElseThrow(() -> ApiException.notFound("Organization domain not found"));
        domainRepository.delete(domain);
        adminAuditEventService.record(
                "organization.domain.removed",
                ORGANIZATION_TARGET,
                organizationId.toString(),
                "domain=" + domain.getDomain());
    }

    private OrganizationEntity findOrganization(Long id) {
        return organizationRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("Organization not found"));
    }

    private AdminOrganizationDomainDTO toDTO(OrganizationDomainEntity entity) {
        return new AdminOrganizationDomainDTO(entity.getId(), entity.getDomain());
    }

    private static String normalize(String domain) {
        return domain == null ? "" : domain.strip().toLowerCase(java.util.Locale.ROOT);
    }

    private static void validateDomain(String domain) {
        if (!domain.matches(
                "(?=.{1,255}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}")) {
            throw ApiException.badRequest(
                    "domain",
                    ApiErrorCode.ORGANIZATION_INVALID_DOMAIN,
                    "Organization domain is invalid");
        }
    }
}
