package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.SamlProviderConfigEntity;
import io.github.susimsek.kitezh.domain.SocialProviderEntity;
import io.github.susimsek.kitezh.repository.SamlProviderConfigRepository;
import io.github.susimsek.kitezh.repository.SocialProviderRepository;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.security.KeyPairGenerator;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.saml2.Saml2Exception;
import org.springframework.security.saml2.provider.service.registration.Saml2MessageBinding;
import org.springframework.web.client.RestClient;

@ExtendWith(MockitoExtension.class)
class SamlRelyingPartyRegistrationRepositoryTest {

    @Mock private SocialProviderRepository providerRepository;

    @Mock private SamlProviderConfigRepository configRepository;

    @Mock private SocialLoginSecretCipher secretCipher;

    @Test
    void returnsNullForUnknownRegistrationId() {
        when(providerRepository.findByAliasIgnoreCase("missing")).thenReturn(Optional.empty());
        when(providerRepository.findByRegistrationId("missing")).thenReturn(Optional.empty());

        SamlRelyingPartyRegistrationRepository repository = repository();

        assertThat(repository.findByRegistrationId("missing")).isNull();
        assertThat(repository.findByRegistrationId(null)).isNull();
        assertThat(repository.findByRegistrationId(" ")).isNull();
    }

    @Test
    void refreshQueriesTheApplicationWideSamlProviderCatalog() {
        when(providerRepository.findAllByProviderTypeIgnoreCaseAndEnabledTrueOrderByGuiOrderAsc(
                        "saml"))
                .thenReturn(List.of());

        repository().refresh();

        verify(providerRepository)
                .findAllByProviderTypeIgnoreCaseAndEnabledTrueOrderByGuiOrderAsc("saml");
    }

    @Test
    void returnsConfiguredAssertionSignatureRequirement() {
        SocialProviderEntity provider = new SocialProviderEntity();
        provider.setAlias("saml");
        provider.setProviderType("saml");
        provider.setEnabled(true);
        SamlProviderConfigEntity config = new SamlProviderConfigEntity();
        config.setWantAssertionsSigned(false);
        when(providerRepository.findByAliasIgnoreCase("saml")).thenReturn(Optional.of(provider));
        when(configRepository.findByProviderId(provider.getId())).thenReturn(Optional.of(config));

        assertThat(repository().requiresSignedAssertions("saml")).isFalse();
    }

    @Test
    void loadsManualApplicationWideRegistrationWithOptionalSettings() {
        SocialProviderEntity provider = provider();
        SamlProviderConfigEntity config = manualConfig(provider);
        when(providerRepository.findAllByProviderTypeIgnoreCaseAndEnabledTrueOrderByGuiOrderAsc(
                        "saml"))
                .thenReturn(List.of(provider));
        when(configRepository.findByProviderId(provider.getId())).thenReturn(Optional.of(config));

        SamlRelyingPartyRegistrationRepository repository = repository();
        repository.refresh();

        var registration = repository.findByRegistrationId(provider.getRegistrationId());
        assertThat(registration).isNotNull();
        assertThat(registration.getRegistrationId()).isEqualTo(provider.getAlias());
        assertThat(registration.getAssertingPartyMetadata().getEntityId())
                .isEqualTo(config.getAssertingPartyEntityId());
        assertThat(registration.getSingleLogoutServiceLocation())
                .isEqualTo("{baseUrl}/logout/saml2/slo/{registrationId}");
        assertThat(registration.getAssertingPartyMetadata().getSingleLogoutServiceLocation())
                .isEqualTo(config.getSingleLogoutServiceUrl());
        assertThat(repository.requiresSignedAssertions(provider.getAlias())).isTrue();
    }

    @Test
    void ignoresInvalidManualRegistrationAndDefaultsUnknownAssertionRequirementToTrue() {
        SocialProviderEntity provider = provider();
        SamlProviderConfigEntity config = new SamlProviderConfigEntity();
        config.setProviderId(provider.getId());
        config.setAssertingPartyEntityId("");
        config.setSingleSignOnServiceUrl(null);
        when(providerRepository.findByAliasIgnoreCase(provider.getAlias()))
                .thenReturn(Optional.of(provider));
        when(configRepository.findByProviderId(provider.getId())).thenReturn(Optional.of(config));

        assertThat(repository().findByRegistrationId(provider.getAlias())).isNull();
        assertThat(repository().requiresSignedAssertions(provider.getAlias())).isTrue();
    }

