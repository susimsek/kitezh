package io.github.susimsek.springauthserversamples.service;

import io.github.susimsek.springauthserversamples.config.security.ReloadableClientRegistrationRepository;
import io.github.susimsek.springauthserversamples.config.security.SocialLoginConfig;
import io.github.susimsek.springauthserversamples.config.security.SocialLoginProperties;
import io.github.susimsek.springauthserversamples.config.security.SocialLoginSecretCipher;
import io.github.susimsek.springauthserversamples.domain.LoginSettingsEntity;
import io.github.susimsek.springauthserversamples.domain.SocialIdentityEntity;
import io.github.susimsek.springauthserversamples.domain.SocialProviderEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminSocialProviderDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminSocialProviderRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminSocialProvidersRequestDTO;
import io.github.susimsek.springauthserversamples.repository.LoginSettingsRepository;
import io.github.susimsek.springauthserversamples.repository.SocialIdentityRepository;
import io.github.susimsek.springauthserversamples.repository.SocialProviderRepository;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.function.Consumer;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@SuppressWarnings("java:S107")
public class SocialProviderSettingsService {

    private static final String GOOGLE = "google";
    private static final String GITHUB = "github";
    private static final String LINKEDIN = "linkedin";
    private static final String MICROSOFT = "microsoft";
    private static final String CLIENT_SECRET_BASIC = "client_secret_basic";
    private static final String DEFAULT_SCOPES = "openid,profile,email";
    private static final String ALWAYS = "always";

    private static final long SETTINGS_ID = 1L;
    private static final Set<String> SUPPORTED_PROVIDERS =
            Set.of(GOOGLE, GITHUB, LINKEDIN, MICROSOFT);

    private final LoginSettingsRepository repository;
    private final SocialIdentityRepository socialIdentityRepository;
    private final SocialProviderRepository socialProviderRepository;
    private final SocialLoginProperties properties;
    private final SocialLoginSecretCipher secretCipher;
    private final ObjectProvider<ReloadableClientRegistrationRepository>
            clientRegistrationRepository;
    private final AdminAuditEventService auditEventService;

    @Transactional(readOnly = true)
    public List<AdminSocialProviderDTO> adminSettings() {
        return adminSettingsInternal();
    }

    private List<AdminSocialProviderDTO> adminSettingsInternal() {
        LoginSettingsEntity settings = settings();
        return effectiveProviders(settings).sorted().map(this::toAdminDTO).toList();
    }

    @Transactional(readOnly = true)
    public List<ProviderCredentials> configuredProviders() {
        return configuredProvidersInternal();
    }

    public ProviderCredentials provider(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return effectiveProviders(settings())
                .filter(
                        provider ->
                                provider.registrationId().equalsIgnoreCase(value)
                                        || provider.alias().equalsIgnoreCase(value))
                .findFirst()
                .orElse(null);
    }

    /** Returns the provider-level user synchronization mode for an id or alias. */
    @Transactional(readOnly = true)
    public String syncMode(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return socialProviderRepository
                .findByRegistrationId(value)
                .or(() -> socialProviderRepository.findByAliasIgnoreCase(value))
                .map(entity -> SocialProviderSyncMode.from(entity.getSyncMode()).value())
                .orElse(null);
    }

    public boolean isEnabled() {
        return properties.enabled();
    }

    public void refreshClientRegistrations() {
        ReloadableClientRegistrationRepository clientRegistration =
                clientRegistrationRepository.getIfAvailable();
        if (clientRegistration != null) {
            clientRegistration.replace(
                    SocialLoginConfig.registrations(configuredProvidersInternal()));
        }
    }

