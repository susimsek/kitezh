package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.saml2.provider.service.authentication.AbstractSaml2AuthenticationRequest;
import org.springframework.security.saml2.provider.service.authentication.Saml2PostAuthenticationRequest;
import org.springframework.security.saml2.provider.service.authentication.Saml2RedirectAuthenticationRequest;
import org.springframework.security.saml2.provider.service.registration.RelyingPartyRegistration;
import org.springframework.security.web.webauthn.api.AttestationConveyancePreference;
import org.springframework.security.web.webauthn.api.AuthenticatorAttachment;
import org.springframework.security.web.webauthn.api.AuthenticatorSelectionCriteria;
import org.springframework.security.web.webauthn.api.AuthenticatorTransport;
import org.springframework.security.web.webauthn.api.Bytes;
import org.springframework.security.web.webauthn.api.ImmutablePublicKeyCredentialUserEntity;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialCreationOptions;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialDescriptor;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialRpEntity;
import org.springframework.security.web.webauthn.api.ResidentKeyRequirement;
import org.springframework.security.web.webauthn.api.UserVerificationRequirement;
import org.springframework.security.web.webauthn.authentication.WebAuthnAuthentication;

class SecurityJsonMapperTest {

    @Test
    void preservesSecurityContextTypeWhenReadingAnUntypedSessionAttribute() throws Exception {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "admin", "N/A", AuthorityUtils.createAuthorityList("ROLE_ADMIN")));
        SecurityJsonMapper mapper = new SecurityJsonMapper(getClass().getClassLoader());

        byte[] serialized = mapper.delegate().writeValueAsBytes(context);
        Object restored = mapper.delegate().readValue(serialized, Object.class);

        assertThat(restored).isInstanceOf(SecurityContext.class);
        assertThat(((SecurityContext) restored).getAuthentication().getName()).isEqualTo("admin");
    }

    @Test
    void preservesWebauthnAuthenticationWhenReadingAnUntypedSessionAttribute() throws Exception {
        WebAuthnAuthentication authentication =
                new WebAuthnAuthentication(
                        ImmutablePublicKeyCredentialUserEntity.builder()
                                .name("admin")
                                .displayName("Admin")
                                .id(new Bytes(new byte[] {1, 2, 3}))
                                .build(),
                        AuthorityUtils.createAuthorityList("ROLE_USER"));
        SecurityJsonMapper mapper = new SecurityJsonMapper(getClass().getClassLoader());

        byte[] serialized = mapper.delegate().writeValueAsBytes(authentication);
        Object restored = mapper.delegate().readValue(serialized, Object.class);

        assertThat(restored).isInstanceOf(WebAuthnAuthentication.class);
        assertThat(((WebAuthnAuthentication) restored).getName()).isEqualTo("admin");
    }

    @Test
    void roundTripsWebauthnSessionAttributesAndNormalizesMapRoots() throws Exception {
        SecurityJsonMapper mapper = new SecurityJsonMapper(getClass().getClassLoader());
        PublicKeyCredentialCreationOptions creationOptions =
                PublicKeyCredentialCreationOptions.builder()
                        .rp(
                                PublicKeyCredentialRpEntity.builder()
                                        .id("localhost")
                                        .name("Sample")
                                        .build())
                        .user(
                                ImmutablePublicKeyCredentialUserEntity.builder()
                                        .name("admin")
                                        .displayName("Admin")
                                        .id(new Bytes(new byte[] {1, 2, 3}))
                                        .build())
                        .challenge(new Bytes(new byte[] {4, 5, 6}))
                        .pubKeyCredParams(
                                List.of(
                                        org.springframework.security.web.webauthn.api
                                                .PublicKeyCredentialParameters.RS256))
                        .authenticatorSelection(
                                AuthenticatorSelectionCriteria.builder()
                                        .residentKey(ResidentKeyRequirement.REQUIRED)
                                        .userVerification(UserVerificationRequirement.REQUIRED)
                                        .build())
                        .timeout(Duration.ofSeconds(30))
                        .build();
        var requestOptions =
                org.springframework.security.web.webauthn.api.PublicKeyCredentialRequestOptions
                        .builder()
                        .challenge(new Bytes(new byte[] {7, 8, 9}))
                        .rpId("localhost")
                        .userVerification(UserVerificationRequirement.PREFERRED)
                        .timeout(Duration.ofSeconds(20))
                        .build();

        ByteArrayOutputStream creationBytes = new ByteArrayOutputStream();
        mapper.writeSessionAttribute(creationOptions, creationBytes);
        ByteArrayOutputStream requestBytes = new ByteArrayOutputStream();
        mapper.writeSessionAttribute(requestOptions, requestBytes);
        ByteArrayOutputStream mapBytes = new ByteArrayOutputStream();
        mapper.writeSessionAttribute(Map.of("key", "value"), mapBytes);

        assertThat(
                        mapper.readSessionAttribute(
                                new ByteArrayInputStream(creationBytes.toByteArray())))
                .isInstanceOf(PublicKeyCredentialCreationOptions.class);
        assertThat(
                        mapper.readSessionAttribute(
                                new ByteArrayInputStream(requestBytes.toByteArray())))
                .isInstanceOf(
                        org.springframework.security.web.webauthn.api
                                .PublicKeyCredentialRequestOptions.class);
        assertThat(mapper.readSessionAttribute(new ByteArrayInputStream(mapBytes.toByteArray())))
                .isInstanceOf(Map.class);
    }

    @Test
    void delegatesOrdinarySessionAttributesThroughTheSecurityMapper() throws Exception {
        SecurityJsonMapper mapper = new SecurityJsonMapper(getClass().getClassLoader());
        ByteArrayOutputStream output = new ByteArrayOutputStream();

        mapper.writeSessionAttribute("plain", output);

        assertThat(mapper.readSessionAttribute(new ByteArrayInputStream(output.toByteArray())))
                .isEqualTo("plain");
    }

    @Test
    void preservesSamlAuthenticationRequestWhenReadingAnUntypedSessionAttribute() throws Exception {
        RelyingPartyRegistration registration =
                RelyingPartyRegistration.withRegistrationId("saml-e2e")
                        .assertingPartyMetadata(
                                party ->
                                        party.entityId("https://idp.example.test/entity")
                                                .singleSignOnServiceLocation(
                                                        "https://idp.example.test/sso"))
                        .build();
        AbstractSaml2AuthenticationRequest request =
                Saml2PostAuthenticationRequest.withRelyingPartyRegistration(registration)
                        .id("request-id")
                        .samlRequest("encoded-request")
                        .relayState("relay-state")
                        .authenticationRequestUri("https://idp.example.test/sso")
                        .build();
        SecurityJsonMapper mapper = new SecurityJsonMapper(getClass().getClassLoader());
        ByteArrayOutputStream output = new ByteArrayOutputStream();

        mapper.writeSessionAttribute(request, output);

        Object restored =
                mapper.readSessionAttribute(new ByteArrayInputStream(output.toByteArray()));
        assertThat(restored).isInstanceOf(Saml2PostAuthenticationRequest.class);
        Saml2PostAuthenticationRequest restoredRequest = (Saml2PostAuthenticationRequest) restored;
        assertThat(restoredRequest.getId()).isEqualTo("request-id");
        assertThat(restoredRequest.getRelyingPartyRegistrationId()).isEqualTo("saml-e2e");
        assertThat(restoredRequest.getSamlRequest()).isEqualTo("encoded-request");
        assertThat(restoredRequest.getRelayState()).isEqualTo("relay-state");
    }

    @Test
    void preservesSamlRedirectAuthenticationRequestWhenReadingAnUntypedSessionAttribute()
            throws Exception {
        RelyingPartyRegistration registration =
                RelyingPartyRegistration.withRegistrationId("saml-e2e")
                        .assertingPartyMetadata(
                                party ->
                                        party.entityId("https://idp.example.test/entity")
                                                .singleSignOnServiceLocation(
                                                        "https://idp.example.test/sso"))
                        .build();
        AbstractSaml2AuthenticationRequest request =
                Saml2RedirectAuthenticationRequest.withRelyingPartyRegistration(registration)
                        .id("request-id")
                        .samlRequest("encoded-request")
                        .relayState("relay-state")
                        .authenticationRequestUri("https://idp.example.test/sso")
                        .sigAlg("algorithm")
                        .signature("signature")
                        .build();
        SecurityJsonMapper mapper = new SecurityJsonMapper(getClass().getClassLoader());
        ByteArrayOutputStream output = new ByteArrayOutputStream();

        mapper.writeSessionAttribute(request, output);

        Object restored =
                mapper.readSessionAttribute(new ByteArrayInputStream(output.toByteArray()));
        assertThat(restored).isInstanceOf(Saml2RedirectAuthenticationRequest.class);
        Saml2RedirectAuthenticationRequest restoredRequest =
                (Saml2RedirectAuthenticationRequest) restored;
        assertThat(restoredRequest.getId()).isEqualTo("request-id");
        assertThat(restoredRequest.getRelyingPartyRegistrationId()).isEqualTo("saml-e2e");
        assertThat(restoredRequest.getSamlRequest()).isEqualTo("encoded-request");
        assertThat(restoredRequest.getRelayState()).isEqualTo("relay-state");
        assertThat(restoredRequest.getSigAlg()).isEqualTo("algorithm");
        assertThat(restoredRequest.getSignature()).isEqualTo("signature");
    }

    @Test
    void restoresOptionalWebauthnFieldsAndRejectsUnsupportedValues() throws Exception {
        SecurityJsonMapper mapper = new SecurityJsonMapper(getClass().getClassLoader());
        var descriptor =
                PublicKeyCredentialDescriptor.builder()
                        .id(new Bytes(new byte[] {9, 8, 7}))
                        .transports(AuthenticatorTransport.USB, AuthenticatorTransport.NFC)
                        .build();
        var options =
                PublicKeyCredentialCreationOptions.builder()
                        .rp(
                                PublicKeyCredentialRpEntity.builder()
                                        .id("localhost")
                                        .name("Sample")
                                        .build())
                        .user(
                                ImmutablePublicKeyCredentialUserEntity.builder()
                                        .name("admin")
                                        .displayName("Admin")
                                        .id(new Bytes(new byte[] {1, 2, 3}))
                                        .build())
                        .challenge(new Bytes(new byte[] {4, 5, 6}))
                        .pubKeyCredParams(
                                List.of(
                                        org.springframework.security.web.webauthn.api
                                                .PublicKeyCredentialParameters.RS256))
                        .excludeCredentials(List.of(descriptor))
                        .authenticatorSelection(
                                AuthenticatorSelectionCriteria.builder()
                                        .authenticatorAttachment(AuthenticatorAttachment.PLATFORM)
                                        .residentKey(ResidentKeyRequirement.PREFERRED)
                                        .userVerification(UserVerificationRequirement.DISCOURAGED)
                                        .build())
                        .attestation(AttestationConveyancePreference.DIRECT)
                        .timeout(Duration.ofSeconds(30))
                        .build();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        mapper.writeSessionAttribute(options, output);

        var restored =
                (PublicKeyCredentialCreationOptions)
                        mapper.readSessionAttribute(new ByteArrayInputStream(output.toByteArray()));
        assertThat(restored.getTimeout()).isEqualTo(Duration.ofSeconds(30));
        assertThat(restored.getExcludeCredentials()).hasSize(1);

        String marker = "spring-security-webauthn-creation-options\n";
        String invalid =
                marker
                        + "{\"rp\":{\"id\":\"localhost\",\"name\":\"Sample\"},"
                        + "\"user\":{\"name\":\"admin\",\"displayName\":\"Admin\",\"id\":\"AQID\"},"
                        + "\"challenge\":\"BAUG\",\"pubKeyCredParams\":[{\"alg\":1,\"type\":\"public-key\"}],"
                        + "\"excludeCredentials\":[]}";
        ByteArrayInputStream invalidInput = new ByteArrayInputStream(invalid.getBytes());
        assertThatThrownBy(() -> mapper.readSessionAttribute(invalidInput))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void readsWebauthnPayloadsWithMissingOptionalFieldsAndStringTimeouts() throws Exception {
        SecurityJsonMapper mapper = new SecurityJsonMapper(getClass().getClassLoader());
        String creationMarker = "spring-security-webauthn-creation-options\n";
        String creationJson =
                "{\"rp\":{\"id\":\"localhost\",\"name\":\"Sample\"},"
                    + "\"user\":{\"name\":\"admin\",\"displayName\":\"Admin\",\"id\":\"AQID\"},"
                    + "\"challenge\":\"BAUG\",\"pubKeyCredParams\":null,"
                    + "\"excludeCredentials\":[{\"type\":\"public-key\",\"id\":\"CQgH\",\"transports\":null}],"
                    + "\"timeout\":\"PT30S\",\"authenticatorSelection\":{"
                    + "\"authenticatorAttachment\":null,\"residentKey\":null,"
                    + "\"userVerification\":null},\"attestation\":null}";
        Object creation =
                mapper.readSessionAttribute(
                        new ByteArrayInputStream((creationMarker + creationJson).getBytes()));
        assertThat(creation).isInstanceOf(PublicKeyCredentialCreationOptions.class);
        assertThat(((PublicKeyCredentialCreationOptions) creation).getExcludeCredentials())
                .hasSize(1);

        String requestMarker = "spring-security-webauthn-request-options\n";
        String requestJson =
                "{\"challenge\":\"BAUG\",\"rpId\":\"localhost\"," + "\"allowCredentials\":null}";
        Object request =
                mapper.readSessionAttribute(
                        new ByteArrayInputStream((requestMarker + requestJson).getBytes()));
        assertThat(request)
                .isInstanceOf(
                        org.springframework.security.web.webauthn.api
                                .PublicKeyCredentialRequestOptions.class);
    }
}