    @Test
    void removesOptionalContactPersonElementsFromIncompatibleMetadata() {
        String metadata =
                "<EntityDescriptor><ContactPerson contactType=\"technical\">"
                        + "<GivenName>Administrator</GivenName></ContactPerson>"
                        + "<IDPSSODescriptor/></EntityDescriptor>";

        assertThat(SamlRelyingPartyRegistrationRepository.removeContactPersonElements(metadata))
                .isEqualTo("<EntityDescriptor><IDPSSODescriptor/></EntityDescriptor>");
    }

    @Test
    void parsesCertificatesKeysBindingsAndMetadataCompatibilityFailures() throws Exception {
        assertThat((List<?>) invoke("certificates", new Class<?>[] {String.class}, CERTIFICATE))
                .hasSize(1);
        assertThat(invoke("binding", new Class<?>[] {String.class}, "POST"))
                .isEqualTo(Saml2MessageBinding.POST);
        assertThat(invoke("binding", new Class<?>[] {String.class}, "REDIRECT"))
                .isEqualTo(Saml2MessageBinding.REDIRECT);
        assertThat(invoke("binding", new Class<?>[] {String.class}, " "))
                .isEqualTo(Saml2MessageBinding.REDIRECT);
        invoke("binding", new Class<?>[] {String.class}, "SOAP");
        assertThat(invoke("hasText", new Class<?>[] {String.class}, "value")).isEqualTo(true);
        assertThat(invoke("hasText", new Class<?>[] {String.class}, " ")).isEqualTo(false);
        assertThat(
                        invoke(
                                "isContactPersonCompatibilityIssue",
                                new Class<?>[] {Throwable.class},
                                new Saml2Exception("invalid value for contactType attribute")))
                .isEqualTo(true);

        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        String key =
                "-----BEGIN PRIVATE KEY-----\n"
                        + Base64.getMimeEncoder(64, new byte[] {'\n'})
                                .encodeToString(
                                        generator.generateKeyPair().getPrivate().getEncoded())
                        + "\n-----END PRIVATE KEY-----";
        assertThat(invoke("privateKey", new Class<?>[] {String.class}, key)).isNotNull();
        KeyPairGenerator ecGenerator = KeyPairGenerator.getInstance("EC");
        ecGenerator.initialize(256);
        String ecKey =
                "-----BEGIN PRIVATE KEY-----\n"
                        + Base64.getMimeEncoder(64, new byte[] {'\n'})
                                .encodeToString(
                                        ecGenerator.generateKeyPair().getPrivate().getEncoded())
                        + "\n-----END PRIVATE KEY-----";
        assertThat(invoke("privateKey", new Class<?>[] {String.class}, ecKey)).isNotNull();
        assertThatThrownBy(() -> invoke("privateKey", new Class<?>[] {String.class}, "invalid"))
                .isInstanceOf(InvocationTargetException.class)
                .hasCauseInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> invoke("certificates", new Class<?>[] {String.class}, "invalid"))
                .isInstanceOf(InvocationTargetException.class)
                .hasCauseInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void ignoresProviderWhenMetadataLocationCannotBeLoaded() {
        SocialProviderEntity provider = provider();
        SamlProviderConfigEntity config = new SamlProviderConfigEntity();
        config.setProviderId(provider.getId());
        config.setMetadataUri("https://idp.example.test/metadata");
        when(providerRepository.findAllByProviderTypeIgnoreCaseAndEnabledTrueOrderByGuiOrderAsc(
                        "saml"))
                .thenReturn(List.of(provider));
        when(configRepository.findByProviderId(provider.getId())).thenReturn(Optional.of(config));

        SamlRelyingPartyRegistrationRepository repository = repository();
        repository.refresh();

        assertThat(repository.findByRegistrationId(provider.getAlias())).isNull();
    }

    @Test
    void loadsRegistrationWithSigningAndDecryptionCredentials() throws Exception {
        SocialProviderEntity provider = provider();
        SamlProviderConfigEntity config = manualConfig(provider);
        final String privateKey = privateKeyPem();
        config.setSignAuthnRequests(true);
        config.setSigningPrivateKeyEncrypted("encrypted-signing-key");
        config.setSigningCertificate(CERTIFICATE);
        config.setDecryptionPrivateKeyEncrypted("encrypted-decryption-key");
        config.setDecryptionCertificate(CERTIFICATE);
        when(secretCipher.decrypt("encrypted-signing-key")).thenReturn(privateKey);
        when(secretCipher.decrypt("encrypted-decryption-key")).thenReturn(privateKey);
        when(providerRepository.findAllByProviderTypeIgnoreCaseAndEnabledTrueOrderByGuiOrderAsc(
                        "saml"))
                .thenReturn(List.of(provider));
        when(configRepository.findByProviderId(provider.getId())).thenReturn(Optional.of(config));

        SamlRelyingPartyRegistrationRepository repository = repository();
        repository.refresh();

        assertThat(repository.findByRegistrationId(provider.getAlias())).isNotNull();
    }

