package io.github.susimsek.kitezh.service;

import io.github.susimsek.kitezh.config.security.SocialLoginSecretCipher;
import io.github.susimsek.kitezh.domain.LdapFederationProviderEntity;
import io.github.susimsek.kitezh.dto.admin.AdminLdapConnectionTestRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminLdapProviderDTO;
import io.github.susimsek.kitezh.dto.admin.AdminLdapProviderRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminLdapProvidersRequestDTO;
import io.github.susimsek.kitezh.repository.LdapFederationProviderRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LdapFederationSettingsService {

    private static final String LDAP_PROVIDER_RESOURCE = "ldap-provider";

    private final LdapFederationProviderRepository repository;
    private final SocialLoginSecretCipher secretCipher;
    private final AdminAuditEventService auditEventService;
    private final LdapDirectoryClient directoryClient;

    @Transactional(readOnly = true)
    public List<AdminLdapProviderDTO> adminSettings() {
        return repository.findAllByOrderByPriorityAscNameAsc().stream().map(this::toDto).toList();
    }

    @Transactional
    public List<AdminLdapProviderDTO> update(AdminLdapProvidersRequestDTO request) {
        List<AdminLdapProviderRequestDTO> providers = request.providers();
        assertUniqueNames(providers);
        Set<String> retainedIds =
                providers.stream()
                        .map(AdminLdapProviderRequestDTO::id)
                        .filter(Objects::nonNull)
                        .filter(id -> !id.isBlank())
                        .collect(java.util.stream.Collectors.toSet());
        repository.findAll().stream()
                .filter(existing -> !retainedIds.contains(existing.getId()))
                .forEach(
                        existing -> {
                            repository.delete(existing);
                            auditEventService.record(
                                    "ldap.provider.deleted",
                                    LDAP_PROVIDER_RESOURCE,
                                    existing.getId());
                        });
        List<LdapFederationProviderEntity> saved = new ArrayList<>();
        for (AdminLdapProviderRequestDTO value : providers) {
            LdapFederationProviderEntity entity = findOrCreate(value.id());
            apply(value, entity);
            saved.add(repository.save(entity));
        }
        auditEventService.record("ldap.provider.updated", LDAP_PROVIDER_RESOURCE, "all");
        return saved.stream().sorted(providerOrder()).map(this::toDto).toList();
    }

    @Transactional
    public void delete(String id) {
        LdapFederationProviderEntity entity =
                repository
                        .findById(id)
                        .orElseThrow(() -> new IllegalArgumentException("LDAP provider not found"));
        repository.delete(entity);
        auditEventService.record("ldap.provider.deleted", LDAP_PROVIDER_RESOURCE, id);
    }

    public void test(AdminLdapConnectionTestRequestDTO request) {
        AdminLdapProviderRequestDTO value = request.provider();
        LdapFederationProviderEntity entity = findOrCreateForTest(value);
        apply(value, entity);
        directoryClient.testConnection(configuration(entity, value.bindPassword()));
    }

    @Transactional(readOnly = true)
    public List<LdapFederationProviderEntity> enabledProviders() {
        return repository.findAllByEnabledTrueOrderByPriorityAscNameAsc();
    }

    String bindPassword(LdapFederationProviderEntity provider) {
        return secretCipher.decrypt(provider.getBindPasswordEncrypted());
    }

    String trustStorePassword(LdapFederationProviderEntity provider) {
        return secretCipher.decrypt(provider.getTrustStorePasswordEncrypted());
    }

    LdapDirectoryClient.Configuration configuration(
            LdapFederationProviderEntity provider, String candidatePassword) {
        String password =
                candidatePassword == null || candidatePassword.isBlank()
                        ? bindPassword(provider)
                        : candidatePassword;
        return new LdapDirectoryClient.Configuration(
                provider.getConnectionUrl(),
                provider.getBindDn(),
                password,
                provider.getUsersDn(),
                provider.getUsernameAttribute(),
                provider.getUuidAttribute(),
                provider.getEmailAttribute(),
                provider.getFirstNameAttribute(),
                provider.getLastNameAttribute(),
                provider.getRdnAttribute(),
                provider.getObjectClasses(),
                provider.getSearchScope(),
                provider.getVendor(),
                provider.getAuthenticationType(),
                provider.isStartTls(),
                provider.getTrustStorePath(),
                trustStorePassword(provider),
                provider.getTrustStoreType(),
                provider.isConnectionPooling(),
                provider.getReferral(),
                provider.getConnectTimeoutMs(),
                provider.getReadTimeoutMs(),
                provider.getBatchSize());
    }

    private LdapFederationProviderEntity findOrCreate(String id) {
        if (id == null || id.isBlank()) {
            return new LdapFederationProviderEntity();
        }
        return repository
                .findById(id)
                .orElseThrow(() -> new IllegalArgumentException("LDAP provider not found"));
    }

    private LdapFederationProviderEntity findOrCreateForTest(AdminLdapProviderRequestDTO value) {
        return value.id() == null || value.id().isBlank()
                ? new LdapFederationProviderEntity()
                : findOrCreate(value.id());
    }

    private void apply(AdminLdapProviderRequestDTO value, LdapFederationProviderEntity entity) {
        entity.setName(value.name().trim());
        entity.setEnabled(value.enabled());
        entity.setPriority(value.priority());
        entity.setConnectionUrl(value.connectionUrl().trim());
        entity.setBindDn(normalize(value.bindDn()));
        entity.setUsersDn(value.usersDn().trim());
        entity.setUsernameAttribute(value.usernameAttribute().trim());
        entity.setUuidAttribute(value.uuidAttribute().trim());
        entity.setEmailAttribute(value.emailAttribute().trim());
        entity.setFirstNameAttribute(value.firstNameAttribute().trim());
        entity.setLastNameAttribute(value.lastNameAttribute().trim());
        entity.setRdnAttribute(value.rdnAttribute().trim());
        entity.setObjectClasses(value.objectClasses().trim());
        entity.setSearchScope(value.searchScope().toUpperCase(Locale.ROOT));
        entity.setEditMode(value.editMode().toUpperCase(Locale.ROOT));
        entity.setImportUsers(value.importUsers());
        entity.setTrustEmail(value.trustEmail());
        entity.setSyncRegistrations(value.syncRegistrations());
        entity.setFullSyncIntervalMinutes(value.fullSyncIntervalMinutes());
        entity.setChangedSyncIntervalMinutes(value.changedSyncIntervalMinutes());
        entity.setVendor(value.vendor().toUpperCase(Locale.ROOT));
        entity.setAuthenticationType(value.authenticationType().toUpperCase(Locale.ROOT));
        entity.setStartTls(value.startTls());
        entity.setTrustStorePath(normalize(value.trustStorePath()));
        entity.setTrustStoreType(value.trustStoreType().toUpperCase(Locale.ROOT));
        entity.setConnectionPooling(value.connectionPooling());
        entity.setReferral(value.referral().toUpperCase(Locale.ROOT));
        entity.setConnectTimeoutMs(value.connectTimeoutMs());
        entity.setReadTimeoutMs(value.readTimeoutMs());
        entity.setBatchSize(value.batchSize());
        if (value.bindPassword() != null && !value.bindPassword().isBlank()) {
            entity.setBindPasswordEncrypted(secretCipher.encrypt(value.bindPassword()));
        }
        if (value.trustStorePassword() != null && !value.trustStorePassword().isBlank()) {
            entity.setTrustStorePasswordEncrypted(secretCipher.encrypt(value.trustStorePassword()));
        }
    }

    private AdminLdapProviderDTO toDto(LdapFederationProviderEntity value) {
        return new AdminLdapProviderDTO(
                value.getId(),
                value.getName(),
                value.isEnabled(),
                value.getPriority(),
                value.getConnectionUrl(),
                value.getBindDn(),
                value.getBindPasswordEncrypted() != null
                        && !value.getBindPasswordEncrypted().isBlank(),
                value.getUsersDn(),
                value.getUsernameAttribute(),
                value.getUuidAttribute(),
                value.getEmailAttribute(),
                value.getFirstNameAttribute(),
                value.getLastNameAttribute(),
                value.getRdnAttribute(),
                value.getObjectClasses(),
                value.getSearchScope(),
                value.getEditMode(),
                value.isImportUsers(),
                value.isTrustEmail(),
                value.isSyncRegistrations(),
                value.getFullSyncIntervalMinutes(),
                value.getChangedSyncIntervalMinutes(),
                value.getLastSyncAt(),
                value.getLastSyncStatus(),
                value.getLastSyncError(),
                value.getLastSyncImported(),
                value.getLastSyncUpdated(),
                value.getVendor(),
                value.getAuthenticationType(),
                value.isStartTls(),
                value.getTrustStorePath(),
                value.getTrustStoreType(),
                value.isConnectionPooling(),
                value.getReferral(),
                value.getConnectTimeoutMs(),
                value.getReadTimeoutMs(),
                value.getBatchSize());
    }

    private static void assertUniqueNames(List<AdminLdapProviderRequestDTO> providers) {
        long distinct =
                providers.stream()
                        .map(AdminLdapProviderRequestDTO::name)
                        .filter(Objects::nonNull)
                        .map(value -> value.trim().toLowerCase(Locale.ROOT))
                        .distinct()
                        .count();
        if (distinct != providers.size()) {
            throw new IllegalArgumentException("LDAP provider names must be unique");
        }
    }

    private static Comparator<LdapFederationProviderEntity> providerOrder() {
        return Comparator.comparingInt(LdapFederationProviderEntity::getPriority)
                .thenComparing(
                        LdapFederationProviderEntity::getName, String.CASE_INSENSITIVE_ORDER);
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
