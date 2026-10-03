package io.github.susimsek.springauthserversamples.service.admin;

import io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity;
import io.github.susimsek.springauthserversamples.domain.ServiceAccountEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientCreatedDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientRequestDTO;
import io.github.susimsek.springauthserversamples.mapper.AdminClientMapper;
import io.github.susimsek.springauthserversamples.mapper.AuthorizationServerMapperSupport;
import io.github.susimsek.springauthserversamples.mapper.RegisteredClientMapper;
import io.github.susimsek.springauthserversamples.repository.AuthorizationConsentRepository;
import io.github.susimsek.springauthserversamples.repository.AuthorizationRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.repository.ServiceAccountRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.security.AuthorizationGrantTypes;
import io.github.susimsek.springauthserversamples.security.ClientSecuritySettings;
import io.github.susimsek.springauthserversamples.security.OfflineAccessSettings;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor(onConstructor_ = @org.springframework.beans.factory.annotation.Autowired)
@SuppressWarnings("java:S4449")
public class AdminClientService {

    private static final String CLIENT_TARGET = "client";
    private static final String CLIENT_ID_FIELD = "clientId";
    private static final String CLIENT_AUTHENTICATION_METHODS_FIELD = "clientAuthenticationMethods";
    private static final String AUTHORIZATION_GRANT_TYPES_FIELD = "authorizationGrantTypes";

    private static final String ADMIN_CONSOLE_CLIENT_ID = "admin-console";
    private static final Duration DEFAULT_AUTHORIZATION_CODE_TTL = Duration.ofMinutes(5);
    private static final Duration DEFAULT_ACCESS_TOKEN_TTL = Duration.ofMinutes(5);
    private static final Duration DEFAULT_REFRESH_TOKEN_TTL = Duration.ofHours(1);
    private static final Duration DEFAULT_SECRET_GRACE_PERIOD = Duration.ofHours(24);

    private final ClientRepository clientRepository;
    private final AuthorizationRepository authorizationRepository;
    private final AuthorizationConsentRepository authorizationConsentRepository;
    private final RegisteredClientMapper registeredClientMapper;
    private final AuthorizationServerMapperSupport mapperSupport;
    private final PasswordEncoder passwordEncoder;
    private final AdminAuditEventService adminAuditEventService;
    private final AdminClientMapper adminClientMapper;
    private final ServiceAccountRepository serviceAccountRepository;
    private final UserRepository userRepository;

    public AdminClientService(
            ClientRepository clientRepository,
            AuthorizationRepository authorizationRepository,
            AuthorizationConsentRepository authorizationConsentRepository,
            RegisteredClientMapper registeredClientMapper,
            AuthorizationServerMapperSupport mapperSupport,
            PasswordEncoder passwordEncoder,
            AdminAuditEventService adminAuditEventService) {
        this(
                clientRepository,
                authorizationRepository,
                authorizationConsentRepository,
                registeredClientMapper,
                mapperSupport,
                passwordEncoder,
                adminAuditEventService,
                null,
                null,
                null);
    }

    @Transactional(readOnly = true)
    public Page<AdminClientDTO> findAll(String query, Pageable pageable) {
        String searchQuery = AdminSearch.normalize(query);
        Page<RegisteredClientEntity> clients =
                clientRepository.findByClientIdContainingIgnoreCaseOrClientNameContainingIgnoreCase(
                        searchQuery, searchQuery, pageable);
        Map<String, ServiceAccountEntity> serviceAccounts = serviceAccounts(clients.getContent());
        return clients.map(
                entity ->
                        adminClientMapper.toDTO(
                                registeredClientMapper.toObject(entity, mapperSupport),
                                entity.getId() != null
                                        && serviceAccounts.containsKey(entity.getId()),
                                entity.getId() == null
                                        ? null
                                        : serviceAccountUsername(
                                                serviceAccounts.get(entity.getId()))));
    }

    @Transactional(readOnly = true)
    public AdminClientDTO findById(String id) {
        return clientRepository
                .findById(id)
                .map(
                        entity -> {
                            RegisteredClient client =
                                    registeredClientMapper.toObject(entity, mapperSupport);
                            ServiceAccountEntity account = serviceAccount(id);
                            return adminClientMapper.toDTO(
                                    client, account != null, serviceAccountUsername(account));
                        })
                .orElse(null);
    }

