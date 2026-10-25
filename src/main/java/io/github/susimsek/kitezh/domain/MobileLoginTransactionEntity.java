package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "mobile_login_transactions")
public class MobileLoginTransactionEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "registered_client_id", nullable = false, length = 100)
    private String registeredClientId;

    @Column(name = "principal_name", nullable = false, length = 200)
    private String principalName;

    @Column(name = "redirect_uri", nullable = false, length = 2048)
    private String redirectUri;

    @Column(name = "scope", nullable = false, length = 1000)
    private String scope;

    @Column(name = "state", nullable = false, length = 256)
    private String state;

    @Column(name = "code_challenge", nullable = false, length = 43)
    private String codeChallenge;

    @Column(name = "nonce", nullable = false, length = 256)
    private String nonce;

    @Column(name = "platform", nullable = false, length = 16)
    private String platform;

    @Column(name = "challenge_kind", nullable = false, length = 32)
    private String challengeKind;

    @Column(name = "pending_action_keys", length = 1000)
    private String pendingActionKeys;

    @Column(name = "mfa_verified", nullable = false)
    private boolean mfaVerified;

    @Column(name = "provider_mfa_required", nullable = false)
    private boolean providerMfaRequired;

    @Column(name = "recovery_codes_issued", nullable = false)
    private boolean recoveryCodesIssued;

    @Column(name = "webauthn_options", length = 32000)
    private String webAuthnOptions;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;
}
