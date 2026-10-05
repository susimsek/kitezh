package io.github.susimsek.kitezh.service;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.LdapFederationIdentityEntity;
import io.github.susimsek.kitezh.domain.LdapFederationProviderEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.AuthorityRepository;
import io.github.susimsek.kitezh.repository.LdapFederationIdentityRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.AuthoritiesConstants;
import java.time.Instant;
import java.util.HashSet;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LdapAuthenticationService {

    private static final PasswordEncoder PASSWORD_ENCODER =
            PasswordEncoderFactories.createDelegatingPasswordEncoder();

    private final LdapFederationSettingsService settingsService;
    private final LdapDirectoryClient directoryClient;
    private final LdapFederationIdentityRepository identityRepository;
    private final UserRepository userRepository;
    private final AuthorityRepository authorityRepository;
    private final LdapFederationMapperService mapperService;

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public UserEntity authenticate(String identifier, String password) {
        for (LdapFederationProviderEntity provider : settingsService.enabledProviders()) {
            LdapDirectoryClient.LdapUser external =
                    directoryClient.authenticate(
                            settingsService.configuration(provider, null), identifier, password);
            if (external == null) {
                continue;
            }
            UserEntity user = importUser(provider, external);
            if (user == null) {
                user = transientUser(provider, external);
            }
            if ("ACTIVE_DIRECTORY".equals(provider.getVendor()) && !user.isEnabled()) {
                throw new BadCredentialsException("LDAP account is disabled");
            }
            return userRepository.findForAuthentication(user.getUsername()).orElse(user);
        }
        return null;
    }

    private UserEntity importUser(
            LdapFederationProviderEntity provider, LdapDirectoryClient.LdapUser external) {
        String externalId =
                external.externalId() == null || external.externalId().isBlank()
                        ? external.distinguishedName()
                        : external.externalId();
        LdapFederationIdentityEntity identity =
                identityRepository
                        .findByProviderIdAndExternalId(provider.getId(), externalId)
                        .orElse(null);
        if (identity != null) {
            sync(identity.getUser(), provider, external);
            identity.setDistinguishedName(external.distinguishedName());
            applyMappers(provider, external, identity.getUser(), identity);
            return identity.getUser();
        }
        if (!provider.isImportUsers()) {
            return null;
        }
        String email = normalize(external.email());
        if (email != null && userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new BadCredentialsException("LDAP account requires explicit linking");
        }
        AuthorityEntity userAuthority =
                authorityRepository
                        .findByName(AuthoritiesConstants.USER)
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "The default user authority is not configured"));
        UserEntity user = new UserEntity();
        user.setUsername(uniqueUsername(provider, external.username(), externalId));
        user.setPassword(PASSWORD_ENCODER.encode(UUID.randomUUID().toString()));
        user.setFirstName(normalize(external.firstName()));
        user.setLastName(normalize(external.lastName()));
        user.setEmail(email);
        user.setEmailVerified(provider.isTrustEmail() && email != null);
        user.setEnabled(true);
        user.setPasswordChangedAt(Instant.now());
        user.setMustChangePassword(false);
        user.setTemporaryPassword(false);
        user.setAuthorities(new HashSet<>(java.util.Set.of(userAuthority)));
        UserEntity saved = userRepository.save(user);
        identity =
                identityRepository.save(
                        new LdapFederationIdentityEntity(
                                externalId, external.distinguishedName(), provider, saved));
        applyMappers(provider, external, saved, identity);
        return saved;
    }

    boolean synchronizeUser(
            LdapFederationProviderEntity provider, LdapDirectoryClient.LdapUser external) {
        if (!provider.isImportUsers()) {
            return false;
        }
        boolean existing =
                identityRepository
                        .findByProviderIdAndExternalId(provider.getId(), externalId(external))
                        .isPresent();
        importUser(provider, external);
        return !existing;
    }

    private static String externalId(LdapDirectoryClient.LdapUser external) {
        return external.externalId() == null || external.externalId().isBlank()
                ? external.distinguishedName()
                : external.externalId();
    }

    private UserEntity transientUser(
            LdapFederationProviderEntity provider, LdapDirectoryClient.LdapUser external) {
        UserEntity user = new UserEntity();
        String username = normalize(external.username());
        String externalId = normalize(external.externalId());
        user.setUsername(
                username == null
                        ? provider.getName() + "_" + fallbackExternalId(external, externalId)
                        : username);
        user.setFirstName(normalize(external.firstName()));
        user.setLastName(normalize(external.lastName()));
        user.setEmail(normalize(external.email()));
        user.setEmailVerified(provider.isTrustEmail() && user.getEmail() != null);
        user.setEnabled(true);
        authorityRepository
                .findByName(AuthoritiesConstants.USER)
                .ifPresent(
                        authority ->
                                user.setAuthorities(new HashSet<>(java.util.Set.of(authority))));
        applyMappers(provider, external, user, null);
        return user;
    }

    private static String fallbackExternalId(
            LdapDirectoryClient.LdapUser external, String externalId) {
        if (externalId != null) {
            return externalId;
        }
        return Integer.toHexString(external.distinguishedName().hashCode());
    }

    private void applyMappers(
            LdapFederationProviderEntity provider,
            LdapDirectoryClient.LdapUser external,
            UserEntity user,
            LdapFederationIdentityEntity identity) {
        if (mapperService != null) {
            mapperService.apply(
                    provider,
                    settingsService.configuration(provider, null),
                    external,
                    user,
                    identity);
        }
    }

    private void sync(
            UserEntity user,
            LdapFederationProviderEntity provider,
            LdapDirectoryClient.LdapUser external) {
        if ("UNSYNCED".equals(provider.getEditMode())) {
            return;
        }
        String email = normalize(external.email());
        if (email != null
                && !email.equalsIgnoreCase(user.getEmail())
                && !email.equalsIgnoreCase(user.getPendingEmail())
                && userRepository
                        .findByEmailIgnoreCase(email)
                        .filter(candidate -> !Objects.equals(candidate.getId(), user.getId()))
                        .isEmpty()) {
            user.setEmail(email);
            user.setEmailVerified(provider.isTrustEmail());
        }
        user.setFirstName(normalize(external.firstName()));
        user.setLastName(normalize(external.lastName()));
    }

    private String uniqueUsername(
            LdapFederationProviderEntity provider, String externalUsername, String externalId) {
        String candidate = normalize(externalUsername);
        if (candidate == null) {
            candidate = provider.getName() + "_" + externalId;
        }
        candidate = candidate.length() > 100 ? candidate.substring(0, 100) : candidate;
        if (userRepository.findForAuthentication(candidate).isEmpty()) {
            return candidate;
        }
        String prefix = provider.getName().replaceAll("[^A-Za-z0-9_-]", "_");
        String suffix = "_" + candidate;
        int length = Math.min(100 - suffix.length(), prefix.length());
        String prefixed = (length > 0 ? prefix.substring(0, length) : "ldap") + suffix;
        return prefixed.length() > 100 ? prefixed.substring(0, 100) : prefixed;
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
