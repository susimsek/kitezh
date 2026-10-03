package io.github.susimsek.springauthserversamples.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.LdapFederationIdentityEntity;
import io.github.susimsek.springauthserversamples.domain.LdapFederationProviderEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.repository.AuthorityRepository;
import io.github.susimsek.springauthserversamples.repository.LdapFederationIdentityRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.security.AuthoritiesConstants;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LdapAuthenticationServiceTest {

    private final LdapFederationSettingsService settingsService =
            mock(LdapFederationSettingsService.class);
    private final LdapDirectoryClient directoryClient = mock(LdapDirectoryClient.class);
    private final LdapFederationIdentityRepository identityRepository =
            mock(LdapFederationIdentityRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final AuthorityRepository authorityRepository = mock(AuthorityRepository.class);
    private final LdapFederationProviderEntity provider = provider();
    private final LdapDirectoryClient.Configuration configuration =
            new LdapDirectoryClient.Configuration(
                    "ldaps://directory.example.com:636",
                    "CN=bind,DC=example,DC=com",
                    "bind-password",
                    "OU=Users,DC=example,DC=com",
                    "sAMAccountName",
                    "objectGUID",
                    "mail",
                    "givenName",
                    "sn",
                    "sAMAccountName",
                    "person,user",
                    "SUBTREE");
    private LdapAuthenticationService service;

    @BeforeEach
    void setUp() {
        service =
                new LdapAuthenticationService(
                        settingsService,
                        directoryClient,
                        identityRepository,
                        userRepository,
                        authorityRepository,
                        null);
        when(settingsService.enabledProviders()).thenReturn(List.of(provider));
        when(settingsService.configuration(provider, null)).thenReturn(configuration);
        when(identityRepository.findByProviderIdAndExternalId("provider-id", "object-id"))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("alice@example.com"))
                .thenReturn(Optional.empty());
        when(userRepository.findForAuthentication("alice")).thenReturn(Optional.empty());
        AuthorityEntity authority = new AuthorityEntity();
        authority.setName(AuthoritiesConstants.USER);
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.of(authority));
        when(userRepository.save(any(UserEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void importsAUserAfterSuccessfulDirectoryAuthentication() {
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(
                        new LdapDirectoryClient.LdapUser(
                                "CN=Alice,OU=Users,DC=example,DC=com",
                                "object-id",
                                "alice",
                                "alice@example.com",
                                "Alice",
                                "Example"));

        UserEntity user = service.authenticate("alice", "directory-password");

        assertThat(user)
                .extracting(UserEntity::getUsername, UserEntity::getEmail, UserEntity::getFirstName)
                .containsExactly("alice", "alice@example.com", "Alice");
        assertThat(user.isEmailVerified()).isFalse();
        assertThat(user.getAuthorities())
                .extracting(AuthorityEntity::getName)
                .containsExactly("ROLE_USER");
    }

    @Test
    void returnsTheAuthenticationGraphAfterImportingAUser() {
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(
                        new LdapDirectoryClient.LdapUser(
                                "CN=Alice,OU=Users,DC=example,DC=com",
                                "object-id",
                                "alice",
                                "alice@example.com",
                                "Alice",
                                "Example"));
        UserEntity loadedUser = new UserEntity();
        loadedUser.setUsername("alice");
        when(userRepository.findForAuthentication("alice"))
                .thenReturn(Optional.empty(), Optional.of(loadedUser));

        UserEntity user = service.authenticate("alice", "directory-password");

        assertThat(user).isSameAs(loadedUser);
    }

    @Test
    void rejectsAnUnlinkedDirectoryIdentityWhenItsEmailBelongsToALocalUser() {
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(
                        new LdapDirectoryClient.LdapUser(
                                "CN=Alice,OU=Users,DC=example,DC=com",
                                "object-id",
                                "alice",
                                "alice@example.com",
                                "Alice",
                                "Example"));
        when(userRepository.findByEmailIgnoreCase("alice@example.com"))
                .thenReturn(Optional.of(new UserEntity()));

        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () -> service.authenticate("alice", "directory-password"))
                .isInstanceOf(
                        org.springframework.security.authentication.BadCredentialsException.class)
                .hasMessage("LDAP account requires explicit linking");
    }

    @Test
    void returnsNullWhenNoEnabledProviderMatches() {
        when(settingsService.enabledProviders()).thenReturn(List.of());

        assertThat(service.authenticate("alice", "directory-password")).isNull();
        verifyNoInteractions(directoryClient);
    }

    @Test
    void continuesWithTheNextProviderWhenTheFirstProviderDoesNotMatch() {
        LdapFederationProviderEntity secondProvider = provider();
        secondProvider.setId("second-provider-id");
        secondProvider.setName("Second AD");
        when(settingsService.enabledProviders()).thenReturn(List.of(provider, secondProvider));
        when(settingsService.configuration(secondProvider, null)).thenReturn(configuration);
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(null);

        assertThat(service.authenticate("alice", "directory-password")).isNull();
    }

    @Test
    void authenticatesAUserWithoutPersistingWhenImportIsDisabled() {
        provider.setImportUsers(false);
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(externalUser("object-id"));

        UserEntity user = service.authenticate("alice", "directory-password");

        assertThat(user).extracting(UserEntity::getUsername).isEqualTo("alice");
        verify(userRepository, never()).save(any(UserEntity.class));
    }

    @Test
    void trustsTheDirectoryEmailWhenConfigured() {
        provider.setTrustEmail(true);
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(externalUser("object-id"));

        UserEntity user = service.authenticate("alice", "directory-password");

        assertThat(user.isEmailVerified()).isTrue();
    }

    @Test
    void synchronizesAnExistingIdentityAndUsesDistinguishedNameAsFallbackId() {
        UserEntity existing = new UserEntity();
        existing.setUsername("alice");
        existing.setEmail("old@example.com");
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("old-id", "old-dn", provider, existing);
        String distinguishedName = "CN=Alice,OU=Users,DC=example,DC=com";
        when(identityRepository.findByProviderIdAndExternalId("provider-id", distinguishedName))
                .thenReturn(Optional.of(identity));
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(
                        new LdapDirectoryClient.LdapUser(
                                distinguishedName,
                                " ",
                                "alice",
                                " alice@example.com ",
                                " Alice ",
                                " Example "));

        UserEntity user = service.authenticate("alice", "directory-password");

        assertThat(user)
                .extracting(UserEntity::getEmail, UserEntity::getFirstName, UserEntity::getLastName)
                .containsExactly("alice@example.com", "Alice", "Example");
        assertThat(identity.getDistinguishedName()).isEqualTo(distinguishedName);
    }

    @Test
    void doesNotSynchronizeAnExistingIdentityInUnsyncedMode() {
        provider.setEditMode("UNSYNCED");
        UserEntity existing = new UserEntity();
        existing.setUsername("alice");
        existing.setEmail("old@example.com");
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("object-id", "old-dn", provider, existing);
        when(identityRepository.findByProviderIdAndExternalId("provider-id", "object-id"))
                .thenReturn(Optional.of(identity));
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(externalUser("object-id"));

        service.authenticate("alice", "directory-password");

        assertThat(existing.getEmail()).isEqualTo("old@example.com");
        assertThat(existing.getFirstName()).isNull();
    }

    @Test
    void failsClearlyWhenTheDefaultAuthorityIsMissing() {
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.empty());
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(externalUser("object-id"));

        assertThatThrownBy(() -> service.authenticate("alice", "directory-password"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("The default user authority is not configured");
    }

    @Test
    void generatesAProviderPrefixedUsernameWhenTheDirectoryUsernameIsTaken() {
        when(userRepository.findForAuthentication("alice"))
                .thenReturn(Optional.of(new UserEntity()), Optional.empty());
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(externalUser("object-id"));

        UserEntity user = service.authenticate("alice", "directory-password");

        assertThat(user.getUsername()).isEqualTo("Corporate_AD_alice");
    }

    @Test
    void generatesAUsernameFromTheProviderAndExternalIdWhenDirectoryUsernameIsMissing() {
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(
                        new LdapDirectoryClient.LdapUser(
                                "CN=Alice,OU=Users,DC=example,DC=com",
                                "object-id",
                                " ",
                                "alice@example.com",
                                "Alice",
                                "Example"));

        UserEntity user = service.authenticate("alice", "directory-password");

        assertThat(user.getUsername()).isEqualTo("Corporate AD_object-id");
    }

    @Test
    void importsAUserWithNullOptionalProfileValues() {
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(
                        new LdapDirectoryClient.LdapUser(
                                "CN=Alice,OU=Users,DC=example,DC=com",
                                "object-id",
                                "alice",
                                " ",
                                null,
                                " "));

        UserEntity user = service.authenticate("alice", "directory-password");

        assertThat(user)
                .extracting(UserEntity::getEmail, UserEntity::getFirstName, UserEntity::getLastName)
                .containsExactly(null, null, null);
        assertThat(user.isEmailVerified()).isFalse();
    }

    @Test
    void preservesAPendingEmailDuringDirectorySynchronization() {
        UserEntity existing = new UserEntity();
        existing.setUsername("alice");
        existing.setEmail("old@example.com");
        existing.setPendingEmail("alice@example.com");
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("object-id", "old-dn", provider, existing);
        when(identityRepository.findByProviderIdAndExternalId("provider-id", "object-id"))
                .thenReturn(Optional.of(identity));
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(externalUser("object-id"));

        service.authenticate("alice", "directory-password");

        assertThat(existing.getEmail()).isEqualTo("old@example.com");
        assertThat(existing.getPendingEmail()).isEqualTo("alice@example.com");
    }

    @Test
    void truncatesAnOverlongDirectoryUsernameBeforeCheckingAvailability() {
        String longUsername = "a".repeat(120);
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(
                        new LdapDirectoryClient.LdapUser(
                                "CN=Alice,OU=Users,DC=example,DC=com",
                                "object-id",
                                longUsername,
                                "alice@example.com",
                                "Alice",
                                "Example"));

        UserEntity user = service.authenticate("alice", "directory-password");

        assertThat(user.getUsername()).hasSize(100).isEqualTo(longUsername.substring(0, 100));
    }

    @Test
    void truncatesTheFallbackUsernameWhenAFullLengthCandidateAlreadyExists() {
        String longUsername = "a".repeat(100);
        when(userRepository.findForAuthentication(longUsername))
                .thenReturn(Optional.of(new UserEntity()));
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(
                        new LdapDirectoryClient.LdapUser(
                                "CN=Alice,OU=Users,DC=example,DC=com",
                                "object-id",
                                longUsername,
                                "alice@example.com",
                                "Alice",
                                "Example"));

        UserEntity user = service.authenticate("alice", "directory-password");

        assertThat(user.getUsername()).hasSize(100).startsWith("ldap_");
    }

    @Test
    void buildsTransientFallbackIdentityWithoutUsernameOrExternalId() {
        provider.setImportUsers(false);
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.empty());
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(
                        new LdapDirectoryClient.LdapUser(
                                "CN=Alice,OU=Users,DC=example,DC=com", null, " ", " ", " ", null));

        UserEntity user = service.authenticate("alice", "directory-password");

        assertThat(user.getUsername())
                .isEqualTo(
                        "Corporate AD_"
                                + Integer.toHexString(
                                        "CN=Alice,OU=Users,DC=example,DC=com".hashCode()));
        assertThat(user.getAuthorities()).isEmpty();
    }

    @Test
    void keepsTheCurrentEmailWhenDirectoryEmailBelongsToAnotherUser() {
        UserEntity existing = new UserEntity();
        existing.setId(1L);
        existing.setUsername("alice");
        existing.setEmail("old@example.com");
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("object-id", "old-dn", provider, existing);
        when(identityRepository.findByProviderIdAndExternalId("provider-id", "object-id"))
                .thenReturn(Optional.of(identity));
        UserEntity otherUser = new UserEntity();
        otherUser.setId(2L);
        when(userRepository.findByEmailIgnoreCase("alice@example.com"))
                .thenReturn(Optional.of(otherUser));
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(externalUser("object-id"));

        service.authenticate("alice", "directory-password");

        assertThat(existing.getEmail()).isEqualTo("old@example.com");
    }

    @Test
    void updatesAnExistingIdentityWhenItsDirectoryEmailChanges() {
        provider.setTrustEmail(true);
        UserEntity existing = new UserEntity();
        existing.setId(1L);
        existing.setUsername("alice");
        existing.setEmail("old@example.com");
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("object-id", "old-dn", provider, existing);
        when(identityRepository.findByProviderIdAndExternalId("provider-id", "object-id"))
                .thenReturn(Optional.of(identity));
        when(userRepository.findByEmailIgnoreCase("alice@example.com"))
                .thenReturn(Optional.empty());
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(externalUser("object-id"));

        service.authenticate("alice", "directory-password");

        assertThat(existing.getEmail()).isEqualTo("alice@example.com");
        assertThat(existing.isEmailVerified()).isTrue();
    }

    @Test
    void rejectsDisabledActiveDirectoryUsersAfterSynchronization() {
        provider.setVendor("ACTIVE_DIRECTORY");
        UserEntity existing = new UserEntity();
        existing.setUsername("alice");
        existing.setEnabled(false);
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("object-id", "old-dn", provider, existing);
        when(identityRepository.findByProviderIdAndExternalId("provider-id", "object-id"))
                .thenReturn(Optional.of(identity));
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(externalUser("object-id"));

        assertThatThrownBy(() -> service.authenticate("alice", "directory-password"))
                .isInstanceOf(
                        org.springframework.security.authentication.BadCredentialsException.class)
                .hasMessage("LDAP account is disabled");
    }

    @Test
    void synchronizesExistingAndSkipsDisabledProviders() {
        UserEntity existing = new UserEntity();
        existing.setUsername("alice");
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("object-id", "old-dn", provider, existing);
        when(identityRepository.findByProviderIdAndExternalId("provider-id", "object-id"))
                .thenReturn(Optional.of(identity));

        assertThat(service.synchronizeUser(provider, externalUser("object-id"))).isFalse();

        provider.setImportUsers(false);
        assertThat(service.synchronizeUser(provider, externalUser("object-id"))).isFalse();
    }

    @Test
    void reportsNewSynchronizationAndUsesDistinguishedNameFallbackId() {
        when(identityRepository.findByProviderIdAndExternalId(
                        "provider-id", "CN=Alice,OU=Users,DC=example,DC=com"))
                .thenReturn(Optional.empty());
        LdapDirectoryClient.LdapUser external =
                new LdapDirectoryClient.LdapUser(
                        "CN=Alice,OU=Users,DC=example,DC=com",
                        " ",
                        "alice",
                        "alice@example.com",
                        "Alice",
                        "Example");

        assertThat(service.synchronizeUser(provider, external)).isTrue();
    }

    @Test
    void handlesTrustEmailWithMissingEmailAndNonActiveDirectoryDisabledUsers() {
        provider.setImportUsers(false);
        provider.setTrustEmail(true);
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(
                        new LdapDirectoryClient.LdapUser(
                                "CN=Alice,OU=Users,DC=example,DC=com",
                                "object-id",
                                "alice",
                                null,
                                "Alice",
                                "Example"));

        UserEntity user = service.authenticate("alice", "directory-password");

        assertThat(user.isEmailVerified()).isFalse();

        provider.setVendor("LDAP");
        user.setEnabled(false);
        assertThat(service.authenticate("alice", "directory-password"))
                .isNotNull()
                .isNotSameAs(user);
    }

    @Test
    void coversTransientFallbackAndSameUserEmailCandidate() {
        provider.setImportUsers(false);
        provider.setTrustEmail(true);
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(externalUser("object-id"));

        UserEntity transientUser = service.authenticate("alice", "directory-password");

        assertThat(transientUser.getUsername()).isEqualTo("alice");
        assertThat(transientUser.isEmailVerified()).isTrue();

        UserEntity existing = new UserEntity();
        existing.setId(1L);
        existing.setUsername("alice");
        existing.setEmail("old@example.com");
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("object-id", "old-dn", provider, existing);
        provider.setImportUsers(true);
        when(identityRepository.findByProviderIdAndExternalId("provider-id", "object-id"))
                .thenReturn(Optional.of(identity));
        when(userRepository.findByEmailIgnoreCase("alice@example.com"))
                .thenReturn(Optional.of(existing));

        service.authenticate("alice", "directory-password");

        assertThat(existing.getEmail()).isEqualTo("alice@example.com");
    }

    @Test
    void usesExternalIdWhenBuildingTransientFallbackUsername() {
        provider.setImportUsers(false);
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(
                        new LdapDirectoryClient.LdapUser(
                                "CN=Alice,OU=Users,DC=example,DC=com",
                                "external-id",
                                " ",
                                " ",
                                " ",
                                " "));

        UserEntity user = service.authenticate("alice", "directory-password");

        assertThat(user.getUsername()).isEqualTo("Corporate AD_external-id");
    }

    @Test
    void invokesConfiguredMappersForImportedUsers() {
        LdapFederationMapperService mapperService = mock(LdapFederationMapperService.class);
        service =
                new LdapAuthenticationService(
                        settingsService,
                        directoryClient,
                        identityRepository,
                        userRepository,
                        authorityRepository,
                        mapperService);
        when(directoryClient.authenticate(configuration, "alice", "directory-password"))
                .thenReturn(externalUser("object-id"));

        service.authenticate("alice", "directory-password");

        verify(mapperService)
                .apply(
                        org.mockito.ArgumentMatchers.eq(provider),
                        org.mockito.ArgumentMatchers.eq(configuration),
                        org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any());
    }

    private static LdapDirectoryClient.LdapUser externalUser(String externalId) {
        return new LdapDirectoryClient.LdapUser(
                "CN=Alice,OU=Users,DC=example,DC=com",
                externalId,
                "alice",
                "alice@example.com",
                "Alice",
                "Example");
    }

    private static LdapFederationProviderEntity provider() {
        LdapFederationProviderEntity value = new LdapFederationProviderEntity();
        value.setId("provider-id");
        value.setName("Corporate AD");
        value.setEnabled(true);
        value.setImportUsers(true);
        value.setUsernameAttribute("sAMAccountName");
        value.setUuidAttribute("objectGUID");
        value.setEmailAttribute("mail");
        value.setFirstNameAttribute("givenName");
        value.setLastNameAttribute("sn");
        value.setObjectClasses("person,user");
        value.setSearchScope("SUBTREE");
        value.setEditMode("READ_ONLY");
        return value;
    }
}
