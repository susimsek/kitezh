package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.config.security.SocialLoginSecretCipher;
import io.github.susimsek.kitezh.domain.SocialProviderEntity;
import io.github.susimsek.kitezh.domain.SocialProviderMapperEntity;
import io.github.susimsek.kitezh.dto.admin.AdminIdentityProviderDTO;
import io.github.susimsek.kitezh.dto.admin.AdminIdentityProviderRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminProviderMapperDTO;
import io.github.susimsek.kitezh.dto.admin.AdminProviderMapperRequestDTO;
import io.github.susimsek.kitezh.repository.SocialIdentityRepository;
import io.github.susimsek.kitezh.repository.SocialProviderMapperRepository;
import io.github.susimsek.kitezh.repository.SocialProviderRepository;
import io.github.susimsek.kitezh.service.SocialProviderIconKeys;
import io.github.susimsek.kitezh.service.SocialProviderSettingsService;
import io.github.susimsek.kitezh.service.SocialProviderSyncMode;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminIdentityProviderService {

    private static final String ALIAS_FIELD = "alias";
    private static final String REGISTRATION_ID_FIELD = "registrationId";
    private static final String IDENTITY_PROVIDER_TARGET = "identity-provider";
    private static final String IDENTITY_PROVIDER_NOT_FOUND = "Identity provider was not found";
    private static final String PROVIDER_MAPPER_NOT_FOUND = "Provider mapper was not found";

    private final SocialProviderRepository providerRepository;
    private final SocialProviderMapperRepository mapperRepository;
    private final SocialIdentityRepository identityRepository;
    private final SocialLoginSecretCipher secretCipher;
    private final SocialProviderSettingsService settingsService;
    private final AdminAuditEventService auditEventService;

    @Transactional(readOnly = true)
    public Page<AdminIdentityProviderDTO> findAll(String query, Pageable pageable) {
        String search = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        Specification<SocialProviderEntity> specification =
                (root, q, cb) -> {
                    if (search.isBlank()) {
                        return cb.conjunction();
                    }
                    String like = "%" + search + "%";
                    return cb.or(
                            cb.like(cb.lower(root.get("displayName")), like),
                            cb.like(cb.lower(root.get(ALIAS_FIELD)), like),
                            cb.like(cb.lower(root.get(REGISTRATION_ID_FIELD)), like),
                            cb.like(cb.lower(root.get("providerType")), like));
                };
        Page<SocialProviderEntity> page = providerRepository.findAll(specification, pageable);
        if (page.isEmpty()) {
            return page.map(entity -> toDto(entity, 0L));
        }
        java.util.Map<String, Long> mapperCounts =
                mapperRepository
                        .countByProviderAliases(
                                page.getContent().stream()
                                        .map(SocialProviderEntity::getAlias)
                                        .toList())
                        .stream()
                        .collect(
                                java.util.stream.Collectors.toMap(
                                        SocialProviderMapperRepository.MapperCount::getAlias,
                                        SocialProviderMapperRepository.MapperCount::getCount));
        return page.map(entity -> toDto(entity, mapperCounts.getOrDefault(entity.getAlias(), 0L)));
    }

    @Transactional(readOnly = true)
    public AdminIdentityProviderDTO findById(String id) {
        return providerRepository.findById(id).map(this::toDto).orElse(null);
    }

    @Transactional
    @CacheEvict(
            cacheNames = {
                SocialProviderRepository.SOCIAL_PROVIDER_BY_REGISTRATION_ID_CACHE,
                SocialProviderRepository.SOCIAL_PROVIDER_BY_ALIAS_CACHE
            },
            allEntries = true)
    public AdminIdentityProviderDTO create(AdminIdentityProviderRequestDTO request) {
        String registrationId = normalize(request.registrationId());
        String alias = normalize(request.alias());
        if (providerRepository.existsByRegistrationId(registrationId)) {
            throw ApiException.conflict(
                    REGISTRATION_ID_FIELD,
                    ApiErrorCode.CONFLICT,
                    "Registration id is already registered");
        }
        if (providerRepository.existsByAliasIgnoreCase(alias)) {
            throw ApiException.conflict(
                    ALIAS_FIELD, ApiErrorCode.CONFLICT, "Provider alias is already registered");
        }
        SocialProviderEntity entity = new SocialProviderEntity();
        entity.setRegistrationId(registrationId);
        apply(entity, request, alias, true);
        providerRepository.save(entity);
        settingsService.refreshClientRegistrations();
        auditEventService.record(
                "identity-provider.created", IDENTITY_PROVIDER_TARGET, entity.getId());
        return toDto(entity);
    }

    @Transactional
    @CacheEvict(
            cacheNames = {
                SocialProviderRepository.SOCIAL_PROVIDER_BY_REGISTRATION_ID_CACHE,
                SocialProviderRepository.SOCIAL_PROVIDER_BY_ALIAS_CACHE,
                SocialProviderMapperRepository.MAPPERS_BY_PROVIDER_ALIAS_CACHE
            },
            allEntries = true)
    public AdminIdentityProviderDTO update(String id, AdminIdentityProviderRequestDTO request) {
        SocialProviderEntity entity =
                providerRepository
                        .findById(id)
                        .orElseThrow(() -> ApiException.notFound(IDENTITY_PROVIDER_NOT_FOUND));
        String registrationId = normalize(request.registrationId());
        String alias = normalize(request.alias());
        final String previousAlias = entity.getAlias();
        providerRepository
                .findByRegistrationId(registrationId)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(
                        other -> {
                            throw ApiException.conflict(
                                    REGISTRATION_ID_FIELD,
                                    ApiErrorCode.CONFLICT,
                                    "Registration id is already registered");
                        });
        providerRepository
                .findByAliasIgnoreCase(alias)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(
                        other -> {
                            throw ApiException.conflict(
                                    ALIAS_FIELD,
                                    ApiErrorCode.CONFLICT,
                                    "Provider alias is already registered");
                        });
        entity.setRegistrationId(registrationId);
        apply(entity, request, alias, false);
        providerRepository.save(entity);
        if (!previousAlias.equals(entity.getAlias())) {
            mapperRepository.findAll().stream()
                    .filter(mapper -> mapper.getProviderAlias().equals(previousAlias))
                    .forEach(mapper -> mapper.setProviderAlias(entity.getAlias()));
        }
        settingsService.refreshClientRegistrations();
        auditEventService.record("identity-provider.updated", IDENTITY_PROVIDER_TARGET, id);
        return toDto(entity);
    }

    @Transactional
    @CacheEvict(
            cacheNames = {
                SocialProviderRepository.SOCIAL_PROVIDER_BY_REGISTRATION_ID_CACHE,
                SocialProviderRepository.SOCIAL_PROVIDER_BY_ALIAS_CACHE,
                SocialProviderMapperRepository.MAPPERS_BY_PROVIDER_ALIAS_CACHE
            },
            allEntries = true)
    public void delete(String id) {
        SocialProviderEntity entity =
                providerRepository
                        .findById(id)
                        .orElseThrow(() -> ApiException.notFound(IDENTITY_PROVIDER_NOT_FOUND));
        if (!identityRepository.findAllByProvider(entity.getRegistrationId()).isEmpty()
                || !identityRepository.findAllByProvider(entity.getAlias()).isEmpty()) {
            throw ApiException.conflict(
                    ApiErrorCode.CONFLICT, "Provider identities are still linked");
        }
        mapperRepository.deleteAll(
                mapperRepository.findAll().stream()
                        .filter(mapper -> mapper.getProviderAlias().equals(entity.getAlias()))
                        .toList());
        providerRepository.delete(entity);
        settingsService.refreshClientRegistrations();
        auditEventService.record("identity-provider.deleted", IDENTITY_PROVIDER_TARGET, id);
    }

    @Transactional(readOnly = true)
    public Page<AdminProviderMapperDTO> findMappers(
            String providerId, String query, Pageable pageable) {
        SocialProviderEntity provider = require(providerId);
        String alias = provider.getAlias();
        String search = query == null ? "" : query.trim();
        return mapperRepository
                .findByProviderAliasAndNameContainingIgnoreCaseOrProviderAliasAndSourceClaimContainingIgnoreCase(
                        alias, search, alias, search, pageable)
                .map(this::toMapperDto);
    }

    @Transactional
    @CacheEvict(
            cacheNames = SocialProviderMapperRepository.MAPPERS_BY_PROVIDER_ALIAS_CACHE,
            allEntries = true)
    public AdminProviderMapperDTO createMapper(
            String providerId, AdminProviderMapperRequestDTO request) {
        SocialProviderEntity provider = require(providerId);
        if (mapperRepository.existsByProviderAliasAndNameIgnoreCase(
                provider.getAlias(), request.name().trim())) {
            throw ApiException.conflict(
                    "name", ApiErrorCode.CONFLICT, "Mapper name is already registered");
        }
        SocialProviderMapperEntity entity = new SocialProviderMapperEntity();
        entity.setProviderAlias(provider.getAlias());
        apply(entity, request);
        mapperRepository.save(entity);
        auditEventService.record(
                "identity-provider.mapper.created", IDENTITY_PROVIDER_TARGET, providerId);
        return toMapperDto(entity);
    }

    @Transactional
    @CacheEvict(
            cacheNames = SocialProviderMapperRepository.MAPPERS_BY_PROVIDER_ALIAS_CACHE,
            allEntries = true)
    public AdminProviderMapperDTO updateMapper(
            String providerId, String mapperId, AdminProviderMapperRequestDTO request) {
        SocialProviderEntity provider = require(providerId);
        SocialProviderMapperEntity entity =
                mapperRepository
                        .findById(mapperId)
                        .orElseThrow(() -> ApiException.notFound(PROVIDER_MAPPER_NOT_FOUND));
        if (!entity.getProviderAlias().equals(provider.getAlias())) {
            throw ApiException.notFound(PROVIDER_MAPPER_NOT_FOUND);
        }
        if (mapperRepository.findAll().stream()
                .anyMatch(
                        other ->
                                !other.getId().equals(mapperId)
                                        && other.getProviderAlias().equals(provider.getAlias())
                                        && other.getName()
                                                .equalsIgnoreCase(request.name().trim()))) {
            throw ApiException.conflict(
                    "name", ApiErrorCode.CONFLICT, "Mapper name is already registered");
        }
        apply(entity, request);
        mapperRepository.save(entity);
        auditEventService.record(
                "identity-provider.mapper.updated", IDENTITY_PROVIDER_TARGET, providerId);
        return toMapperDto(entity);
    }

    @Transactional
    @CacheEvict(
            cacheNames = SocialProviderMapperRepository.MAPPERS_BY_PROVIDER_ALIAS_CACHE,
            allEntries = true)
    public void deleteMapper(String providerId, String mapperId) {
        SocialProviderEntity provider = require(providerId);
        SocialProviderMapperEntity entity =
                mapperRepository
                        .findById(mapperId)
                        .orElseThrow(() -> ApiException.notFound(PROVIDER_MAPPER_NOT_FOUND));
        if (!entity.getProviderAlias().equals(provider.getAlias())) {
            throw ApiException.notFound(PROVIDER_MAPPER_NOT_FOUND);
        }
        mapperRepository.delete(entity);
        auditEventService.record(
                "identity-provider.mapper.deleted", IDENTITY_PROVIDER_TARGET, providerId);
    }

    private SocialProviderEntity require(String id) {
        return providerRepository
                .findById(id)
                .orElseThrow(() -> ApiException.notFound(IDENTITY_PROVIDER_NOT_FOUND));
    }

    private void apply(
            SocialProviderEntity entity,
            AdminIdentityProviderRequestDTO request,
            String alias,
            boolean create) {
        String providerType = normalize(request.providerType());
        if (!java.util.Set.of("google", "github", "linkedin", "microsoft", "oidc")
                .contains(providerType)) {
            throw ApiException.badRequest(
                    "providerType", ApiErrorCode.INVALID_REQUEST, "Provider type is invalid");
        }
        entity.setProviderType(providerType);
        if ("oidc".equals(providerType)
                && (request.authorizationUri() == null
                        || request.authorizationUri().isBlank()
                        || request.tokenUri() == null
                        || request.tokenUri().isBlank())) {
            throw ApiException.badRequest(
                    "authorizationUri",
                    ApiErrorCode.INVALID_REQUEST,
                    "Authorization and token endpoints are required for OIDC providers");
        }
        entity.setDisplayName(request.displayName().trim());
        entity.setAlias(alias);
        String iconKey = request.iconKey().trim().toLowerCase(Locale.ROOT);
        if (!SocialProviderIconKeys.isAllowed(iconKey)) {
            throw ApiException.badRequest(
                    "iconKey", ApiErrorCode.INVALID_REQUEST, "Provider icon is invalid");
        }
        entity.setIconKey(iconKey);
        entity.setShortStateParameter(request.shortStateParameter());
        entity.setCaseSensitiveUsername(request.caseSensitiveUsername());
        entity.setEnabled(request.enabled());
        entity.setHideOnLogin(request.hideOnLogin());
        entity.setAccountLinkingOnly(request.accountLinkingOnly());
        entity.setTrustEmail(request.trustEmail());
        entity.setMfaRequired(request.mfaRequired());
        entity.setRequiredClaims(
                request.requiredClaims() == null || request.requiredClaims().isBlank()
                        ? "sub"
                        : request.requiredClaims().trim());
        entity.setStoreTokens(request.storeTokens());
        entity.setStoredTokensReadable(request.storedTokensReadable());
        entity.setGuiOrder(request.guiOrder());
        entity.setShowInAccountConsole(
                request.showInAccountConsole().trim().toLowerCase(Locale.ROOT));
        entity.setSyncMode(SocialProviderSyncMode.from(request.syncMode()).value());
        entity.setClientId(request.clientId().trim());
        if (create || (request.clientSecret() != null && !request.clientSecret().isBlank())) {
            if (request.clientSecret() == null || request.clientSecret().isBlank()) {
                throw ApiException.badRequest(
                        "clientSecret", ApiErrorCode.INVALID_REQUEST, "Client secret is required");
            }
            entity.setClientSecretEncrypted(secretCipher.encrypt(request.clientSecret().trim()));
        }
        entity.setAuthorizationUri(blankToNull(request.authorizationUri()));
        entity.setTokenUri(blankToNull(request.tokenUri()));
        entity.setUserInfoUri(blankToNull(request.userInfoUri()));
        entity.setJwkSetUri(blankToNull(request.jwkSetUri()));
        entity.setIssuerUri(blankToNull(request.issuerUri()));
        entity.setClientAuthenticationMethod(request.clientAuthenticationMethod().trim());
        entity.setScopes(request.scopes().trim());
        entity.setUserNameAttribute(request.userNameAttribute().trim());
    }

    private void apply(SocialProviderMapperEntity entity, AdminProviderMapperRequestDTO request) {
        entity.setName(request.name().trim());
        entity.setSourceClaim(request.sourceClaim().trim());
        entity.setTarget(request.target().trim());
        entity.setMapperType(request.mapperType().trim());
        String syncMode = request.syncMode().trim().toLowerCase(Locale.ROOT);
        entity.setSyncMode(
                "inherit".equals(syncMode)
                        ? syncMode
                        : SocialProviderSyncMode.from(syncMode).value());
        entity.setAddToIdToken(request.addToIdToken());
        entity.setAddToAccessToken(request.addToAccessToken());
    }

    private AdminIdentityProviderDTO toDto(SocialProviderEntity e) {
        return toDto(e, mapperRepository.countByProviderAlias(e.getAlias()));
    }

    private AdminIdentityProviderDTO toDto(SocialProviderEntity e, long mapperCount) {
        String secret = e.getClientSecretEncrypted();
        return new AdminIdentityProviderDTO(
                e.getId(),
                e.getRegistrationId(),
                e.getProviderType(),
                e.getDisplayName(),
                e.getAlias(),
                SocialProviderIconKeys.normalize(e.getIconKey(), e.getProviderType()),
                e.isShortStateParameter(),
                e.isCaseSensitiveUsername(),
                e.isEnabled(),
                e.getClientId() != null
                        && !e.getClientId().isBlank()
                        && secret != null
                        && !secret.isBlank(),
                e.isHideOnLogin(),
                e.isAccountLinkingOnly(),
                e.isTrustEmail(),
                e.isMfaRequired(),
                e.getRequiredClaims(),
                e.isStoreTokens(),
                e.isStoredTokensReadable(),
                e.getGuiOrder(),
                e.getShowInAccountConsole(),
                SocialProviderSyncMode.from(e.getSyncMode()).value(),
                e.getClientId(),
                secret != null && !secret.isBlank(),
                e.getAuthorizationUri(),
                e.getTokenUri(),
                e.getUserInfoUri(),
                e.getJwkSetUri(),
                e.getIssuerUri(),
                e.getClientAuthenticationMethod(),
                e.getScopes(),
                e.getUserNameAttribute(),
                mapperCount);
    }

    private AdminProviderMapperDTO toMapperDto(SocialProviderMapperEntity e) {
        return new AdminProviderMapperDTO(
                e.getId(),
                e.getProviderAlias(),
                e.getName(),
                e.getSourceClaim(),
                e.getTarget(),
                e.getMapperType(),
                e.getSyncMode(),
                e.isAddToIdToken(),
                e.isAddToAccessToken());
    }

    private static String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
