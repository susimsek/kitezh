package io.github.susimsek.kitezh.config.security;

import com.webauthn4j.converter.util.ObjectConverter;
import com.webauthn4j.data.attestation.AttestationObject;
import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.dto.admin.WebAuthnPolicyDTO;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import java.net.URI;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.webauthn.api.AttestationConveyancePreference;
import org.springframework.security.web.webauthn.api.AuthenticatorAttachment;
import org.springframework.security.web.webauthn.api.AuthenticatorSelectionCriteria;
import org.springframework.security.web.webauthn.api.CredentialRecord;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialCreationOptions;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialParameters;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialRequestOptions;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialRpEntity;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialUserEntity;
import org.springframework.security.web.webauthn.api.ResidentKeyRequirement;
import org.springframework.security.web.webauthn.api.UserVerificationRequirement;
import org.springframework.security.web.webauthn.authentication.HttpSessionPublicKeyCredentialRequestOptionsRepository;
import org.springframework.security.web.webauthn.authentication.PublicKeyCredentialRequestOptionsRepository;
import org.springframework.security.web.webauthn.authentication.WebAuthnAuthenticationProvider;
import org.springframework.security.web.webauthn.management.JdbcUserCredentialRepository;
import org.springframework.security.web.webauthn.management.PublicKeyCredentialCreationOptionsRequest;
import org.springframework.security.web.webauthn.management.PublicKeyCredentialRequestOptionsRequest;
import org.springframework.security.web.webauthn.management.PublicKeyCredentialUserEntityRepository;
import org.springframework.security.web.webauthn.management.RelyingPartyAuthenticationRequest;
import org.springframework.security.web.webauthn.management.RelyingPartyRegistrationRequest;
import org.springframework.security.web.webauthn.management.UserCredentialRepository;
import org.springframework.security.web.webauthn.management.WebAuthnRelyingPartyOperations;
import org.springframework.security.web.webauthn.management.Webauthn4JRelyingPartyOperations;

@Configuration(proxyBeanMethods = false)
@SuppressWarnings("java:S6213")
public class WebAuthnConfig {

    @Bean
    PublicKeyCredentialUserEntityRepository webAuthnUserEntityRepository(
            UserRepository userRepository) {
        return new WebAuthnUserEntityRepository(userRepository);
    }

    @Bean
    UserCredentialRepository webAuthnUserCredentialRepository(JdbcOperations jdbcOperations) {
        return new JdbcUserCredentialRepository(jdbcOperations);
    }

    @Bean
    PublicKeyCredentialRequestOptionsRepository webAuthnRequestOptionsRepository() {
        return new HttpSessionPublicKeyCredentialRequestOptionsRepository();
    }

    @Bean
    WebAuthnRelyingPartyOperations webAuthnRelyingPartyOperations(
            PublicKeyCredentialUserEntityRepository userEntities,
            UserCredentialRepository userCredentials,
            ApplicationProperties applicationProperties,
            LoginSettingsService loginSettingsService) {
        return new ConfigurableWebAuthnRelyingPartyOperations(
                userEntities, userCredentials, applicationProperties, loginSettingsService);
    }

    @Bean
    AuthenticationManager webAuthnAuthenticationManager(
            WebAuthnRelyingPartyOperations relyingPartyOperations,
            UserDetailsService userDetailsService) {
        return new ProviderManager(
                new WebAuthnAuthenticationProvider(relyingPartyOperations, userDetailsService));
    }

