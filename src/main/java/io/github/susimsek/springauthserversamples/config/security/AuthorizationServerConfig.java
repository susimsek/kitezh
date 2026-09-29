package io.github.susimsek.springauthserversamples.config.security;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.github.susimsek.springauthserversamples.config.observability.LoggingProperties;
import io.github.susimsek.springauthserversamples.config.observability.ObservabilityMdcFilter;
import io.github.susimsek.springauthserversamples.domain.ClientScopeEntity;
import io.github.susimsek.springauthserversamples.domain.GroupEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.repository.AuthorizationRepository;
import io.github.susimsek.springauthserversamples.repository.ClientScopeRepository;
import io.github.susimsek.springauthserversamples.repository.SocialIdentityRepository;
import io.github.susimsek.springauthserversamples.repository.UserAvatarRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.security.AuthorizationEndpointErrorResponseHandler;
import io.github.susimsek.springauthserversamples.security.AuthorizationGrantTypes;
import io.github.susimsek.springauthserversamples.security.ClientSecuritySettings;
import io.github.susimsek.springauthserversamples.security.LocalizedOAuth2ErrorResponseHandler;
import io.github.susimsek.springauthserversamples.security.OAuth2KeyJwkSource;
import io.github.susimsek.springauthserversamples.security.OidcSessionIdentifier;
import io.github.susimsek.springauthserversamples.service.OAuth2KeyService;
import io.github.susimsek.springauthserversamples.service.security.EffectiveRoleService;
import io.github.susimsek.springauthserversamples.service.security.OAuth2ObservabilityMetrics;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.OAuth2AuthorizationServerConfiguration;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.oauth2.server.authorization.OAuth2AuthorizationServerConfigurer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.token.DelegatingOAuth2TokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;
import org.springframework.security.oauth2.server.authorization.token.JwtGenerator;
import org.springframework.security.oauth2.server.authorization.token.OAuth2AccessTokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenCustomizer;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.util.matcher.MediaTypeRequestMatcher;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Configuration(proxyBeanMethods = false)
@RequiredArgsConstructor
public class AuthorizationServerConfig {

    private static final MediaTypeRequestMatcher HTML_REQUEST_MATCHER = htmlRequestMatcher();
    private static final String ROLES_SCOPE = "roles";

    record AuthorizationServerFilterDependencies(
            RequiredActionAuthorizationFilter requiredActionAuthorizationFilter,
            MfaAuthorizationFilter mfaAuthorizationFilter,
            CibaAuthenticationGrantAuthenticationProvider cibaAuthenticationProvider,
            SocialProviderLogoutSuccessHandler socialProviderLogoutSuccessHandler,
            SecurityContextRepository securityContextRepository,
            ObservabilityMdcFilter observabilityMdcFilter) {}

    private final ApplicationProperties applicationProperties;
    private final AuthorizationEndpointErrorResponseHandler
            authorizationEndpointErrorResponseHandler;
    private final LocalizedOAuth2ErrorResponseHandler localizedOAuth2ErrorResponseHandler;

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    SecurityFilterChain authorizationServerSecurityFilterChain(
            HttpSecurity http,
            OAuth2TokenGenerator<OAuth2Token> tokenGenerator,
            RegisteredClientRepository registeredClientRepository,
            RequiredActionAuthorizationFilter requiredActionAuthorizationFilter,
            MfaAuthorizationFilter mfaAuthorizationFilter,
            CibaAuthenticationGrantAuthenticationProvider cibaAuthenticationProvider,
            SocialProviderLogoutSuccessHandler socialProviderLogoutSuccessHandler,
            @Qualifier("authorizationServerSecurityContextRepository")
                    SecurityContextRepository securityContextRepository,
            LoggingProperties loggingProperties) {
        return authorizationServerSecurityFilterChain(
                http,
                tokenGenerator,
                registeredClientRepository,
                new AuthorizationServerFilterDependencies(
                        requiredActionAuthorizationFilter,
                        mfaAuthorizationFilter,
                        cibaAuthenticationProvider,
                        socialProviderLogoutSuccessHandler,
                        securityContextRepository,
                        new ObservabilityMdcFilter(loggingProperties.getAccess())));
    }