    @Transactional
    @CacheEvict(cacheNames = LoginSettingsRepository.LOGIN_SETTINGS_BY_ID_CACHE, allEntries = true)
    public List<AdminSocialProviderDTO> update(AdminSocialProvidersRequestDTO request) {
        LoginSettingsEntity settings = settings();
        Set<String> seen = new java.util.HashSet<>();
        for (AdminSocialProviderRequestDTO provider : request.providers()) {
            String registrationId = normalizeProvider(provider.provider());
            String alias = provider.alias().trim().toLowerCase(Locale.ROOT);
            boolean aliasUsedByAnotherProvider =
                    effectiveProviders(settings)
                            .anyMatch(
                                    current ->
                                            !current.registrationId().equals(registrationId)
                                                    && current.alias().equals(alias));
            boolean duplicate = !seen.add(registrationId);
            if (!duplicate && !alias.equals(registrationId)) {
                duplicate = !seen.add(alias);
            }
            if (!SUPPORTED_PROVIDERS.contains(registrationId)
                    || duplicate
                    || aliasUsedByAnotherProvider) {
                throw ApiException.badRequest(
                        "provider", ApiErrorCode.INVALID_REQUEST, "The social provider is invalid");
            }
            if (provider.storedTokensReadable() && !provider.storeTokens()) {
                throw ApiException.badRequest(
                        "storedTokensReadable",
                        ApiErrorCode.INVALID_REQUEST,
                        "Stored tokens must be enabled before they can be readable");
            }
            apply(
                    registrationId,
                    settings,
                    alias,
                    provider.clientId().trim(),
                    provider.clientSecret(),
                    provider.hideOnLogin(),
                    provider.accountLinkingOnly(),
                    provider.trustEmail(),
                    provider.mfaRequired(),
                    provider.requiredClaims(),
                    provider.storeTokens(),
                    provider.storedTokensReadable(),
                    provider.guiOrder(),
                    provider.showInAccountConsole());
            if (!provider.storeTokens()) {
                clearStoredTokens(registrationId);
            }
        }
        repository.save(settings);
        refreshClientRegistrations();
        auditEventService.record("social.providers.updated", "social-providers", "default");
        return adminSettingsInternal();
    }

    public List<ProviderCredentials> effectiveProviders() {
        return effectiveProviders(settings()).toList();
    }

    private java.util.stream.Stream<ProviderCredentials> effectiveProviders(
            LoginSettingsEntity settings) {
        Set<String> builtIns = Set.of(GOOGLE, GITHUB, LINKEDIN, MICROSOFT);
        java.util.stream.Stream<ProviderCredentials> seeded =
                Arrays.stream(new String[] {GOOGLE, GITHUB, LINKEDIN, MICROSOFT})
                        .map(provider -> merge(credentials(provider, settings), provider));
        java.util.stream.Stream<ProviderCredentials> custom =
                socialProviderRepository.findAll().stream()
                        .filter(entity -> !builtIns.contains(entity.getRegistrationId()))
                        .map(this::credentials);
        return java.util.stream.Stream.concat(seeded, custom);
    }

    private List<ProviderCredentials> configuredProvidersInternal() {
        return effectiveProviders(settings()).filter(ProviderCredentials::configured).toList();
    }

    private ProviderCredentials merge(ProviderCredentials legacy, String registrationId) {
        return socialProviderRepository
                .findByRegistrationId(registrationId)
                .map(entity -> credentials(entity, legacy))
                .orElse(legacy);
    }

    private ProviderCredentials credentials(SocialProviderEntity entity) {
        String secret = entity.getClientSecretEncrypted();
        return new ProviderCredentials(
                entity.getRegistrationId(),
                entity.getAlias(),
                entity.getDisplayName(),
                entity.getProviderType(),
                entity.getClientId(),
                secret == null || secret.isBlank() ? "" : secretCipher.decrypt(secret),
                entity.isEnabled(),
                entity.isHideOnLogin(),
                entity.isAccountLinkingOnly(),
                entity.isTrustEmail(),
                entity.isMfaRequired(),
                entity.getRequiredClaims(),
                entity.isStoreTokens(),
                entity.isStoredTokensReadable(),
                entity.getGuiOrder(),
                entity.getShowInAccountConsole(),
                entity.getAuthorizationUri(),
                entity.getTokenUri(),
                entity.getUserInfoUri(),
                entity.getJwkSetUri(),
                entity.getIssuerUri(),
                entity.getClientAuthenticationMethod(),
                entity.getScopes(),
                entity.getUserNameAttribute(),
                SocialProviderIconKeys.normalize(entity.getIconKey(), entity.getProviderType()),
                entity.isShortStateParameter(),
                entity.isCaseSensitiveUsername());
    }

