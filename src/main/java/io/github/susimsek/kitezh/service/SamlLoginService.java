package io.github.susimsek.kitezh.service;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.SamlProviderConfigEntity;
import io.github.susimsek.kitezh.domain.SocialIdentityEntity;
import io.github.susimsek.kitezh.domain.SocialProviderEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.AuthorityRepository;
import io.github.susimsek.kitezh.repository.SamlProviderConfigRepository;
import io.github.susimsek.kitezh.repository.SocialIdentityRepository;
import io.github.susimsek.kitezh.repository.SocialProviderRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.AuthoritiesConstants;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.UserAccessInvalidationService;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.saml2.provider.service.authentication.Saml2AuthenticatedPrincipal;
import org.springframework.security.saml2.provider.service.authentication.Saml2Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/** Maps a validated SAML assertion to an application user without introducing realms. */
@Service
@RequiredArgsConstructor
public class SamlLoginService {

    private static final String EMAIL_CLAIM = "email";
    private static final String FIRST_NAME_CLAIM = "firstName";
    private static final String LAST_NAME_CLAIM = "lastName";

    private final UserRepository userRepository;
    private final SocialIdentityRepository socialIdentityRepository;
    private final SocialProviderRepository providerRepository;
    private final SamlProviderConfigRepository configRepository;
    private final AuthorityRepository authorityRepository;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    private final SocialProviderSettingsService providerSettingsService;
    private final SocialIdentityMapperService mapperService;
    private final ObjectMapper objectMapper;
    private final AdminAuditEventService auditEventService;
    private final UserAccessInvalidationService userAccessInvalidationService;

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public String findOrCreate(String registrationId, Saml2Authentication authentication) {
        if (!(authentication.getPrincipal() instanceof Saml2AuthenticatedPrincipal principal)) {
            throw new AuthenticationServiceException("SAML principal is invalid");
        }
        String provider = registrationId;
        SocialProviderEntity providerEntity = enabledProvider(provider);
        provider = providerEntity.getAlias();
        if (providerEntity.isAccountLinkingOnly()) {
            throw new AuthenticationServiceException(
                    "This SAML provider is available only for account linking");
        }
        SamlProviderConfigEntity config =
                configRepository
                        .findByProviderId(providerEntity.getId())
                        .orElseThrow(
                                () ->
                                        new AuthenticationServiceException(
                                                "SAML provider configuration is missing"));
        Map<String, Object> attributes = attributes(principal, config);
        String subject = required(attributes, "sub");
        ensureRequiredClaims(attributes, providerEntity.getRequiredClaims());
        SocialIdentityEntity existing =
                socialIdentityRepository.findByProviderAndSubject(provider, subject).orElse(null);
        if (existing != null) {
            UserEntity user = existing.getUser();
            final Set<String> previousRoles = roleNames(user);
            final Set<Long> previousGroups = groupIds(user);
            if (shouldSyncExistingUser(providerEntity)) {
                syncProfile(user, attributes);
            }
            persistMappedClaims(
                    existing,
                    mapperService.apply(
                            providerEntity.getAlias(),
                            attributes,
                            user,
                            false,
                            providerSettings(providerEntity).caseSensitiveUsername(),
                            providerEntity.getSyncMode(),
                            existing));
            socialIdentityRepository.save(existing);
            invalidateIfAccessChanged(user, previousRoles, previousGroups);
            return user.getUsername();
        }

        String email = normalizeEmail(value(attributes, EMAIL_CLAIM));
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
        user.setFirstName(value(attributes, FIRST_NAME_CLAIM));
        user.setLastName(value(attributes, LAST_NAME_CLAIM));
        user.setEmail(email);
        user.setEmailVerified(email != null && providerEntity.isTrustEmail());
        user.setEnabled(true);
        user.setPasswordChangedAt(Instant.now());
        user.setMustChangePassword(false);
        user.setTemporaryPassword(false);
        user.setAuthorities(java.util.Set.of(userAuthority));
        UserEntity saved = userRepository.save(user);
        SocialIdentityEntity identity = new SocialIdentityEntity(provider, subject, saved);
        persistMappedClaims(
                identity,
                mapperService.apply(
                        providerEntity.getAlias(),
                        attributes,
                        saved,
                        true,
                        providerSettings(providerEntity).caseSensitiveUsername(),
                        providerEntity.getSyncMode(),
                        identity));
        socialIdentityRepository.save(identity);
        auditEventService.record("saml.login.created", "saml_identity", provider + ":" + subject);
        return saved.getUsername();
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void linkExisting(
            String username, String registrationId, Saml2Authentication authentication) {
        if (!(authentication.getPrincipal() instanceof Saml2AuthenticatedPrincipal principal)) {
            throw new AuthenticationServiceException("SAML principal is invalid");
        }
        String provider = registrationId;
        SocialProviderEntity providerEntity = enabledProvider(provider);
        provider = providerEntity.getAlias();
        SamlProviderConfigEntity config =
                configRepository
                        .findByProviderId(providerEntity.getId())
                        .orElseThrow(
                                () ->
                                        new AuthenticationServiceException(
                                                "SAML provider configuration is missing"));
        Map<String, Object> attributes = attributes(principal, config);
        String subject = required(attributes, "sub");
        UserEntity user =
                userRepository
                        .findForLoginUpdate(username)
                        .orElseThrow(
                                () ->
                                        new AuthenticationServiceException(
                                                "The local account could not be found"));
        final Set<String> previousRoles = roleNames(user);
        final Set<Long> previousGroups = groupIds(user);
        SocialIdentityEntity existing =
                socialIdentityRepository.findByProviderAndSubject(provider, subject).orElse(null);
        if (existing != null && !Objects.equals(existing.getUser().getId(), user.getId())) {
            throw new AuthenticationServiceException(
                    "This SAML account is already linked to another local account");
        }
        if (existing == null) {
            if (!socialIdentityRepository
                    .findAllByUserUsernameAndProvider(username, provider)
                    .isEmpty()) {
                throw new AuthenticationServiceException(
                        "A different SAML account is already linked for this provider");
            }
            existing =
                    socialIdentityRepository.save(
                            new SocialIdentityEntity(provider, subject, user));
        }
        persistMappedClaims(
                existing,
                mapperService.apply(
                        providerEntity.getAlias(),
                        attributes,
                        user,
                        true,
                        providerSettings(providerEntity).caseSensitiveUsername(),
                        providerEntity.getSyncMode(),
                        existing));
        socialIdentityRepository.save(existing);
        invalidateIfAccessChanged(user, previousRoles, previousGroups);
        auditEventService.record(
                "account.saml_link.created", "saml_identity", username + ":" + provider);
    }

    public boolean providerRequiresMfa(String provider) {
        return providerRepository
                .findByAliasIgnoreCase(provider)
                .or(() -> providerRepository.findByRegistrationId(provider))
                .map(SocialProviderEntity::isMfaRequired)
                .orElse(false);
    }

    private SocialProviderEntity enabledProvider(String providerKey) {
        return providerRepository
                .findByAliasIgnoreCase(providerKey)
                .or(() -> providerRepository.findByRegistrationId(providerKey))
                .filter(
                        entity ->
                                entity.isEnabled()
                                        && "saml".equalsIgnoreCase(entity.getProviderType()))
                .orElseThrow(
                        () ->
                                new AuthenticationServiceException(
                                        "SAML provider is disabled or unknown"));
    }

    private SocialProviderSettingsService.ProviderCredentials providerSettings(
            SocialProviderEntity provider) {
        return providerSettingsService.provider(provider.getAlias());
    }

    private static Map<String, Object> attributes(
            Saml2AuthenticatedPrincipal principal, SamlProviderConfigEntity config) {
        Map<String, Object> result = new LinkedHashMap<>();
        principal
                .getAttributes()
                .forEach(
                        (key, values) ->
                                result.put(
                                        key,
                                        values.size() == 1
                                                ? values.getFirst()
                                                : List.copyOf(values)));
        String subject =
                "NameID".equalsIgnoreCase(config.getPrincipalAttribute())
                        ? principal.getName()
                        : first(principal.getAttribute(config.getPrincipalAttribute()));
        result.put("sub", subject);
        putMapped(result, EMAIL_CLAIM, config.getEmailAttribute(), principal);
        putMapped(result, FIRST_NAME_CLAIM, config.getFirstNameAttribute(), principal);
        putMapped(result, LAST_NAME_CLAIM, config.getLastNameAttribute(), principal);
        putMapped(result, "groups", config.getGroupsAttribute(), principal);
        return result;
    }

    private static void putMapped(
            Map<String, Object> values,
            String target,
            String source,
            Saml2AuthenticatedPrincipal principal) {
        if (source == null || source.isBlank()) {
            return;
        }
        List<Object> value = principal.getAttribute(source);
        if (value != null && !value.isEmpty()) {
            values.put(target, value.size() == 1 ? value.getFirst() : List.copyOf(value));
        }
    }

    private static String first(List<?> values) {
        return values == null || values.isEmpty() || values.getFirst() == null
                ? null
                : String.valueOf(values.getFirst()).trim();
    }

    private static String required(Map<String, Object> attributes, String key) {
        String value = value(attributes, key);
        if (value == null || value.isBlank()) {
            throw new AuthenticationServiceException("The SAML assertion has no subject");
        }
        return value;
    }

    private static void ensureRequiredClaims(
            Map<String, Object> attributes, String requiredClaims) {
        String claims = requiredClaims == null || requiredClaims.isBlank() ? "sub" : requiredClaims;
        for (String claim : claims.split(",")) {
            String name = claim.trim();
            if (!name.isBlank()
                    && (value(attributes, name) == null || value(attributes, name).isBlank())) {
                throw new AuthenticationServiceException("The SAML assertion is missing: " + name);
            }
        }
    }

    private boolean shouldSyncExistingUser(SocialProviderEntity provider) {
        return SocialProviderSyncMode.from(provider.getSyncMode()).updatesExistingUser();
    }

    private static void syncProfile(UserEntity user, Map<String, Object> attributes) {
        String firstName = value(attributes, FIRST_NAME_CLAIM);
        if (firstName != null) {
            user.setFirstName(firstName);
        }
        String lastName = value(attributes, LAST_NAME_CLAIM);
        if (lastName != null) {
            user.setLastName(lastName);
        }
        String email = normalizeEmail(value(attributes, EMAIL_CLAIM));
        if (email != null) {
            user.setEmail(email);
        }
    }

    private void persistMappedClaims(
            SocialIdentityEntity identity, Map<String, Map<String, Object>> mappedClaims) {
        if (mappedClaims == null || mappedClaims.isEmpty()) {
            return;
        }
        try {
            identity.setMappedClaims(objectMapper.writeValueAsString(mappedClaims));
        } catch (JacksonException exception) {
            throw new IllegalStateException("The SAML claims could not be stored", exception);
        }
    }

    private static String value(Map<String, Object> attributes, String key) {
        Object value = attributes.get(key);
        if (value instanceof List<?> values) {
            return values.isEmpty() ? null : String.valueOf(values.getFirst()).trim();
        }
        if (value instanceof Iterable<?> iterable) {
            java.util.Iterator<?> iterator = iterable.iterator();
            return iterator.hasNext() ? String.valueOf(iterator.next()).trim() : null;
        }
        return value == null ? null : String.valueOf(value).trim();
    }

    private static String normalizeEmail(String value) {
        return value == null || value.isBlank() ? null : value.toLowerCase(Locale.ROOT);
    }

    private static Set<String> roleNames(UserEntity user) {
        return user.getAuthorities().stream()
                .map(AuthorityEntity::getName)
                .collect(java.util.stream.Collectors.toSet());
    }

    private static Set<Long> groupIds(UserEntity user) {
        return user.getGroups().stream()
                .map(io.github.susimsek.kitezh.domain.GroupEntity::getId)
                .collect(java.util.stream.Collectors.toSet());
    }

    private void invalidateIfAccessChanged(
            UserEntity user, Set<String> previousRoles, Set<Long> previousGroups) {
        if (!previousRoles.equals(roleNames(user)) || !previousGroups.equals(groupIds(user))) {
            userAccessInvalidationService.invalidateForCurrentPrincipal(user.getUsername());
        }
    }

    private static String username(String provider, String subject) {
        try {
            return "saml_"
                    + provider
                    + "_"
                    + java.util.HexFormat.of()
                            .formatHex(
                                    java.security.MessageDigest.getInstance("SHA-256")
                                            .digest(
                                                    (provider + ":" + subject)
                                                            .getBytes(
                                                                    java.nio.charset
                                                                            .StandardCharsets
                                                                            .UTF_8)))
                            .substring(0, 32);
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
