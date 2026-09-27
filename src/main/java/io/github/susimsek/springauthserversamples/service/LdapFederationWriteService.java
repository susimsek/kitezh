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
