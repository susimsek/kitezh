package io.github.susimsek.springauthserversamples.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.LdapFederationProviderEntity;
import io.github.susimsek.springauthserversamples.repository.LdapFederationProviderRepository;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;

class LdapFederationSyncServiceTest {

    private final LdapFederationProviderRepository providerRepository =
            mock(LdapFederationProviderRepository.class);
    private final LdapFederationSettingsService settingsService =
            mock(LdapFederationSettingsService.class);
    private final LdapDirectoryClient directoryClient = mock(LdapDirectoryClient.class);
    private final LdapAuthenticationService authenticationService =
            mock(LdapAuthenticationService.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);
    private final PlatformTransactionManager transactionManager =
            mock(PlatformTransactionManager.class);
    private final TransactionStatus transactionStatus = mock(TransactionStatus.class);
    private final LdapFederationSyncService service =
            new LdapFederationSyncService(
                    providerRepository,
                    settingsService,
                    directoryClient,
                    authenticationService,
                    auditEventService,
                    transactionManager);

    @Test
    void importsAndUpdatesUsersAndStoresSuccessStatus() {
        LdapFederationProviderEntity provider = provider(true);
        LdapDirectoryClient.Configuration configuration =
                mock(LdapDirectoryClient.Configuration.class);
        LdapDirectoryClient.LdapUser imported = user("one");
        LdapDirectoryClient.LdapUser updated = user("two");
        when(transactionManager.getTransaction(any(TransactionDefinition.class)))
                .thenReturn(transactionStatus);
        when(providerRepository.findById("provider-id")).thenReturn(Optional.of(provider));
        when(settingsService.configuration(provider, null)).thenReturn(configuration);
        when(directoryClient.searchUsers(configuration, null))
                .thenReturn(List.of(imported, updated));
        when(authenticationService.synchronizeUser(provider, imported)).thenReturn(true);
        when(authenticationService.synchronizeUser(provider, updated)).thenReturn(false);
        doNothing().when(transactionManager).commit(transactionStatus);

        LdapFederationSyncService.SyncResult result =
                service.synchronize("provider-id", LdapFederationSyncService.SyncMode.FULL);

        assertThat(result)
                .extracting(
                        LdapFederationSyncService.SyncResult::status,
                        LdapFederationSyncService.SyncResult::imported,
                        LdapFederationSyncService.SyncResult::updated)
                .containsExactly("SUCCESS", 1, 1);
        assertThat(provider.getLastSyncStatus()).isEqualTo("SUCCESS");
        verify(auditEventService).record("ldap.sync.completed", "ldap-provider", "provider-id");
    }

    @Test
    void skipsSynchronizationWhenImportIsDisabled() {
        LdapFederationProviderEntity provider = provider(false);
        when(transactionManager.getTransaction(any(TransactionDefinition.class)))
                .thenReturn(transactionStatus);
        when(providerRepository.findById("provider-id")).thenReturn(Optional.of(provider));
        doNothing().when(transactionManager).commit(transactionStatus);

        LdapFederationSyncService.SyncResult result =
                service.synchronize("provider-id", LdapFederationSyncService.SyncMode.FULL);

        assertThat(result.status()).isEqualTo("SKIPPED");
        assertThat(provider.getLastSyncError()).contains("disabled");
    }

    private static LdapFederationProviderEntity provider(boolean importUsers) {
        LdapFederationProviderEntity provider = new LdapFederationProviderEntity();
        provider.setId("provider-id");
        provider.setImportUsers(importUsers);
        return provider;
    }

    private static LdapDirectoryClient.LdapUser user(String username) {
        return new LdapDirectoryClient.LdapUser(
                "uid=" + username, username, username, username + "@example.com", "First", "Last");
    }
}