    @Transactional
    @CacheEvict(
            cacheNames = ClientRepository.REGISTERED_CLIENT_BY_CLIENT_ID_CACHE,
            allEntries = true)
    public AdminClientCreatedDTO create(AdminClientRequestDTO request) {
        validate(request);
        if (clientRepository.existsByClientId(request.clientId())) {
            throw ApiException.conflict(
                    CLIENT_ID_FIELD,
                    ApiErrorCode.CLIENT_DUPLICATE_CLIENT_ID,
                    "Client ID is already registered");
        }

        String rawSecret = requiresSecret(request) ? generateSecret() : null;
        RegisteredClient.Builder clientBuilder =
                RegisteredClient.withId(UUID.randomUUID().toString())
                        .clientId(request.clientId())
                        .clientIdIssuedAt(Instant.now())
                        .clientSecret(rawSecret == null ? null : passwordEncoder.encode(rawSecret));
        if (rawSecret != null && request.clientSecretTimeToLive() != null) {
            clientBuilder.clientSecretExpiresAt(
                    Instant.now().plus(request.clientSecretTimeToLive()));
        }
        RegisteredClient client = apply(clientBuilder, request, null).build();

        RegisteredClient savedClient = save(client);
        updateServiceAccount(savedClient, request.serviceAccountEnabled());
        AdminClientDTO saved = clientDTO(savedClient);
        adminAuditEventService.record("client.created", CLIENT_TARGET, saved.id());
        return adminClientMapper.toCreatedDTO(saved, rawSecret);
    }

    @Transactional
    @CacheEvict(
            cacheNames = ClientRepository.REGISTERED_CLIENT_BY_CLIENT_ID_CACHE,
            allEntries = true)
    public AdminClientDTO update(String id, AdminClientRequestDTO request) {
        validate(request);
        RegisteredClient existing = findRequired(id);
        rejectAdminConsoleMutation(existing);
        if (!existing.getClientId().equals(request.clientId())
                && clientRepository.existsByClientId(request.clientId())) {
            throw ApiException.conflict(
                    CLIENT_ID_FIELD,
                    ApiErrorCode.CLIENT_DUPLICATE_CLIENT_ID,
                    "Client ID is already registered");
        }

        RegisteredClient.Builder builder =
                RegisteredClient.from(existing)
                        .clientId(request.clientId())
                        .clientName(request.clientName());

        if (!requiresSecret(request)) {
            builder.clientSecret(null).clientSecretExpiresAt(null);
        } else if (existing.getClientSecret() == null) {
            throw ApiException.badRequest(
                    CLIENT_AUTHENTICATION_METHODS_FIELD,
                    ApiErrorCode.CLIENT_SECRET_REQUIRED,
                    "Regenerate a client secret before enabling a secret authentication method");
        } else if (request.clientSecretTimeToLive() != null) {
            builder.clientSecretExpiresAt(Instant.now().plus(request.clientSecretTimeToLive()));
        }

        RegisteredClient updated = apply(builder, request, existing).build();
        RegisteredClient savedClient = save(updated);
        updateServiceAccount(savedClient, request.serviceAccountEnabled());
        AdminClientDTO saved = clientDTO(savedClient);
        adminAuditEventService.record("client.updated", CLIENT_TARGET, saved.id());
        return saved;
    }

    @Transactional
    @CacheEvict(
            cacheNames = ClientRepository.REGISTERED_CLIENT_BY_CLIENT_ID_CACHE,
            allEntries = true)
    public void delete(String id) {
        rejectAdminConsoleMutation(findRequired(id));
        authorizationRepository.deleteByRegisteredClientId(id);
        authorizationConsentRepository.deleteByIdRegisteredClientId(id);
        removeServiceAccount(id);
        clientRepository.deleteById(id);
        adminAuditEventService.record("client.deleted", CLIENT_TARGET, id);
    }