    private ProviderCredentials credentials(
            SocialProviderEntity entity, ProviderCredentials legacy) {
        ProviderCredentials dynamic = credentials(entity);
        return dynamic.clientId() == null || dynamic.clientId().isBlank()
                ? new ProviderCredentials(
                        dynamic.registrationId(),
                        dynamic.alias(),
                        dynamic.displayName(),
                        dynamic.providerType(),
                        legacy.clientId(),
                        legacy.clientSecret(),
                        dynamic.enabled(),
                        dynamic.hideOnLogin(),
                        dynamic.accountLinkingOnly(),
                        dynamic.trustEmail(),
                        dynamic.mfaRequired(),
                        dynamic.requiredClaims(),
                        dynamic.storeTokens(),
                        dynamic.storedTokensReadable(),
                        dynamic.guiOrder(),
                        dynamic.showInAccountConsole(),
                        dynamic.authorizationUri(),
                        dynamic.tokenUri(),
                        dynamic.userInfoUri(),
                        dynamic.jwkSetUri(),
                        dynamic.issuerUri(),
                        dynamic.clientAuthenticationMethod(),
                        dynamic.scopes(),
                        dynamic.userNameAttribute(),
                        dynamic.iconKey(),
                        dynamic.shortStateParameter(),
                        dynamic.caseSensitiveUsername())
                : dynamic;
    }

    private ProviderCredentials credentials(String provider, LoginSettingsEntity settings) {
        SocialLoginProperties.Provider configured = configuredProperties(provider);
        String clientId = firstNonBlank(storedClientId(provider, settings), configured.clientId());
        String clientSecret = storedSecret(provider, settings);
        if (clientSecret.isBlank()) {
            clientSecret = configured.clientSecret();
        }
        return new ProviderCredentials(
                provider,
                firstNonBlank(storedAlias(provider, settings), provider),
                capitalize(provider),
                provider,
                clientId,
                clientSecret,
                enabled(provider, settings),
                hideOnLogin(provider, settings),
                accountLinkingOnly(provider, settings),
                trustEmail(provider, settings),
                mfaRequired(provider, settings),
                requiredClaims(provider, settings),
                storeTokens(provider, settings),
                storedTokensReadable(provider, settings),
                guiOrder(provider, settings),
                showInAccountConsole(provider, settings),
                null,
                null,
                null,
                null,
                null,
                CLIENT_SECRET_BASIC,
                DEFAULT_SCOPES,
                "sub");
    }

    private AdminSocialProviderDTO toAdminDTO(ProviderCredentials credentials) {
        return new AdminSocialProviderDTO(
                credentials.registrationId(),
                credentials.alias(),
                credentials.hideOnLogin(),
                credentials.accountLinkingOnly(),
                credentials.trustEmail(),
                credentials.mfaRequired(),
                credentials.requiredClaims(),
                credentials.storeTokens(),
                credentials.storedTokensReadable(),
                credentials.guiOrder(),
                credentials.showInAccountConsole(),
                credentials.clientId(),
                credentials.configured());
    }

    private void apply(
            String provider,
            LoginSettingsEntity settings,
            String alias,
            String clientId,
            String clientSecret,
            boolean hideOnLogin,
            boolean accountLinkingOnly,
            boolean trustEmail,
            boolean mfaRequired,
            String requiredClaims,
            boolean storeTokens,
            boolean storedTokensReadable,
            int guiOrder,
            String showInAccountConsole) {
        if (clientSecret != null && !clientSecret.isBlank()) {
            try {
                setSecret(provider, settings, secretCipher.encrypt(clientSecret.trim()));
            } catch (IllegalStateException exception) {
                throw ApiException.badRequest(
                        "clientSecret", ApiErrorCode.INVALID_REQUEST, exception.getMessage());
            }
        }
        setAlias(provider, settings, alias);
        setHideOnLogin(provider, settings, hideOnLogin);
        setAccountLinkingOnly(provider, settings, accountLinkingOnly);
        setTrustEmail(provider, settings, trustEmail);
        setMfaRequired(provider, settings, mfaRequired);
        setRequiredClaims(provider, settings, requiredClaims);
        setStoreTokens(provider, settings, storeTokens);
        setStoredTokensReadable(provider, settings, storedTokensReadable);
        setGuiOrder(provider, settings, guiOrder);
        setShowInAccountConsole(
                provider, settings, normalizeAccountConsoleVisibility(showInAccountConsole));
        setClientId(provider, settings, clientId);
    }

    private boolean enabled(String provider, LoginSettingsEntity settings) {
        return switch (provider) {
            case GOOGLE -> settings.isGoogleLoginEnabled();
            case GITHUB -> settings.isGithubLoginEnabled();
            case LINKEDIN -> settings.isLinkedinLoginEnabled();
            case MICROSOFT -> settings.isMicrosoftLoginEnabled();
            default -> false;
        };
    }

