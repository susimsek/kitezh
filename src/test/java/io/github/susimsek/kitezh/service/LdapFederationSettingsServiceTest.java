package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.security.SocialLoginSecretCipher;
import io.github.susimsek.kitezh.domain.LdapFederationProviderEntity;
import io.github.susimsek.kitezh.dto.admin.AdminLdapConnectionTestRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminLdapProviderRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminLdapProvidersRequestDTO;
import io.github.susimsek.kitezh.repository.LdapFederationProviderRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class LdapFederationSettingsServiceTest {

    private final LdapFederationProviderRepository repository =
            mock(LdapFederationProviderRepository.class);
    private final SocialLoginSecretCipher secretCipher = mock(SocialLoginSecretCipher.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);
    private final LdapDirectoryClient directoryClient = mock(LdapDirectoryClient.class);

    @Test
    void storesConfigurationWithoutExposingTheBindPassword() {
        when(secretCipher.encrypt("bind-password")).thenReturn("v1:encrypted");
        when(repository.save(any(LdapFederationProviderEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        LdapFederationSettingsService service = service();

        var result = service.update(new AdminLdapProvidersRequestDTO(List.of(request(null))));

        assertThat(result)
                .singleElement()
                .satisfies(
                        provider -> {
                            assertThat(provider.name()).isEqualTo("Corporate AD");
                            assertThat(provider.bindPasswordConfigured()).isTrue();
                        });
        verify(secretCipher).encrypt("bind-password");
        verify(auditEventService).record("ldap.provider.updated", "ldap-provider", "all");
    }

    @Test
    void testsAProviderUsingTheSubmittedPassword() {
        LdapFederationSettingsService service = service();

        service.test(new AdminLdapConnectionTestRequestDTO(request(null)));

        verify(directoryClient).testConnection(any(LdapDirectoryClient.Configuration.class));
    }

    @Test
    void mapsProvidersInPriorityOrder() {
        LdapFederationProviderEntity provider = provider("provider-id", "Corporate AD", 10);
        when(repository.findAllByOrderByPriorityAscNameAsc()).thenReturn(List.of(provider));

        assertThat(service().adminSettings())
                .singleElement()
                .satisfies(
                        value -> {
                            assertThat(value.id()).isEqualTo("provider-id");
                            assertThat(value.name()).isEqualTo("Corporate AD");
                            assertThat(value.bindPasswordConfigured()).isTrue();
                        });
    }

    @Test
    void rejectsDuplicateProviderNamesIgnoringCaseAndWhitespace() {
        AdminLdapProviderRequestDTO first = request(null);
        AdminLdapProviderRequestDTO template = request(null);
        AdminLdapProviderRequestDTO second =
                new AdminLdapProviderRequestDTO(
                        null,
                        " corporate ad ",
                        template.enabled(),
                        template.priority(),
                        template.connectionUrl(),
                        template.bindDn(),
                        template.bindPassword(),
                        template.usersDn(),
                        template.usernameAttribute(),
                        template.uuidAttribute(),
                        template.emailAttribute(),
                        template.firstNameAttribute(),
                        template.lastNameAttribute(),
                        template.rdnAttribute(),
                        template.objectClasses(),
                        template.searchScope(),
                        template.editMode(),
                        template.importUsers(),
                        template.trustEmail());

        LdapFederationSettingsService service = service();
        AdminLdapProvidersRequestDTO request =
                new AdminLdapProvidersRequestDTO(List.of(first, second));
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.update(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("LDAP provider names must be unique");
    }

    @Test
    void deletesProvidersThatAreNoLongerRetained() {
        LdapFederationProviderEntity existing = provider("removed-id", "Removed AD", 1);
        when(repository.findAll()).thenReturn(List.of(existing));
        when(repository.findAllByOrderByPriorityAscNameAsc()).thenReturn(List.of());

        service().update(new AdminLdapProvidersRequestDTO(List.of()));

        verify(repository).delete(existing);
        verify(auditEventService).record("ldap.provider.deleted", "ldap-provider", "removed-id");
    }

    @Test
    void deletesAnExistingProviderOrReportsWhenItDoesNotExist() {
        LdapFederationProviderEntity existing = provider("provider-id", "Corporate AD", 10);
        when(repository.findById("provider-id")).thenReturn(Optional.of(existing));

        service().delete("provider-id");

        verify(repository).delete(existing);
        verify(auditEventService).record("ldap.provider.deleted", "ldap-provider", "provider-id");

        when(repository.findById("missing")).thenReturn(Optional.empty());
        LdapFederationSettingsService service = service();
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.delete("missing"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("LDAP provider not found");
    }

    @Test
    void usesStoredBindPasswordUnlessATestPasswordIsProvided() {
        LdapFederationProviderEntity provider = provider("provider-id", "Corporate AD", 10);
        provider.setBindPasswordEncrypted("v1:encrypted");
        when(secretCipher.decrypt("v1:encrypted")).thenReturn("stored-password");

        LdapDirectoryClient.Configuration stored = service().configuration(provider, null);
        LdapDirectoryClient.Configuration candidate =
                service().configuration(provider, "test-password");

        assertThat(stored.bindPassword()).isEqualTo("stored-password");
        assertThat(candidate.bindPassword()).isEqualTo("test-password");
        verify(secretCipher).decrypt("v1:encrypted");
    }

    @Test
    void exposesEnabledProvidersFromTheRepository() {
        LdapFederationProviderEntity provider = provider("provider-id", "Corporate AD", 10);
        when(repository.findAllByEnabledTrueOrderByPriorityAscNameAsc())
                .thenReturn(List.of(provider));

        assertThat(service().enabledProviders()).containsExactly(provider);
    }

    @Test
    void testsAnExistingProviderWithoutPersistingTheCandidate() {
        LdapFederationProviderEntity existing = provider("provider-id", "Corporate AD", 10);
        when(repository.findById("provider-id")).thenReturn(Optional.of(existing));

        service().test(new AdminLdapConnectionTestRequestDTO(request("provider-id")));

        verify(directoryClient).testConnection(any(LdapDirectoryClient.Configuration.class));
        verify(repository, never()).save(any());
    }

    @Test
    void keepsAnExistingProviderWhenItIsRetainedAndDoesNotEncryptBlankPassword() {
        LdapFederationProviderEntity existing = provider("provider-id", "Corporate AD", 10);
        when(repository.findAll()).thenReturn(List.of(existing));
        when(repository.findById("provider-id")).thenReturn(Optional.of(existing));
        when(repository.save(any(LdapFederationProviderEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var result =
                service()
                        .update(
                                new AdminLdapProvidersRequestDTO(
                                        List.of(request("provider-id", " "))));

        assertThat(result)
                .singleElement()
                .satisfies(value -> assertThat(value.bindPasswordConfigured()).isTrue());
        verify(repository, never()).delete(existing);
        verify(secretCipher, never()).encrypt(" ");
    }

    @Test
    void createsAProviderWithoutConfiguredBindPassword() {
        when(repository.save(any(LdapFederationProviderEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var result =
                service().update(new AdminLdapProvidersRequestDTO(List.of(request(null, " "))));

        assertThat(result)
                .singleElement()
                .satisfies(value -> assertThat(value.bindPasswordConfigured()).isFalse());
    }

    @Test
    void usesStoredPasswordWhenTheCandidatePasswordIsBlank() {
        LdapFederationProviderEntity provider = provider("provider-id", "Corporate AD", 10);
        provider.setBindPasswordEncrypted("v1:encrypted");
        when(secretCipher.decrypt("v1:encrypted")).thenReturn("stored-password");

        assertThat(service().configuration(provider, " ").bindPassword())
                .isEqualTo("stored-password");
    }

    @Test
    void rejectsTestsForAnUnknownExistingProvider() {
        when(repository.findById("missing")).thenReturn(Optional.empty());
        LdapFederationSettingsService service = service();
        AdminLdapConnectionTestRequestDTO request =
                new AdminLdapConnectionTestRequestDTO(request("missing"));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.test(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("LDAP provider not found");
    }

    private static LdapFederationProviderEntity provider(String id, String name, int priority) {
        LdapFederationProviderEntity value = new LdapFederationProviderEntity();
        value.setId(id);
        value.setName(name);
        value.setPriority(priority);
        value.setEnabled(true);
        value.setConnectionUrl("ldaps://directory.example.com:636");
        value.setBindDn("CN=bind,DC=example,DC=com");
        value.setBindPasswordEncrypted("v1:encrypted");
        value.setUsersDn("OU=Users,DC=example,DC=com");
        value.setUsernameAttribute("sAMAccountName");
        value.setUuidAttribute("objectGUID");
        value.setEmailAttribute("mail");
        value.setFirstNameAttribute("givenName");
        value.setLastNameAttribute("sn");
        value.setRdnAttribute("sAMAccountName");
        value.setObjectClasses("person,user");
        value.setSearchScope("SUBTREE");
        value.setEditMode("READ_ONLY");
        value.setImportUsers(true);
        return value;
    }

    private LdapFederationSettingsService service() {
        return new LdapFederationSettingsService(
                repository, secretCipher, auditEventService, directoryClient);
    }

    private static AdminLdapProviderRequestDTO request(String id) {
        return request(id, "bind-password");
    }

    private static AdminLdapProviderRequestDTO request(String id, String bindPassword) {
        return new AdminLdapProviderRequestDTO(
                id,
                "Corporate AD",
                false,
                10,
                "ldaps://directory.example.com:636",
                "CN=bind,DC=example,DC=com",
                bindPassword,
                "OU=Users,DC=example,DC=com",
                "sAMAccountName",
                "objectGUID",
                "mail",
                "givenName",
                "sn",
                "sAMAccountName",
                "person,user",
                "SUBTREE",
                "READ_ONLY",
                true,
                false);
    }
}
