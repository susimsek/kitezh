package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.domain.OrganizationIdentityProviderEntity;
import io.github.susimsek.kitezh.domain.SocialProviderEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationIdentityProviderDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationIdentityProviderRequestDTO;
import io.github.susimsek.kitezh.repository.OrganizationIdentityProviderRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.repository.SocialProviderRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminOrganizationIdentityProviderService {

    private static final String ORGANIZATION_TARGET = "organization";

    private final OrganizationRepository organizationRepository;
    private final OrganizationIdentityProviderRepository bindingRepository;
    private final SocialProviderRepository providerRepository;
    private final AdminAuditEventService adminAuditEventService;

    @Transactional(readOnly = true)
    public Page<AdminOrganizationIdentityProviderDTO> findAll(
            Long organizationId, Pageable pageable) {
        requireOrganization(organizationId);
        return bindingRepository.findByOrganizationId(organizationId, pageable).map(this::toDTO);
    }

    @Transactional
    public AdminOrganizationIdentityProviderDTO add(
            Long organizationId, AdminOrganizationIdentityProviderRequestDTO request) {
        OrganizationEntity organization = requireOrganization(organizationId);
        SocialProviderEntity provider = resolveProvider(request.providerAlias());
        String alias = provider.getAlias().toLowerCase(Locale.ROOT);
        if (bindingRepository.existsByOrganizationIdAndProviderAliasIgnoreCase(
                organizationId, alias)) {
            throw ApiException.conflict(
                    "providerAlias",
                    ApiErrorCode.ORGANIZATION_IDP_ALREADY_EXISTS,
                    "Identity provider is already bound to the organization");
        }
        OrganizationIdentityProviderEntity binding = new OrganizationIdentityProviderEntity();
        binding.setOrganization(organization);
        binding.setProviderAlias(alias);
        binding.setEnabled(request.enabledValue());
        OrganizationIdentityProviderEntity saved = bindingRepository.save(binding);
        adminAuditEventService.record(
                "organization.identity_provider.added",
                ORGANIZATION_TARGET,
                organizationId.toString(),
                "provider=" + alias);
        return toDTO(saved);
    }

    @Transactional
    public AdminOrganizationIdentityProviderDTO update(
            Long organizationId,
            Long bindingId,
            AdminOrganizationIdentityProviderRequestDTO request) {
        requireOrganization(organizationId);
        OrganizationIdentityProviderEntity binding = requireBinding(organizationId, bindingId);
        SocialProviderEntity provider = resolveProvider(request.providerAlias());
        String alias = provider.getAlias().toLowerCase(Locale.ROOT);
        if (!alias.equalsIgnoreCase(binding.getProviderAlias())
                && bindingRepository.existsByOrganizationIdAndProviderAliasIgnoreCase(
                        organizationId, alias)) {
            throw ApiException.conflict(
                    "providerAlias",
                    ApiErrorCode.ORGANIZATION_IDP_ALREADY_EXISTS,
                    "Identity provider is already bound to the organization");
        }
        binding.setProviderAlias(alias);
        binding.setEnabled(request.enabledValue());
        adminAuditEventService.record(
                "organization.identity_provider.updated",
                ORGANIZATION_TARGET,
                organizationId.toString(),
                "provider=" + alias);
        return toDTO(binding);
    }

    @Transactional
    public void remove(Long organizationId, Long bindingId) {
        requireOrganization(organizationId);
        OrganizationIdentityProviderEntity binding = requireBinding(organizationId, bindingId);
        bindingRepository.delete(binding);
        adminAuditEventService.record(
                "organization.identity_provider.removed",
                ORGANIZATION_TARGET,
                organizationId.toString(),
                "provider=" + binding.getProviderAlias());
    }

    private OrganizationEntity requireOrganization(Long id) {
        return organizationRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound("Organization not found"));
    }

    private OrganizationIdentityProviderEntity requireBinding(Long organizationId, Long bindingId) {
        OrganizationIdentityProviderEntity binding =
                bindingRepository
                        .findById(bindingId)
                        .orElseThrow(
                                () ->
                                        ApiException.notFound(
                                                ApiErrorCode.ORGANIZATION_IDP_NOT_FOUND,
                                                "Identity provider binding not found"));
        if (!binding.getOrganization().getId().equals(organizationId)) {
            throw ApiException.notFound(
                    ApiErrorCode.ORGANIZATION_IDP_NOT_FOUND, "Identity provider binding not found");
        }
        return binding;
    }

    private SocialProviderEntity resolveProvider(String value) {
        String normalized = value.strip().toLowerCase(Locale.ROOT);
        return providerRepository
                .findByAliasIgnoreCase(normalized)
                .or(() -> providerRepository.findByRegistrationId(normalized))
                .orElseThrow(
                        () ->
                                ApiException.badRequest(
                                        "providerAlias",
                                        ApiErrorCode.ORGANIZATION_IDP_PROVIDER_NOT_FOUND,
                                        "Identity provider was not found"));
    }

    private AdminOrganizationIdentityProviderDTO toDTO(OrganizationIdentityProviderEntity binding) {
        return new AdminOrganizationIdentityProviderDTO(
                binding.getId(), binding.getProviderAlias(), binding.isEnabled());
    }
}
