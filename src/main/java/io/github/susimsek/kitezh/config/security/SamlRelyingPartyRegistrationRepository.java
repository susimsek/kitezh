package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.domain.SamlProviderConfigEntity;
import io.github.susimsek.kitezh.domain.SocialProviderEntity;
import io.github.susimsek.kitezh.repository.SamlProviderConfigRepository;
import io.github.susimsek.kitezh.repository.SocialProviderRepository;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.security.saml2.Saml2Exception;
import org.springframework.security.saml2.core.Saml2X509Credential;
import org.springframework.security.saml2.provider.service.registration.RelyingPartyRegistration;
import org.springframework.security.saml2.provider.service.registration.RelyingPartyRegistrationRepository;
import org.springframework.security.saml2.provider.service.registration.RelyingPartyRegistrations;
import org.springframework.security.saml2.provider.service.registration.Saml2MessageBinding;
import org.springframework.stereotype.Repository;
import org.springframework.web.client.RestClient;

/** Resolves application-wide SAML relying-party registrations from the provider catalog. */
@Repository
public class SamlRelyingPartyRegistrationRepository implements RelyingPartyRegistrationRepository {

    private static final Logger log =
            LoggerFactory.getLogger(SamlRelyingPartyRegistrationRepository.class);

    private static final String ACS = "{baseUrl}/login/saml2/sso/{registrationId}";
    private static final String DEFAULT_SP_ENTITY_ID =
            "{baseUrl}/saml2/service-provider-metadata/{registrationId}";

    private final SocialProviderRepository providerRepository;
    private final SamlProviderConfigRepository configRepository;
    private final SocialLoginSecretCipher secretCipher;
    private final RestClient.Builder restClientBuilder;
    private final Map<String, RelyingPartyRegistration> registrations = new ConcurrentHashMap<>();

    public SamlRelyingPartyRegistrationRepository(
            SocialProviderRepository providerRepository,
            SamlProviderConfigRepository configRepository,
            SocialLoginSecretCipher secretCipher,
            RestClient.Builder restClientBuilder) {
        this.providerRepository = providerRepository;
        this.configRepository = configRepository;
        this.secretCipher = secretCipher;
        this.restClientBuilder = restClientBuilder;
    }

    @Override
    public RelyingPartyRegistration findByRegistrationId(String registrationId) {
        if (registrationId == null || registrationId.isBlank()) {
            return null;
        }
        refreshIfMissing(registrationId);
        return registrations.get(registrationId);
    }

    public synchronized void refresh() {
        registrations.clear();
        providerRepository
                .findAllByProviderTypeIgnoreCaseAndEnabledTrueOrderByGuiOrderAsc("saml")
                .forEach(this::load);
    }

    public boolean requiresSignedAssertions(String registrationId) {
        return providerRepository
                .findByAliasIgnoreCase(registrationId)
                .or(() -> providerRepository.findByRegistrationId(registrationId))
                .filter(provider -> provider.isEnabled() && isSaml(provider))
                .flatMap(provider -> configRepository.findByProviderId(provider.getId()))
                .map(SamlProviderConfigEntity::isWantAssertionsSigned)
                .orElse(true);
    }

    private void refreshIfMissing(String registrationId) {
        if (registrations.containsKey(registrationId)) {
            return;
        }
        providerRepository
                .findByAliasIgnoreCase(registrationId)
                .or(() -> providerRepository.findByRegistrationId(registrationId))
                .filter(provider -> provider.isEnabled() && isSaml(provider))
                .ifPresent(this::load);
    }

    private void load(SocialProviderEntity provider) {
        configRepository
                .findByProviderId(provider.getId())
                .flatMap(config -> build(provider, config))
                .ifPresent(
                        registration -> {
                            registrations.put(provider.getAlias(), registration);
                            if (!provider.getAlias().equals(provider.getRegistrationId())) {
                                registrations.put(provider.getRegistrationId(), registration);
                            }
                        });
    }

    private java.util.Optional<RelyingPartyRegistration> build(
            SocialProviderEntity provider, SamlProviderConfigEntity config) {
        try {
            RelyingPartyRegistration.Builder builder = baseBuilder(provider, config);
            configureServiceProvider(builder, config);
            configurePartyBindings(builder, config);
            configureCredentials(builder, config);
            return java.util.Optional.of(builder.build());
        } catch (RuntimeException exception) {
            log.warn(
                    "SAML provider {} is not available until its configuration is corrected",
                    provider.getAlias(),
                    exception);
            return java.util.Optional.empty();
        }
    }