    @Transactional
    @CacheEvict(
            cacheNames = ClientRepository.REGISTERED_CLIENT_BY_CLIENT_ID_CACHE,
            allEntries = true)
    public String regenerateSecret(String id) {
        RegisteredClient existing = findRequired(id);
        rejectAdminConsoleMutation(existing);
        String rawSecret = generateSecret();
        Map<String, Object> settings = new HashMap<>(existing.getClientSettings().getSettings());
        if (existing.getClientSecret() == null) {
            settings.remove(ClientSecuritySettings.PREVIOUS_SECRET);
            settings.remove(ClientSecuritySettings.PREVIOUS_SECRET_EXPIRES_AT);
        } else {
            settings.put(ClientSecuritySettings.PREVIOUS_SECRET, existing.getClientSecret());
            settings.put(
                    ClientSecuritySettings.PREVIOUS_SECRET_EXPIRES_AT,
                    Instant.now().plus(secretGracePeriod(existing)).toString());
        }
        RegisteredClient updated =
                RegisteredClient.from(existing)
                        .clientSecret(passwordEncoder.encode(rawSecret))
                        .clientSettings(ClientSettings.withSettings(settings).build())
                        .build();
        save(updated);
        adminAuditEventService.record("client.secret.regenerated", CLIENT_TARGET, id);
        return rawSecret;
    }

    private Map<String, ServiceAccountEntity> serviceAccounts(
            List<RegisteredClientEntity> clients) {
        if (serviceAccountRepository == null || clients.isEmpty()) {
            return Map.of();
        }
        return serviceAccountRepository
                .findAllByClientIdIn(clients.stream().map(RegisteredClientEntity::getId).toList())
                .stream()
                .collect(
                        java.util.stream.Collectors.toMap(
                                ServiceAccountEntity::getClientId, account -> account));
    }

    private ServiceAccountEntity serviceAccount(String clientId) {
        return serviceAccountRepository == null
                ? null
                : serviceAccountRepository.findByClientId(clientId).orElse(null);
    }

    private AdminClientDTO clientDTO(RegisteredClient client) {
        ServiceAccountEntity account = serviceAccount(client.getId());
        return adminClientMapper.toDTO(client, account != null, serviceAccountUsername(account));
    }

    private void updateServiceAccount(RegisteredClient client, boolean enabled) {
        if (serviceAccountRepository == null || userRepository == null) {
            return;
        }
        ServiceAccountEntity existing = serviceAccount(client.getId());
        if (enabled) {
            if (existing == null) {
                UserEntity saved = userRepository.save(serviceAccountUser(client.getClientId()));
                serviceAccountRepository.save(new ServiceAccountEntity(client.getId(), saved));
            } else {
                UserEntity user = existing.getUser();
                String previousUsername = user.getUsername();
                String username = serviceAccountUsername(client.getClientId());
                if (!username.equals(previousUsername)) {
                    authorizationRepository.deleteByPrincipalName(previousUsername);
                    user.setUsername(username);
                }
                user.setEnabled(true);
                user.setServiceAccount(true);
                userRepository.save(user);
            }
        } else if (existing != null) {
            authorizationRepository.deleteByPrincipalName(existing.getUser().getUsername());
            serviceAccountRepository.delete(existing);
            userRepository.delete(existing.getUser());
        }
    }

    private void removeServiceAccount(String clientId) {
        if (serviceAccountRepository == null || userRepository == null) {
            return;
        }
        ServiceAccountEntity existing = serviceAccount(clientId);
        if (existing != null) {
            authorizationRepository.deleteByPrincipalName(existing.getUser().getUsername());
            serviceAccountRepository.delete(existing);
            userRepository.delete(existing.getUser());
        }
    }

    private UserEntity serviceAccountUser(String clientId) {
        UserEntity user = new UserEntity();
        user.setUsername(serviceAccountUsername(clientId));
        user.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setEnabled(true);
        user.setServiceAccount(true);
        user.setEmailVerified(true);
        user.setAuthorities(new HashSet<>());
        user.setClientRoles(new HashSet<>());
        user.setGroups(new HashSet<>());
        return user;
    }

    private static String serviceAccountUsername(ServiceAccountEntity account) {
        return account == null || account.getUser() == null
                ? null
                : account.getUser().getUsername();
    }

    private static String serviceAccountUsername(String clientId) {
        return "service-account-" + clientId;
    }

    private static void validate(AdminClientRequestDTO request) {
        if (request == null) {
            throw ApiException.badRequest(
                    ApiErrorCode.CLIENT_INVALID_REQUEST, "Request body is required");
        }
        validateRequiredFields(request);
        validateMethodAndGrantRules(request);
        validateUrisAndDurations(request);
    }

