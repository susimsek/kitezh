package io.github.susimsek.kitezh.service;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.SocialIdentityEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.account.SocialLinkDTO;
import io.github.susimsek.kitezh.dto.account.SocialProviderDTO;
import io.github.susimsek.kitezh.repository.AuthorityRepository;
import io.github.susimsek.kitezh.repository.SocialIdentityRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.AuthoritiesConstants;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.UserAccessInvalidationService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class SocialLoginService {

    private static final String LINKEDIN = "linkedin";

    private static final Set<String> SUPPORTED_PROVIDERS =
            Set.of("google", "github", LINKEDIN, "microsoft");

    public static final String PENDING_SOCIAL_LINK = "socialLogin.pendingLink";
    public static final String PENDING_SOCIAL_LINK_TARGET = "socialLogin.pendingLinkTarget";
    public static final String SOCIAL_LOGIN_PROVIDER = "socialLogin.provider";

    private final UserRepository userRepository;
    private final SocialIdentityRepository socialIdentityRepository;
    private final AuthorityRepository authorityRepository;
    private final PasswordEncoder passwordEncoder;
    private final LoginSettingsService loginSettingsService;
    private final SocialProviderSettingsService socialProviderSettingsService;
    private final SocialIdentityMapperService socialIdentityMapperService;
    private final ObjectMapper objectMapper;
    private final UserAccessInvalidationService userAccessInvalidationService;
    private final AdminAuditEventService auditEventService;

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public String findOrCreate(OAuth2AuthenticationToken authentication) {
        String provider = canonicalProvider(authentication.getAuthorizedClientRegistrationId());
        if (provider == null) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("social_provider_invalid"),
                    "The social login provider is invalid");
        }
        ensureProviderLoginAllowed(provider);
        Map<String, Object> attributes = authentication.getPrincipal().getAttributes();
        SocialProviderSettingsService.ProviderCredentials providerSettings =
                socialProviderSettingsService.provider(provider);
        ensureRequiredClaims(attributes, providerSettings);
        String subject = requiredAttribute(attributes, "sub", "id");
        SocialIdentityEntity existing =
                socialIdentityRepository.findByProviderAndSubject(provider, subject).orElse(null);
        if (existing != null) {
            String syncMode = socialProviderSettingsService.syncMode(provider);
            if (shouldSyncExistingUser(syncMode)) {
                syncProfile(existing.getUser(), attributes);
            } else if (syncMode == null) {
                // Keep compatibility for providers without a persisted catalog entry.
                syncPicture(existing.getUser(), socialPicture(attributes));
            }
            persistMappedClaims(
                    existing, applyMappers(provider, attributes, existing.getUser(), false));
            return existing.getUser().getUsername();
        }

        String email = normalizeEmail(attribute(attributes, "email"));
        if (email != null && userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new SocialAccountLinkRequiredException(provider, subject, email, attributes);
        }

        AuthorityEntity userAuthority =
                authorityRepository
                        .findByName(AuthoritiesConstants.USER)
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "The default user authority is not configured"));
        UserEntity user = new UserEntity();
        user.setUsername(username(provider, subject));
        user.setPassword(passwordEncoder.encode(java.util.UUID.randomUUID().toString()));
        user.setFirstName(firstName(attributes));
        user.setLastName(lastName(attributes));
        user.setEmail(email);
        user.setEmailVerified(
                email != null
                        && ((providerSettings != null && providerSettings.trustEmail())
                                || emailVerified(attributes)));
        user.setPictureUrl(socialPicture(attributes));
        user.setEnabled(true);
        user.setPasswordChangedAt(Instant.now());
        user.setMustChangePassword(false);
        user.setTemporaryPassword(false);
        user.setAuthorities(java.util.Set.of(userAuthority));
        UserEntity saved = userRepository.save(user);
        SocialIdentityEntity identity = new SocialIdentityEntity(provider, subject, saved);
        persistMappedClaims(identity, applyMappers(provider, attributes, saved, true));
        socialIdentityRepository.save(identity);
        return saved.getUsername();
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public String linkExisting(
            String username, String expectedProvider, OAuth2AuthenticationToken authentication) {
        String provider = canonicalProvider(provider(authentication));
        String expected = canonicalProvider(expectedProvider);
        ensureProviderEnabled(provider);
        if (expected == null || !expected.equals(provider)) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("social_provider_mismatch"),
                    "The social provider did not match the pending account link");
        }
        String subject = subject(authentication.getPrincipal().getAttributes());
        ensureRequiredClaims(
                authentication.getPrincipal().getAttributes(),
                socialProviderSettingsService.provider(provider));
        UserEntity user = link(username, provider, subject);
        syncPicture(user, socialPicture(authentication.getPrincipal().getAttributes()));
        SocialIdentityEntity identity =
                socialIdentityRepository
                        .findByProviderAndSubject(provider, subject)
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "The social identity link was not persisted"));
        persistMappedClaims(
                identity,
                applyMappers(provider, authentication.getPrincipal().getAttributes(), user, true));
        socialIdentityRepository.save(identity);
        return username;
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void linkPending(String username, Map<?, ?> pendingLink) {
        String provider = pendingValue(pendingLink, "provider");
        String subject = pendingValue(pendingLink, "subject");
        if (provider == null || subject == null) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("invalid_pending_account_link"),
                    "The pending social account link is invalid");
        }
        ensureProviderEnabled(provider);
        UserEntity user = link(username, provider, subject);
        Map<String, Object> attributes = pendingAttributes(pendingLink);
        if (!attributes.isEmpty()) {
            SocialIdentityEntity identity =
                    socialIdentityRepository
                            .findByProviderAndSubject(provider, subject)
                            .orElseThrow(
                                    () ->
                                            new IllegalStateException(
                                                    "The social identity link was not persisted"));
            persistMappedClaims(identity, applyMappers(provider, attributes, user, true));
            socialIdentityRepository.save(identity);
        }
    }

    public Set<String> linkedProviders(String username) {
        return socialIdentityRepository.findAllByUserUsername(username).stream()
                .map(SocialIdentityEntity::getProvider)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void unlink(String username, String provider) {
        SocialProviderSettingsService.ProviderCredentials configuredProvider =
                socialProviderSettingsService.provider(provider);
        String normalizedProvider =
                configuredProvider == null
                        ? normalizeProvider(provider)
                        : providerKey(configuredProvider);
        List<SocialIdentityEntity> identities =
                socialIdentityRepository.findAllByUserUsernameAndProvider(
                        username, normalizedProvider);
        if (identities.isEmpty()) {
            throw ApiException.notFound("Social account link not found");
        }
        socialIdentityRepository.deleteAll(identities);
        userAccessInvalidationService.invalidate(username);
        auditEventService.record(
                "account.social_link.deleted",
                "social_identity",
                username + ":" + normalizedProvider);
    }

    public List<String> configuredProviders() {
        return socialProviderSettingsService.configuredProviders().stream()
                .map(SocialProviderSettingsService.ProviderCredentials::registrationId)
                .filter(this::isProviderEnabled)
                .toList();
    }

    public List<SocialProviderDTO> availableProviders() {
        return socialProviderSettingsService.effectiveProviders().stream()
                .sorted()
                .filter(
                        provider ->
                                isProviderEnabled(provider.registrationId())
                                        && !provider.hideOnLogin()
                                        && !provider.accountLinkingOnly())
                .map(
                        provider ->
                                new SocialProviderDTO(
                                        provider.alias(),
                                        provider.providerType(),
                                        provider.iconKey(),
                                        "saml".equalsIgnoreCase(provider.providerType())
                                                || provider.configured()))
                .toList();
    }

    public List<SocialLinkDTO> socialLinks(String username) {
        Set<String> linked = linkedProviders(username);
        return socialProviderSettingsService.effectiveProviders().stream()
                .sorted()
                .filter(
                        provider ->
                                (isProviderEnabled(providerKey(provider))
                                                || linked.contains(providerKey(provider)))
                                        && accountConsoleVisible(provider, linked))
                .map(
                        provider ->
                                new SocialLinkDTO(
                                        provider.alias(),
                                        provider.displayName(),
                                        provider.iconKey(),
                                        linked.contains(providerKey(provider)),
                                        "saml".equalsIgnoreCase(provider.providerType())
                                                || provider.configured(),
                                        isProviderEnabled(providerKey(provider))))
                .toList();
    }

    public boolean isProviderEnabled(String provider) {
        SocialProviderSettingsService.ProviderCredentials configuredProvider =
                socialProviderSettingsService.provider(provider);
        if (configuredProvider != null
                && "saml".equalsIgnoreCase(configuredProvider.providerType())) {
            return configuredProvider.enabled();
        }
        return configuredProvider != null
                ? configuredProvider.enabled()
                : provider != null
                        && loginSettingsService.isSocialProviderEnabled(
                                provider.toLowerCase(Locale.ROOT));
    }

    public boolean requiresShortStateParameter(String provider) {
        SocialProviderSettingsService.ProviderCredentials configuredProvider =
                socialProviderSettingsService.provider(provider);
        return configuredProvider != null && configuredProvider.shortStateParameter();
    }

    /** Returns whether a provider may be used to start a new public login. */
    public boolean isProviderLoginAllowed(String provider) {
        SocialProviderSettingsService.ProviderCredentials configuredProvider =
                socialProviderSettingsService.provider(provider);
        return isProviderEnabled(provider)
                && (configuredProvider == null || !configuredProvider.accountLinkingOnly());
    }

    public boolean isLinkedInProvider(String provider) {
        return LINKEDIN.equals(canonicalProvider(provider));
    }

    public boolean providerRequiresMfa(String provider) {
        SocialProviderSettingsService.ProviderCredentials configuredProvider =
                socialProviderSettingsService.provider(provider);
        return configuredProvider != null && configuredProvider.mfaRequired();
    }

    private void ensureProviderEnabled(String provider) {
        if (!isProviderEnabled(provider)) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("social_provider_disabled"),
                    "This social login provider is disabled");
        }
    }

    private void ensureProviderLoginAllowed(String provider) {
        if (!isProviderLoginAllowed(provider)) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("social_provider_disabled"),
                    "This social login provider is disabled for public sign-in");
        }
    }

    private String normalizeProvider(String provider) {
        String normalized = provider == null ? "" : provider.trim().toLowerCase(Locale.ROOT);
        SocialProviderSettingsService.ProviderCredentials configured =
                socialProviderSettingsService.provider(normalized);
        if (configured != null) {
            return configured.registrationId();
        }
        if (!SUPPORTED_PROVIDERS.contains(normalized)) {
            throw ApiException.badRequest(
                    "provider", ApiErrorCode.INVALID_REQUEST, "The social provider is invalid");
        }
        return normalized;
    }

    private static boolean accountConsoleVisible(
            SocialProviderSettingsService.ProviderCredentials provider, Set<String> linked) {
        String providerKey = providerKey(provider);
        return switch (provider.showInAccountConsole()) {
            case "never" -> false;
            case "when-linked" -> linked.contains(providerKey);
            default -> true;
        };
    }

    private static String providerKey(SocialProviderSettingsService.ProviderCredentials provider) {
        return "saml".equalsIgnoreCase(provider.providerType())
                ? provider.alias()
                : provider.registrationId();
    }

    private UserEntity link(String username, String provider, String subject) {
        UserEntity user =
                userRepository
                        .findForLoginUpdate(username)
                        .orElseThrow(
                                () ->
                                        new OAuth2AuthenticationException(
                                                new OAuth2Error("user_not_found"),
                                                "The local account could not be found"));
        SocialIdentityEntity existing =
                socialIdentityRepository.findByProviderAndSubject(provider, subject).orElse(null);
        if (existing != null) {
            if (!Objects.equals(existing.getUser().getId(), user.getId())) {
                throw new OAuth2AuthenticationException(
                        new OAuth2Error("social_identity_already_linked"),
                        "This social account is already linked to another local account");
            }
            return user;
        }
        if (!socialIdentityRepository
                .findAllByUserUsernameAndProvider(username, provider)
                .isEmpty()) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("social_provider_already_linked"),
                    "A different account is already linked for this social provider");
        }
        socialIdentityRepository.save(new SocialIdentityEntity(provider, subject, user));
        return user;
    }

    private static String requiredAttribute(Map<String, Object> attributes, String... names) {
        for (String name : names) {
            String value = attribute(attributes, name);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        throw new OAuth2AuthenticationException(
                new OAuth2Error("invalid_user_info"),
                "The social provider did not return a subject");
    }

    private static String provider(OAuth2AuthenticationToken authentication) {
        return authentication.getAuthorizedClientRegistrationId().toLowerCase(Locale.ROOT);
    }

    private String canonicalProvider(String value) {
        SocialProviderSettingsService.ProviderCredentials provider =
                socialProviderSettingsService.provider(value);
        if (provider != null) {
            return provider.registrationId();
        }
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        return SUPPORTED_PROVIDERS.contains(normalized) ? normalized : null;
    }

    private static String subject(Map<String, Object> attributes) {
        return requiredAttribute(attributes, "sub", "id");
    }

    private static String pendingValue(Map<?, ?> pendingLink, String key) {
        Object value = pendingLink.get(key);
        return value == null ? null : String.valueOf(value).trim();
    }

    private static Map<String, Object> pendingAttributes(Map<?, ?> pendingLink) {
        Object value = pendingLink.get("attributes");
        if (!(value instanceof Map<?, ?> attributes)) {
            return Map.of();
        }
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        attributes.forEach((key, item) -> result.put(String.valueOf(key), item));
        return result;
    }

    private static String attribute(Map<String, Object> attributes, String name) {
        Object value = attributes.get(name);
        return value == null ? null : String.valueOf(value).trim();
    }

    private static String normalizeEmail(String value) {
        return value == null || value.isBlank() ? null : value.toLowerCase(Locale.ROOT);
    }

    private static boolean emailVerified(Map<String, Object> attributes) {
        Object value = attributes.get("email_verified");
        return value instanceof Boolean booleanValue
                ? booleanValue
                : value != null && Boolean.parseBoolean(String.valueOf(value));
    }

    private static void ensureRequiredClaims(
            Map<String, Object> attributes,
            SocialProviderSettingsService.ProviderCredentials provider) {
        String requiredClaims = provider == null ? "sub" : provider.requiredClaims();
        for (String claim :
                requiredClaims == null ? new String[] {"sub"} : requiredClaims.split(",")) {
            String value = attribute(attributes, claim.trim());
            if (value == null || value.isBlank()) {
                throw new OAuth2AuthenticationException(
                        new OAuth2Error("social_claim_missing"),
                        "The social provider did not return the required claim: " + claim.trim());
            }
        }
    }

    private static String firstName(Map<String, Object> attributes) {
        String value = firstNonBlank(attributes, "given_name", "localizedFirstName", "first_name");
        return value == null ? firstNonBlank(attributes, "name") : value;
    }

    private static String lastName(Map<String, Object> attributes) {
        return firstNonBlank(attributes, "family_name", "localizedLastName", "last_name");
    }

    private Map<String, Map<String, Object>> applyMappers(
            String provider, Map<String, Object> attributes, UserEntity user, boolean firstLogin) {
        SocialProviderSettingsService.ProviderCredentials configured =
                socialProviderSettingsService.provider(provider);
        String alias = configured == null ? provider : configured.alias();
        return socialIdentityMapperService.apply(
                alias,
                attributes,
                user,
                firstLogin,
                configured != null && configured.caseSensitiveUsername(),
                socialProviderSettingsService.syncMode(provider));
    }

    private static boolean shouldSyncExistingUser(String mode) {
        return mode != null && SocialProviderSyncMode.from(mode).updatesExistingUser();
    }

    private void syncProfile(UserEntity user, Map<String, Object> attributes) {
        String firstName = firstName(attributes);
        if (firstName != null) {
            user.setFirstName(firstName);
        }
        String lastName = lastName(attributes);
        if (lastName != null) {
            user.setLastName(lastName);
        }
        String email = normalizeEmail(attribute(attributes, "email"));
        if (email != null) {
            user.setEmail(email);
        }
        if (attributes.containsKey("email_verified")) {
            user.setEmailVerified(emailVerified(attributes));
        }
        String picture = socialPicture(attributes);
        if (picture != null) {
            user.setPictureUrl(picture);
        }
        userRepository.save(user);
    }

    private void persistMappedClaims(
            SocialIdentityEntity identity, Map<String, Map<String, Object>> mappedClaims) {
        if (mappedClaims == null || mappedClaims.isEmpty()) {
            return;
        }
        try {
            identity.setMappedClaims(objectMapper.writeValueAsString(mappedClaims));
        } catch (JacksonException exception) {
            throw new IllegalStateException(
                    "The social provider claims could not be stored", exception);
        }
    }

    private void syncPicture(UserEntity user, String pictureUrl) {
        if ((user.getPictureUrl() == null || user.getPictureUrl().isBlank())
                && pictureUrl != null) {
            user.setPictureUrl(pictureUrl);
            userRepository.save(user);
        }
    }

    private static String socialPicture(Map<String, Object> attributes) {
        String value = firstNonBlank(attributes, "picture", "avatar_url", "profile_image_url");
        if (value == null || value.length() > 1000) {
            return null;
        }
        try {
            URI uri = URI.create(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                            && uri.getHost() != null
                            && uri.getUserInfo() == null
                            && uri.getFragment() == null
                    ? uri.toString()
                    : null;
        } catch (IllegalArgumentException _) {
            return null;
        }
    }

    private static String firstNonBlank(Map<String, Object> attributes, String... names) {
        for (String name : names) {
            String value = attribute(attributes, name);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static String username(String provider, String subject) {
        try {
            byte[] digest =
                    MessageDigest.getInstance("SHA-256")
                            .digest((provider + ":" + subject).getBytes(StandardCharsets.UTF_8));
            return "social_" + provider + "_" + HexFormat.of().formatHex(digest).substring(0, 32);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
