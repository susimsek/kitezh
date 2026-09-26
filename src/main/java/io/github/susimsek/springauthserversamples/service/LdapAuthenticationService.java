package io.github.susimsek.springauthserversamples.service;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.LdapFederationIdentityEntity;
import io.github.susimsek.springauthserversamples.domain.LdapFederationProviderEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.repository.AuthorityRepository;
import io.github.susimsek.springauthserversamples.repository.LdapFederationIdentityRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.security.AuthoritiesConstants;
import java.time.Instant;
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
            return identity.getUser();
        }
        if (!provider.isImportUsers()) {
            throw new BadCredentialsException("LDAP user import is disabled");
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
        user.setAuthorities(java.util.Set.of(userAuthority));
        UserEntity saved = userRepository.save(user);
        identityRepository.save(
                new LdapFederationIdentityEntity(
                        externalId, external.distinguishedName(), provider, saved));
        return saved;
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
