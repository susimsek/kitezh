package io.github.susimsek.springauthserversamples.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Application-wide LDAP or Active Directory user federation configuration. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "ldap_federation_providers")
public class LdapFederationProviderEntity extends AuditableEntity {

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id = UUID.randomUUID().toString();

    @Column(name = "name", nullable = false, unique = true, length = 100)
    private String name;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Column(name = "priority", nullable = false)
    private int priority;

    @Column(name = "connection_url", nullable = false, length = 1000)
    private String connectionUrl;

    @Column(name = "bind_dn", length = 500)
    private String bindDn;

    @Column(name = "bind_password_encrypted", length = 2000)
    private String bindPasswordEncrypted;

    @Column(name = "users_dn", nullable = false, length = 1000)
    private String usersDn;

    @Column(name = "username_attribute", nullable = false, length = 100)
    private String usernameAttribute = "uid";

    @Column(name = "uuid_attribute", nullable = false, length = 100)
    private String uuidAttribute = "entryUUID";

    @Column(name = "email_attribute", nullable = false, length = 100)
    private String emailAttribute = "mail";

    @Column(name = "first_name_attribute", nullable = false, length = 100)
    private String firstNameAttribute = "givenName";

    @Column(name = "last_name_attribute", nullable = false, length = 100)
    private String lastNameAttribute = "sn";

    @Column(name = "rdn_attribute", nullable = false, length = 100)
    private String rdnAttribute = "uid";

    @Column(name = "object_classes", nullable = false, length = 1000)
    private String objectClasses = "inetOrgPerson";

    @Column(name = "search_scope", nullable = false, length = 20)
    private String searchScope = "SUBTREE";

    @Column(name = "edit_mode", nullable = false, length = 20)
    private String editMode = "READ_ONLY";

    @Column(name = "import_users", nullable = false)
    private boolean importUsers = true;

    @Column(name = "trust_email", nullable = false)
    private boolean trustEmail;

    @Column(name = "sync_registrations", nullable = false)
    private boolean syncRegistrations;

    @Column(name = "full_sync_interval_minutes", nullable = false)
    private int fullSyncIntervalMinutes;

    @Column(name = "changed_sync_interval_minutes", nullable = false)
    private int changedSyncIntervalMinutes;

    @Column(name = "vendor", nullable = false, length = 30)
    private String vendor = "LDAP";

    @Column(name = "authentication_type", nullable = false, length = 30)
    private String authenticationType = "SIMPLE";

    @Column(name = "start_tls", nullable = false)
    private boolean startTls;

    @Column(name = "trust_store_path", length = 1000)
    private String trustStorePath;

    @Column(name = "trust_store_password_encrypted", length = 2000)
    private String trustStorePasswordEncrypted;

    @Column(name = "trust_store_type", nullable = false, length = 20)
    private String trustStoreType = "JKS";

    @Column(name = "connection_pooling", nullable = false)
    private boolean connectionPooling;

    @Column(name = "referral", nullable = false, length = 20)
    private String referral = "THROW";

    @Column(name = "connect_timeout_ms", nullable = false)
    private int connectTimeoutMs = 5000;

    @Column(name = "read_timeout_ms", nullable = false)
    private int readTimeoutMs = 5000;

    @Column(name = "batch_size", nullable = false)
    private int batchSize = 500;

    @Column(name = "last_sync_at")
    private Instant lastSyncAt;

    @Column(name = "last_sync_status", length = 30)
    private String lastSyncStatus;

    @Column(name = "last_sync_error", length = 2000)
    private String lastSyncError;

    @Column(name = "last_sync_imported", nullable = false)
    private int lastSyncImported;

    @Column(name = "last_sync_updated", nullable = false)
    private int lastSyncUpdated;
}
