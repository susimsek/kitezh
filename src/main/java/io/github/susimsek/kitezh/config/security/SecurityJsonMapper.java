package io.github.susimsek.kitezh.config.security;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.security.jackson.SecurityJacksonModules;
import org.springframework.security.web.webauthn.api.AttestationConveyancePreference;
import org.springframework.security.web.webauthn.api.AuthenticatorSelectionCriteria;
import org.springframework.security.web.webauthn.api.AuthenticatorTransport;
import org.springframework.security.web.webauthn.api.Bytes;
import org.springframework.security.web.webauthn.api.ImmutablePublicKeyCredentialUserEntity;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialCreationOptions;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialDescriptor;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialParameters;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialType;
import org.springframework.security.web.webauthn.api.ResidentKeyRequirement;
import org.springframework.security.web.webauthn.api.UserVerificationRequirement;
import org.springframework.security.web.webauthn.authentication.WebAuthnAuthentication;
import org.springframework.security.web.webauthn.jackson.WebauthnJacksonModule;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import tools.jackson.databind.module.SimpleModule;

/**
 * Dedicated Jackson mapper for Spring Security and Authorization Server persistence.
 *
 * <p>This wrapper intentionally prevents the security-aware {@link JsonMapper} from becoming the
 * application's MVC/REST mapper.
 */
public final class SecurityJsonMapper {

    private static final String USER_VERIFICATION = "userVerification";
    private static final Set<String> JDK_IMMUTABLE_COLLECTION_TYPES =
            Set.of(
                    "java.util.ImmutableCollections$List12",
                    "java.util.ImmutableCollections$ListN",
                    "java.util.ImmutableCollections$Set12",
                    "java.util.ImmutableCollections$SetN",
                    "java.util.ImmutableCollections$Map1",
                    "java.util.ImmutableCollections$MapN");

    private static final byte[] WEBAUTHN_CREATION_OPTIONS_MARKER =
            "spring-security-webauthn-creation-options\n"
                    .getBytes(java.nio.charset.StandardCharsets.UTF_8);
    private static final byte[] WEBAUTHN_REQUEST_OPTIONS_MARKER =
            "spring-security-webauthn-request-options\n"
                    .getBytes(java.nio.charset.StandardCharsets.UTF_8);

    private final JsonMapper delegate;
    private final JsonMapper webauthnDelegate;

    public SecurityJsonMapper(ClassLoader classLoader) {
        BasicPolymorphicTypeValidator.Builder typeValidator =
                BasicPolymorphicTypeValidator.builder()
                        .allowIfSubType(WebAuthnAuthentication.class)
                        .allowIfSubType(ImmutablePublicKeyCredentialUserEntity.class)
                        .allowIfSubType(Number.class)
                        .allowIfSubType(Boolean.class)
                        .allowIfSubType(String.class)
                        .allowIfSubType(
                                (context, subtype) ->
                                        JDK_IMMUTABLE_COLLECTION_TYPES.contains(subtype.getName()));
        this.delegate =
                JsonMapper.builder()
                        .addModules(SecurityJacksonModules.getModules(classLoader, typeValidator))
                        .addModule(new WebauthnJacksonModule())
                        .build();
        this.webauthnDelegate =
                JsonMapper.builder()
                        .addModule(new WebauthnJacksonModule())
                        .addModule(new WebauthnSessionAttributeModule())
                        .build();
    }

    public JsonMapper delegate() {
        return delegate;
    }

    public void writeSessionAttribute(Object value, OutputStream outputStream) throws IOException {
        if (value instanceof PublicKeyCredentialCreationOptions options) {
            outputStream.write(WEBAUTHN_CREATION_OPTIONS_MARKER);
            webauthnDelegate.writeValue(outputStream, options);
            return;
        }
        if (value
                instanceof
                org.springframework.security.web.webauthn.api.PublicKeyCredentialRequestOptions
                        options) {
            outputStream.write(WEBAUTHN_REQUEST_OPTIONS_MARKER);
            webauthnDelegate.writeValue(outputStream, options);
            return;
        }
        if (value instanceof Map<?, ?> map) {
            // Java's immutable Map implementations are final, so Jackson omits the
            // polymorphic type id required when the session attribute is read as Object.
            // Normalize map roots before persistence while keeping the session mapper isolated.
            delegate.writeValue(outputStream, new LinkedHashMap<>(map));
            return;
        }
        delegate.writeValue(outputStream, value);
    }