    private static void validateRequiredFields(AdminClientRequestDTO request) {
        if (!hasText(request.clientId())) {
            throw ApiException.badRequest(
                    CLIENT_ID_FIELD,
                    ApiErrorCode.CLIENT_INVALID_CLIENT_ID,
                    "Client ID is required");
        }
        if (!hasText(request.clientName())) {
            throw ApiException.badRequest(
                    "clientName",
                    ApiErrorCode.CLIENT_INVALID_CLIENT_NAME,
                    "Client name is required");
        }
        requireNonEmpty(
                request.clientAuthenticationMethods(),
                CLIENT_AUTHENTICATION_METHODS_FIELD,
                ApiErrorCode.CLIENT_INVALID_AUTHENTICATION_METHODS,
                "At least one client authentication method is required");
        requireNonEmpty(
                request.authorizationGrantTypes(),
                AUTHORIZATION_GRANT_TYPES_FIELD,
                ApiErrorCode.CLIENT_INVALID_GRANT_TYPES,
                "At least one authorization grant type is required");
        requireNonEmpty(
                request.scopes(),
                "scopes",
                ApiErrorCode.CLIENT_INVALID_SCOPES,
                "At least one scope is required");
    }

    private static void validateMethodAndGrantRules(AdminClientRequestDTO request) {
        Set<String> methods = request.clientAuthenticationMethods();
        Set<String> grants = request.authorizationGrantTypes();
        Set<String> redirectUris = nullSafe(request.redirectUris());

        boolean publicClient = methods.contains(ClientAuthenticationMethod.NONE.getValue());
        if (publicClient && methods.size() > 1) {
            throw ApiException.badRequest(
                    CLIENT_AUTHENTICATION_METHODS_FIELD,
                    ApiErrorCode.CLIENT_INVALID_AUTHENTICATION_METHODS,
                    "The 'none' authentication method cannot be combined with other methods");
        }
        if (publicClient && grants.contains(AuthorizationGrantType.CLIENT_CREDENTIALS.getValue())) {
            throw ApiException.badRequest(
                    AUTHORIZATION_GRANT_TYPES_FIELD,
                    ApiErrorCode.CLIENT_INVALID_GRANT_TYPES,
                    "A public client cannot use the client_credentials grant");
        }
        if (grants.contains(AuthorizationGrantType.AUTHORIZATION_CODE.getValue())
                && redirectUris.isEmpty()) {
            throw ApiException.badRequest(
                    "redirectUris",
                    ApiErrorCode.CLIENT_REDIRECT_URI_REQUIRED,
                    "At least one redirect URI is required for authorization_code");
        }
        if (publicClient
                && grants.contains(AuthorizationGrantType.AUTHORIZATION_CODE.getValue())
                && !request.requireProofKey()) {
            throw ApiException.badRequest(
                    AUTHORIZATION_GRANT_TYPES_FIELD,
                    ApiErrorCode.CLIENT_PKCE_REQUIRED,
                    "PKCE must be required for a public authorization_code client");
        }
        if (request.requireProofKey()
                && !grants.contains(AuthorizationGrantType.AUTHORIZATION_CODE.getValue())) {
            throw ApiException.badRequest(
                    AUTHORIZATION_GRANT_TYPES_FIELD,
                    ApiErrorCode.CLIENT_INVALID_PKCE,
                    "PKCE requires the authorization_code grant");
        }
        if (request.serviceAccountEnabled()
                && !grants.contains(AuthorizationGrantType.CLIENT_CREDENTIALS.getValue())) {
            throw ApiException.badRequest(
                    AUTHORIZATION_GRANT_TYPES_FIELD,
                    ApiErrorCode.CLIENT_INVALID_GRANT_TYPES,
                    "A service account requires the client_credentials grant");
        }
        if (methods.contains(ClientAuthenticationMethod.TLS_CLIENT_AUTH.getValue())
                && !hasText(request.x509CertificateSubjectDN())) {
            throw ApiException.badRequest(
                    "x509CertificateSubjectDN",
                    ApiErrorCode.CLIENT_INVALID_AUTHENTICATION_METHODS,
                    "A certificate subject DN is required for tls_client_auth");
        }
        validatePrivateKeyJwt(request, methods);
    }

    private static void validatePrivateKeyJwt(AdminClientRequestDTO request, Set<String> methods) {
        if (!methods.contains(ClientAuthenticationMethod.PRIVATE_KEY_JWT.getValue())) {
            return;
        }
        if (!hasText(request.jwkSetUrl())) {
            throw ApiException.badRequest(
                    "jwkSetUrl",
                    ApiErrorCode.CLIENT_INVALID_URI,
                    "A JWKS URL is required for private_key_jwt");
        }
        if (!hasText(request.tokenEndpointAuthenticationSigningAlgorithm())) {
            throw ApiException.badRequest(
                    "tokenEndpointAuthenticationSigningAlgorithm",
                    ApiErrorCode.CLIENT_INVALID_AUTHENTICATION_METHODS,
                    "A signing algorithm is required for private_key_jwt");
        }
    }