    private RelyingPartyRegistration.Builder baseBuilder(
            SocialProviderEntity provider, SamlProviderConfigEntity config) {
        if (hasText(config.getMetadataUri())) {
            return fromMetadataLocation(config.getMetadataUri())
                    .registrationId(provider.getAlias());
        }
        RelyingPartyRegistration.Builder builder =
                RelyingPartyRegistration.withRegistrationId(provider.getAlias());
        builder.assertingPartyMetadata(
                party -> {
                    party.entityId(required(config.getAssertingPartyEntityId()))
                            .singleSignOnServiceLocation(
                                    required(config.getSingleSignOnServiceUrl()))
                            .wantAuthnRequestsSigned(config.isSignAuthnRequests())
                            .verificationX509Credentials(
                                    credentials ->
                                            certificates(config.getIdpCertificate())
                                                    .forEach(
                                                            certificate ->
                                                                    credentials.add(
                                                                            Saml2X509Credential
                                                                                    .verification(
                                                                                            certificate))));
                });
        return builder;
    }

    private static void configureServiceProvider(
            RelyingPartyRegistration.Builder builder, SamlProviderConfigEntity config) {
        builder.entityId(
                        hasText(config.getServiceProviderEntityId())
                                ? config.getServiceProviderEntityId()
                                : DEFAULT_SP_ENTITY_ID)
                .assertionConsumerServiceLocation(ACS)
                .assertionConsumerServiceBinding(requiredBinding(config.getResponseBinding()))
                .authnRequestsSigned(config.isSignAuthnRequests());
        if (hasText(config.getNameIdFormat())) {
            builder.nameIdFormat(config.getNameIdFormat());
        }
        builder.singleLogoutServiceLocation("{baseUrl}/logout/saml2/slo/{registrationId}");
        if (hasText(config.getLogoutBinding())) {
            builder.singleLogoutServiceBinding(requiredBinding(config.getLogoutBinding()));
        }
    }

    private static void configurePartyBindings(
            RelyingPartyRegistration.Builder builder, SamlProviderConfigEntity config) {
        builder.assertingPartyMetadata(
                party -> {
                    if (hasText(config.getSingleLogoutServiceUrl())) {
                        party.singleLogoutServiceLocation(config.getSingleLogoutServiceUrl());
                    }
                    if (hasText(config.getAuthnRequestBinding())) {
                        party.singleSignOnServiceBinding(
                                requiredBinding(config.getAuthnRequestBinding()));
                    }
                    if (hasText(config.getLogoutBinding())) {
                        party.singleLogoutServiceBinding(
                                requiredBinding(config.getLogoutBinding()));
                    }
                    if (hasText(config.getSignatureAlgorithm())) {
                        party.signingAlgorithms(
                                algorithms ->
                                        algorithms.add(config.getSignatureAlgorithm().trim()));
                    }
                });
    }

    private void configureCredentials(
            RelyingPartyRegistration.Builder builder, SamlProviderConfigEntity config) {
        if (config.isSignAuthnRequests()) {
            builder.signingX509Credentials(
                    credentials ->
                            credentials.add(
                                    Saml2X509Credential.signing(
                                            privateKey(
                                                    secretCipher.decrypt(
                                                            required(
                                                                    config
                                                                            .getSigningPrivateKeyEncrypted()))),
                                            certificate(config.getSigningCertificate()))));
        }
        if (hasText(config.getDecryptionPrivateKeyEncrypted())
                && hasText(config.getDecryptionCertificate())) {
            builder.decryptionX509Credentials(
                    credentials ->
                            credentials.add(
                                    Saml2X509Credential.decryption(
                                            privateKey(
                                                    secretCipher.decrypt(
                                                            config
                                                                    .getDecryptionPrivateKeyEncrypted())),
                                            certificate(config.getDecryptionCertificate()))));
        }
    }

    private static boolean isSaml(SocialProviderEntity provider) {
        return "saml".equalsIgnoreCase(provider.getProviderType());
    }