    private String storedAlias(String provider, LoginSettingsEntity settings) {
        return switch (provider) {
            case GOOGLE -> settings.getGoogleAlias();
            case GITHUB -> settings.getGithubAlias();
            case LINKEDIN -> settings.getLinkedinAlias();
            case MICROSOFT -> settings.getMicrosoftAlias();
            default -> "";
        };
    }

    private boolean hideOnLogin(String provider, LoginSettingsEntity settings) {
        return switch (provider) {
            case GOOGLE -> settings.isGoogleHideOnLogin();
            case GITHUB -> settings.isGithubHideOnLogin();
            case LINKEDIN -> settings.isLinkedinHideOnLogin();
            case MICROSOFT -> settings.isMicrosoftHideOnLogin();
            default -> false;
        };
    }

    private boolean accountLinkingOnly(String provider, LoginSettingsEntity settings) {
        return switch (provider) {
            case GOOGLE -> settings.isGoogleAccountLinkingOnly();
            case GITHUB -> settings.isGithubAccountLinkingOnly();
            case LINKEDIN -> settings.isLinkedinAccountLinkingOnly();
            case MICROSOFT -> settings.isMicrosoftAccountLinkingOnly();
            default -> false;
        };
    }

    private boolean trustEmail(String provider, LoginSettingsEntity settings) {
        return switch (provider) {
            case GOOGLE -> settings.isGoogleTrustEmail();
            case GITHUB -> settings.isGithubTrustEmail();
            case LINKEDIN -> settings.isLinkedinTrustEmail();
            case MICROSOFT -> settings.isMicrosoftTrustEmail();
            default -> false;
        };
    }

    private boolean mfaRequired(String provider, LoginSettingsEntity settings) {
        return switch (provider) {
            case GOOGLE -> settings.isGoogleMfaRequired();
            case GITHUB -> settings.isGithubMfaRequired();
            case LINKEDIN -> settings.isLinkedinMfaRequired();
            case MICROSOFT -> settings.isMicrosoftMfaRequired();
            default -> false;
        };
    }

    private String requiredClaims(String provider, LoginSettingsEntity settings) {
        return switch (provider) {
            case GOOGLE -> settings.getGoogleRequiredClaims();
            case GITHUB -> settings.getGithubRequiredClaims();
            case LINKEDIN -> settings.getLinkedinRequiredClaims();
            case MICROSOFT -> settings.getMicrosoftRequiredClaims();
            default -> "sub";
        };
    }

    private boolean storeTokens(String provider, LoginSettingsEntity settings) {
        return switch (provider) {
            case GOOGLE -> settings.isGoogleStoreTokens();
            case GITHUB -> settings.isGithubStoreTokens();
            case LINKEDIN -> settings.isLinkedinStoreTokens();
            case MICROSOFT -> settings.isMicrosoftStoreTokens();
            default -> false;
        };
    }

    private boolean storedTokensReadable(String provider, LoginSettingsEntity settings) {
        return switch (provider) {
            case GOOGLE -> settings.isGoogleStoredTokensReadable();
            case GITHUB -> settings.isGithubStoredTokensReadable();
            case LINKEDIN -> settings.isLinkedinStoredTokensReadable();
            case MICROSOFT -> settings.isMicrosoftStoredTokensReadable();
            default -> false;
        };
    }

    private int guiOrder(String provider, LoginSettingsEntity settings) {
        return switch (provider) {
            case GOOGLE -> settings.getGoogleGuiOrder();
            case GITHUB -> settings.getGithubGuiOrder();
            case LINKEDIN -> settings.getLinkedinGuiOrder();
            case MICROSOFT -> settings.getMicrosoftGuiOrder();
            default -> 0;
        };
    }

    private String showInAccountConsole(String provider, LoginSettingsEntity settings) {
        return switch (provider) {
            case GOOGLE -> settings.getGoogleShowInAccountConsole();
            case GITHUB -> settings.getGithubShowInAccountConsole();
            case LINKEDIN -> settings.getLinkedinShowInAccountConsole();
            case MICROSOFT -> settings.getMicrosoftShowInAccountConsole();
            default -> ALWAYS;
        };
    }