    private static Object invoke(String name, Class<?>[] parameterTypes, Object... arguments)
            throws Exception {
        Method method =
                SamlRelyingPartyRegistrationRepository.class.getDeclaredMethod(
                        name, parameterTypes);
        method.setAccessible(true);
        return method.invoke(null, arguments);
    }

    private static String privateKeyPem() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        return "-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder(64, new byte[] {'\n'})
                        .encodeToString(generator.generateKeyPair().getPrivate().getEncoded())
                + "\n-----END PRIVATE KEY-----";
    }

    private SamlRelyingPartyRegistrationRepository repository() {
        return new SamlRelyingPartyRegistrationRepository(
                providerRepository, configRepository, secretCipher, RestClient.builder());
    }

    private static SocialProviderEntity provider() {
        SocialProviderEntity provider = new SocialProviderEntity();
        provider.setRegistrationId("saml-registration");
        provider.setAlias("saml-alias");
        provider.setProviderType("saml");
        provider.setEnabled(true);
        return provider;
    }

    private static SamlProviderConfigEntity manualConfig(SocialProviderEntity provider) {
        SamlProviderConfigEntity config = new SamlProviderConfigEntity();
        config.setProviderId(provider.getId());
        config.setAssertingPartyEntityId("https://idp.example.test/entity");
        config.setSingleSignOnServiceUrl("https://idp.example.test/sso");
        config.setSingleLogoutServiceUrl("https://idp.example.test/slo");
        config.setIdpCertificate(CERTIFICATE);
        config.setServiceProviderEntityId("https://sp.example.test/entity");
        config.setWantAssertionsSigned(true);
        config.setAuthnRequestBinding("POST");
        config.setResponseBinding("REDIRECT");
        config.setLogoutBinding("POST");
        config.setNameIdFormat("urn:oasis:names:tc:SAML:2.0:nameid-format:persistent");
        config.setSignatureAlgorithm("http://www.w3.org/2001/04/xmldsig-more#rsa-sha256");
        return config;
    }

    private static final String CERTIFICATE =
            """
            -----BEGIN CERTIFICATE-----
            MIIC0jCCAbqgAwIBAgIJALZVkwDFJ7R5MA0GCSqGSIb3DQEBDAUAMBcxFTATBgNV
            BAMTDFNBTUwgRml4dHVyZTAeFw0yNjEwMDQwODM5NTBaFw0zNjEwMDEwODM5NTBa
            MBcxFTATBgNVBAMTDFNBTUwgRml4dHVyZTCCASIwDQYJKoZIhvcNAQEBBQADggEP
            ADCCAQoCggEBAJfh+MyVBjxYEAV1QTtQIdniGLB9Kj/okLpcvAvU3PC8RcqDV2RY
            Xbz9/zTott+68iiDZ20IGmHI5sxiK2agfxSym7rcdBsMzNS32RLwT/8zZzBlLJAc
            I7cLkx8yASydgsSU6kJhLuLShBUe+X8qwZmAiKBJbILdPZ8tTxqtwbPyluFmqrVx
            T7W6dyC6gwUIM8fXtKyKbn6VFk4Zqea+u8HT1NHkk38uhL+NuTuPw/lO71xEq3tJ
            VLHORzn77C9Bd9tH5Ctsyzaq9la/NbYRdQ/Oa/qmiwpN1tqCo9jB36Wp4pwSXxne
            yHs3Ub69M8F8aKeZg6nSPze1AzcCghEmD88CAwEAAaMhMB8wHQYDVR0OBBYEFOu/
            urlT+ckcU0KC/+xYlSZ74s0aMA0GCSqGSIb3DQEBDAUAA4IBAQAxpZTM1NGxC+TE
            pn6OYpFPGp4sM+pjH0DOeY7RBdPeQ1YPVwqKfvZA1wb7l9ZIne9RBYgn3EnHZld5
            J+y/kQf5ldLWSGJJl/zJG+qTG4L/XoWJDDod4JndeohjJWNGG7P0brPIvGEjGhdX
            Of9pnpyRQXH+43rS6YxAB71205P/Ep3pEEGyr2vkmYE6Y5APpIZFtifoyjiN6zuF
            yqloowr+XSVr4gvNt40YyJ73Qsvhoc6G7eFghxXaofbsJTWFeTiBwBeLCxnZa1Y3
            HHba71rYDO6LBirF8VO3SsVcSjYuRdwMd5c7LXmvgx4Wmu7vp+5xGPPRqDMG1wNt
            Z6ofKlRy
            -----END CERTIFICATE-----
            """;
}
