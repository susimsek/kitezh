package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Answers.RETURNS_SELF;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.webauthn4j.converter.util.ObjectConverter;
import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.dto.admin.WebAuthnPolicyDTO;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Method;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.webauthn.api.Bytes;
import org.springframework.security.web.webauthn.api.CredentialRecord;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialParameters;
import org.springframework.security.web.webauthn.authentication.PublicKeyCredentialRequestOptionsRepository;
import org.springframework.security.web.webauthn.management.PublicKeyCredentialCreationOptionsRequest;
import org.springframework.security.web.webauthn.management.PublicKeyCredentialRequestOptionsRequest;
import org.springframework.security.web.webauthn.management.PublicKeyCredentialUserEntityRepository;
import org.springframework.security.web.webauthn.management.RelyingPartyAuthenticationRequest;
import org.springframework.security.web.webauthn.management.RelyingPartyRegistrationRequest;
import org.springframework.security.web.webauthn.management.UserCredentialRepository;
import org.springframework.security.web.webauthn.management.WebAuthnRelyingPartyOperations;
import org.springframework.security.web.webauthn.management.Webauthn4JRelyingPartyOperations;

@SuppressWarnings("java:S6213")
class WebAuthnConfigTest {

    private final WebAuthnConfig config = new WebAuthnConfig();

    @Test
    void createsWebAuthnInfrastructureBeans() {
        final PublicKeyCredentialUserEntityRepository users =
                config.webAuthnUserEntityRepository(mock(UserRepository.class));
        UserCredentialRepository credentials =
                config.webAuthnUserCredentialRepository(mock(JdbcOperations.class));

        assertThat(users).isNotNull();
        assertThat(credentials).isNotNull();
        assertThat(config.webAuthnRequestOptionsRepository())
                .isInstanceOf(PublicKeyCredentialRequestOptionsRepository.class);
        WebAuthnRelyingPartyOperations operations =
                config.webAuthnRelyingPartyOperations(
                        users,
                        credentials,
                        new ApplicationProperties(),
                        mock(LoginSettingsService.class));
        assertThat(operations).isNotNull();
        AuthenticationManager manager =
                config.webAuthnAuthenticationManager(operations, mock(UserDetailsService.class));
        assertThat(manager).isNotNull();
    }

