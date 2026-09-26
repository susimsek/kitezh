package io.github.susimsek.springauthserversamples.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.LdapFederationIdentityEntity;
import io.github.susimsek.springauthserversamples.domain.LdapFederationProviderEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.repository.LdapFederationIdentityRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class LdapFederationWriteServiceTest {

    private final LdapFederationIdentityRepository identityRepository =
            mock(LdapFederationIdentityRepository.class);
    private final LdapFederationSettingsService settingsService =
            mock(LdapFederationSettingsService.class);
    private final LdapDirectoryClient directoryClient = mock(LdapDirectoryClient.class);

    @Test
    void writesChangedProfileFieldsForWritableProvider() {
        UserEntity user = user("ldap-user", "old@example.com");
        LdapFederationProviderEntity provider = provider("WRITABLE");
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity(
                        "external-id", "uid=ldap-user,ou=users,dc=example,dc=com", provider, user);
        when(identityRepository.findByUserUsername("ldap-user")).thenReturn(Optional.of(identity));
        when(settingsService.configuration(provider, null)).thenReturn(configuration());

        service().updateProfile(user, "ldap-user", "new@example.com", "New", "User");

        verify(directoryClient)
                .updateUser(
                        any(LdapDirectoryClient.Configuration.class),
                        eq("uid=ldap-user,ou=users,dc=example,dc=com"),
                        eq(
                                Map.of(
                                        "mail", "new@example.com",
                                        "givenName", "New")));
    }

    @Test
    void rejectsProfileChangesForReadOnlyProvider() {
        UserEntity user = user("ldap-user", "old@example.com");
        LdapFederationProviderEntity provider = provider("READ_ONLY");
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("external-id", "uid=ldap-user", provider, user);
        when(identityRepository.findByUserUsername("ldap-user")).thenReturn(Optional.of(identity));

        LdapFederationWriteService writeService = service();
        Throwable exception =
                catchThrowable(
                        () ->
                                writeService.updateProfile(
                                        user, "ldap-user", "new@example.com", "New", "User"));

        assertThat(exception)
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.LDAP_READ_ONLY);
        verifyNoInteractions(directoryClient);
    }

    @Test
    void keepsUnsyncedProfileChangesLocal() {
        UserEntity user = user("ldap-user", "old@example.com");
        LdapFederationProviderEntity provider = provider("UNSYNCED");
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("external-id", "uid=ldap-user", provider, user);
        when(identityRepository.findByUserUsername("ldap-user")).thenReturn(Optional.of(identity));

        service().updateProfile(user, "renamed-local-user", "new@example.com", "New", "User");

        verifyNoInteractions(directoryClient);
    }

    @Test
    void ignoresUsersWithoutAnLdapIdentity() {
        UserEntity user = user("local-user", "old@example.com");
        when(identityRepository.findByUserUsername("local-user")).thenReturn(Optional.empty());

        service().updateProfile(user, "local-user", "new@example.com", "New", "User");

        verifyNoInteractions(directoryClient);
    }

    @Test
    void doesNotWriteWhenNoProfileValueChanged() {
        UserEntity user = user("ldap-user", "old@example.com");
        LdapFederationProviderEntity provider = provider("WRITABLE");
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("external-id", "uid=ldap-user", provider, user);
        when(identityRepository.findByUserUsername("ldap-user")).thenReturn(Optional.of(identity));

        service().updateProfile(user, "ldap-user", "old@example.com", "Old", "User");

        verifyNoInteractions(directoryClient);
    }

    @Test
    void rejectsUsernameChangesBeforeCheckingEditMode() {
        UserEntity user = user("ldap-user", "old@example.com");
        LdapFederationProviderEntity provider = provider("WRITABLE");
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("external-id", "uid=ldap-user", provider, user);
        when(identityRepository.findByUserUsername("ldap-user")).thenReturn(Optional.of(identity));

        Throwable exception =
                catchThrowable(
                        () ->
                                service()
                                        .updateProfile(
                                                user,
                                                "renamed-user",
                                                "old@example.com",
                                                "Old",
                                                "User"));

        assertThat(exception)
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.LDAP_READ_ONLY);
        verifyNoInteractions(directoryClient);
    }

    @Test
    void translatesDirectoryWriteFailuresToAnApiError() {
        UserEntity user = user("ldap-user", "old@example.com");
        LdapFederationProviderEntity provider = provider("WRITABLE");
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("external-id", "uid=ldap-user", provider, user);
        when(identityRepository.findByUserUsername("ldap-user")).thenReturn(Optional.of(identity));
        when(settingsService.configuration(provider, null)).thenReturn(configuration());
        doThrow(new IllegalStateException("directory unavailable"))
                .when(directoryClient)
                .updateUser(
                        any(LdapDirectoryClient.Configuration.class),
                        eq("uid=ldap-user"),
                        any(Map.class));

        Throwable exception =
                catchThrowable(
                        () ->
                                service()
                                        .updateProfile(
                                                user,
                                                "ldap-user",
                                                "new@example.com",
                                                "New",
                                                "User"));

        assertThat(exception)
                .isInstanceOf(ApiException.class)
                .extracting(ApiException.class::cast)
                .extracting(ApiException::getErrorCode)
                .isEqualTo(ApiErrorCode.LDAP_WRITE_FAILED);
    }

    private LdapFederationWriteService service() {
        return new LdapFederationWriteService(identityRepository, settingsService, directoryClient);
    }

    private static UserEntity user(String username, String email) {
        UserEntity user = new UserEntity();
        user.setUsername(username);
        user.setEmail(email);
        user.setFirstName("Old");
        user.setLastName("User");
        return user;
    }

    private static LdapFederationProviderEntity provider(String editMode) {
        LdapFederationProviderEntity provider = new LdapFederationProviderEntity();
        provider.setEditMode(editMode);
        provider.setEmailAttribute("mail");
        provider.setFirstNameAttribute("givenName");
        provider.setLastNameAttribute("sn");
        return provider;
    }

    private static LdapDirectoryClient.Configuration configuration() {
        return new LdapDirectoryClient.Configuration(
                "ldap://localhost:389",
                "cn=admin,dc=example,dc=com",
                "secret",
                "ou=users,dc=example,dc=com",
                "uid",
                "entryUUID",
                "mail",
                "givenName",
                "sn",
                "uid",
                "inetOrgPerson",
                "SUBTREE");
    }
}