    public Object readSessionAttribute(InputStream inputStream) throws IOException {
        byte[] bytes = inputStream.readAllBytes();
        if (startsWithWebauthnCreationOptionsMarker(bytes)) {
            return readWebauthnCreationOptions(
                    new ByteArrayInputStream(
                            bytes,
                            WEBAUTHN_CREATION_OPTIONS_MARKER.length,
                            bytes.length - WEBAUTHN_CREATION_OPTIONS_MARKER.length));
        }
        if (startsWithWebauthnRequestOptionsMarker(bytes)) {
            return readWebauthnRequestOptions(
                    new ByteArrayInputStream(
                            bytes,
                            WEBAUTHN_REQUEST_OPTIONS_MARKER.length,
                            bytes.length - WEBAUTHN_REQUEST_OPTIONS_MARKER.length));
        }
        return delegate.readValue(bytes, Object.class);
    }

    @SuppressWarnings("unchecked")
    private PublicKeyCredentialCreationOptions readWebauthnCreationOptions(
            InputStream inputStream) {
        Map<String, Object> source = webauthnDelegate.readValue(inputStream, Map.class);
        Map<String, Object> rp = (Map<String, Object>) source.get("rp");
        Map<String, Object> user = (Map<String, Object>) source.get("user");
        PublicKeyCredentialCreationOptions.PublicKeyCredentialCreationOptionsBuilder builder =
                PublicKeyCredentialCreationOptions.builder()
                        .rp(
                                org.springframework.security.web.webauthn.api
                                        .PublicKeyCredentialRpEntity.builder()
                                        .id((String) rp.get("id"))
                                        .name((String) rp.get("name"))
                                        .build())
                        .user(
                                ImmutablePublicKeyCredentialUserEntity.builder()
                                        .name((String) user.get("name"))
                                        .id(Bytes.fromBase64((String) user.get("id")))
                                        .displayName((String) user.get("displayName"))
                                        .build())
                        .challenge(Bytes.fromBase64((String) source.get("challenge")))
                        .pubKeyCredParams(
                                readParameters(
                                        (List<Map<String, Object>>) source.get("pubKeyCredParams")))
                        .excludeCredentials(
                                readDescriptors(
                                        (List<Map<String, Object>>)
                                                source.get("excludeCredentials")));

        Long timeout = longValue(source.get("timeout"));
        if (timeout != null) {
            builder.timeout(Duration.ofMillis(timeout));
        }
        Map<String, Object> selection = (Map<String, Object>) source.get("authenticatorSelection");
        if (selection != null) {
            AuthenticatorSelectionCriteria.AuthenticatorSelectionCriteriaBuilder selectionBuilder =
                    AuthenticatorSelectionCriteria.builder();
            if (selection.get("authenticatorAttachment") != null) {
                selectionBuilder.authenticatorAttachment(
                        org.springframework.security.web.webauthn.api.AuthenticatorAttachment
                                .valueOf((String) selection.get("authenticatorAttachment")));
            }
            if (selection.get("residentKey") != null) {
                selectionBuilder.residentKey(
                        ResidentKeyRequirement.valueOf((String) selection.get("residentKey")));
            }
            if (selection.get(USER_VERIFICATION) != null) {
                selectionBuilder.userVerification(
                        userVerificationRequirement((String) selection.get(USER_VERIFICATION)));
            }
            builder.authenticatorSelection(selectionBuilder.build());
        }
        if (source.get("attestation") != null) {
            builder.attestation(
                    AttestationConveyancePreference.valueOf((String) source.get("attestation")));
        }
        return builder.build();
    }

    @SuppressWarnings("unchecked")
    private org.springframework.security.web.webauthn.api.PublicKeyCredentialRequestOptions
            readWebauthnRequestOptions(InputStream inputStream) {
        Map<String, Object> source = webauthnDelegate.readValue(inputStream, Map.class);
        org.springframework.security.web.webauthn.api.PublicKeyCredentialRequestOptions
                        .PublicKeyCredentialRequestOptionsBuilder
                builder =
                        org.springframework.security.web.webauthn.api
                                .PublicKeyCredentialRequestOptions.builder()
                                .challenge(Bytes.fromBase64((String) source.get("challenge")))
                                .rpId((String) source.get("rpId"))
                                .allowCredentials(
                                        readDescriptors(
                                                (List<Map<String, Object>>)
                                                        source.get("allowCredentials")));
        Long timeout = longValue(source.get("timeout"));
        if (timeout != null) {
            builder.timeout(Duration.ofMillis(timeout));
        }
        if (source.get(USER_VERIFICATION) != null) {
            builder.userVerification(
                    userVerificationRequirement((String) source.get(USER_VERIFICATION)));
        }
        return builder.build();
    }