    SecurityFilterChain authorizationServerSecurityFilterChain(
            HttpSecurity http,
            OAuth2TokenGenerator<OAuth2Token> tokenGenerator,
            RegisteredClientRepository registeredClientRepository,
            AuthorizationServerFilterDependencies dependencies) {
        return buildAuthorizationServerSecurityFilterChain(
                http, tokenGenerator, registeredClientRepository, dependencies);
    }

    private SecurityFilterChain buildAuthorizationServerSecurityFilterChain(
            HttpSecurity http,
            OAuth2TokenGenerator<OAuth2Token> tokenGenerator,
            RegisteredClientRepository registeredClientRepository,
            AuthorizationServerFilterDependencies dependencies) {
        OAuth2AuthorizationServerConfigurer authorizationServerConfigurer =
                new OAuth2AuthorizationServerConfigurer();

        http.securityMatcher(authorizationServerConfigurer.getEndpointsMatcher())
                .csrf(
                        AbstractHttpConfigurer
                                ::disable) // NOSONAR - OAuth2 protocol endpoints use bearer/client
                // authentication, not browser cookies.
                .securityContext(
                        securityContext ->
                                securityContext
                                        .securityContextRepository(
                                                dependencies.securityContextRepository())
                                        .requireExplicitSave(false))
                .addFilterBefore(
                        dependencies.requiredActionAuthorizationFilter(), AuthorizationFilter.class)
                .addFilterBefore(dependencies.mfaAuthorizationFilter(), AuthorizationFilter.class)
                .addFilterBefore(dependencies.observabilityMdcFilter(), AuthorizationFilter.class)
                .sessionManagement(
                        sessionManagement ->
                                sessionManagement.requireExplicitAuthenticationStrategy(true))
                .with(
                        authorizationServerConfigurer,
                        authorizationServer ->
                                authorizationServer
                                        .tokenGenerator(tokenGenerator)
                                        .authorizationServerMetadataEndpoint(
                                                metadataEndpoint ->
                                                        metadataEndpoint
                                                                .authorizationServerMetadataCustomizer(
                                                                        builder ->
                                                                                addCibaMetadata(
                                                                                        builder,
                                                                                        applicationProperties
                                                                                                .authorizationServer()
                                                                                                .issuer())))
                                        .oidc(
                                                oidc ->
                                                        oidc.logoutEndpoint(
                                                                        logout ->
                                                                                logout
                                                                                        .logoutResponseHandler(
                                                                                                dependencies
                                                                                                        .socialProviderLogoutSuccessHandler()))
                                                                .providerConfigurationEndpoint(
                                                                        providerConfigurationEndpoint ->
                                                                                providerConfigurationEndpoint
                                                                                        .providerConfigurationCustomizer(
                                                                                                builder ->
                                                                                                        addCibaMetadata(
                                                                                                                builder,
                                                                                                                applicationProperties
                                                                                                                        .authorizationServer()
                                                                                                                        .issuer()))))
                                        .authorizationEndpoint(
                                                authorizationEndpoint ->
                                                        authorizationEndpoint
                                                                .authorizationRequestConverter(
                                                                        new DefaultClientScopesAuthorizationRequestConverter(
                                                                                registeredClientRepository))
                                                                .consentPage("/consent")
                                                                .errorResponseHandler(
                                                                        authorizationEndpointErrorResponseHandler))
                                        .clientAuthentication(
                                                clientAuthentication ->
                                                        clientAuthentication
                                                                .authenticationConverter(
                                                                        new ConsolePublicClientAuthenticationConverter())
                                                                .authenticationProvider(
                                                                        new ConsolePublicClientAuthenticationProvider(
                                                                                registeredClientRepository))
                                                                .errorResponseHandler(
                                                                        localizedOAuth2ErrorResponseHandler))
                                        .pushedAuthorizationRequestEndpoint(
                                                pushedAuthorizationRequestEndpoint ->
                                                        pushedAuthorizationRequestEndpoint
                                                                .pushedAuthorizationRequestConverter(
                                                                        new DefaultClientScopesAuthorizationRequestConverter(
                                                                                registeredClientRepository))
                                                                .errorResponseHandler(
                                                                        localizedOAuth2ErrorResponseHandler))
                                        .deviceAuthorizationEndpoint(
                                                deviceAuthorizationEndpoint ->
                                                        deviceAuthorizationEndpoint
                                                                .errorResponseHandler(
                                                                        localizedOAuth2ErrorResponseHandler))
                                        .tokenEndpoint(
                                                tokenEndpoint ->
                                                        tokenEndpoint
                                                                .accessTokenRequestConverters(
                                                                        converters ->
                                                                                converters.add(
                                                                                        new CibaAuthenticationGrantAuthenticationConverter()))
                                                                .authenticationProvider(
                                                                        dependencies
                                                                                .cibaAuthenticationProvider())
                                                                .accessTokenRequestConverter(
                                                                        new DefaultClientScopesClientCredentialsConverter())
                                                                .errorResponseHandler(
                                                                        localizedOAuth2ErrorResponseHandler))
                                        .tokenIntrospectionEndpoint(
                                                tokenIntrospectionEndpoint ->
                                                        tokenIntrospectionEndpoint
                                                                .errorResponseHandler(
                                                                        localizedOAuth2ErrorResponseHandler))
                                        .tokenRevocationEndpoint(
                                                tokenRevocationEndpoint ->
                                                        tokenRevocationEndpoint
                                                                .errorResponseHandler(
                                                                        localizedOAuth2ErrorResponseHandler)))
                .authorizeHttpRequests(authorize -> authorize.anyRequest().authenticated())
                .oauth2ResourceServer(
                        resourceServer ->
                                resourceServer
                                        .jwt(Customizer.withDefaults())
                                        .dPoP(
                                                dpop -> {
                                                    DpopNonceService nonceService =
                                                            new DpopNonceService(
                                                                    applicationProperties.dpop());
                                                    dpop.authenticationConverter(
                                                                    new DpopNonceAuthenticationConverter(
                                                                            nonceService))
                                                            .authenticationFailureHandler(
                                                                    new DpopNonceAuthenticationFailureHandler(
                                                                            nonceService));
                                                }))
                .exceptionHandling(
                        exceptions ->
                                exceptions.defaultAuthenticationEntryPointFor(
                                        new LoginUrlAuthenticationEntryPoint("/login"),
                                        HTML_REQUEST_MATCHER));

        return http.build();
    }

