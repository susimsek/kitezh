package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.config.security.SamlRelyingPartyRegistrationRepository;
import io.github.susimsek.kitezh.config.security.SocialLoginSecretCipher;
import io.github.susimsek.kitezh.domain.SamlProviderConfigEntity;
import io.github.susimsek.kitezh.domain.SocialProviderEntity;
import io.github.susimsek.kitezh.domain.SocialProviderMapperEntity;
import io.github.susimsek.kitezh.dto.admin.AdminIdentityProviderDTO;
import io.github.susimsek.kitezh.dto.admin.AdminIdentityProviderRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminProviderMapperDTO;
import io.github.susimsek.kitezh.dto.admin.AdminProviderMapperRequestDTO;
import io.github.susimsek.kitezh.repository.SamlProviderConfigRepository;
import io.github.susimsek.kitezh.repository.SocialIdentityRepository;
import io.github.susimsek.kitezh.repository.SocialProviderMapperRepository;
import io.github.susimsek.kitezh.repository.SocialProviderRepository;
import io.github.susimsek.kitezh.service.SocialProviderIconKeys;
import io.github.susimsek.kitezh.service.SocialProviderSettingsService;
import io.github.susimsek.kitezh.service.SocialProviderSyncMode;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class AdminIdentityProviderService {

    private static final String ALIAS_FIELD = "alias";
    private static final String REGISTRATION_ID_FIELD = "registrationId";
    private static final String IDENTITY_PROVIDER_TARGET = "identity-provider";
    private static final String IDENTITY_PROVIDER_NOT_FOUND = "Identity provider was not found";
    private static final String PROVIDER_MAPPER_NOT_FOUND = "Provider mapper was not found";
    private static final String SAML_REDIRECT_BINDING = "REDIRECT";

    private final SocialProviderRepository providerRepository;
    private final SamlProviderConfigRepository samlConfigRepository;
    private final SocialProviderMapperRepository mapperRepository;
    private final SocialIdentityRepository identityRepository;
    private final SocialLoginSecretCipher secretCipher;
    private final SocialProviderSettingsService settingsService;
    private final SamlRelyingPartyRegistrationRepository samlRegistrationRepository;
    private final AdminAuditEventService auditEventService;

    public AdminIdentityProviderService(
            SocialProviderRepository providerRepository,
            SocialProviderMapperRepository mapperRepository,
            SocialIdentityRepository identityRepository,
            SocialLoginSecretCipher secretCipher,
            SocialProviderSettingsService settingsService,
            AdminAuditEventService auditEventService) {
        this(
                providerRepository,
                null,
                mapperRepository,
                identityRepository,
                secretCipher,
                settingsService,
                null,
                auditEventService);
    }

    @Autowired
    public AdminIdentityProviderService(
            SocialProviderRepository providerRepository,
            SamlProviderConfigRepository samlConfigRepository,
            SocialProviderMapperRepository mapperRepository,
            SocialIdentityRepository identityRepository,
            SocialLoginSecretCipher secretCipher,
            SocialProviderSettingsService settingsService,
            SamlRelyingPartyRegistrationRepository samlRegistrationRepository,
            AdminAuditEventService auditEventService) {
        this.providerRepository = providerRepository;
        this.samlConfigRepository = samlConfigRepository;
        this.mapperRepository = mapperRepository;
        this.identityRepository = identityRepository;
        this.secretCipher = secretCipher;
        this.settingsService = settingsService;
        this.samlRegistrationRepository = samlRegistrationRepository;
        this.auditEventService = auditEventService;
    }

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
        Map<String, SamlProviderConfigEntity> samlConfigs = samlConfigs(page);
        return page.map(
                entity ->
                        toDto(
                                entity,
                                mapperCounts.getOrDefault(entity.getAlias(), 0L),
                                samlConfigs.get(entity.getId())));
    }

    @Transactional(readOnly = true)
    public AdminIdentityProviderDTO findById(String id) {
        return providerRepository
                .findById(id)
                .map(entity -> toDto(entity, samlConfig(id)))
                .orElse(null);
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
        applySaml(entity, request, true);
        settingsService.refreshClientRegistrations();
        refreshSamlRegistrations();
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
        applySaml(entity, request, false);
        if (!previousAlias.equals(entity.getAlias())) {
            mapperRepository.findAll().stream()
                    .filter(mapper -> mapper.getProviderAlias().equals(previousAlias))
                    .forEach(mapper -> mapper.setProviderAlias(entity.getAlias()));
        }
        settingsService.refreshClientRegistrations();
        refreshSamlRegistrations();
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
        if (samlConfigRepository != null) {
            samlConfigRepository.deleteById(entity.getId());
        }
        providerRepository.delete(entity);
        settingsService.refreshClientRegistrations();
        refreshSamlRegistrations();
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
        applyMapper(entity, request);
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
        applyMapper(entity, request);
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
        validateProviderType(providerType);
        entity.setProviderType(providerType);
        validateProviderEndpoints(providerType, request);
        validateClientId(providerType, request);
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
        entity.setClientId(blankToNull(request.clientId()));
        applyClientSecret(entity, request, providerType, create);
        applyProviderEndpoints(entity, request);
        entity.setClientAuthenticationMethod(request.clientAuthenticationMethod().trim());
        entity.setScopes(request.scopes().trim());
        entity.setUserNameAttribute(request.userNameAttribute().trim());
    }

    private static void validateProviderType(String providerType) {
        if (!java.util.Set.of("google", "github", "linkedin", "microsoft", "oidc", "saml")
                .contains(providerType)) {
            throw ApiException.badRequest(
                    "providerType", ApiErrorCode.INVALID_REQUEST, "Provider type is invalid");
        }
    }

    private static void validateProviderEndpoints(
            String providerType, AdminIdentityProviderRequestDTO request) {
        if ("oidc".equals(providerType)
                && (!hasText(request.authorizationUri()) || !hasText(request.tokenUri()))) {
            throw ApiException.badRequest(
                    "authorizationUri",
                    ApiErrorCode.INVALID_REQUEST,
                    "Authorization and token endpoints are required for OIDC providers");
        }
    }

    private static void validateClientId(
            String providerType, AdminIdentityProviderRequestDTO request) {
        if (!"saml".equals(providerType) && !hasText(request.clientId())) {
            throw ApiException.badRequest(
                    "clientId", ApiErrorCode.INVALID_REQUEST, "Client id is required");
        }
    }

    private void applyClientSecret(
            SocialProviderEntity entity,
            AdminIdentityProviderRequestDTO request,
            String providerType,
            boolean create) {
        if (!"saml".equals(providerType) && (create || hasText(request.clientSecret()))) {
            if (!hasText(request.clientSecret())) {
                throw ApiException.badRequest(
                        "clientSecret", ApiErrorCode.INVALID_REQUEST, "Client secret is required");
            }
            entity.setClientSecretEncrypted(secretCipher.encrypt(request.clientSecret().trim()));
        }
    }

    private static void applyProviderEndpoints(
            SocialProviderEntity entity, AdminIdentityProviderRequestDTO request) {
        entity.setAuthorizationUri(blankToNull(request.authorizationUri()));
        entity.setTokenUri(blankToNull(request.tokenUri()));
        entity.setUserInfoUri(blankToNull(request.userInfoUri()));
        entity.setJwkSetUri(blankToNull(request.jwkSetUri()));
        entity.setIssuerUri(blankToNull(request.issuerUri()));
    }

    private void applySaml(
            SocialProviderEntity provider,
            AdminIdentityProviderRequestDTO request,
            boolean create) {
        if (!isSaml(provider)) {
            removeSamlConfiguration(provider);
            return;
        }
        requireSamlRepository();
        validateSamlSource(request);
        SamlProviderConfigEntity config = loadSamlConfig(provider);
        applySamlSettings(config, provider, request);
        applySamlKeys(config, request, create);
        validateSamlSigningMaterial(config, request);
        samlConfigRepository.save(config);
    }

    private static boolean isSaml(SocialProviderEntity provider) {
        return "saml".equalsIgnoreCase(provider.getProviderType());
    }

    private void removeSamlConfiguration(SocialProviderEntity provider) {
        if (samlConfigRepository != null) {
            samlConfigRepository.deleteById(provider.getId());
        }
    }

    private void requireSamlRepository() {
        if (samlConfigRepository == null) {
            throw new IllegalStateException("SAML provider configuration is unavailable");
        }
    }

    private static void validateSamlSource(AdminIdentityProviderRequestDTO request) {
        boolean metadata = hasText(request.samlMetadataUri());
        boolean manual =
                hasText(request.samlAssertingPartyEntityId())
                        && hasText(request.samlSingleSignOnServiceUrl())
                        && hasText(request.samlIdpCertificate());
        if (!metadata && !manual) {
            throw ApiException.badRequest(
                    "samlMetadataUri",
                    ApiErrorCode.INVALID_REQUEST,
                    "SAML metadata URL or asserting-party details are required");
        }
    }

    private SamlProviderConfigEntity loadSamlConfig(SocialProviderEntity provider) {
        return samlConfigRepository
                .findById(provider.getId())
                .orElseGet(SamlProviderConfigEntity::new);
    }

    private static void applySamlSettings(
            SamlProviderConfigEntity config,
            SocialProviderEntity provider,
            AdminIdentityProviderRequestDTO request) {
        config.setProviderId(provider.getId());
        config.setMetadataUri(blankToNull(request.samlMetadataUri()));
        config.setAssertingPartyEntityId(blankToNull(request.samlAssertingPartyEntityId()));
        config.setSingleSignOnServiceUrl(blankToNull(request.samlSingleSignOnServiceUrl()));
        config.setSingleLogoutServiceUrl(blankToNull(request.samlSingleLogoutServiceUrl()));
        config.setIdpCertificate(blankToNull(request.samlIdpCertificate()));
        config.setServiceProviderEntityId(blankToNull(request.samlServiceProviderEntityId()));
        config.setSignAuthnRequests(request.samlSignAuthnRequests());
        config.setWantAssertionsSigned(request.samlWantAssertionsSigned());
        config.setSignatureAlgorithm(blankToNull(request.samlSignatureAlgorithm()));
        config.setAuthnRequestBinding(
                defaultValue(request.samlAuthnRequestBinding(), SAML_REDIRECT_BINDING)
                        .toUpperCase(Locale.ROOT));
        config.setResponseBinding(
                defaultValue(request.samlResponseBinding(), "POST").toUpperCase(Locale.ROOT));
        config.setLogoutBinding(
                defaultValue(request.samlLogoutBinding(), SAML_REDIRECT_BINDING)
                        .toUpperCase(Locale.ROOT));
        config.setForceAuthentication(request.samlForceAuthentication());
        config.setPassSubject(request.samlPassSubject());
        config.setNameIdFormat(blankToNull(request.samlNameIdFormat()));
        config.setPrincipalAttribute(defaultValue(request.samlPrincipalAttribute(), "NameID"));
        config.setEmailAttribute(defaultValue(request.samlEmailAttribute(), "email"));
        config.setFirstNameAttribute(defaultValue(request.samlFirstNameAttribute(), "givenName"));
        config.setLastNameAttribute(defaultValue(request.samlLastNameAttribute(), "sn"));
        config.setGroupsAttribute(defaultValue(request.samlGroupsAttribute(), "groups"));
    }

    private void applySamlKeys(
            SamlProviderConfigEntity config,
            AdminIdentityProviderRequestDTO request,
            boolean create) {
        if (hasText(request.samlSigningPrivateKey())) {
            config.setSigningPrivateKeyEncrypted(
                    secretCipher.encrypt(request.samlSigningPrivateKey().trim()));
        } else if (create && request.samlSignAuthnRequests()) {
            throw ApiException.badRequest(
                    "samlSigningPrivateKey",
                    ApiErrorCode.INVALID_REQUEST,
                    "A signing private key is required when SAML AuthnRequests are signed");
        }
        if (hasText(request.samlSigningCertificate())) {
            config.setSigningCertificate(request.samlSigningCertificate().trim());
        }
        if (hasText(request.samlDecryptionPrivateKey())) {
            config.setDecryptionPrivateKeyEncrypted(
                    secretCipher.encrypt(request.samlDecryptionPrivateKey().trim()));
        }
        if (hasText(request.samlDecryptionCertificate())) {
            config.setDecryptionCertificate(request.samlDecryptionCertificate().trim());
        }
    }

    private static void validateSamlSigningMaterial(
            SamlProviderConfigEntity config, AdminIdentityProviderRequestDTO request) {
        if (request.samlSignAuthnRequests()
                && (!hasText(config.getSigningPrivateKeyEncrypted())
                        || !hasText(config.getSigningCertificate()))) {
            throw ApiException.badRequest(
                    "samlSigningCertificate",
                    ApiErrorCode.INVALID_REQUEST,
                    "A signing certificate is required when SAML AuthnRequests are signed");
        }
    }

    private void applyMapper(
            SocialProviderMapperEntity entity, AdminProviderMapperRequestDTO request) {
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
        return toDto(e, mapperRepository.countByProviderAlias(e.getAlias()), samlConfig(e.getId()));
    }

    private AdminIdentityProviderDTO toDto(
            SocialProviderEntity e, SamlProviderConfigEntity samlConfig) {
        return toDto(e, mapperRepository.countByProviderAlias(e.getAlias()), samlConfig);
    }

    private AdminIdentityProviderDTO toDto(SocialProviderEntity e, long mapperCount) {
        return toDto(e, mapperCount, samlConfig(e.getId()));
    }

    private AdminIdentityProviderDTO toDto(
            SocialProviderEntity e, long mapperCount, SamlProviderConfigEntity saml) {
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
                isConfigured(e, saml),
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
                text(e.getClientId()),
                secret != null && !secret.isBlank(),
                e.getAuthorizationUri(),
                e.getTokenUri(),
                e.getUserInfoUri(),
                e.getJwkSetUri(),
                e.getIssuerUri(),
                e.getClientAuthenticationMethod(),
                e.getScopes(),
                e.getUserNameAttribute(),
                mapperCount,
                samlText(saml, SamlProviderConfigEntity::getMetadataUri),
                samlText(saml, SamlProviderConfigEntity::getAssertingPartyEntityId),
                samlText(saml, SamlProviderConfigEntity::getSingleSignOnServiceUrl),
                samlText(saml, SamlProviderConfigEntity::getSingleLogoutServiceUrl),
                samlText(saml, SamlProviderConfigEntity::getIdpCertificate),
                samlHasText(saml, SamlProviderConfigEntity::getSigningPrivateKeyEncrypted),
                samlText(saml, SamlProviderConfigEntity::getSigningCertificate),
                samlText(saml, SamlProviderConfigEntity::getServiceProviderEntityId),
                samlFlag(saml, SamlProviderConfigEntity::isSignAuthnRequests, false),
                samlFlag(saml, SamlProviderConfigEntity::isWantAssertionsSigned, true),
                samlText(saml, SamlProviderConfigEntity::getNameIdFormat),
                samlTextOrDefault(saml, SamlProviderConfigEntity::getPrincipalAttribute, "NameID"),
                samlTextOrDefault(saml, SamlProviderConfigEntity::getEmailAttribute, "email"),
                samlTextOrDefault(
                        saml, SamlProviderConfigEntity::getFirstNameAttribute, "givenName"),
                samlTextOrDefault(saml, SamlProviderConfigEntity::getLastNameAttribute, "sn"),
                samlTextOrDefault(saml, SamlProviderConfigEntity::getGroupsAttribute, "groups"),
                samlHasText(saml, SamlProviderConfigEntity::getDecryptionPrivateKeyEncrypted),
                samlText(saml, SamlProviderConfigEntity::getDecryptionCertificate),
                samlText(saml, SamlProviderConfigEntity::getSignatureAlgorithm),
                samlTextOrDefault(
                        saml,
                        SamlProviderConfigEntity::getAuthnRequestBinding,
                        SAML_REDIRECT_BINDING),
                samlTextOrDefault(saml, SamlProviderConfigEntity::getResponseBinding, "POST"),
                samlTextOrDefault(
                        saml, SamlProviderConfigEntity::getLogoutBinding, SAML_REDIRECT_BINDING),
                samlFlag(saml, SamlProviderConfigEntity::isForceAuthentication, false),
                samlFlag(saml, SamlProviderConfigEntity::isPassSubject, false));
    }

    private static String samlText(
            SamlProviderConfigEntity saml, Function<SamlProviderConfigEntity, String> accessor) {
        return saml == null ? "" : text(accessor.apply(saml));
    }

    private static String samlTextOrDefault(
            SamlProviderConfigEntity saml,
            Function<SamlProviderConfigEntity, String> accessor,
            String fallback) {
        return saml == null ? fallback : text(accessor.apply(saml));
    }

    private static boolean samlHasText(
            SamlProviderConfigEntity saml, Function<SamlProviderConfigEntity, String> accessor) {
        return saml != null && hasText(accessor.apply(saml));
    }

    private static boolean samlFlag(
            SamlProviderConfigEntity saml,
            Predicate<SamlProviderConfigEntity> accessor,
            boolean fallback) {
        return saml == null ? fallback : accessor.test(saml);
    }

    private static boolean isConfigured(
            SocialProviderEntity provider, SamlProviderConfigEntity saml) {
        if (!"saml".equalsIgnoreCase(provider.getProviderType())) {
            String secret = provider.getClientSecretEncrypted();
            return hasText(provider.getClientId()) && hasText(secret);
        }
        if (saml == null) {
            return false;
        }
        return hasText(saml.getMetadataUri())
                || (hasText(saml.getAssertingPartyEntityId())
                        && hasText(saml.getSingleSignOnServiceUrl())
                        && hasText(saml.getIdpCertificate()));
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

    private static String defaultValue(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private Map<String, SamlProviderConfigEntity> samlConfigs(
            Page<SocialProviderEntity> providers) {
        if (samlConfigRepository == null) {
            return Map.of();
        }
        return samlConfigRepository
                .findAllById(
                        providers.getContent().stream().map(SocialProviderEntity::getId).toList())
                .stream()
                .collect(
                        java.util.stream.Collectors.toMap(
                                SamlProviderConfigEntity::getProviderId, value -> value));
    }

    private SamlProviderConfigEntity samlConfig(String providerId) {
        return samlConfigRepository == null
                ? null
                : samlConfigRepository.findByProviderId(providerId).orElse(null);
    }

    private void refreshSamlRegistrations() {
        if (samlRegistrationRepository == null) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            samlRegistrationRepository.refresh();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        samlRegistrationRepository.refresh();
                    }
                });
    }

    private static String text(String value) {
        return value == null ? "" : value;
    }
}