    private RelyingPartyRegistration.Builder fromMetadataLocation(String metadataUri) {
        try {
            return RelyingPartyRegistrations.fromMetadataLocation(metadataUri);
        } catch (Saml2Exception exception) {
            if (!isContactPersonCompatibilityIssue(exception)) {
                throw exception;
            }
            String metadata =
                    restClientBuilder
                            .build()
                            .get()
                            .uri(metadataUri)
                            .accept(MediaType.APPLICATION_XML)
                            .retrieve()
                            .body(String.class);
            if (metadata == null || metadata.isBlank()) {
                throw exception;
            }
            return RelyingPartyRegistrations.fromMetadata(
                    new ByteArrayInputStream(
                            removeContactPersonElements(metadata)
                                    .getBytes(StandardCharsets.UTF_8)));
        }
    }

    private static boolean isContactPersonCompatibilityIssue(Throwable exception) {
        for (Throwable current = exception; current != null; current = current.getCause()) {
            String message = current.getMessage();
            if (message != null && message.contains("invalid value for contactType attribute")) {
                return true;
            }
        }
        return false;
    }

    static String removeContactPersonElements(String metadata) {
        return metadata.replaceAll(
                "(?s)<(?:[A-Za-z_][\\w.-]*:)?ContactPerson\\b[^>]*>.*?</(?:[A-Za-z_][\\w.-]*:)?ContactPerson\\s*>",
                "");
    }

    private static String required(String value) {
        if (!hasText(value)) {
            throw new IllegalArgumentException("Required SAML configuration is missing");
        }
        return value.trim();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static X509Certificate certificate(String pem) {
        return certificates(pem).getFirst();
    }

    private static List<X509Certificate> certificates(String pem) {
        try {
            java.util.regex.Matcher matcher =
                    java.util.regex.Pattern.compile(
                                    "-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----",
                                    java.util.regex.Pattern.DOTALL)
                            .matcher(pem);
            List<X509Certificate> certificates = new java.util.ArrayList<>();
            while (matcher.find()) {
                String encoded = matcher.group(1).replaceAll("\\s", "");
                certificates.add(
                        (X509Certificate)
                                CertificateFactory.getInstance("X.509")
                                        .generateCertificate(
                                                new ByteArrayInputStream(
                                                        Base64.getDecoder().decode(encoded))));
            }
            if (certificates.isEmpty()) {
                throw new IllegalArgumentException("No certificate was found");
            }
            return certificates;
        } catch (Exception exception) {
            throw new IllegalArgumentException("The SAML certificate is invalid", exception);
        }
    }

    private static Saml2MessageBinding binding(String value) {
        if (!hasText(value)) {
            return Saml2MessageBinding.REDIRECT;
        }
        return switch (value.trim().toUpperCase(java.util.Locale.ROOT)) {
            case "POST" -> Saml2MessageBinding.POST;
            case "REDIRECT" -> Saml2MessageBinding.REDIRECT;
            default -> Saml2MessageBinding.from(value.trim());
        };
    }

    private static Saml2MessageBinding requiredBinding(String value) {
        Saml2MessageBinding binding = binding(value);
        if (binding == null) {
            throw new IllegalArgumentException("Unsupported SAML message binding: " + value);
        }
        return binding;
    }

    private static PrivateKey privateKey(String pem) {
        try {
            String encoded =
                    pem.replace("-----BEGIN PRIVATE KEY-----", "")
                            .replace("-----END PRIVATE KEY-----", "")
                            .replaceAll("\\s", "");
            byte[] bytes = Base64.getDecoder().decode(encoded);
            PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(bytes);
            for (String algorithm : new String[] {"RSA", "EC", "DSA"}) {
                Optional<PrivateKey> key = privateKeyForAlgorithm(spec, algorithm);
                if (key.isPresent()) {
                    return key.get();
                }
            }
            throw new IllegalArgumentException("The SAML signing key algorithm is unsupported");
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException(
                    "The SAML signing private key is invalid", exception);
        }
    }

    private static Optional<PrivateKey> privateKeyForAlgorithm(
            PKCS8EncodedKeySpec spec, String algorithm) {
        try {
            return Optional.of(KeyFactory.getInstance(algorithm).generatePrivate(spec));
        } catch (java.security.GeneralSecurityException _) {
            return Optional.empty();
        }
    }
}