    private static void validateUrisAndDurations(AdminClientRequestDTO request) {
        Set<String> redirectUris = nullSafe(request.redirectUris());
        redirectUris.forEach(uri -> validateUri("redirectUris", "redirect URI", uri));
        nullSafe(request.postLogoutRedirectUris())
                .forEach(
                        uri ->
                                validateUri(
                                        "postLogoutRedirectUris", "post logout redirect URI", uri));

        validateOptionalUri("rootUrl", "root URL", request.rootUrl());
        validateOptionalUri("homeUrl", "home URL", request.homeUrl());
        validateOptionalUri("adminUrl", "admin URL", request.adminUrl());
        nullSafe(request.webOrigins()).forEach(uri -> validateUri("webOrigins", "web origin", uri));
        validateOptionalUri("jwkSetUrl", "JWKS URL", request.jwkSetUrl());

        validatePositiveDuration(
                "authorizationCodeTimeToLive",
                "authorization code TTL",
                request.authorizationCodeTimeToLive());
        validatePositiveDuration(
                "accessTokenTimeToLive", "access token TTL", request.accessTokenTimeToLive());
        validatePositiveDuration(
                "refreshTokenTimeToLive", "refresh token TTL", request.refreshTokenTimeToLive());
        validatePositiveDuration(
                "offlineSessionIdle", "offline session idle", request.offlineSessionIdle());
        validatePositiveDuration(
                "offlineSessionMax", "offline session max", request.offlineSessionMax());
        if (request.offlineSessionIdle() != null
                && request.offlineSessionMax() != null
                && request.offlineSessionMax().compareTo(request.offlineSessionIdle()) < 0) {
            throw ApiException.badRequest(
                    "offlineSessionMax",
                    ApiErrorCode.CLIENT_INVALID_REQUEST,
                    "Offline session max must be greater than or equal to idle timeout");
        }
        validatePositiveDuration(
                "clientSecretTimeToLive", "client secret TTL", request.clientSecretTimeToLive());
        validatePositiveDuration(
                "clientSecretGracePeriod",
                "client secret grace period",
                request.clientSecretGracePeriod());
        validateCiba(request, request.authorizationGrantTypes());
    }

    private RegisteredClient save(RegisteredClient client) {
        return registeredClientMapper.toObject(
                clientRepository.save(registeredClientMapper.toEntity(client, mapperSupport)),
                mapperSupport);
    }

    private RegisteredClient findRequired(String id) {
        return clientRepository
                .findById(id)
                .map(entity -> registeredClientMapper.toObject(entity, mapperSupport))
                .orElseThrow(() -> ApiException.notFound("Client not found"));
    }

    private static void rejectAdminConsoleMutation(RegisteredClient client) {
        if (ADMIN_CONSOLE_CLIENT_ID.equals(client.getClientId())) {
            throw ApiException.badRequest(
                    ApiErrorCode.CLIENT_PROTECTED,
                    "The administration console client cannot be changed");
        }
    }

    private static RegisteredClient.Builder apply(
            RegisteredClient.Builder builder,
            AdminClientRequestDTO request,
            RegisteredClient existing) {
        builder.clientName(request.clientName())
                .clientAuthenticationMethods(
                        methods -> {
                            methods.clear();
                            request.clientAuthenticationMethods().stream()
                                    .map(ClientAuthenticationMethod::new)
                                    .forEach(methods::add);
                        })
                .authorizationGrantTypes(
                        grantTypes -> {
                            grantTypes.clear();
                            request.authorizationGrantTypes().stream()
                                    .map(AuthorizationGrantType::new)
                                    .forEach(grantTypes::add);
                        })
                .redirectUris(
                        uris -> {
                            uris.clear();
                            uris.addAll(nullSafe(request.redirectUris()));
                        })
                .postLogoutRedirectUris(
                        uris -> {
                            uris.clear();
                            uris.addAll(nullSafe(request.postLogoutRedirectUris()));
                        })
                .scopes(
                        scopes -> {
                            scopes.clear();
                            scopes.addAll(request.scopes());
                        })
                .clientSettings(buildClientSettings(request, existing))
                .tokenSettings(buildTokenSettings(request, existing));
        return builder;
    }

