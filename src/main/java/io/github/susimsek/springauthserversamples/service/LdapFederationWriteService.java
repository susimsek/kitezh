package io.github.susimsek.springauthserversamples.service;

import io.github.susimsek.springauthserversamples.domain.LdapFederationIdentityEntity;
import io.github.susimsek.springauthserversamples.domain.LdapFederationProviderEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.repository.LdapFederationIdentityRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Writes editable built-in profile fields back to writable LDAP identities. */
@Service
@RequiredArgsConstructor
public class LdapFederationWriteService {

    private final LdapFederationIdentityRepository identityRepository;
    private final LdapFederationSettingsService settingsService;
    private final LdapDirectoryClient directoryClient;

    @Transactional
    public void updateProfile(
            UserEntity user,
            String requestedUsername,
            String email,
            String firstName,
            String lastName) {
        identityRepository
                .findByUserUsername(user.getUsername())
                .ifPresent(
                        identity ->
                                updateDirectory(
                                        identity, requestedUsername, email, firstName, lastName));
    }

    @Transactional
    public void registerUser(UserEntity user, String password) {
        settingsService.enabledProviders().stream()
                .filter(LdapFederationProviderEntity::isSyncRegistrations)
                .filter(provider -> "WRITABLE".equals(provider.getEditMode()))
                .findFirst()
                .ifPresent(
                        provider -> {
                            String distinguishedName =
                                    directoryClient.registerUser(
                                            settingsService.configuration(provider, null),
                                            user.getUsername(),
                                            user.getEmail(),
                                            user.getFirstName(),
                                            user.getLastName(),
                                            password);
                            identityRepository.save(
                                    new LdapFederationIdentityEntity(
                                            distinguishedName, distinguishedName, provider, user));
                        });
    }

    @Transactional
    public boolean changePassword(UserEntity user, String currentPassword, String newPassword) {
        LdapFederationIdentityEntity identity =
                identityRepository.findByUserUsername(user.getUsername()).orElse(null);
        if (identity == null || "UNSYNCED".equals(identity.getProvider().getEditMode())) {
            return false;
        }
        LdapFederationProviderEntity provider = identity.getProvider();
        if (!"WRITABLE".equals(provider.getEditMode())) {
            throw ApiException.forbidden(
                    ApiErrorCode.LDAP_READ_ONLY, "The LDAP password is read-only");
        }
        try {
            directoryClient.authenticate(
                    settingsService.configuration(provider, null),
                    user.getUsername(),
                    currentPassword);
            directoryClient.updatePassword(
                    settingsService.configuration(provider, null),
                    identity.getDistinguishedName(),
                    newPassword);
            return true;
        } catch (BadCredentialsException exception) {
            throw ApiException.badRequest(
                    "currentPassword",
                    ApiErrorCode.INVALID_CURRENT_PASSWORD,
                    "The current LDAP password is incorrect");
        } catch (RuntimeException exception) {
            throw ApiException.serverError(
                    ApiErrorCode.LDAP_WRITE_FAILED,
                    "The LDAP password could not be updated",
                    exception);
        }
    }

    private void updateDirectory(
            LdapFederationIdentityEntity identity,
            String requestedUsername,
            String email,
            String firstName,
            String lastName) {
        UserEntity user = identity.getUser();
        LdapFederationProviderEntity provider = identity.getProvider();
        if ("UNSYNCED".equals(provider.getEditMode())) {
            return;
        }
        if (!Objects.equals(user.getUsername(), requestedUsername)) {
            throw ApiException.forbidden(
                    ApiErrorCode.LDAP_READ_ONLY,
                    "The LDAP username is managed by the directory and cannot be changed here");
        }
        Map<String, String> changes = new LinkedHashMap<>();
        addChange(changes, provider.getEmailAttribute(), user.getEmail(), email);
        addChange(changes, provider.getFirstNameAttribute(), user.getFirstName(), firstName);
        addChange(changes, provider.getLastNameAttribute(), user.getLastName(), lastName);
        if (changes.isEmpty()) {
            return;
        }
        if (!"WRITABLE".equals(provider.getEditMode())) {
            throw ApiException.forbidden(
                    ApiErrorCode.LDAP_READ_ONLY, "The LDAP profile is read-only");
        }
        try {
            directoryClient.updateUser(
                    settingsService.configuration(provider, null),
                    identity.getDistinguishedName(),
                    changes);
        } catch (RuntimeException exception) {
            throw ApiException.serverError(
                    ApiErrorCode.LDAP_WRITE_FAILED,
                    "The LDAP profile could not be updated",
                    exception);
        }
    }

    private static void addChange(
            Map<String, String> changes, String attribute, String current, String requested) {
        if (!Objects.equals(current, requested)) {
            changes.put(attribute, requested);
        }
    }
}