    @Test
    void mapsConfiguredWebAuthnValues() throws Exception {
        assertThat(invoke("csv", String.class, " ES256, ,RS256 "))
                .isEqualTo(List.of("ES256", "RS256"));
        assertThat(invoke("csv", String.class, (Object) null)).isEqualTo(List.of());
        assertThat(invoke("value", String.class, (Object) null)).isEqualTo("");
        assertThat(invoke("value", String.class, "  rp  ")).isEqualTo("rp");

        @SuppressWarnings("unchecked")
        List<PublicKeyCredentialParameters> algorithms =
                (List<PublicKeyCredentialParameters>)
                        invoke(
                                "algorithms",
                                String.class,
                                "EdDSA,ES256,ES384,ES512,RS1,RS256,RS384,RS512");
        assertThat(algorithms).hasSize(8);
        assertThat(value(invoke("attachment", String.class, "platform"))).isEqualTo("platform");
        assertThat(value(invoke("attachment", String.class, "cross-platform")))
                .isEqualTo("cross-platform");
        assertThat(invoke("attachment", String.class, "any")).isNull();
        assertThat(value(invoke("residentKey", String.class, "required")))
                .isEqualToIgnoringCase("required");
        assertThat(value(invoke("userVerification", String.class, "discouraged")))
                .isEqualToIgnoringCase("discouraged");
        assertThat(value(invoke("userVerification", String.class, "preferred")))
                .isEqualToIgnoringCase("preferred");
        assertThat(value(invoke("userVerification", String.class, "anything")))
                .isEqualToIgnoringCase("required");
        assertThat(value(invoke("attestation", String.class, "direct")))
                .isEqualToIgnoringCase("direct");
        assertThatThrownBy(() -> invoke("algorithm", String.class, "unsupported"))
                .hasCauseInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void delegatesCeremonyOperationsUsingConfiguredPolicies() {
        PublicKeyCredentialUserEntityRepository users =
                mock(PublicKeyCredentialUserEntityRepository.class);
        UserCredentialRepository credentials = mock(UserCredentialRepository.class);
        LoginSettingsService settings = mock(LoginSettingsService.class);
        WebAuthnPolicyDTO registrationPolicy =
                new WebAuthnPolicyDTO(
                        "Configured RP",
                        "rp.example",
                        "ES256,RS256",
                        "DIRECT",
                        "PLATFORM",
                        "PREFERRED",
                        "DISCOURAGED",
                        42,
                        false,
                        "");
        WebAuthnPolicyDTO authenticationPolicy =
                new WebAuthnPolicyDTO(
                        "Configured RP",
                        "rp.example",
                        "ES256",
                        "NONE",
                        "ANY",
                        "REQUIRED",
                        "PREFERRED",
                        21,
                        true,
                        "");
        when(settings.webAuthnPolicy(false)).thenReturn(registrationPolicy);
        when(settings.webAuthnPolicy(true)).thenReturn(authenticationPolicy);
        final ApplicationProperties properties =
                new ApplicationProperties(
                        new ApplicationProperties.Cache(
                                new ApplicationProperties.Caffeine(Duration.ofHours(1), 1, 10)),
                        new ApplicationProperties.Session("*"),
                        new ApplicationProperties.AuthorizationServer(
                                "https://issuer.example:9443"),
                        new ApplicationProperties.Mail(
                                false, "no-reply@example.test", "https://issuer.example"),
                        new ApplicationProperties.Security(),
                        new ApplicationProperties.WebAuthn(
                                "Default RP", "", "", 300, "REQUIRED", "REQUIRED", "NONE"),
                        new ApplicationProperties.RegistrationCaptcha());

        AtomicReference<
                        java.util.function.Consumer<
                                org.springframework.security.web.webauthn.api
                                        .PublicKeyCredentialCreationOptions
                                        .PublicKeyCredentialCreationOptionsBuilder>>
                creationCustomizer = new AtomicReference<>();
        AtomicReference<
                        java.util.function.Consumer<
                                org.springframework.security.web.webauthn.api
                                        .PublicKeyCredentialRequestOptions
                                        .PublicKeyCredentialRequestOptionsBuilder>>
                requestCustomizer = new AtomicReference<>();
        try (var _ =
                Mockito.mockConstruction(
                        Webauthn4JRelyingPartyOperations.class,
                        (delegate, context) -> {
                            doAnswer(
                                            invocation -> {
                                                creationCustomizer.set(invocation.getArgument(0));
                                                return null;
                                            })
                                    .when(delegate)
                                    .setCustomizeCreationOptions(any());
                            doAnswer(
                                            invocation -> {
                                                requestCustomizer.set(invocation.getArgument(0));
                                                return null;
                                            })
                                    .when(delegate)
                                    .setCustomizeRequestOptions(any());
                        })) {
            WebAuthnRelyingPartyOperations operations =
                    config.webAuthnRelyingPartyOperations(users, credentials, properties, settings);

            operations.createPublicKeyCredentialCreationOptions(
                    mock(PublicKeyCredentialCreationOptionsRequest.class));
            operations.createCredentialRequestOptions(
                    mock(PublicKeyCredentialRequestOptionsRequest.class));
            operations.registerCredential(mock(RelyingPartyRegistrationRequest.class));
            operations.authenticate(mock(RelyingPartyAuthenticationRequest.class));

            assertThat(creationCustomizer.get()).isNotNull();
            var creationBuilder =
                    mock(
                            org.springframework.security.web.webauthn.api
                                    .PublicKeyCredentialCreationOptions
                                    .PublicKeyCredentialCreationOptionsBuilder.class,
                            RETURNS_SELF);
            creationCustomizer.get().accept(creationBuilder);
            verify(creationBuilder).timeout(Duration.ofSeconds(42));
            verify(creationBuilder).excludeCredentials(List.of());
            assertThat(requestCustomizer.get()).isNotNull();
            var requestBuilder =
                    mock(
                            org.springframework.security.web.webauthn.api
                                    .PublicKeyCredentialRequestOptions
                                    .PublicKeyCredentialRequestOptionsBuilder.class,
                            RETURNS_SELF);
            requestCustomizer.get().accept(requestBuilder);
            verify(requestBuilder).timeout(Duration.ofSeconds(21));
        }
    }

    @Test
    void usesFallbackRelyingPartySettingsAndRejectsMissingAllowedAaguid() {
        final PublicKeyCredentialUserEntityRepository users =
                mock(PublicKeyCredentialUserEntityRepository.class);
        UserCredentialRepository credentials = mock(UserCredentialRepository.class);
        LoginSettingsService settings = mock(LoginSettingsService.class);
        WebAuthnPolicyDTO policy =
                new WebAuthnPolicyDTO(
                        " ",
                        " ",
                        "ES256",
                        "NONE",
                        "ANY",
                        "REQUIRED",
                        "REQUIRED",
                        30,
                        true,
                        "00000000-0000-0000-0000-000000000001");
        when(settings.webAuthnPolicy(false)).thenReturn(policy);
        final ApplicationProperties properties =
                new ApplicationProperties(
                        new ApplicationProperties.Cache(
                                new ApplicationProperties.Caffeine(Duration.ofHours(1), 1, 10)),
                        new ApplicationProperties.Session("*"),
                        new ApplicationProperties.AuthorizationServer("https://issuer.example"),
                        new ApplicationProperties.Mail(
                                false, "no-reply@example.test", "https://issuer.example"),
                        new ApplicationProperties.Security(),
                        new ApplicationProperties.WebAuthn(
                                "Fallback RP",
                                " ",
                                " https://one.example, , https://two.example ",
                                300,
                                "REQUIRED",
                                "REQUIRED",
                                "NONE"),
                        new ApplicationProperties.RegistrationCaptcha());
        CredentialRecord record = mock(CredentialRecord.class);
        when(record.getAttestationObject()).thenReturn(null);
        Bytes credentialId = new Bytes(new byte[] {1, 2, 3});
        when(record.getCredentialId()).thenReturn(credentialId);
        when(credentials.findByCredentialId(record.getCredentialId())).thenReturn(record);

        try (var _ =
                Mockito.mockConstruction(
                        Webauthn4JRelyingPartyOperations.class,
                        (delegate, context) ->
                                when(delegate.registerCredential(any())).thenReturn(record))) {
            WebAuthnRelyingPartyOperations operations =
                    config.webAuthnRelyingPartyOperations(users, credentials, properties, settings);
            assertThatThrownBy(
                            () ->
                                    operations.registerCredential(
                                            mock(RelyingPartyRegistrationRequest.class)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("AAGUID");
            verify(credentials).delete(record.getCredentialId());
        }
    }

    @Test
    void enforcesAllowedAndDisallowedAaguidsFromAttestationData() throws Exception {
        final PublicKeyCredentialUserEntityRepository users =
                mock(PublicKeyCredentialUserEntityRepository.class);
        UserCredentialRepository credentials = mock(UserCredentialRepository.class);
        LoginSettingsService settings = mock(LoginSettingsService.class);
        UUID allowedAaguid = UUID.fromString("00000000-0000-0000-0000-000000000001");
        WebAuthnPolicyDTO policy =
                new WebAuthnPolicyDTO(
                        "Configured RP",
                        "rp.example",
                        "ES256",
                        "NONE",
                        "ANY",
                        "REQUIRED",
                        "REQUIRED",
                        30,
                        true,
                        allowedAaguid.toString());
        when(settings.webAuthnPolicy(false)).thenReturn(policy);
        CredentialRecord record = mock(CredentialRecord.class);
        Bytes credentialId = new Bytes(new byte[] {1, 2, 3});
        when(record.getCredentialId()).thenReturn(credentialId);
        when(record.getAttestationObject()).thenReturn(new Bytes(attestationObject(allowedAaguid)));
        when(credentials.findByCredentialId(credentialId)).thenReturn(record);

        try (var _ =
                Mockito.mockConstruction(
                        Webauthn4JRelyingPartyOperations.class,
                        (delegate, context) ->
                                when(delegate.registerCredential(any())).thenReturn(record))) {
            WebAuthnRelyingPartyOperations operations =
                    config.webAuthnRelyingPartyOperations(
                            users, credentials, properties(), settings);

            operations.registerCredential(mock(RelyingPartyRegistrationRequest.class));
            verify(credentials, never()).delete(credentialId);

            UUID disallowedAaguid = UUID.fromString("00000000-0000-0000-0000-000000000002");
            when(record.getAttestationObject())
                    .thenReturn(new Bytes(attestationObject(disallowedAaguid)));
            assertThatThrownBy(
                            () ->
                                    operations.registerCredential(
                                            mock(RelyingPartyRegistrationRequest.class)))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("not allowed");
            verify(credentials, org.mockito.Mockito.atLeastOnce()).delete(credentialId);
        }
    }

    private static ApplicationProperties properties() {
        return new ApplicationProperties(
                new ApplicationProperties.Cache(
                        new ApplicationProperties.Caffeine(Duration.ofHours(1), 1, 10)),
                new ApplicationProperties.Session("*"),
                new ApplicationProperties.AuthorizationServer("https://issuer.example"),
                new ApplicationProperties.Mail(
                        false, "no-reply@example.test", "https://issuer.example"),
                new ApplicationProperties.Security(),
                new ApplicationProperties.WebAuthn(
                        "Fallback RP", " ", "", 300, "REQUIRED", "REQUIRED", "NONE"),
                new ApplicationProperties.RegistrationCaptcha());
    }

    private static byte[] attestationObject(UUID aaguid) throws Exception {
        byte[] credentialId = new byte[] {1, 2, 3};
        byte[] credentialPublicKey =
                new ObjectConverter()
                        .getCborConverter()
                        .writeValueAsBytes(
                                Map.of(
                                        1, 2,
                                        3, -7,
                                        -1, 1,
                                        -2, new byte[32],
                                        -3, new byte[32]));
        ByteArrayOutputStream authenticatorData = new ByteArrayOutputStream();
        authenticatorData.write(new byte[32]);
        authenticatorData.write(0x41);
        authenticatorData.write(new byte[4]);
        authenticatorData.write(
                ByteBuffer.allocate(16)
                        .putLong(aaguid.getMostSignificantBits())
                        .putLong(aaguid.getLeastSignificantBits())
                        .array());
        authenticatorData.write((credentialId.length >>> 8) & 0xff);
        authenticatorData.write(credentialId.length & 0xff);
        authenticatorData.write(credentialId);
        authenticatorData.write(credentialPublicKey);
        return new ObjectConverter()
                .getCborConverter()
                .writeValueAsBytes(
                        Map.of(
                                "authData", authenticatorData.toByteArray(),
                                "fmt", "none",
                                "attStmt", Map.of()));
    }

    private static Object invoke(String name, Class<?> parameterType, Object value)
            throws Exception {
        Class<?> operations =
                Class.forName(
                        "io.github.susimsek.kitezh.config.security.WebAuthnConfig$ConfigurableWebAuthnRelyingPartyOperations");
        Method method = operations.getDeclaredMethod(name, parameterType);
        method.setAccessible(true);
        return method.invoke(null, value);
    }

    private static String value(Object option) throws Exception {
        return (String) option.getClass().getMethod("getValue").invoke(option);
    }
}