    private static ClientSettings buildClientSettings(
            AdminClientRequestDTO request, RegisteredClient existing) {
        ClientSettings settings = initialClientSettings(request, existing);
        var values = new HashMap<>(settings.getSettings());
        applyBaseClientSettings(values, request, existing);
        applyOptionalClientSettings(values, request, existing);
        settings = ClientSettings.withSettings(values).build();
        return withDefaultScopes(settings, request, existing);
    }

    private static ClientSettings initialClientSettings(
            AdminClientRequestDTO request, RegisteredClient existing) {
        ClientSettings.Builder builder =
                existing == null
                        ? ClientSettings.builder()
                        : ClientSettings.withSettings(
                                new HashMap<>(existing.getClientSettings().getSettings()));
        return builder.requireAuthorizationConsent(request.requireAuthorizationConsent())
                .requireProofKey(request.requireProofKey())
                .build();
    }

    private static void applyBaseClientSettings(
            Map<String, Object> values, AdminClientRequestDTO request, RegisteredClient existing) {
        values.put(ClientSecuritySettings.REQUIRE_DPOP_PROOF, request.requireDpop());
        values.put(ClientSecuritySettings.REQUIRE_DPOP_JKT, request.requireDpopJkt());
        values.put(ClientSecuritySettings.DPOP_REFRESH_TOKEN_ONLY, request.dpopRefreshTokenOnly());
        values.put(ClientSecuritySettings.DPOP_SIGNING_ALGORITHMS, request.dpopSigningAlgorithms());
        if (request.enabled() != null || existing == null) {
            values.put(
                    ClientSecuritySettings.CLIENT_ENABLED,
                    request.enabled() == null || request.enabled());
        }
    }

    private static void applyOptionalClientSettings(
            Map<String, Object> values, AdminClientRequestDTO request, RegisteredClient existing) {
        applyOptionalUrls(values, request, existing);
        applyOptionalLogoutSettings(values, request);
        applyOptionalAuthenticationSettings(values, request, existing);
        applyCibaSettings(values, request);
    }

    private static void applyOptionalUrls(
            Map<String, Object> values, AdminClientRequestDTO request, RegisteredClient existing) {
        if (request.rootUrl() != null) {
            putOrRemove(values, ClientSecuritySettings.ROOT_URL, request.rootUrl());
        }
        if (request.homeUrl() != null) {
            putOrRemove(values, ClientSecuritySettings.HOME_URL, request.homeUrl());
        }
        if (request.adminUrl() != null) {
            putOrRemove(values, ClientSecuritySettings.ADMIN_URL, request.adminUrl());
        }
        if (request.webOrigins() == null) {
            if (existing == null) {
                values.remove(ClientSecuritySettings.WEB_ORIGINS);
            }
        } else {
            values.put(ClientSecuritySettings.WEB_ORIGINS, request.webOrigins());
        }
    }

    private static void applyOptionalLogoutSettings(
            Map<String, Object> values, AdminClientRequestDTO request) {
        if (request.frontChannelLogout() != null) {
            values.put(ClientSecuritySettings.FRONT_CHANNEL_LOGOUT, request.frontChannelLogout());
        }
        if (request.backchannelLogout() != null) {
            values.put(ClientSecuritySettings.BACK_CHANNEL_LOGOUT, request.backchannelLogout());
        }
    }

    private static void applyOptionalAuthenticationSettings(
            Map<String, Object> values, AdminClientRequestDTO request, RegisteredClient existing) {
        if (request.jwkSetUrl() != null) {
            putOrRemove(
                    values,
                    org.springframework.security.oauth2.server.authorization.settings
                            .ConfigurationSettingNames.Client.JWK_SET_URL,
                    request.jwkSetUrl());
        }
        if (request.clientSecretGracePeriod() != null) {
            values.put(
                    ClientSecuritySettings.SECRET_GRACE_PERIOD_SECONDS,
                    request.clientSecretGracePeriod().toSeconds());
        }
        if (hasText(request.tokenEndpointAuthenticationSigningAlgorithm())) {
            SignatureAlgorithm algorithm =
                    SignatureAlgorithm.from(request.tokenEndpointAuthenticationSigningAlgorithm());
            if (algorithm != null) {
                values.put(
                        org.springframework.security.oauth2.server.authorization.settings
                                .ConfigurationSettingNames.Client
                                .TOKEN_ENDPOINT_AUTHENTICATION_SIGNING_ALGORITHM,
                        algorithm);
            }
        } else if (existing == null || !hasPrivateKeyJwt(request)) {
            values.remove(
                    org.springframework.security.oauth2.server.authorization.settings
                            .ConfigurationSettingNames.Client
                            .TOKEN_ENDPOINT_AUTHENTICATION_SIGNING_ALGORITHM);
        }
        if (request.x509CertificateSubjectDN() != null) {
            putOrRemove(
                    values,
                    org.springframework.security.oauth2.server.authorization.settings
                            .ConfigurationSettingNames.Client.X509_CERTIFICATE_SUBJECT_DN,
                    request.x509CertificateSubjectDN());
        }
    }

