package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Application-wide SAML relying-party configuration for an identity provider. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "saml_identity_provider_configs")
public class SamlProviderConfigEntity {

    @Id
    @Column(name = "provider_id", nullable = false, length = 36)
    private String providerId;

    @Column(name = "metadata_uri", length = 2000)
    private String metadataUri;

    @Column(name = "asserting_party_entity_id", length = 1000)
    private String assertingPartyEntityId;

    @Column(name = "single_sign_on_service_url", length = 2000)
    private String singleSignOnServiceUrl;

    @Column(name = "single_logout_service_url", length = 2000)
    private String singleLogoutServiceUrl;

    @Column(name = "idp_certificate", length = 12000)
    private String idpCertificate;

    @Column(name = "signing_private_key_encrypted", length = 20000)
    private String signingPrivateKeyEncrypted;

    @Column(name = "signing_certificate", length = 12000)
    private String signingCertificate;

    @Column(name = "decryption_private_key_encrypted", length = 20000)
    private String decryptionPrivateKeyEncrypted;

    @Column(name = "decryption_certificate", length = 12000)
    private String decryptionCertificate;

    @Column(name = "service_provider_entity_id", length = 1000)
    private String serviceProviderEntityId;

    @Column(name = "sign_authn_requests", nullable = false)
    private boolean signAuthnRequests;

    @Column(name = "want_assertions_signed", nullable = false)
    private boolean wantAssertionsSigned = true;

    @Column(name = "signature_algorithm", length = 500)
    private String signatureAlgorithm;

    @Column(name = "authn_request_binding", length = 20)
    private String authnRequestBinding = "REDIRECT";

    @Column(name = "response_binding", length = 20)
    private String responseBinding = "POST";

    @Column(name = "logout_binding", length = 20)
    private String logoutBinding = "REDIRECT";

    @Column(name = "force_authentication", nullable = false)
    private boolean forceAuthentication;

    @Column(name = "pass_subject", nullable = false)
    private boolean passSubject;

    @Column(name = "name_id_format", length = 200)
    private String nameIdFormat;

    @Column(name = "principal_attribute", length = 200)
    private String principalAttribute = "NameID";

    @Column(name = "email_attribute", length = 200)
    private String emailAttribute = "email";

    @Column(name = "first_name_attribute", length = 200)
    private String firstNameAttribute = "givenName";

    @Column(name = "last_name_attribute", length = 200)
    private String lastNameAttribute = "sn";

    @Column(name = "groups_attribute", length = 200)
    private String groupsAttribute = "groups";
}