    private SocialLoginProperties.Provider configuredProperties(String provider) {
        return switch (provider) {
            case GOOGLE -> properties.google();
            case GITHUB -> properties.github();
            case LINKEDIN -> properties.linkedin();
            case MICROSOFT -> properties.microsoft();
            default -> throw new IllegalArgumentException("Unsupported social provider");
        };
    }

    private String storedClientId(String provider, LoginSettingsEntity settings) {
        return switch (provider) {
            case GOOGLE -> settings.getGoogleClientId();
            case GITHUB -> settings.getGithubClientId();
            case LINKEDIN -> settings.getLinkedinClientId();
            case MICROSOFT -> settings.getMicrosoftClientId();
            default -> "";
        };
    }

    private String storedSecret(String provider, LoginSettingsEntity settings) {
        String encrypted =
                switch (provider) {
                    case GOOGLE -> settings.getGoogleClientSecretEncrypted();
                    case GITHUB -> settings.getGithubClientSecretEncrypted();
                    case LINKEDIN -> settings.getLinkedinClientSecretEncrypted();
                    case MICROSOFT -> settings.getMicrosoftClientSecretEncrypted();
                    default -> "";
                };
        return encrypted == null || encrypted.isBlank() ? "" : secretCipher.decrypt(encrypted);
    }

    private void setClientId(String provider, LoginSettingsEntity settings, String value) {
        consumer(
                        provider,
                        settings::setGoogleClientId,
                        settings::setGithubClientId,
                        settings::setLinkedinClientId,
                        settings::setMicrosoftClientId)
                .accept(value);
    }

    private void setAlias(String provider, LoginSettingsEntity settings, String value) {
        switch (provider) {
            case GOOGLE -> settings.setGoogleAlias(value);
            case GITHUB -> settings.setGithubAlias(value);
            case LINKEDIN -> settings.setLinkedinAlias(value);
            case MICROSOFT -> settings.setMicrosoftAlias(value);
            default -> { // Unknown providers are intentionally ignored.
            }
        }
    }

    private void setHideOnLogin(String provider, LoginSettingsEntity settings, boolean value) {
        switch (provider) {
            case GOOGLE -> settings.setGoogleHideOnLogin(value);
            case GITHUB -> settings.setGithubHideOnLogin(value);
            case LINKEDIN -> settings.setLinkedinHideOnLogin(value);
            case MICROSOFT -> settings.setMicrosoftHideOnLogin(value);
            default -> { // Unknown providers are intentionally ignored.
            }
        }
    }

    private void setAccountLinkingOnly(
            String provider, LoginSettingsEntity settings, boolean value) {
        switch (provider) {
            case GOOGLE -> settings.setGoogleAccountLinkingOnly(value);
            case GITHUB -> settings.setGithubAccountLinkingOnly(value);
            case LINKEDIN -> settings.setLinkedinAccountLinkingOnly(value);
            case MICROSOFT -> settings.setMicrosoftAccountLinkingOnly(value);
            default -> { // Unknown providers are intentionally ignored.
            }
        }
    }

    private void setTrustEmail(String provider, LoginSettingsEntity settings, boolean value) {
        switch (provider) {
            case GOOGLE -> settings.setGoogleTrustEmail(value);
            case GITHUB -> settings.setGithubTrustEmail(value);
            case LINKEDIN -> settings.setLinkedinTrustEmail(value);
            case MICROSOFT -> settings.setMicrosoftTrustEmail(value);
            default -> { // Unknown providers are intentionally ignored.
            }
        }
    }

    private void setMfaRequired(String provider, LoginSettingsEntity settings, boolean value) {
        switch (provider) {
            case GOOGLE -> settings.setGoogleMfaRequired(value);
            case GITHUB -> settings.setGithubMfaRequired(value);
            case LINKEDIN -> settings.setLinkedinMfaRequired(value);
            case MICROSOFT -> settings.setMicrosoftMfaRequired(value);
            default -> { // Unknown providers are intentionally ignored.
            }
        }
    }

    private void setRequiredClaims(String provider, LoginSettingsEntity settings, String value) {
        String normalized = normalizeRequiredClaims(value);
        switch (provider) {
            case GOOGLE -> settings.setGoogleRequiredClaims(normalized);
            case GITHUB -> settings.setGithubRequiredClaims(normalized);
            case LINKEDIN -> settings.setLinkedinRequiredClaims(normalized);
            case MICROSOFT -> settings.setMicrosoftRequiredClaims(normalized);
            default -> { // Unknown providers are intentionally ignored.
            }
        }
    }