    private static MediaTypeRequestMatcher htmlRequestMatcher() {
        MediaTypeRequestMatcher requestMatcher = new MediaTypeRequestMatcher(MediaType.TEXT_HTML);
        requestMatcher.setIgnoredMediaTypes(Set.of(MediaType.ALL));
        return requestMatcher;
    }

    static void addCibaMetadata(
            org.springframework.security.oauth2.server.authorization
                            .OAuth2AuthorizationServerMetadata.Builder
                    builder,
            String issuer) {
        addCibaMetadataClaims(builder::claim, builder::grantType, issuer);
    }

    static void addCibaMetadata(
            org.springframework.security.oauth2.server.authorization.oidc.OidcProviderConfiguration
                            .Builder
                    builder,
            String issuer) {
        addCibaMetadataClaims(builder::claim, builder::grantType, issuer);
    }

    private static void addCibaMetadataClaims(
            java.util.function.BiConsumer<String, Object> claimConsumer,
            java.util.function.Consumer<String> grantTypeConsumer,
            String issuer) {
        claimConsumer.accept(
                "backchannel_authentication_endpoint", issuer + "/oauth2/bc-authorize");
        claimConsumer.accept(
                "backchannel_token_delivery_modes_supported", List.of("poll", "ping", "push"));
        claimConsumer.accept(
                "backchannel_authentication_request_signing_alg_values_supported",
                List.of("RS256", "ES256"));
        claimConsumer.accept("backchannel_user_code_parameter", true);
        grantTypeConsumer.accept(AuthorizationGrantTypes.CIBA);
    }