    private static void applyCibaSettings(
            Map<String, Object> values, AdminClientRequestDTO request) {
        String cibaDeliveryMode = resolveCibaDeliveryMode(request);
        values.put(ClientSecuritySettings.CIBA_DELIVERY_MODE, cibaDeliveryMode);
        if (ClientSecuritySettings.CIBA_POLL.equals(cibaDeliveryMode)) {
            values.remove(ClientSecuritySettings.CIBA_NOTIFICATION_ENDPOINT);
            values.remove(ClientSecuritySettings.CIBA_CLIENT_NOTIFICATION_TOKEN);
        } else {
            values.put(
                    ClientSecuritySettings.CIBA_NOTIFICATION_ENDPOINT,
                    request.cibaNotificationEndpoint());
            values.remove(ClientSecuritySettings.CIBA_CLIENT_NOTIFICATION_TOKEN);
        }
    }

    private static ClientSettings withDefaultScopes(
            ClientSettings settings, AdminClientRequestDTO request, RegisteredClient existing) {
        if (existing == null
                || existing.getClientSettings().getSetting(ClientScopeSettings.DEFAULT_SCOPES)
                        == null) {
            return ClientScopeSettings.withAssignments(
                    settings, new java.util.LinkedHashSet<>(request.scopes()), java.util.Set.of());
        }
        return settings;
    }

    private static TokenSettings buildTokenSettings(
            AdminClientRequestDTO request, RegisteredClient existing) {
        TokenSettings.Builder builder =
                existing == null
                        ? TokenSettings.builder()
                        : TokenSettings.withSettings(
                                new HashMap<>(existing.getTokenSettings().getSettings()));

        Duration authorizationCodeTtl =
                resolveTtl(
                        request.authorizationCodeTimeToLive(),
                        DEFAULT_AUTHORIZATION_CODE_TTL,
                        existing == null
                                ? null
                                : existing.getTokenSettings().getAuthorizationCodeTimeToLive());
        Duration accessTokenTtl =
                resolveTtl(
                        request.accessTokenTimeToLive(),
                        DEFAULT_ACCESS_TOKEN_TTL,
                        existing == null
                                ? null
                                : existing.getTokenSettings().getAccessTokenTimeToLive());
        Duration refreshTokenTtl =
                resolveTtl(
                        request.refreshTokenTimeToLive(),
                        DEFAULT_REFRESH_TOKEN_TTL,
                        existing == null
                                ? null
                                : existing.getTokenSettings().getRefreshTokenTimeToLive());

        Map<String, Object> settings = new HashMap<>(builder.build().getSettings());
        applyOptionalOfflineSetting(
                settings, OfflineAccessSettings.OFFLINE_SESSION_IDLE, request.offlineSessionIdle());
        applyOptionalOfflineSetting(
                settings, OfflineAccessSettings.OFFLINE_SESSION_MAX, request.offlineSessionMax());
        return TokenSettings.withSettings(settings)
                .authorizationCodeTimeToLive(authorizationCodeTtl)
                .accessTokenTimeToLive(accessTokenTtl)
                .refreshTokenTimeToLive(refreshTokenTtl)
                .build();
    }

    private static void applyOptionalOfflineSetting(
            Map<String, Object> settings, String key, Duration value) {
        if (value == null) {
            settings.remove(key);
        } else {
            settings.put(key, value.toString());
        }
    }

    private static Duration resolveTtl(
            Duration requested, Duration defaultValue, Duration existingValue) {
        if (requested != null) {
            return requested;
        }
        return existingValue == null ? defaultValue : existingValue;
    }