    private void setStoreTokens(String provider, LoginSettingsEntity settings, boolean value) {
        switch (provider) {
            case GOOGLE -> settings.setGoogleStoreTokens(value);
            case GITHUB -> settings.setGithubStoreTokens(value);
            case LINKEDIN -> settings.setLinkedinStoreTokens(value);
            case MICROSOFT -> settings.setMicrosoftStoreTokens(value);
            default -> { // Unknown providers are intentionally ignored.
            }
        }
    }

    private void setStoredTokensReadable(
            String provider, LoginSettingsEntity settings, boolean value) {
        switch (provider) {
            case GOOGLE -> settings.setGoogleStoredTokensReadable(value);
            case GITHUB -> settings.setGithubStoredTokensReadable(value);
            case LINKEDIN -> settings.setLinkedinStoredTokensReadable(value);
            case MICROSOFT -> settings.setMicrosoftStoredTokensReadable(value);
            default -> { // Unknown providers are intentionally ignored.
            }
        }
    }

    private void setGuiOrder(String provider, LoginSettingsEntity settings, int value) {
        switch (provider) {
            case GOOGLE -> settings.setGoogleGuiOrder(value);
            case GITHUB -> settings.setGithubGuiOrder(value);
            case LINKEDIN -> settings.setLinkedinGuiOrder(value);
            case MICROSOFT -> settings.setMicrosoftGuiOrder(value);
            default -> { // Unknown providers are intentionally ignored.
            }
        }
    }

    private void setShowInAccountConsole(
            String provider, LoginSettingsEntity settings, String value) {
        switch (provider) {
            case GOOGLE -> settings.setGoogleShowInAccountConsole(value);
            case GITHUB -> settings.setGithubShowInAccountConsole(value);
            case LINKEDIN -> settings.setLinkedinShowInAccountConsole(value);
            case MICROSOFT -> settings.setMicrosoftShowInAccountConsole(value);
            default -> { // Unknown providers are intentionally ignored.
            }
        }
    }

    private void setSecret(String provider, LoginSettingsEntity settings, String value) {
        consumer(
                        provider,
                        settings::setGoogleClientSecretEncrypted,
                        settings::setGithubClientSecretEncrypted,
                        settings::setLinkedinClientSecretEncrypted,
                        settings::setMicrosoftClientSecretEncrypted)
                .accept(value);
    }

    private static Consumer<String> consumer(
            String provider,
            Consumer<String> google,
            Consumer<String> github,
            Consumer<String> linkedin,
            Consumer<String> microsoft) {
        return switch (provider) {
            case GOOGLE -> google;
            case GITHUB -> github;
            case LINKEDIN -> linkedin;
            case MICROSOFT -> microsoft;
            default -> value -> {};
        };
    }

    private static String normalizeProvider(String provider) {
        return provider == null ? "" : provider.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeAccountConsoleVisibility(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (!Set.of(ALWAYS, "when-linked", "never").contains(normalized)) {
            throw ApiException.badRequest(
                    "showInAccountConsole",
                    ApiErrorCode.INVALID_REQUEST,
                    "The Account Console visibility is invalid");
        }
        return normalized;
    }

    private static String normalizeRequiredClaims(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isBlank()) {
            return "sub";
        }
        String result =
                Arrays.stream(normalized.split(","))
                        .map(String::trim)
                        .filter(claim -> !claim.isBlank())
                        .distinct()
                        .map(
                                claim -> {
                                    if (!claim.matches("[A-Za-z0-9_.-]+")) {
                                        throw ApiException.badRequest(
                                                "requiredClaims",
                                                ApiErrorCode.INVALID_REQUEST,
                                                "Provider claim names are invalid");
                                    }
                                    return claim;
                                })
                        .reduce((left, right) -> left + "," + right)
                        .orElse("sub");
        if (result.length() > 500) {
            throw ApiException.badRequest(
                    "requiredClaims",
                    ApiErrorCode.INVALID_REQUEST,
                    "Provider required claims are too long");
        }
        return result;
    }

    private static String capitalize(String value) {
        return Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }

    private static String firstNonBlank(String first, String fallback) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return fallback == null ? "" : fallback;
    }

    private LoginSettingsEntity settings() {
        return repository
                .findById(SETTINGS_ID)
                .orElseThrow(() -> new IllegalStateException("Login settings are not configured"));
    }

    private void clearStoredTokens(String provider) {
        List<SocialIdentityEntity> identities =
                socialIdentityRepository.findAllByProvider(provider);
        identities.forEach(
                identity -> {
                    identity.setAccessTokenEncrypted(null);
                    identity.setRefreshTokenEncrypted(null);
                    identity.setAccessTokenExpiresAt(null);
                    identity.setTokenType(null);
                    identity.setTokenScopes(null);
                });
        if (!identities.isEmpty()) {
            socialIdentityRepository.saveAll(identities);
        }
    }

    public record ProviderCredentials(
            String registrationId,
            String alias,
            String displayName,
            String providerType,
            String clientId,
            String clientSecret,
            boolean enabled,
            boolean hideOnLogin,
            boolean accountLinkingOnly,
            boolean trustEmail,
            boolean mfaRequired,
            String requiredClaims,
            boolean storeTokens,
            boolean storedTokensReadable,
            int guiOrder,
            String showInAccountConsole,
            String authorizationUri,
            String tokenUri,
            String userInfoUri,
            String jwkSetUri,
            String issuerUri,
            String clientAuthenticationMethod,
            String scopes,
            String userNameAttribute,
            String iconKey,
            boolean shortStateParameter,
            boolean caseSensitiveUsername)
            implements Comparable<ProviderCredentials> {
        public ProviderCredentials(
                String registrationId,
                String alias,
                String displayName,
                String providerType,
                String clientId,
                String clientSecret,
                boolean enabled,
                boolean hideOnLogin,
                boolean accountLinkingOnly,
                boolean trustEmail,
                boolean mfaRequired,
                String requiredClaims,
                boolean storeTokens,
                boolean storedTokensReadable,
                int guiOrder,
                String showInAccountConsole,
                String authorizationUri,
                String tokenUri,
                String userInfoUri,
                String jwkSetUri,
                String issuerUri,
                String clientAuthenticationMethod,
                String scopes,
                String userNameAttribute,
                String iconKey) {
            this(
                    registrationId,
                    alias,
                    displayName,
                    providerType,
                    clientId,
                    clientSecret,
                    enabled,
                    hideOnLogin,
                    accountLinkingOnly,
                    trustEmail,
                    mfaRequired,
                    requiredClaims,
                    storeTokens,
                    storedTokensReadable,
                    guiOrder,
                    showInAccountConsole,
                    authorizationUri,
                    tokenUri,
                    userInfoUri,
                    jwkSetUri,
                    issuerUri,
                    clientAuthenticationMethod,
                    scopes,
                    userNameAttribute,
                    iconKey,
                    false,
                    false);
        }

        public ProviderCredentials(
                String registrationId,
                String alias,
                String displayName,
                String providerType,
                String clientId,
                String clientSecret,
                boolean enabled,
                boolean hideOnLogin,
                boolean accountLinkingOnly,
                boolean trustEmail,
                boolean mfaRequired,
                String requiredClaims,
                boolean storeTokens,
                boolean storedTokensReadable,
                int guiOrder,
                String showInAccountConsole,
                String authorizationUri,
                String tokenUri,
                String userInfoUri,
                String jwkSetUri,
                String issuerUri,
                String clientAuthenticationMethod,
                String scopes,
                String userNameAttribute) {
            this(
                    registrationId,
                    alias,
                    displayName,
                    providerType,
                    clientId,
                    clientSecret,
                    enabled,
                    hideOnLogin,
                    accountLinkingOnly,
                    trustEmail,
                    mfaRequired,
                    requiredClaims,
                    storeTokens,
                    storedTokensReadable,
                    guiOrder,
                    showInAccountConsole,
                    authorizationUri,
                    tokenUri,
                    userInfoUri,
                    jwkSetUri,
                    issuerUri,
                    clientAuthenticationMethod,
                    scopes,
                    userNameAttribute,
                    SocialProviderIconKeys.normalize(alias, providerType),
                    false,
                    false);
        }

        public ProviderCredentials(String registrationId, String clientId, String clientSecret) {
            this(
                    registrationId,
                    registrationId,
                    capitalize(registrationId),
                    registrationId,
                    clientId,
                    clientSecret,
                    true,
                    false,
                    false,
                    false,
                    false,
                    "sub",
                    false,
                    false,
                    0,
                    ALWAYS,
                    null,
                    null,
                    null,
                    null,
                    null,
                    CLIENT_SECRET_BASIC,
                    DEFAULT_SCOPES,
                    "sub");
        }

        public ProviderCredentials(
                String registrationId,
                String alias,
                String clientId,
                String clientSecret,
                boolean enabled,
                boolean hideOnLogin,
                boolean accountLinkingOnly,
                int guiOrder,
                String showInAccountConsole) {
            this(
                    registrationId,
                    alias,
                    capitalize(registrationId),
                    registrationId,
                    clientId,
                    clientSecret,
                    enabled,
                    hideOnLogin,
                    accountLinkingOnly,
                    false,
                    false,
                    "sub",
                    false,
                    false,
                    guiOrder,
                    showInAccountConsole,
                    null,
                    null,
                    null,
                    null,
                    null,
                    CLIENT_SECRET_BASIC,
                    DEFAULT_SCOPES,
                    "sub");
        }

        public ProviderCredentials(
                String registrationId,
                String alias,
                String clientId,
                String clientSecret,
                boolean enabled,
                boolean hideOnLogin,
                boolean accountLinkingOnly,
                boolean storeTokens,
                boolean storedTokensReadable,
                int guiOrder,
                String showInAccountConsole) {
            this(
                    registrationId,
                    alias,
                    capitalize(registrationId),
                    registrationId,
                    clientId,
                    clientSecret,
                    enabled,
                    hideOnLogin,
                    accountLinkingOnly,
                    false,
                    false,
                    "sub",
                    storeTokens,
                    storedTokensReadable,
                    guiOrder,
                    showInAccountConsole,
                    null,
                    null,
                    null,
                    null,
                    null,
                    CLIENT_SECRET_BASIC,
                    DEFAULT_SCOPES,
                    "sub");
        }

        public ProviderCredentials(
                String registrationId,
                String alias,
                String clientId,
                String clientSecret,
                boolean enabled,
                boolean hideOnLogin,
                boolean accountLinkingOnly,
                boolean trustEmail,
                boolean mfaRequired,
                String requiredClaims,
                int guiOrder,
                String showInAccountConsole,
                boolean storeTokens,
                boolean storedTokensReadable) {
            this(
                    registrationId,
                    alias,
                    capitalize(registrationId),
                    registrationId,
                    clientId,
                    clientSecret,
                    enabled,
                    hideOnLogin,
                    accountLinkingOnly,
                    trustEmail,
                    mfaRequired,
                    requiredClaims,
                    storeTokens,
                    storedTokensReadable,
                    guiOrder,
                    showInAccountConsole,
                    null,
                    null,
                    null,
                    null,
                    null,
                    CLIENT_SECRET_BASIC,
                    DEFAULT_SCOPES,
                    "sub");
        }

        public ProviderCredentials(
                String registrationId,
                String alias,
                String clientId,
                String clientSecret,
                boolean enabled,
                boolean hideOnLogin,
                boolean accountLinkingOnly,
                boolean trustEmail,
                boolean mfaRequired,
                String requiredClaims,
                boolean storeTokens,
                boolean storedTokensReadable,
                int guiOrder,
                String showInAccountConsole) {
            this(
                    registrationId,
                    alias,
                    capitalize(registrationId),
                    registrationId,
                    clientId,
                    clientSecret,
                    enabled,
                    hideOnLogin,
                    accountLinkingOnly,
                    trustEmail,
                    mfaRequired,
                    requiredClaims,
                    storeTokens,
                    storedTokensReadable,
                    guiOrder,
                    showInAccountConsole,
                    null,
                    null,
                    null,
                    null,
                    null,
                    CLIENT_SECRET_BASIC,
                    DEFAULT_SCOPES,
                    "sub");
        }

        public boolean configured() {
            return clientId != null
                    && !clientId.isBlank()
                    && clientSecret != null
                    && !clientSecret.isBlank();
        }

        @Override
        public int compareTo(ProviderCredentials other) {
            int order = Integer.compare(guiOrder, other.guiOrder);
            return order != 0 ? order : registrationId.compareTo(other.registrationId);
        }

        private static String capitalize(String value) {
            return value == null || value.isBlank()
                    ? "Provider"
                    : Character.toUpperCase(value.charAt(0)) + value.substring(1);
        }
    }
}