    @Bean
    AuthorizationServerSettings authorizationServerSettings() {
        return AuthorizationServerSettings.builder()
                .issuer(applicationProperties.authorizationServer().issuer())
                .build();
    }

    @Bean
    JWKSource<SecurityContext> jwkSource(OAuth2KeyService oauth2KeyService) {
        return new OAuth2KeyJwkSource(oauth2KeyService);
    }

    @Bean
    @Primary
    JwtDecoder jwtDecoder(JWKSource<SecurityContext> jwkSource) {
        return OAuth2AuthorizationServerConfiguration.jwtDecoder(jwkSource);
    }

    @Bean
    JwtEncoder jwtEncoder(JWKSource<SecurityContext> jwkSource) {
        NimbusJwtEncoder jwtEncoder = new NimbusJwtEncoder(jwkSource);
        jwtEncoder.setJwkSelector(
                keys ->
                        keys.stream()
                                .filter(JWK::isPrivate)
                                .findFirst()
                                .orElseThrow(
                                        () ->
                                                new IllegalStateException(
                                                        "No private OAuth2 signing key is"
                                                                + " available")));
        return jwtEncoder;
    }

    @Bean
    OAuth2TokenGenerator<OAuth2Token> tokenGenerator(
            JwtEncoder jwtEncoder,
            OAuth2TokenCustomizer<JwtEncodingContext> jwtTokenCustomizer,
            OAuth2ObservabilityMetrics metrics) {
        return new ObservabilityOAuth2TokenGenerator(
                tokenGenerator(jwtEncoder, jwtTokenCustomizer), metrics);
    }

    OAuth2TokenGenerator<OAuth2Token> tokenGenerator(
            JwtEncoder jwtEncoder, OAuth2TokenCustomizer<JwtEncodingContext> jwtTokenCustomizer) {
        JwtGenerator jwtGenerator = new JwtGenerator(jwtEncoder);
        jwtGenerator.setJwtCustomizer(jwtTokenCustomizer);

        return new DelegatingOAuth2TokenGenerator(
                jwtGenerator, new OAuth2AccessTokenGenerator(), new ConsoleRefreshTokenGenerator());
    }

    @Bean
    OAuth2TokenCustomizer<JwtEncodingContext> jwtTokenCustomizer(
            UserRepository userRepository,
            UserAvatarRepository userAvatarRepository,
            AuthorizationRepository authorizationRepository,
            ClientScopeRepository clientScopeRepository,
            SocialIdentityRepository socialIdentityRepository,
            ObjectMapper objectMapper) {
        return jwtTokenCustomizer(
                userRepository,
                userAvatarRepository,
                authorizationRepository,
                clientScopeRepository,
                false,
                socialIdentityRepository,
                objectMapper);
    }

    OAuth2TokenCustomizer<JwtEncodingContext> jwtTokenCustomizer(
            UserRepository userRepository,
            UserAvatarRepository userAvatarRepository,
            AuthorizationRepository authorizationRepository) {
        return jwtTokenCustomizer(
                userRepository,
                userAvatarRepository,
                authorizationRepository,
                null,
                true,
                null,
                null);
    }

    private OAuth2TokenCustomizer<JwtEncodingContext> jwtTokenCustomizer(
            UserRepository userRepository,
            UserAvatarRepository userAvatarRepository,
            AuthorizationRepository authorizationRepository,
            ClientScopeRepository clientScopeRepository,
            boolean legacyAdminGroups,
            SocialIdentityRepository socialIdentityRepository,
            ObjectMapper objectMapper) {
        return context -> {
            boolean adminAccessToken = isAdminAccessToken(context);
            List<ClientScopeEntity> groupMappers = groupMappers(context, clientScopeRepository);
            Optional<UserEntity> tokenUser =
                    tokenUser(context, userRepository, adminAccessToken, groupMappers);
            appendMappedClaims(context, tokenUser, socialIdentityRepository, objectMapper);
            appendUserClaims(context, tokenUser, userAvatarRepository, applicationProperties);
            appendNonceClaim(context);
            appendAdminClaims(context, tokenUser, legacyAdminGroups, adminAccessToken);
            appendGroupMapperClaims(context, tokenUser, groupMappers);
            appendClientRoleClaims(context, tokenUser);
            appendSessionIdClaim(context, authorizationRepository);
            appendDpopConfirmationClaim(context);
            appendCibaAuthReqIdClaim(context);
        };
    }