    private static boolean requiresSecret(AdminClientRequestDTO request) {
        return request.clientAuthenticationMethods().stream()
                .map(ClientAuthenticationMethod::new)
                .anyMatch(AdminClientService::isSecretMethod);
    }

    private static void validateCiba(AdminClientRequestDTO request, Set<String> grants) {
        String mode = resolveCibaDeliveryMode(request);
        if (!ClientSecuritySettings.CIBA_DELIVERY_MODES.contains(mode)) {
            throw ApiException.badRequest(
                    "cibaDeliveryMode",
                    ApiErrorCode.CLIENT_INVALID_REQUEST,
                    "CIBA delivery mode must be poll, ping, or push");
        }
        if (!ClientSecuritySettings.CIBA_POLL.equals(mode)
                && !grants.contains(AuthorizationGrantTypes.CIBA)) {
            throw ApiException.badRequest(
                    AUTHORIZATION_GRANT_TYPES_FIELD,
                    ApiErrorCode.CLIENT_INVALID_GRANT_TYPES,
                    "Ping or push delivery requires the CIBA grant");
        }
        if (!ClientSecuritySettings.CIBA_POLL.equals(mode)) {
            validateUri(
                    "cibaNotificationEndpoint",
                    "CIBA notification endpoint",
                    request.cibaNotificationEndpoint());
        }
    }

    private static String resolveCibaDeliveryMode(AdminClientRequestDTO request) {
        return hasText(request.cibaDeliveryMode())
                ? request.cibaDeliveryMode().trim().toLowerCase(java.util.Locale.ROOT)
                : ClientSecuritySettings.CIBA_POLL;
    }

    private static boolean isSecretMethod(ClientAuthenticationMethod method) {
        return ClientAuthenticationMethod.CLIENT_SECRET_BASIC.equals(method)
                || ClientAuthenticationMethod.CLIENT_SECRET_POST.equals(method);
    }

    private static boolean hasPrivateKeyJwt(AdminClientRequestDTO request) {
        return request.clientAuthenticationMethods()
                .contains(ClientAuthenticationMethod.PRIVATE_KEY_JWT.getValue());
    }

    private static Duration secretGracePeriod(RegisteredClient client) {
        Object value =
                client.getClientSettings()
                        .getSetting(ClientSecuritySettings.SECRET_GRACE_PERIOD_SECONDS);
        if (value instanceof Number number && number.longValue() > 0) {
            return Duration.ofSeconds(number.longValue());
        }
        if (value instanceof String text) {
            try {
                long seconds = Long.parseLong(text);
                if (seconds > 0) {
                    return Duration.ofSeconds(seconds);
                }
            } catch (NumberFormatException _) {
                return DEFAULT_SECRET_GRACE_PERIOD;
            }
        }
        return DEFAULT_SECRET_GRACE_PERIOD;
    }

    private static void putOrRemove(Map<String, Object> values, String key, String value) {
        if (hasText(value)) {
            values.put(key, value.trim());
        } else {
            values.remove(key);
        }
    }

    private static void validateUri(String field, String label, String value) {
        if (!hasText(value)) {
            throw ApiException.badRequest(
                    field, ApiErrorCode.CLIENT_INVALID_URI, "Empty " + label + " is not allowed");
        }
        try {
            URI uri = URI.create(value);
            if (!uri.isAbsolute() || uri.getScheme() == null || uri.getFragment() != null) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException _) {
            throw ApiException.badRequest(
                    field, ApiErrorCode.CLIENT_INVALID_URI, "Invalid " + label + ": " + value);
        }
    }

    private static void validateOptionalUri(String field, String label, String value) {
        if (hasText(value)) {
            validateUri(field, label, value);
        }
    }

    private static void validatePositiveDuration(String field, String label, Duration duration) {
        if (duration != null && (duration.isZero() || duration.isNegative())) {
            throw ApiException.badRequest(
                    field, ApiErrorCode.CLIENT_INVALID_TTL, label + " must be greater than zero");
        }
    }

    private static <T> void requireNonEmpty(
            Set<T> values, String field, ApiErrorCode errorCode, String message) {
        if (values == null || values.isEmpty()) {
            throw ApiException.badRequest(field, errorCode, message);
        }
    }

    private static Set<String> nullSafe(Set<String> values) {
        return values == null ? Set.of() : values;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String generateSecret() {
        return UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "");
    }
}