    private static List<PublicKeyCredentialParameters> readParameters(
            List<Map<String, Object>> values) {
        List<PublicKeyCredentialParameters> parameters = new ArrayList<>();
        for (Map<String, Object> value : values != null ? values : List.<Map<String, Object>>of()) {
            long algorithm = longValue(value.get("alg"));
            String type = (String) value.get("type");
            parameters.add(
                    List.of(
                                    PublicKeyCredentialParameters.EdDSA,
                                    PublicKeyCredentialParameters.ES256,
                                    PublicKeyCredentialParameters.ES384,
                                    PublicKeyCredentialParameters.ES512,
                                    PublicKeyCredentialParameters.RS256,
                                    PublicKeyCredentialParameters.RS384,
                                    PublicKeyCredentialParameters.RS512,
                                    PublicKeyCredentialParameters.RS1)
                            .stream()
                            .filter(
                                    parameter ->
                                            parameter.getAlg().getValue() == algorithm
                                                    && parameter.getType().getValue().equals(type))
                            .findFirst()
                            .orElseThrow(
                                    () ->
                                            new IllegalArgumentException(
                                                    "Unsupported WebAuthn public key algorithm: "
                                                            + algorithm)));
        }
        return parameters;
    }

    @SuppressWarnings("unchecked")
    private static List<PublicKeyCredentialDescriptor> readDescriptors(
            List<Map<String, Object>> values) {
        List<PublicKeyCredentialDescriptor> descriptors = new ArrayList<>();
        for (Map<String, Object> value : values != null ? values : List.<Map<String, Object>>of()) {
            List<String> transports = (List<String>) value.get("transports");
            descriptors.add(
                    PublicKeyCredentialDescriptor.builder()
                            .type(PublicKeyCredentialType.valueOf((String) value.get("type")))
                            .id(Bytes.fromBase64((String) value.get("id")))
                            .transports(
                                    transports == null
                                            ? Set.of()
                                            : transports.stream()
                                                    .map(AuthenticatorTransport::valueOf)
                                                    .collect(java.util.stream.Collectors.toSet()))
                            .build());
        }
        return descriptors;
    }

    private static UserVerificationRequirement userVerificationRequirement(String value) {
        return switch (value) {
            case "discouraged" -> UserVerificationRequirement.DISCOURAGED;
            case "preferred" -> UserVerificationRequirement.PREFERRED;
            case "required" -> UserVerificationRequirement.REQUIRED;
            default ->
                    throw new IllegalArgumentException(
                            "Unsupported WebAuthn user verification: " + value);
        };
    }

    private static Long longValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        String text = (String) value;
        return text.startsWith("P") ? Duration.parse(text).toMillis() : Long.parseLong(text);
    }

    private static boolean startsWithWebauthnCreationOptionsMarker(byte[] bytes) {
        return startsWith(bytes, WEBAUTHN_CREATION_OPTIONS_MARKER);
    }

    private static boolean startsWithWebauthnRequestOptionsMarker(byte[] bytes) {
        return startsWith(bytes, WEBAUTHN_REQUEST_OPTIONS_MARKER);
    }

    private static boolean startsWith(byte[] bytes, byte[] marker) {
        if (bytes.length < marker.length) {
            return false;
        }
        for (int index = 0; index < marker.length; index++) {
            if (bytes[index] != marker[index]) {
                return false;
            }
        }
        return true;
    }

    private static final class WebauthnSessionAttributeModule extends SimpleModule {

        @Override
        public void setupModule(SetupContext context) {
            context.setMixIn(
                    PublicKeyCredentialCreationOptions.class,
                    WebauthnCreationOptionsSessionAttributeMixin.class);
            context.setMixIn(
                    org.springframework.security.web.webauthn.api.PublicKeyCredentialRequestOptions
                            .class,
                    WebauthnRequestOptionsSessionAttributeMixin.class);
        }
    }

    private abstract static class WebauthnCreationOptionsSessionAttributeMixin {

        @JsonIgnore
        abstract Object getExtensions();
    }

    private abstract static class WebauthnRequestOptionsSessionAttributeMixin {

        @JsonIgnore
        abstract Object getExtensions();
    }
}