    private static boolean isAdminAccessToken(JwtEncodingContext context) {
        return OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())
                && ConsoleClients.ADMIN.equals(context.getRegisteredClient().getClientId());
    }

    private static List<ClientScopeEntity> groupMappers(
            JwtEncodingContext context, ClientScopeRepository clientScopeRepository) {
        return clientScopeRepository == null
                ? List.of()
                : clientScopeRepository.findByNameIn(context.getAuthorizedScopes()).stream()
                        .filter(ClientScopeEntity::isGroupMapperEnabled)
                        .toList();
    }

    private static Optional<UserEntity> tokenUser(
            JwtEncodingContext context,
            UserRepository userRepository,
            boolean adminAccessToken,
            List<ClientScopeEntity> groupMappers) {
        if (isUserProfileToken(context)
                || isUserEmailToken(context)
                || isUserLocaleToken(context)
                || adminAccessToken
                || !groupMappers.isEmpty()
                || isRoleToken(context)
                || isUserSocialClaimsToken(context)) {
            return userRepository.findByUsername(context.getPrincipal().getName());
        }
        return Optional.empty();
    }

    private static void appendUserClaims(
            JwtEncodingContext context,
            Optional<UserEntity> tokenUser,
            UserAvatarRepository userAvatarRepository,
            ApplicationProperties applicationProperties) {
        if (isUserLocaleToken(context)) {
            tokenUser
                    .map(UserEntity::getPreferredLocale)
                    .filter(locale -> locale != null && !locale.isBlank())
                    .ifPresent(locale -> context.getClaims().claim("locale", locale));
        }
        if (isUserProfileToken(context)) {
            tokenUser.ifPresent(
                    user -> {
                        String picture =
                                userAvatarRepository
                                        .findVersionByUserId(user.getId())
                                        .map(
                                                avatar ->
                                                        applicationProperties
                                                                        .authorizationServer()
                                                                        .issuer()
                                                                + "/avatars/"
                                                                + avatar.getPublicId()
                                                                + "?v="
                                                                + avatar.getUpdatedAt()
                                                                        .toEpochMilli())
                                        .orElse(user.getPictureUrl());
                        if (picture != null && !picture.isBlank()) {
                            context.getClaims().claim("picture", picture);
                        }
                    });
        }
        if (isUserEmailToken(context)) {
            tokenUser.ifPresent(
                    user -> {
                        if (user.getEmail() != null) {
                            context.getClaims().claim("email", user.getEmail());
                            context.getClaims().claim("email_verified", user.isEmailVerified());
                        }
                    });
        }
    }

    private static void appendNonceClaim(JwtEncodingContext context) {
        if (!OidcParameterNames.ID_TOKEN.equals(context.getTokenType().getValue())
                || context.getAuthorization() == null) {
            return;
        }
        OAuth2AuthorizationRequest authorizationRequest =
                context.getAuthorization().getAttribute(OAuth2AuthorizationRequest.class.getName());
        if (authorizationRequest == null) {
            return;
        }
        Object nonceValue =
                authorizationRequest.getAdditionalParameters().get(OidcParameterNames.NONCE);
        if (nonceValue instanceof String nonce && !nonce.isBlank()) {
            context.getClaims().claim(OidcParameterNames.NONCE, nonce);
        }
    }

    private static void appendAdminClaims(
            JwtEncodingContext context,
            Optional<UserEntity> tokenUser,
            boolean legacyAdminGroups,
            boolean adminAccessToken) {
        if (adminAccessToken) {
            context.getClaims()
                    .claim(
                            ROLES_SCOPE,
                            context.getPrincipal().getAuthorities().stream()
                                    .map(GrantedAuthority::getAuthority)
                                    .sorted()
                                    .collect(Collectors.toCollection(ArrayList::new)));
        }
        if (legacyAdminGroups && adminAccessToken) {
            tokenUser.ifPresent(
                    user ->
                            context.getClaims()
                                    .claim(
                                            "groups",
                                            user.getGroups().stream()
                                                    .map(AuthorizationServerConfig::groupPath)
                                                    .sorted()
                                                    .collect(
                                                            Collectors.toCollection(
                                                                    ArrayList::new))));
        }
    }

    private static void appendGroupMapperClaims(
            JwtEncodingContext context,
            Optional<UserEntity> tokenUser,
            List<ClientScopeEntity> groupMappers) {
        if (groupMappers.isEmpty()) {
            return;
        }
        tokenUser.ifPresent(
                user ->
                        groupMappers.stream()
                                .findFirst()
                                .ifPresent(
                                        mapper ->
                                                context.getClaims()
                                                        .claim(
                                                                mapper.getGroupClaimName(),
                                                                user.getGroups().stream()
                                                                        .map(
                                                                                group ->
                                                                                        mapper
                                                                                                        .isGroupMapperFullPath()
                                                                                                ? groupPath(
                                                                                                        group)
                                                                                                : group
                                                                                                        .getName())
                                                                        .sorted()
                                                                        .collect(
                                                                                Collectors
                                                                                        .toCollection(
                                                                                                ArrayList
                                                                                                        ::new)))));
    }

    private static void appendClientRoleClaims(
            JwtEncodingContext context, Optional<UserEntity> tokenUser) {
        if (!isRoleToken(context) || tokenUser.isEmpty()) {
            return;
        }
        String clientId = context.getRegisteredClient().getClientId();
        Set<String> roles =
                EffectiveRoleService.effectiveClientRoleNames(tokenUser.get())
                        .getOrDefault(clientId, Set.of());
        if (roles.isEmpty()) {
            return;
        }
        context.getClaims()
                .claim(
                        "resource_access",
                        Map.of(clientId, Map.of(ROLES_SCOPE, new ArrayList<>(roles))));
    }

    private static void appendSessionIdClaim(
            JwtEncodingContext context, AuthorizationRepository authorizationRepository) {
        if (OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())
                && ConsoleClients.ALL.contains(context.getRegisteredClient().getClientId())) {
            authorizationSessionId(context, authorizationRepository)
                    .map(OidcSessionIdentifier::fromSessionId)
                    .ifPresent(sessionId -> context.getClaims().claim("sid", sessionId));
        }
    }

    private static void appendDpopConfirmationClaim(JwtEncodingContext context) {
        if (!OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())) {
            return;
        }
        Object proof = context.get(OAuth2TokenContext.DPOP_PROOF_KEY);
        if (!(proof instanceof Jwt dpopProof)) {
            return;
        }
        if (AuthorizationGrantType.REFRESH_TOKEN.equals(context.getAuthorizationGrantType())
                && ClientSecuritySettings.requiresDpopForRefreshToken(context.getRegisteredClient())
                && !ClientSecuritySettings.requiresDpopProof(context.getRegisteredClient())
                && !context.getRegisteredClient()
                        .getClientAuthenticationMethods()
                        .contains(ClientAuthenticationMethod.NONE)) {
            return;
        }
        Object jwkHeader = dpopProof.getHeaders().get("jwk");
        if (!(jwkHeader instanceof Map<?, ?> jwkMap)) {
            return;
        }
        Map<String, Object> jwkJson = new java.util.LinkedHashMap<>();
        jwkMap.forEach(
                (key, value) -> {
                    if (key instanceof String stringKey) {
                        jwkJson.put(stringKey, value);
                    }
                });
        try {
            String thumbprint = JWK.parse(jwkJson).computeThumbprint().toString();
            validateDpopJkt(context, thumbprint);
            context.getClaims().claim("cnf", Map.of("jkt", thumbprint));
        } catch (ParseException | JOSEException exception) {
            throw new IllegalStateException("Unable to compute the DPoP key thumbprint", exception);
        }
    }

    private static void appendCibaAuthReqIdClaim(JwtEncodingContext context) {
        if (!AuthorizationGrantTypes.CIBA.equals(context.getAuthorizationGrantType().getValue())) {
            return;
        }
        if (context.getAuthorizationGrant()
                instanceof CibaAuthenticationGrantAuthenticationToken cibaGrant) {
            context.getClaims()
                    .claim(
                            CibaAuthenticationGrantAuthenticationToken.AUTH_REQ_ID_CLAIM,
                            cibaGrant.getAuthReqId());
            Object acrValues =
                    cibaGrant
                            .getAdditionalParameters()
                            .get(CibaAuthenticationGrantAuthenticationToken.ACR_VALUES_ATTRIBUTE);
            if (acrValues instanceof String acr && !acr.isBlank()) {
                context.getClaims().claim("acr", acr.trim().split("\\s+")[0]);
            }
            if (OidcParameterNames.ID_TOKEN.equals(context.getTokenType().getValue())) {
                addCibaTokenHash(
                        context,
                        cibaGrant,
                        "at_hash",
                        CibaAuthenticationGrantAuthenticationToken.ACCESS_TOKEN_VALUE);
                addCibaTokenHash(
                        context,
                        cibaGrant,
                        "urn:openid:params:jwt:claim:rt_hash",
                        CibaAuthenticationGrantAuthenticationToken.REFRESH_TOKEN_VALUE);
            }
        }
    }

    private static void addCibaTokenHash(
            JwtEncodingContext context,
            CibaAuthenticationGrantAuthenticationToken grant,
            String claimName,
            String contextKey) {
        Object token = grant.getAdditionalParameters().get(contextKey);
        if (!(token instanceof String tokenValue) || tokenValue.isBlank()) {
            return;
        }
        try {
            String signatureAlgorithm = context.getJwsHeader().build().getAlgorithm().getName();
            String digestAlgorithm;
            if (signatureAlgorithm.endsWith("512")) {
                digestAlgorithm = "SHA-512";
            } else if (signatureAlgorithm.endsWith("384")) {
                digestAlgorithm = "SHA-384";
            } else {
                digestAlgorithm = "SHA-256";
            }
            byte[] digest =
                    java.security.MessageDigest.getInstance(digestAlgorithm)
                            .digest(
                                    tokenValue.getBytes(
                                            java.nio.charset.StandardCharsets.US_ASCII));
            context.getClaims()
                    .claim(
                            claimName,
                            java.util.Base64.getUrlEncoder()
                                    .withoutPadding()
                                    .encodeToString(
                                            java.util.Arrays.copyOf(digest, digest.length / 2)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("The token hash algorithm is not available", exception);
        }
    }

    private static void validateDpopJkt(JwtEncodingContext context, String thumbprint) {
        if (!AuthorizationGrantType.AUTHORIZATION_CODE.equals(context.getAuthorizationGrantType())
                || !ClientSecuritySettings.requiresDpopJkt(context.getRegisteredClient())) {
            return;
        }
        OAuth2AuthorizationRequest authorizationRequest =
                context.getAuthorization().getAttribute(OAuth2AuthorizationRequest.class.getName());
        Object expected =
                authorizationRequest == null
                        ? null
                        : authorizationRequest.getAdditionalParameters().get("dpop_jkt");
        if (!thumbprint.equals(expected)) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error(
                            OAuth2ErrorCodes.INVALID_DPOP_PROOF,
                            "DPoP proof key does not match dpop_jkt",
                            "https://www.rfc-editor.org/rfc/rfc9449#section-10.1"));
        }
    }

    private static void appendMappedClaims(
            JwtEncodingContext context,
            Optional<UserEntity> tokenUser,
            SocialIdentityRepository socialIdentityRepository,
            ObjectMapper objectMapper) {
        if (socialIdentityRepository == null
                || objectMapper == null
                || !isUserSocialClaimsToken(context)
                || tokenUser.isEmpty()) {
            return;
        }
        String tokenKey =
                OidcParameterNames.ID_TOKEN.equals(context.getTokenType().getValue())
                        ? "id_token"
                        : "access_token";
        socialIdentityRepository.findAllByUserUsername(tokenUser.get().getUsername()).stream()
                .map(
                        io.github.susimsek.springauthserversamples.domain.SocialIdentityEntity
                                ::getMappedClaims)
                .filter(value -> value != null && !value.isBlank())
                .forEach(
                        value -> {
                            try {
                                Map<String, Map<String, Object>> mapped =
                                        objectMapper.readValue(value, new TypeReference<>() {});
                                Map<String, Object> claims = mapped.get(tokenKey);
                                if (claims != null) {
                                    claims.forEach(
                                            (name, claim) ->
                                                    context.getClaims().claim(name, claim));
                                }
                            } catch (Exception _) {
                                // A malformed optional mapper payload must not block token
                                // issuance.
                                return;
                            }
                        });
    }

    private static boolean isUserProfileToken(JwtEncodingContext context) {
        return context.getAuthorizedScopes().contains("profile")
                && (OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())
                        || OidcParameterNames.ID_TOKEN.equals(context.getTokenType().getValue()))
                && (AuthorizationGrantType.AUTHORIZATION_CODE.equals(
                                context.getAuthorizationGrantType())
                        || AuthorizationGrantType.REFRESH_TOKEN.equals(
                                context.getAuthorizationGrantType())
                        || isCibaGrant(context));
    }

    private static boolean isUserEmailToken(JwtEncodingContext context) {
        return context.getAuthorizedScopes().contains("email")
                && (OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())
                        || OidcParameterNames.ID_TOKEN.equals(context.getTokenType().getValue()))
                && (AuthorizationGrantType.AUTHORIZATION_CODE.equals(
                                context.getAuthorizationGrantType())
                        || AuthorizationGrantType.REFRESH_TOKEN.equals(
                                context.getAuthorizationGrantType())
                        || isCibaGrant(context));
    }

    private static boolean isUserLocaleToken(JwtEncodingContext context) {
        return (AuthorizationGrantType.AUTHORIZATION_CODE.equals(
                                context.getAuthorizationGrantType())
                        || AuthorizationGrantType.REFRESH_TOKEN.equals(
                                context.getAuthorizationGrantType())
                        || isCibaGrant(context))
                && (OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())
                        || OidcParameterNames.ID_TOKEN.equals(context.getTokenType().getValue()));
    }

    private static boolean isUserSocialClaimsToken(JwtEncodingContext context) {
        return (AuthorizationGrantType.AUTHORIZATION_CODE.equals(
                                context.getAuthorizationGrantType())
                        || AuthorizationGrantType.REFRESH_TOKEN.equals(
                                context.getAuthorizationGrantType())
                        || isCibaGrant(context))
                && (OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())
                        || OidcParameterNames.ID_TOKEN.equals(context.getTokenType().getValue()));
    }

    private static boolean isRoleToken(JwtEncodingContext context) {
        return context.getAuthorizedScopes().contains(ROLES_SCOPE)
                && (OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())
                        || OidcParameterNames.ID_TOKEN.equals(context.getTokenType().getValue()))
                && (AuthorizationGrantType.AUTHORIZATION_CODE.equals(
                                context.getAuthorizationGrantType())
                        || AuthorizationGrantType.REFRESH_TOKEN.equals(
                                context.getAuthorizationGrantType())
                        || isCibaGrant(context));
    }

    private static boolean isCibaGrant(JwtEncodingContext context) {
        return AuthorizationGrantTypes.CIBA.equals(context.getAuthorizationGrantType().getValue());
    }

    private static String groupPath(GroupEntity group) {
        StringBuilder path = new StringBuilder(group.getName());
        GroupEntity parent = group.getParent();
        while (parent != null) {
            path.insert(0, parent.getName() + "/");
            parent = parent.getParent();
        }
        return "/" + path;
    }

    private static java.util.Optional<String> authorizationSessionId(
            JwtEncodingContext context, AuthorizationRepository authorizationRepository) {
        if (context.getAuthorization() == null) {
            return java.util.Optional.empty();
        }
        return authorizationRepository.findSessionIdById(context.getAuthorization().getId());
    }
}
