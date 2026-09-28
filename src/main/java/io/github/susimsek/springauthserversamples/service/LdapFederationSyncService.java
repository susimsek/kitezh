package io.github.susimsek.springauthserversamples.service;

import io.github.susimsek.springauthserversamples.domain.LdapFederationProviderEntity;
import io.github.susimsek.springauthserversamples.repository.LdapFederationProviderRepository;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import java.time.Duration;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/** Runs manual and scheduled LDAP imports without introducing realm-scoped state. */
@Service
public class LdapFederationSyncService {

    private final LdapFederationProviderRepository providerRepository;
    private final LdapFederationSettingsService settingsService;
    private final LdapDirectoryClient directoryClient;
    private final LdapAuthenticationService authenticationService;
    private final AdminAuditEventService auditEventService;
    private final TransactionTemplate transactionTemplate;

    @Autowired
    public LdapFederationSyncService(
            LdapFederationProviderRepository providerRepository,
            LdapFederationSettingsService settingsService,
            LdapDirectoryClient directoryClient,
            LdapAuthenticationService authenticationService,
            AdminAuditEventService auditEventService,
            org.springframework.transaction.PlatformTransactionManager transactionManager) {
        this.providerRepository = providerRepository;
        this.settingsService = settingsService;
        this.directoryClient = directoryClient;
        this.authenticationService = authenticationService;
        this.auditEventService = auditEventService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    public SyncResult synchronize(String providerId, SyncMode mode) {
        return transactionTemplate.execute(status -> synchronizeInTransaction(providerId, mode));
    }

    private SyncResult synchronizeInTransaction(String providerId, SyncMode mode) {
        LdapFederationProviderEntity provider = requireProvider(providerId);
        if (!provider.isImportUsers()) {
            return finishSkipped(provider, "Import users is disabled for this provider");
        }
        provider.setLastSyncStatus("RUNNING");
        provider.setLastSyncError(null);
        Instant previousSync = provider.getLastSyncAt();
        providerRepository.save(provider);
        int imported = 0;
        int updated = 0;
        try {
            for (LdapDirectoryClient.LdapUser external :
                    directoryClient.searchUsers(
                            settingsService.configuration(provider, null),
                            mode == SyncMode.CHANGED ? previousSync : null)) {
                if (authenticationService.synchronizeUser(provider, external)) {
                    imported++;
                } else {
                    updated++;
                }
            }
            provider.setLastSyncAt(Instant.now());
            provider.setLastSyncStatus("SUCCESS");
            provider.setLastSyncImported(imported);
            provider.setLastSyncUpdated(updated);
            providerRepository.save(provider);
            auditEventService.record("ldap.sync.completed", "ldap-provider", providerId);
            return new SyncResult(providerId, mode, "SUCCESS", imported, updated, null);
        } catch (RuntimeException exception) {
            provider.setLastSyncAt(Instant.now());
            provider.setLastSyncStatus("FAILED");
            provider.setLastSyncImported(imported);
            provider.setLastSyncUpdated(updated);
            provider.setLastSyncError(message(exception));
            providerRepository.save(provider);
            auditEventService.record("ldap.sync.failed", "ldap-provider", providerId);
            return new SyncResult(
                    providerId, mode, "FAILED", imported, updated, message(exception));
        }
    }

    @Scheduled(fixedDelayString = "${app.ldap.sync.scheduler-delay-ms:60000}")
    public void synchronizeScheduledProviders() {
        Instant now = Instant.now();
        providerRepository.findAllByEnabledTrueOrderByPriorityAscNameAsc().stream()
                .filter(provider -> provider.isImportUsers() && due(provider, now))
                .forEach(provider -> synchronize(provider.getId(), scheduledMode(provider)));
    }

    private static SyncMode scheduledMode(LdapFederationProviderEntity provider) {
        if (provider.getLastSyncAt() == null) {
            return SyncMode.FULL;
        }
        Duration elapsed = Duration.between(provider.getLastSyncAt(), Instant.now());
        if (provider.getFullSyncIntervalMinutes() > 0
                && elapsed.toMinutes() >= provider.getFullSyncIntervalMinutes()) {
            return SyncMode.FULL;
        }
        if (provider.getChangedSyncIntervalMinutes() > 0) {
            return SyncMode.CHANGED;
        }
        return SyncMode.FULL;
    }

    private static boolean due(LdapFederationProviderEntity provider, Instant now) {
        if (provider.getLastSyncAt() == null) {
            return provider.getFullSyncIntervalMinutes() > 0
                    || provider.getChangedSyncIntervalMinutes() > 0;
        }
        Duration elapsed = Duration.between(provider.getLastSyncAt(), now);
        int changedInterval = provider.getChangedSyncIntervalMinutes();
        int fullInterval = provider.getFullSyncIntervalMinutes();
        return (changedInterval > 0 && elapsed.toMinutes() >= changedInterval)
                || (fullInterval > 0 && elapsed.toMinutes() >= fullInterval);
    }

    private SyncResult finishSkipped(LdapFederationProviderEntity provider, String error) {
        provider.setLastSyncAt(Instant.now());
        provider.setLastSyncStatus("SKIPPED");
        provider.setLastSyncImported(0);
        provider.setLastSyncUpdated(0);
        provider.setLastSyncError(error);
        providerRepository.save(provider);
        return new SyncResult(provider.getId(), SyncMode.FULL, "SKIPPED", 0, 0, error);
    }

    private LdapFederationProviderEntity requireProvider(String providerId) {
        return providerRepository
                .findById(providerId)
                .orElseThrow(() -> new IllegalArgumentException("LDAP provider not found"));
    }

    private static String message(RuntimeException exception) {
        return exception.getMessage() == null
                ? exception.getClass().getSimpleName()
                : exception.getMessage();
    }

    public enum SyncMode {
        FULL,
        CHANGED
    }

    public record SyncResult(
            String providerId,
            SyncMode mode,
            String status,
            int imported,
            int updated,
            String error) {}
}
