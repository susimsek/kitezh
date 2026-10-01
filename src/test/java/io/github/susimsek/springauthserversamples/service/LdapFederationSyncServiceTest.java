package io.github.susimsek.springauthserversamples.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.LdapFederationProviderEntity;
import io.github.susimsek.springauthserversamples.repository.LdapFederationProviderRepository;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import java.time.Instant;
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

    @Test
    void importsChangedUsersUsingPreviousSyncAndHandlesFailures() {
        LdapFederationProviderEntity provider = provider(true);
        Instant previousSync = Instant.now().minusSeconds(60);
        provider.setLastSyncAt(previousSync);
        LdapDirectoryClient.Configuration configuration =
                mock(LdapDirectoryClient.Configuration.class);
        when(transactionManager.getTransaction(any(TransactionDefinition.class)))
                .thenReturn(transactionStatus);
        when(providerRepository.findById("provider-id")).thenReturn(Optional.of(provider));
        when(settingsService.configuration(provider, null)).thenReturn(configuration);
        when(directoryClient.searchUsers(configuration, previousSync)).thenReturn(List.of());
        doNothing().when(transactionManager).commit(transactionStatus);

        LdapFederationSyncService.SyncResult changed =
                service.synchronize("provider-id", LdapFederationSyncService.SyncMode.CHANGED);

        assertThat(changed.status()).isEqualTo("SUCCESS");
        verify(directoryClient).searchUsers(configuration, previousSync);

        when(directoryClient.searchUsers(configuration, null))
                .thenThrow(new IllegalStateException());
        LdapFederationSyncService.SyncResult failed =
                service.synchronize("provider-id", LdapFederationSyncService.SyncMode.FULL);

        assertThat(failed)
                .extracting(
                        LdapFederationSyncService.SyncResult::status,
                        LdapFederationSyncService.SyncResult::error)
                .containsExactly("FAILED", "IllegalStateException");
        verify(auditEventService).record("ldap.sync.failed", "ldap-provider", "provider-id");
    }

    @Test
    void synchronizesDueScheduledProvidersWithFullAndChangedModes() {
        LdapFederationProviderEntity full = provider(true);
        full.setId("full-provider");
        full.setFullSyncIntervalMinutes(1);
        LdapFederationProviderEntity changed = provider(true);
        changed.setId("changed-provider");
        changed.setLastSyncAt(Instant.now().minusSeconds(120));
        changed.setChangedSyncIntervalMinutes(1);
        LdapFederationProviderEntity disabled = provider(false);
        disabled.setId("disabled-provider");
        LdapDirectoryClient.Configuration configuration =
                mock(LdapDirectoryClient.Configuration.class);
        when(providerRepository.findAllByEnabledTrueOrderByPriorityAscNameAsc())
                .thenReturn(List.of(full, changed, disabled));
        when(transactionManager.getTransaction(any(TransactionDefinition.class)))
                .thenReturn(transactionStatus);
        when(providerRepository.findById("full-provider")).thenReturn(Optional.of(full));
        when(providerRepository.findById("changed-provider")).thenReturn(Optional.of(changed));
        when(settingsService.configuration(any(), isNull())).thenReturn(configuration);
        when(directoryClient.searchUsers(any(), any())).thenReturn(List.of());
        doNothing().when(transactionManager).commit(transactionStatus);

        Instant changedSync = changed.getLastSyncAt();
        service.synchronizeScheduledProviders();

        verify(directoryClient).searchUsers(configuration, null);
        verify(directoryClient).searchUsers(configuration, changedSync);
        verify(auditEventService).record("ldap.sync.completed", "ldap-provider", "full-provider");
        verify(auditEventService)
                .record("ldap.sync.completed", "ldap-provider", "changed-provider");
    }

    @Test
    void rejectsUnknownProvider() {
        when(transactionManager.getTransaction(any(TransactionDefinition.class)))
                .thenReturn(transactionStatus);
        when(providerRepository.findById("missing")).thenReturn(Optional.empty());

        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () ->
                                service.synchronize(
                                        "missing", LdapFederationSyncService.SyncMode.FULL))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("LDAP provider not found");
    }

    @Test
    void schedulesOnlyProvidersThatAreDueAndSelectsFullModeWhenIntervalElapsed() {
        LdapFederationProviderEntity notDue = provider(true);
        notDue.setId("not-due");
        notDue.setLastSyncAt(Instant.now());
        LdapFederationProviderEntity full = provider(true);
        full.setId("full");
        full.setLastSyncAt(Instant.now().minusSeconds(120));
        full.setFullSyncIntervalMinutes(1);
        full.setChangedSyncIntervalMinutes(1);
        when(providerRepository.findAllByEnabledTrueOrderByPriorityAscNameAsc())
                .thenReturn(List.of(notDue, full));
        when(transactionManager.getTransaction(any(TransactionDefinition.class)))
                .thenReturn(transactionStatus);
        when(providerRepository.findById("full")).thenReturn(Optional.of(full));
        LdapDirectoryClient.Configuration configuration =
                mock(LdapDirectoryClient.Configuration.class);
        when(settingsService.configuration(full, null)).thenReturn(configuration);
        when(directoryClient.searchUsers(configuration, null)).thenReturn(List.of());
        doNothing().when(transactionManager).commit(transactionStatus);

        service.synchronizeScheduledProviders();

        verify(directoryClient).searchUsers(configuration, null);
        verify(providerRepository, never()).findById("not-due");
    }

    @Test
    void reportsExceptionTypeWhenSynchronizationFailureHasNoMessage() {
        LdapFederationProviderEntity provider = provider(true);
        LdapDirectoryClient.Configuration configuration =
                mock(LdapDirectoryClient.Configuration.class);
        when(transactionManager.getTransaction(any(TransactionDefinition.class)))
                .thenReturn(transactionStatus);
        when(providerRepository.findById("provider-id")).thenReturn(Optional.of(provider));
        when(settingsService.configuration(provider, null)).thenReturn(configuration);
        when(directoryClient.searchUsers(configuration, null))
                .thenThrow(new IllegalStateException());
        doNothing().when(transactionManager).commit(transactionStatus);

        LdapFederationSyncService.SyncResult result =
                service.synchronize("provider-id", LdapFederationSyncService.SyncMode.FULL);

        assertThat(result.error()).isEqualTo("IllegalStateException");
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
