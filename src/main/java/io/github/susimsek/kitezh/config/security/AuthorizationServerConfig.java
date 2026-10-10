package io.github.susimsek.kitezh.config.security;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.config.observability.LoggingProperties;
import io.github.susimsek.kitezh.config.observability.ObservabilityMdcFilter;
import io.github.susimsek.kitezh.domain.ClientMapperEntity;
import io.github.susimsek.kitezh.domain.ClientScopeEntity;
import io.github.susimsek.kitezh.domain.GroupEntity;
import io.github.susimsek.kitezh.domain.OrganizationClaimEntity;
import io.github.susimsek.kitezh.domain.SocialIdentityEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import io.github.susimsek.kitezh.repository.ClientMapperRepository;
import io.github.susimsek.kitezh.repository.ClientScopeMapperRepository;
import io.github.susimsek.kitezh.repository.ClientScopeRepository;
import io.github.susimsek.kitezh.repository.OrganizationClaimRepository;
import io.github.susimsek.kitezh.repository.ServiceAccountRepository;
import io.github.susimsek.kitezh.repository.SocialIdentityRepository;
import io.github.susimsek.kitezh.repository.UserAvatarRepository;
import io.github.susimsek.kitezh.repository.UserProfileAttributeRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.AuthorizationEndpointErrorResponseHandler;
import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import io.github.susimsek.kitezh.security.ClientSecuritySettings;
import io.github.susimsek.kitezh.security.LocalizedOAuth2ErrorResponseHandler;
import io.github.susimsek.kitezh.security.OAuth2KeyJwkSource;
import io.github.susimsek.kitezh.security.OidcSessionIdentifier;
import io.github.susimsek.kitezh.security.ProtocolMapperTypes;
import io.github.susimsek.kitezh.security.RotatingClientSecretAuthenticationProvider;
import io.github.susimsek.kitezh.service.OAuth2KeyService;
import io.github.susimsek.kitezh.service.admin.OfflineAccessPolicyService;
import io.github.susimsek.kitezh.service.security.EffectiveRoleService;
import io.github.susimsek.kitezh.service.security.OAuth2ObservabilityMetrics;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
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
import org.springframework.security.crypto.password.PasswordEncoder;
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
    private static final String EMAIL_CLAIM = "email";

    record AuthorizationServerFilterDependencies(
            RequiredActionAuthorizationFilter requiredActionAuthorizationFilter,
            MfaAuthorizationFilter mfaAuthorizationFilter,
            PasswordEncoder passwordEncoder,
            CibaAuthenticationGrantAuthenticationProvider cibaAuthenticationProvider,
            TokenExchangeAuthenticationProvider tokenExchangeAuthenticationProvider,
            SocialProviderLogoutSuccessHandler socialProviderLogoutSuccessHandler,
            SecurityContextRepository securityContextRepository,
            ObservabilityMdcFilter observabilityMdcFilter) {}

    record JwtTokenCustomizerDependencies(
            UserRepository userRepository,
            UserAvatarRepository userAvatarRepository,
            AuthorizationRepository authorizationRepository,
            ClientScopeRepository clientScopeRepository,
            ClientMapperRepository clientMapperRepository,
            ClientScopeMapperRepository clientScopeMapperRepository,
            ServiceAccountRepository serviceAccountRepository,
            UserProfileAttributeRepository userProfileAttributeRepository,
            boolean legacyAdminGroups,
            SocialIdentityRepository socialIdentityRepository,
            ObjectMapper objectMapper,
            OrganizationClaimRepository organizationClaimRepository) {}

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
            PasswordEncoder passwordEncoder,
            RequiredActionAuthorizationFilter requiredActionAuthorizationFilter,
            MfaAuthorizationFilter mfaAuthorizationFilter,
            CibaAuthenticationGrantAuthenticationProvider cibaAuthenticationProvider,
            TokenExchangeAuthenticationProvider tokenExchangeAuthenticationProvider,
            SocialProviderLogoutSuccessHandler socialProviderLogoutSuccessHandler,
            @Qualifier("authorizationServerSecurityContextRepository")
                    SecurityContextRepository securityContextRepository,
            LoggingProperties loggingProperties) {
        return buildAuthorizationServerSecurityFilterChain(
                http,
                tokenGenerator,
                registeredClientRepository,
                new AuthorizationServerFilterDependencies(
                        requiredActionAuthorizationFilter,
                        mfaAuthorizationFilter,
                        passwordEncoder,
                        cibaAuthenticationProvider,
                        tokenExchangeAuthenticationProvider,
                        socialProviderLogoutSuccessHandler,
                        securityContextRepository,
                        new ObservabilityMdcFilter(loggingProperties)));
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
                                                                        new RotatingClientSecretAuthenticationProvider(
                                                                                registeredClientRepository,
                                                                                dependencies
                                                                                        .passwordEncoder()))
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
                                                                .accessTokenRequestConverter(
                                                                        new DefaultClientScopesClientCredentialsConverter())
                                                                .authenticationProvider(
                                                                        dependencies
                                                                                .cibaAuthenticationProvider())
                                                                .authenticationProvider(
                                                                        dependencies
                                                                                .tokenExchangeAuthenticationProvider())
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
        builder.grantType(AuthorizationGrantTypes.TOKEN_EXCHANGE);
    }

    static void addCibaMetadata(
            org.springframework.security.oauth2.server.authorization.oidc.OidcProviderConfiguration
                            .Builder
                    builder,
            String issuer) {
        addCibaMetadataClaims(builder::claim, builder::grantType, issuer);
        builder.grantType(AuthorizationGrantTypes.TOKEN_EXCHANGE);
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
            OAuth2ObservabilityMetrics metrics,
            OfflineAccessPolicyService offlineAccessPolicyService) {
        return new ObservabilityOAuth2TokenGenerator(
                tokenGenerator(
                        jwtEncoder,
                        jwtTokenCustomizer,
                        applicationProperties.authorizationServer().offlineSessionIdle(),
                        offlineAccessPolicyService),
                metrics);
    }

    OAuth2TokenGenerator<OAuth2Token> tokenGenerator(
            JwtEncoder jwtEncoder, OAuth2TokenCustomizer<JwtEncodingContext> jwtTokenCustomizer) {
        return tokenGenerator(jwtEncoder, jwtTokenCustomizer, java.time.Duration.ofDays(30));
    }

    OAuth2TokenGenerator<OAuth2Token> tokenGenerator(
            JwtEncoder jwtEncoder,
            OAuth2TokenCustomizer<JwtEncodingContext> jwtTokenCustomizer,
            java.time.Duration offlineSessionIdle) {
        return tokenGenerator(jwtEncoder, jwtTokenCustomizer, offlineSessionIdle, null);
    }

    OAuth2TokenGenerator<OAuth2Token> tokenGenerator(
            JwtEncoder jwtEncoder,
            OAuth2TokenCustomizer<JwtEncodingContext> jwtTokenCustomizer,
            java.time.Duration offlineSessionIdle,
            OfflineAccessPolicyService offlineAccessPolicyService) {
        JwtGenerator jwtGenerator = new JwtGenerator(jwtEncoder);
        jwtGenerator.setJwtCustomizer(jwtTokenCustomizer);

        return new DelegatingOAuth2TokenGenerator(
                jwtGenerator,
                new OAuth2AccessTokenGenerator(),
                new ConsoleRefreshTokenGenerator(offlineSessionIdle, offlineAccessPolicyService));
    }

    @Bean
    OAuth2TokenCustomizer<JwtEncodingContext> organizationAwareJwtTokenCustomizer(
            UserRepository userRepository,
            UserAvatarRepository userAvatarRepository,
            AuthorizationRepository authorizationRepository,
            ClientScopeRepository clientScopeRepository,
            ClientMapperRepository clientMapperRepository,
            ClientScopeMapperRepository clientScopeMapperRepository,
            ServiceAccountRepository serviceAccountRepository,
            UserProfileAttributeRepository userProfileAttributeRepository,
            SocialIdentityRepository socialIdentityRepository,
            ObjectMapper objectMapper,
            OrganizationClaimRepository organizationClaimRepository) {
        return jwtTokenCustomizer(
                new JwtTokenCustomizerDependencies(
                        userRepository,
                        userAvatarRepository,
                        authorizationRepository,
                        clientScopeRepository,
                        clientMapperRepository,
                        clientScopeMapperRepository,
                        serviceAccountRepository,
                        userProfileAttributeRepository,
                        false,
                        socialIdentityRepository,
                        objectMapper,
                        organizationClaimRepository));
    }

    OAuth2TokenCustomizer<JwtEncodingContext> jwtTokenCustomizer(
            UserRepository userRepository,
            UserAvatarRepository userAvatarRepository,
            AuthorizationRepository authorizationRepository) {
        return jwtTokenCustomizer(
                new JwtTokenCustomizerDependencies(
                        userRepository,
                        userAvatarRepository,
                        authorizationRepository,
                        null,
                        null,
                        null,
                        null,
                        null,
                        true,
                        null,
                        null,
                        null));
    }

    OAuth2TokenCustomizer<JwtEncodingContext> jwtTokenCustomizer(
            UserRepository userRepository,
            UserAvatarRepository userAvatarRepository,
            AuthorizationRepository authorizationRepository,
            ClientScopeRepository clientScopeRepository,
            SocialIdentityRepository socialIdentityRepository,
            ObjectMapper objectMapper) {
        return jwtTokenCustomizer(
                new JwtTokenCustomizerDependencies(
                        userRepository,
                        userAvatarRepository,
                        authorizationRepository,
                        clientScopeRepository,
                        null,
                        null,
                        null,
                        null,
                        false,
                        socialIdentityRepository,
                        objectMapper,
                        null));
    }

    OAuth2TokenCustomizer<JwtEncodingContext> jwtTokenCustomizer(
            JwtTokenCustomizerDependencies dependencies) {
        return context -> {
            if (OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())) {
                context.getClaims().claim("client_id", context.getRegisteredClient().getClientId());
            }
            boolean adminAccessToken = isAdminAccessToken(context);
            List<ClientScopeEntity> groupMappers =
                    groupMappers(context, dependencies.clientScopeRepository());
            List<TokenMapper> clientMappers =
                    dependencies.clientMapperRepository() == null
                            ? List.of()
                            : clientMappers(
                                    context,
                                    dependencies.clientMapperRepository(),
                                    dependencies.clientScopeRepository(),
                                    dependencies.clientScopeMapperRepository());
            Optional<UserEntity> tokenUser =
                    tokenUser(
                            context,
                            dependencies.userRepository(),
                            adminAccessToken,
                            groupMappers,
                            clientMappers,
                            dependencies.serviceAccountRepository(),
                            dependencies.organizationClaimRepository() != null);
            tokenUser
                    .filter(UserEntity::isServiceAccount)
                    .ifPresent(user -> context.getClaims().subject(user.getUsername()));
            appendMappedClaims(
                    context,
                    tokenUser,
                    dependencies.socialIdentityRepository(),
                    dependencies.objectMapper());
            appendUserClaims(
                    context, tokenUser, dependencies.userAvatarRepository(), applicationProperties);
            appendOrganizationClaims(
                    context, tokenUser, dependencies.organizationClaimRepository());
            appendNonceClaim(context);
            appendAdminClaims(
                    context, tokenUser, dependencies.legacyAdminGroups(), adminAccessToken);
            RoleScopeMappings roleScopeMappings =
                    roleScopeMappings(context, dependencies.clientScopeRepository());
            appendRealmRoleClaims(context, tokenUser, roleScopeMappings);
            appendGroupMapperClaims(context, tokenUser, groupMappers);
            appendClientRoleClaims(context, tokenUser, roleScopeMappings);
            appendClientMappers(
                    context,
                    tokenUser,
                    clientMappers,
                    dependencies.userProfileAttributeRepository(),
                    roleScopeMappings);
            appendSessionIdClaim(context, dependencies.authorizationRepository());
            appendDpopConfirmationClaim(context);
            appendCibaAuthReqIdClaim(context);
            appendTokenExchangeClaims(context);
        };
    }

    private static boolean isAdminAccessToken(JwtEncodingContext context) {
        return OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())
                && ConsoleClients.ADMIN_CLIENTS.contains(
                        context.getRegisteredClient().getClientId());
    }

    private static List<ClientScopeEntity> groupMappers(
            JwtEncodingContext context, ClientScopeRepository clientScopeRepository) {
        return clientScopeRepository == null
                ? List.of()
                : clientScopeRepository.findByNameIn(context.getAuthorizedScopes()).stream()
                        .filter(ClientScopeEntity::isGroupMapperEnabled)
                        .toList();
    }

    private static List<TokenMapper> clientMappers(
            JwtEncodingContext context,
            ClientMapperRepository clientMapperRepository,
            ClientScopeRepository clientScopeRepository,
            ClientScopeMapperRepository clientScopeMapperRepository) {
        List<TokenMapper> mappers = new ArrayList<>();
        clientMapperRepository
                .findAllByClientIdOrderByPriorityAscNameAsc(context.getRegisteredClient().getId())
                .stream()
                .map(AuthorizationServerConfig::toTokenMapper)
                .forEach(mappers::add);
        Set<String> scopes = context.getAuthorizedScopes();
        if (clientScopeRepository != null
                && clientScopeMapperRepository != null
                && !scopes.isEmpty()) {
            List<String> scopeIds =
                    clientScopeRepository.findByNameIn(scopes).stream()
                            .map(ClientScopeEntity::getId)
                            .toList();
            if (!scopeIds.isEmpty()) {
                clientScopeMapperRepository
                        .findAllByClientScopeIdInOrderByPriorityAscNameAsc(scopeIds)
                        .stream()
                        .map(AuthorizationServerConfig::toTokenMapper)
                        .forEach(mappers::add);
            }
        }
        mappers.sort(
                Comparator.comparingInt(TokenMapper::priority).thenComparing(TokenMapper::name));
        return mappers;
    }

    private static RoleScopeMappings roleScopeMappings(
            JwtEncodingContext context, ClientScopeRepository repository) {
        if (repository == null || context.getAuthorizedScopes().isEmpty()) {
            return RoleScopeMappings.unconfigured();
        }
        List<ClientScopeEntity> scopes =
                repository.findDetailedByNameIn(context.getAuthorizedScopes());
        if (scopes.isEmpty()) {
            return RoleScopeMappings.unconfigured();
        }
        Set<String> applicationRoles = new java.util.TreeSet<>();
        Map<String, Set<String>> clientRoles = new java.util.TreeMap<>();
        boolean configured = false;
        for (ClientScopeEntity scope : scopes) {
            var expanded =
                    EffectiveRoleService.expandScopeRoles(
                            scope.getApplicationRoles(), scope.getClientRoles());
            configured |=
                    !expanded.applicationRoles().isEmpty() || !expanded.clientRoles().isEmpty();
            applicationRoles.addAll(expanded.applicationRoles());
            expanded.clientRoles()
                    .forEach(
                            (clientId, roles) ->
                                    clientRoles
                                            .computeIfAbsent(
                                                    clientId, ignored -> new java.util.TreeSet<>())
                                            .addAll(roles));
        }
        return new RoleScopeMappings(configured, applicationRoles, clientRoles);
    }

    private static TokenMapper toTokenMapper(ClientMapperEntity mapper) {
        return new TokenMapper(
                ProtocolMapperTypes.canonicalize(mapper.getMapperType()),
                mapper.getSource(),
                mapper.getValue(),
                mapper.getClaimName(),
                mapper.getName(),
                mapper.getPriority(),
                mapper.isAddToIdToken(),
                mapper.isAddToAccessToken());
    }

    private static TokenMapper toTokenMapper(
            io.github.susimsek.kitezh.domain.ClientScopeMapperEntity mapper) {
        return new TokenMapper(
                ProtocolMapperTypes.canonicalize(mapper.getMapperType()),
                mapper.getSource(),
                mapper.getValue(),
                mapper.getClaimName(),
                mapper.getName(),
                mapper.getPriority(),
                mapper.isAddToIdToken(),
                mapper.isAddToAccessToken());
    }

    private static Optional<UserEntity> tokenUser(
            JwtEncodingContext context,
            UserRepository userRepository,
            boolean adminAccessToken,
            List<ClientScopeEntity> groupMappers,
            List<TokenMapper> clientMappers,
            ServiceAccountRepository serviceAccountRepository,
            boolean organizationClaimsEnabled) {
        if (serviceAccountRepository != null
                && AuthorizationGrantType.CLIENT_CREDENTIALS.equals(
                        context.getAuthorizationGrantType())) {
            Optional<UserEntity> serviceAccount =
                    serviceAccountRepository
                            .findByClientId(context.getRegisteredClient().getId())
                            .flatMap(
                                    account ->
                                            userRepository.findByUsername(
                                                    account.getUser().getUsername()));
            if (serviceAccount.isPresent()) {
                return serviceAccount;
            }
        }
        if (isUserProfileToken(context)
                || isUserEmailToken(context)
                || isUserLocaleToken(context)
                || adminAccessToken
                || !groupMappers.isEmpty()
                || !clientMappers.isEmpty()
                || isRoleToken(context)
                || isUserSocialClaimsToken(context)
                || (organizationClaimsEnabled && isOrganizationClaimToken(context))) {
            return userRepository.findByUsername(context.getPrincipal().getName());
        }
        return Optional.empty();
    }

    private static boolean isOrganizationClaimToken(JwtEncodingContext context) {
        return OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())
                || OidcParameterNames.ID_TOKEN.equals(context.getTokenType().getValue());
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
                            context.getClaims().claim(EMAIL_CLAIM, user.getEmail());
                            context.getClaims().claim("email_verified", user.isEmailVerified());
                        }
                    });
        }
    }

    private static void appendOrganizationClaims(
            JwtEncodingContext context,
            Optional<UserEntity> tokenUser,
            OrganizationClaimRepository claimRepository) {
        if (claimRepository == null || tokenUser.isEmpty()) {
            return;
        }
        boolean accessToken = OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType());
        boolean idToken = OidcParameterNames.ID_TOKEN.equals(context.getTokenType().getValue());
        if (!accessToken && !idToken) {
            return;
        }
        List<OrganizationClaimEntity> claims =
                claimRepository.findEnabledClaimsForUser(tokenUser.get().getId());
        Map<String, List<String>> values = new java.util.LinkedHashMap<>();
        claims.stream()
                .filter(
                        claim ->
                                (accessToken
                                                && (claim.isAddToAccessToken()
                                                        || claim.isAddToUserInfo()))
                                        || (idToken && claim.isAddToIdToken()))
                .forEach(
                        claim ->
                                values.computeIfAbsent(
                                                claim.getClaimName(), ignored -> new ArrayList<>())
                                        .add(claim.getClaimValue()));
        values.forEach(
                (name, claimValues) ->
                        context.getClaims()
                                .claim(
                                        name,
                                        claimValues.size() == 1
                                                ? claimValues.getFirst()
                                                : claimValues));
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
            JwtEncodingContext context,
            Optional<UserEntity> tokenUser,
            RoleScopeMappings roleScopeMappings) {
        if (!isRoleToken(context) || tokenUser.isEmpty()) {
            return;
        }
        Map<String, Set<String>> roles =
                EffectiveRoleService.effectiveClientRoleNames(tokenUser.get());
        roles = roleScopeMappings.filterClientRoles(roles);
        if (roles.isEmpty()) {
            return;
        }
        Map<String, Object> resourceAccess = new java.util.LinkedHashMap<>();
        roles.forEach(
                (clientId, clientRoles) ->
                        resourceAccess.put(
                                clientId, Map.of(ROLES_SCOPE, new ArrayList<>(clientRoles))));
        context.getClaims().claim("resource_access", resourceAccess);
    }

    private static void appendClientMappers(
            JwtEncodingContext context,
            Optional<UserEntity> tokenUser,
            List<TokenMapper> mappers,
            UserProfileAttributeRepository attributeRepository,
            RoleScopeMappings roleScopeMappings) {
        if (mappers.isEmpty()) {
            return;
        }
        boolean idToken = OidcParameterNames.ID_TOKEN.equals(context.getTokenType().getValue());
        boolean accessToken = OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType());
        mappers.stream()
                .filter(
                        mapper ->
                                (idToken && mapper.addToIdToken())
                                        || (accessToken && mapper.addToAccessToken()))
                .forEach(
                        mapper ->
                                appendClientMapper(
                                        context,
                                        tokenUser,
                                        mapper,
                                        attributeRepository,
                                        roleScopeMappings));
    }

    private static void appendClientMapper(
            JwtEncodingContext context,
            Optional<UserEntity> tokenUser,
            TokenMapper mapper,
            UserProfileAttributeRepository attributeRepository,
            RoleScopeMappings roleScopeMappings) {
        if (ProtocolMapperTypes.usesAudienceClaim(mapper.mapperType())) {
            appendAudienceClaim(
                    context, audienceValues(context, tokenUser, mapper, roleScopeMappings));
            return;
        }
        Object value =
                switch (mapper.mapperType()) {
                    case ProtocolMapperTypes.HARDCODED_CLAIM -> mapper.value();
                    case ProtocolMapperTypes.USER_PROPERTY ->
                            tokenUser
                                    .map(accountUser -> userProperty(accountUser, mapper.source()))
                                    .orElse(null);
                    case ProtocolMapperTypes.USER_ATTRIBUTE ->
                            tokenUser
                                    .map(
                                            accountUser ->
                                                    userAttribute(
                                                            accountUser,
                                                            mapper.source(),
                                                            attributeRepository))
                                    .orElse(null);
                    case ProtocolMapperTypes.GROUP_MEMBERSHIP ->
                            tokenUser.map(AuthorizationServerConfig::groupMemberships).orElse(null);
                    case ProtocolMapperTypes.GROUP_ATTRIBUTE ->
                            tokenUser
                                    .map(
                                            accountUser ->
                                                    groupAttribute(accountUser, mapper.source()))
                                    .orElse(null);
                    case ProtocolMapperTypes.APPLICATION_ROLE ->
                            tokenUser.map(EffectiveRoleService::effectiveRoleNames).orElse(null);
                    case ProtocolMapperTypes.CLIENT_ROLE ->
                            tokenUser
                                    .map(
                                            accountUser ->
                                                    EffectiveRoleService.effectiveClientRoleNames(
                                                                    accountUser)
                                                            .getOrDefault(
                                                                    context.getRegisteredClient()
                                                                            .getClientId(),
                                                                    Set.of()))
                                    .orElse(null);
                    case ProtocolMapperTypes.EMAIL ->
                            tokenUser.map(UserEntity::getEmail).orElse(null);
                    case ProtocolMapperTypes.FULL_NAME ->
                            tokenUser.map(AuthorizationServerConfig::fullName).orElse(null);
                    case ProtocolMapperTypes.LOCALE ->
                            tokenUser.map(UserEntity::getPreferredLocale).orElse(null);
                    case ProtocolMapperTypes.USERNAME ->
                            tokenUser.map(UserEntity::getUsername).orElse(null);
                    default -> null;
                };
        if (value != null) {
            context.getClaims().claim(mapper.claimName(), value);
        }
    }

    private static List<String> audienceValues(
            JwtEncodingContext context,
            Optional<UserEntity> tokenUser,
            TokenMapper mapper,
            RoleScopeMappings roleScopeMappings) {
        if (ProtocolMapperTypes.AUDIENCE.equals(mapper.mapperType())) {
            return mapper.value() == null || mapper.value().isBlank()
                    ? List.of()
                    : List.of(mapper.value());
        }
        if (tokenUser.isEmpty()) {
            return List.of();
        }
        return roleScopeMappings
                .filterClientRoles(EffectiveRoleService.effectiveClientRoleNames(tokenUser.get()))
                .keySet()
                .stream()
                .filter(clientId -> !clientId.equals(context.getRegisteredClient().getClientId()))
                .sorted()
                .toList();
    }

    private static void appendAudienceClaim(JwtEncodingContext context, List<String> audiences) {
        if (audiences.isEmpty()) {
            return;
        }
        Set<String> merged = new LinkedHashSet<>();
        Object existing = context.getClaims().build().getClaims().get("aud");
        if (existing instanceof String audience) {
            merged.add(audience);
        } else if (existing instanceof Collection<?> values) {
            values.stream()
                    .filter(String.class::isInstance)
                    .map(String.class::cast)
                    .forEach(merged::add);
        }
        merged.addAll(audiences);
        context.getClaims().claim("aud", new ArrayList<>(merged));
    }

    private static List<String> groupMemberships(UserEntity user) {
        return user.getGroups() == null
                ? List.of()
                : user.getGroups().stream()
                        .map(AuthorizationServerConfig::groupPath)
                        .sorted()
                        .toList();
    }

    private static Object groupAttribute(UserEntity user, String source) {
        if (source == null || source.isBlank() || user.getGroups() == null) {
            return null;
        }
        List<String> values =
                user.getGroups().stream()
                        .filter(group -> group.getAttributes() != null)
                        .flatMap(group -> group.getAttributes().stream())
                        .filter(attribute -> source.equals(attribute.getName()))
                        .map(io.github.susimsek.kitezh.domain.GroupAttribute::getValue)
                        .distinct()
                        .toList();
        return singleOrList(values);
    }

    private static String fullName(UserEntity user) {
        return java.util.stream.Stream.of(user.getFirstName(), user.getLastName())
                .filter(value -> value != null && !value.isBlank())
                .collect(Collectors.joining(" "));
    }

    private static Object userProperty(UserEntity user, String source) {
        return switch (source == null ? "" : source) {
            case "username" -> user.getUsername();
            case "firstName" -> user.getFirstName();
            case "lastName" -> user.getLastName();
            case EMAIL_CLAIM -> user.getEmail();
            case "preferredLocale" -> user.getPreferredLocale();
            default -> null;
        };
    }

    private static Object userAttribute(
            UserEntity user, String source, UserProfileAttributeRepository attributeRepository) {
        if (attributeRepository == null || source == null || source.isBlank()) {
            return null;
        }
        List<String> values =
                attributeRepository
                        .findAllByUserIdOrderByDefinitionDisplayOrderAscDefinitionNameAscPositionAsc(
                                user.getId())
                        .stream()
                        .filter(attribute -> source.equals(attribute.getDefinition().getName()))
                        .map(io.github.susimsek.kitezh.domain.UserProfileAttributeEntity::getValue)
                        .toList();
        return singleOrList(values);
    }

    private static Object singleOrList(List<String> values) {
        if (values.isEmpty()) {
            return null;
        }
        if (values.size() == 1) {
            return values.getFirst();
        }
        return values;
    }

    private static void appendRealmRoleClaims(
            JwtEncodingContext context,
            Optional<UserEntity> tokenUser,
            RoleScopeMappings roleScopeMappings) {
        if (!isRoleToken(context)
                || AuthorizationGrantType.CLIENT_CREDENTIALS.equals(
                        context.getAuthorizationGrantType())
                || tokenUser.isEmpty()) {
            return;
        }
        Set<String> roles =
                roleScopeMappings.filterApplicationRoles(
                        EffectiveRoleService.effectiveRoleNames(tokenUser.get()));
        if (!roles.isEmpty()) {
            context.getClaims().claim("realm_access", Map.of(ROLES_SCOPE, new ArrayList<>(roles)));
        }
    }

    private record TokenMapper(
            String mapperType,
            String source,
            String value,
            String claimName,
            String name,
            int priority,
            boolean addToIdToken,
            boolean addToAccessToken) {}

    private record RoleScopeMappings(
            boolean configured,
            Set<String> applicationRoles,
            Map<String, Set<String>> clientRoles) {

        private static RoleScopeMappings unconfigured() {
            return new RoleScopeMappings(false, Set.of(), Map.of());
        }

        private Set<String> filterApplicationRoles(Set<String> roles) {
            return configured
                    ? roles.stream().filter(applicationRoles::contains).collect(Collectors.toSet())
                    : roles;
        }

        private Map<String, Set<String>> filterClientRoles(Map<String, Set<String>> roles) {
            if (!configured) {
                return roles;
            }
            return roles.entrySet().stream()
                    .map(
                            entry ->
                                    Map.entry(
                                            entry.getKey(),
                                            entry.getValue().stream()
                                                    .filter(
                                                            role ->
                                                                    clientRoles
                                                                            .getOrDefault(
                                                                                    entry.getKey(),
                                                                                    Set.of())
                                                                            .contains(role))
                                                    .collect(Collectors.toSet())))
                    .filter(entry -> !entry.getValue().isEmpty())
                    .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        }
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

    private static void appendTokenExchangeClaims(JwtEncodingContext context) {
        if (!OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())
                || !(context.getAuthorizationGrant()
                        instanceof
                        org.springframework.security.oauth2.server.authorization.authentication
                                        .OAuth2TokenExchangeAuthenticationToken
                                tokenExchange)) {
            return;
        }
        List<String> audiences =
                tokenExchange.getAudiences().isEmpty()
                        ? List.of(context.getRegisteredClient().getClientId())
                        : tokenExchange.getAudiences().stream().sorted().toList();
        appendAudienceClaim(context, audiences);
        if (context.getPrincipal()
                instanceof
                org.springframework.security.oauth2.server.authorization.authentication
                                .OAuth2TokenExchangeCompositeAuthenticationToken
                        composite) {
            composite.getActors().stream()
                    .findFirst()
                    .map(actor -> new java.util.LinkedHashMap<String, Object>(actor.getClaims()))
                    .ifPresent(actor -> context.getClaims().claim("act", actor));
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
                .map(SocialIdentityEntity::getMappedClaims)
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
        return context.getAuthorizedScopes().contains(EMAIL_CLAIM)
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
                        || AuthorizationGrantType.CLIENT_CREDENTIALS.equals(
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
