package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@Table(name = "social_identity_providers")
public class SocialProviderEntity extends AuditableEntity {

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id = UUID.randomUUID().toString();

    @Column(name = "registration_id", nullable = false, unique = true, length = 100)
    private String registrationId;

    @Column(name = "provider_type", nullable = false, length = 50)
    private String providerType;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(name = "alias", nullable = false, unique = true, length = 50)
    private String alias;

    @Column(name = "icon_key", nullable = false, length = 40)
    private String iconKey = "generic";

    @Column(name = "short_state_parameter", nullable = false)
    private boolean shortStateParameter;

    @Column(name = "case_sensitive_username", nullable = false)
    private boolean caseSensitiveUsername;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Column(name = "hide_on_login", nullable = false)
    private boolean hideOnLogin;

    @Column(name = "account_linking_only", nullable = false)
    private boolean accountLinkingOnly;

    @Column(name = "trust_email", nullable = false)
    private boolean trustEmail;

    @Column(name = "mfa_required", nullable = false)
    private boolean mfaRequired;

    @Column(name = "required_claims", nullable = false, length = 500)
    private String requiredClaims = "sub";

    @Column(name = "store_tokens", nullable = false)
    private boolean storeTokens;

    @Column(name = "stored_tokens_readable", nullable = false)
    private boolean storedTokensReadable;

    @Column(name = "gui_order", nullable = false)
    private int guiOrder;

    @Column(name = "show_in_account_console", nullable = false, length = 20)
    private String showInAccountConsole = "always";

    @Column(name = "sync_mode", nullable = false, length = 20)
    private String syncMode = "import";

    @Column(name = "client_id", length = 500)
    private String clientId;

    @Column(name = "client_secret_encrypted", length = 2000)
    private String clientSecretEncrypted;

    @Column(name = "authorization_uri", length = 1000)
    private String authorizationUri;

    @Column(name = "token_uri", length = 1000)
    private String tokenUri;

    @Column(name = "user_info_uri", length = 1000)
    private String userInfoUri;

    @Column(name = "jwk_set_uri", length = 1000)
    private String jwkSetUri;

    @Column(name = "issuer_uri", length = 1000)
    private String issuerUri;

    @Column(name = "client_authentication_method", nullable = false, length = 30)
    private String clientAuthenticationMethod = "client_secret_basic";

    @Column(name = "scopes", nullable = false, length = 1000)
    private String scopes = "openid,profile,email";

    @Column(name = "user_name_attribute", nullable = false, length = 100)
    private String userNameAttribute = "sub";
}