    private static final class ConfigurableWebAuthnRelyingPartyOperations
            implements WebAuthnRelyingPartyOperations {

        private final PublicKeyCredentialUserEntityRepository userEntities;
        private final UserCredentialRepository userCredentials;
        private final ApplicationProperties applicationProperties;
        private final LoginSettingsService loginSettingsService;

        private ConfigurableWebAuthnRelyingPartyOperations(
                PublicKeyCredentialUserEntityRepository userEntities,
                UserCredentialRepository userCredentials,
                ApplicationProperties applicationProperties,
                LoginSettingsService loginSettingsService) {
            this.userEntities = userEntities;
            this.userCredentials = userCredentials;
            this.applicationProperties = applicationProperties;
            this.loginSettingsService = loginSettingsService;
        }

        @Override
        public PublicKeyCredentialCreationOptions createPublicKeyCredentialCreationOptions(
                PublicKeyCredentialCreationOptionsRequest request) {
            WebAuthnPolicyDTO policy = policy(false);
            Webauthn4JRelyingPartyOperations delegate = delegate(policy);
            delegate.setCustomizeCreationOptions(options -> customizeCreation(options, policy));
            return delegate.createPublicKeyCredentialCreationOptions(request);
        }

        @Override
        public CredentialRecord registerCredential(RelyingPartyRegistrationRequest request) {
            WebAuthnPolicyDTO policy = policy(false);
            CredentialRecord record = delegate(policy).registerCredential(request);
            enforceAaguids(record, policy);
            return record;
        }

        @Override
        public PublicKeyCredentialRequestOptions createCredentialRequestOptions(
                PublicKeyCredentialRequestOptionsRequest request) {
            WebAuthnPolicyDTO policy = policy(true);
            Webauthn4JRelyingPartyOperations delegate = delegate(policy);
            delegate.setCustomizeRequestOptions(options -> customizeRequest(options, policy));
            return delegate.createCredentialRequestOptions(request);
        }

        @Override
        public PublicKeyCredentialUserEntity authenticate(
                RelyingPartyAuthenticationRequest request) {
            return delegate(policy(true)).authenticate(request);
        }

        private Webauthn4JRelyingPartyOperations delegate(WebAuthnPolicyDTO policy) {
            URI issuer = URI.create(applicationProperties.authorizationServer().issuer());
            String configuredRpId = value(policy.rpId());
            String rpId = configuredRpId.isBlank() ? issuer.getHost() : configuredRpId;
            String configuredOrigin = issuer.getScheme() + "://" + issuer.getRawAuthority();
            String configuredOrigins = applicationProperties.webAuthn().allowedOrigins();
            Set<String> allowedOrigins =
                    configuredOrigins == null || configuredOrigins.isBlank()
                            ? Set.of(configuredOrigin)
                            : Arrays.stream(configuredOrigins.split(","))
                                    .map(String::trim)
                                    .filter(origin -> !origin.isBlank())
                                    .collect(Collectors.toUnmodifiableSet());
            String rpName = value(policy.rpName());
            if (rpName.isBlank()) {
                rpName = applicationProperties.webAuthn().rpName();
            }
            return new Webauthn4JRelyingPartyOperations(
                    userEntities,
                    userCredentials,
                    PublicKeyCredentialRpEntity.builder().id(rpId).name(rpName).build(),
                    allowedOrigins);
        }

        private void customizeCreation(
                PublicKeyCredentialCreationOptions.PublicKeyCredentialCreationOptionsBuilder
                        options,
                WebAuthnPolicyDTO policy) {
            options.timeout(Duration.ofSeconds(policy.timeoutSeconds()))
                    .pubKeyCredParams(algorithms(policy.signatureAlgorithms()))
                    .authenticatorSelection(
                            AuthenticatorSelectionCriteria.builder()
                                    .authenticatorAttachment(
                                            attachment(policy.authenticatorAttachment()))
                                    .residentKey(residentKey(policy.residentKey()))
                                    .userVerification(userVerification(policy.userVerification()))
                                    .build())
                    .attestation(attestation(policy.attestation()));
            if (!policy.avoidSameAuthenticator()) {
                options.excludeCredentials(List.of());
            }
        }

        private void customizeRequest(
                PublicKeyCredentialRequestOptions.PublicKeyCredentialRequestOptionsBuilder options,
                WebAuthnPolicyDTO policy) {
            options.timeout(Duration.ofSeconds(policy.timeoutSeconds()))
                    .userVerification(userVerification(policy.userVerification()));
        }

        private void enforceAaguids(CredentialRecord record, WebAuthnPolicyDTO policy) {
            Set<UUID> allowed =
                    csv(policy.acceptableAaguids()).stream()
                            .map(UUID::fromString)
                            .collect(Collectors.toUnmodifiableSet());
            if (allowed.isEmpty()) {
                return;
            }
            try {
                if (record.getAttestationObject() == null) {
                    throw new IllegalArgumentException("The authenticator AAGUID is unavailable");
                }
                AttestationObject attestation =
                        new ObjectConverter()
                                .getCborConverter()
                                .readValue(
                                        record.getAttestationObject().getBytes(),
                                        AttestationObject.class);
                UUID aaguid =
                        attestation
                                .getAuthenticatorData()
                                .getAttestedCredentialData()
                                .getAaguid()
                                .getValue();
                if (!allowed.contains(aaguid)) {
                    userCredentials.delete(record.getCredentialId());
                    throw new IllegalArgumentException("The authenticator AAGUID is not allowed");
                }
            } catch (RuntimeException ex) {
                if (userCredentials.findByCredentialId(record.getCredentialId()) != null) {
                    userCredentials.delete(record.getCredentialId());
                }
                throw ex;
            }
        }

        private WebAuthnPolicyDTO policy(boolean passwordless) {
            return loginSettingsService.webAuthnPolicy(passwordless);
        }

        private static List<String> csv(String value) {
            return value == null
                    ? List.of()
                    : Arrays.stream(value.split(","))
                            .map(String::trim)
                            .filter(item -> !item.isBlank())
                            .toList();
        }

        private static String value(String value) {
            return value == null ? "" : value.trim();
        }

        private static List<PublicKeyCredentialParameters> algorithms(String value) {
            return csv(value).stream()
                    .map(ConfigurableWebAuthnRelyingPartyOperations::algorithm)
                    .toList();
        }

        private static PublicKeyCredentialParameters algorithm(String value) {
            return switch (value.toUpperCase(Locale.ROOT)) {
                case "EDDSA" -> PublicKeyCredentialParameters.EdDSA;
                case "ES256" -> PublicKeyCredentialParameters.ES256;
                case "ES384" -> PublicKeyCredentialParameters.ES384;
                case "ES512" -> PublicKeyCredentialParameters.ES512;
                case "RS1" -> PublicKeyCredentialParameters.RS1;
                case "RS256" -> PublicKeyCredentialParameters.RS256;
                case "RS384" -> PublicKeyCredentialParameters.RS384;
                case "RS512" -> PublicKeyCredentialParameters.RS512;
                default ->
                        throw new IllegalArgumentException(
                                "Unsupported WebAuthn signature algorithm");
            };
        }

        private static AuthenticatorAttachment attachment(String value) {
            return switch (value(value).toLowerCase(Locale.ROOT)) {
                case "platform" -> AuthenticatorAttachment.PLATFORM;
                case "cross-platform" -> AuthenticatorAttachment.CROSS_PLATFORM;
                default -> null;
            };
        }

        private static ResidentKeyRequirement residentKey(String value) {
            return ResidentKeyRequirement.valueOf(value(value).toUpperCase(Locale.ROOT));
        }

        private static UserVerificationRequirement userVerification(String value) {
            return switch (value(value).toLowerCase(Locale.ROOT)) {
                case "discouraged" -> UserVerificationRequirement.DISCOURAGED;
                case "preferred" -> UserVerificationRequirement.PREFERRED;
                default -> UserVerificationRequirement.REQUIRED;
            };
        }

        private static AttestationConveyancePreference attestation(String value) {
            return AttestationConveyancePreference.valueOf(value(value).toUpperCase(Locale.ROOT));
        }
    }
}
