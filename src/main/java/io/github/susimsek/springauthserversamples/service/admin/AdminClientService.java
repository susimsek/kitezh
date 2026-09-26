package io.github.susimsek.springauthserversamples.service.admin;

import io.github.susimsek.springauthserversamples.dto.admin.AdminClientCreatedDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminClientRequestDTO;
import io.github.susimsek.springauthserversamples.mapper.AdminClientMapper;
import io.github.susimsek.springauthserversamples.mapper.AuthorizationServerMapperSupport;
import io.github.susimsek.springauthserversamples.mapper.RegisteredClientMapper;
import io.github.susimsek.springauthserversamples.repository.AuthorizationConsentRepository;
import io.github.susimsek.springauthserversamples.repository.AuthorizationRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.security.ClientSecuritySettings;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.mapstruct.factory.Mappers;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
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

    private final ClientRepository clientRepository;
    private final AuthorizationRepository authorizationRepository;
    private final AuthorizationConsentRepository authorizationConsentRepository;
    private final RegisteredClientMapper registeredClientMapper;
    private final AuthorizationServerMapperSupport mapperSupport;
    private final PasswordEncoder passwordEncoder;
    private final AdminAuditEventService adminAuditEventService;
    private final AdminClientMapper adminClientMapper;

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
                Mappers.getMapper(AdminClientMapper.class));
    }

    @Transactional(readOnly = true)
    public Page<AdminClientDTO> findAll(String query, Pageable pageable) {
        String searchQuery = AdminSearch.normalize(query);
        return clientRepository
                .findByClientIdContainingIgnoreCaseOrClientNameContainingIgnoreCase(
                        searchQuery, searchQuery, pageable)
                .map(entity -> registeredClientMapper.toObject(entity, mapperSupport))
                .map(adminClientMapper::toDTO);
    }

    @Transactional(readOnly = true)
    public AdminClientDTO findById(String id) {
        return clientRepository
                .findById(id)
                .map(entity -> registeredClientMapper.toObject(entity, mapperSupport))
                .map(adminClientMapper::toDTO)
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
        RegisteredClient client =
                apply(
                                RegisteredClient.withId(UUID.randomUUID().toString())
                                        .clientId(request.clientId())
                                        .clientIdIssuedAt(Instant.now())
                                        .clientSecret(
                                                rawSecret == null
                                                        ? null
                                                        : passwordEncoder.encode(rawSecret)),
                                request,
                                null)
                        .build();

        AdminClientDTO saved = adminClientMapper.toDTO(save(client));
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
        }

        RegisteredClient updated = apply(builder, request, existing).build();
        AdminClientDTO saved = adminClientMapper.toDTO(save(updated));
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
        RegisteredClient updated =
                RegisteredClient.from(existing)
                        .clientSecret(passwordEncoder.encode(rawSecret))
                        .build();
        save(updated);
        adminAuditEventService.record("client.secret.regenerated", CLIENT_TARGET, id);
        return rawSecret;
    }

    private static void validate(AdminClientRequestDTO request) {
        if (request == null) {
            throw ApiException.badRequest(
                    ApiErrorCode.CLIENT_INVALID_REQUEST, "Request body is required");
        }
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

        redirectUris.forEach(uri -> validateUri("redirectUris", "redirect URI", uri));
        nullSafe(request.postLogoutRedirectUris())
                .forEach(
                        uri ->
                                validateUri(
                                        "postLogoutRedirectUris", "post logout redirect URI", uri));

        validatePositiveDuration(
                "authorizationCodeTimeToLive",
                "authorization code TTL",
                request.authorizationCodeTimeToLive());
        validatePositiveDuration(
                "accessTokenTimeToLive", "access token TTL", request.accessTokenTimeToLive());
        validatePositiveDuration(
                "refreshTokenTimeToLive", "refresh token TTL", request.refreshTokenTimeToLive());
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
        ClientSettings.Builder builder =
                existing == null
                        ? ClientSettings.builder()
                        : ClientSettings.withSettings(
                                new HashMap<>(existing.getClientSettings().getSettings()));

        ClientSettings settings =
                builder.requireAuthorizationConsent(request.requireAuthorizationConsent())
                        .requireProofKey(request.requireProofKey())
                        .build();
        var values = new HashMap<>(settings.getSettings());
        values.put(ClientSecuritySettings.REQUIRE_DPOP_PROOF, request.requireDpop());
        values.put(ClientSecuritySettings.REQUIRE_DPOP_JKT, request.requireDpopJkt());
        values.put(ClientSecuritySettings.DPOP_REFRESH_TOKEN_ONLY, request.dpopRefreshTokenOnly());
        values.put(ClientSecuritySettings.DPOP_SIGNING_ALGORITHMS, request.dpopSigningAlgorithms());
        settings = ClientSettings.withSettings(values).build();
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

        return builder.authorizationCodeTimeToLive(authorizationCodeTtl)
                .accessTokenTimeToLive(accessTokenTtl)
                .refreshTokenTimeToLive(refreshTokenTtl)
                .build();
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

    private static boolean isSecretMethod(ClientAuthenticationMethod method) {
        return ClientAuthenticationMethod.CLIENT_SECRET_BASIC.equals(method)
                || ClientAuthenticationMethod.CLIENT_SECRET_POST.equals(method);
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
