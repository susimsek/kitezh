package io.github.susimsek.kitezh.config.security;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.config.observability.LoggingProperties;
import io.github.susimsek.kitezh.config.observability.ObservabilityMdcFilter;
import io.github.susimsek.kitezh.security.LocalizedAccessDeniedHandler;
import io.github.susimsek.kitezh.security.LocalizedAuthenticationEntryPoint;
import io.github.susimsek.kitezh.service.SamlLoginService;
import io.github.susimsek.kitezh.service.SocialLoginService;
import io.github.susimsek.kitezh.service.SocialProviderSettingsService;
import io.github.susimsek.kitezh.service.SocialTokenService;
import io.github.susimsek.kitezh.service.account.MfaService;
import io.github.susimsek.kitezh.service.security.OAuth2ObservabilityMetrics;
import java.net.URI;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationEventPublisher;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DefaultAuthenticationEventPublisher;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.endpoint.OAuth2AccessTokenResponseClient;
import org.springframework.security.oauth2.client.endpoint.OAuth2AuthorizationCodeGrantRequest;
import org.springframework.security.oauth2.client.endpoint.RestClientAuthorizationCodeTokenResponseClient;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.saml2.core.Saml2Error;
import org.springframework.security.saml2.core.Saml2ResponseValidatorResult;
import org.springframework.security.saml2.provider.service.authentication.AbstractSaml2AuthenticationRequest;
import org.springframework.security.saml2.provider.service.authentication.OpenSaml5AuthenticationProvider;
import org.springframework.security.saml2.provider.service.web.HttpSessionSaml2AuthenticationRequestRepository;
import org.springframework.security.saml2.provider.service.web.Saml2AuthenticationRequestRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint;
import org.springframework.security.web.authentication.SavedRequestAwareAuthenticationSuccessHandler;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.context.DelegatingSecurityContextRepository;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.util.matcher.MediaTypeRequestMatcher;
import org.springframework.security.web.util.matcher.NegatedRequestMatcher;
import org.springframework.security.web.webauthn.authentication.PublicKeyCredentialRequestOptionsFilter;
import org.springframework.security.web.webauthn.authentication.PublicKeyCredentialRequestOptionsRepository;
import org.springframework.security.web.webauthn.authentication.WebAuthnAuthenticationFilter;
import org.springframework.security.web.webauthn.management.WebAuthnRelyingPartyOperations;
import org.springframework.web.client.RestClient;

@Configuration(proxyBeanMethods = false)
public class SecurityConfig {

    private static final String LOGIN_PATH = "/login";
    private static final String LOGIN_ERROR_PATH = LOGIN_PATH + "?" + OAuth2ParameterNames.ERROR;

    private static final SecureRandom SOCIAL_STATE_RANDOM = new SecureRandom();

    private static final MediaTypeRequestMatcher HTML_REQUEST_MATCHER = htmlRequestMatcher();

    private static final NegatedRequestMatcher NON_HTML_REQUEST_MATCHER =
            new NegatedRequestMatcher(HTML_REQUEST_MATCHER);

    private final LocalizedAuthenticationEntryPoint localizedAuthenticationEntryPoint;
    private final LocalizedAccessDeniedHandler localizedAccessDeniedHandler;
    private final DynamicRememberMeServices rememberMeServices;

    private record DefaultSecurityDependencies(
            SamlRelyingPartyRegistrationRepository samlRegistrationRepository,
            SamlLoginAuthenticationSuccessHandler samlLoginSuccessHandler,
            SamlAuthenticationRequestResolver samlAuthenticationRequestResolver,
            ObservabilityMdcFilter observabilityMdcFilter) {}

    @org.springframework.beans.factory.annotation.Autowired
    public SecurityConfig(
            LocalizedAuthenticationEntryPoint localizedAuthenticationEntryPoint,
            LocalizedAccessDeniedHandler localizedAccessDeniedHandler,
            DynamicRememberMeServices rememberMeServices) {
        this.localizedAuthenticationEntryPoint = localizedAuthenticationEntryPoint;
        this.localizedAccessDeniedHandler = localizedAccessDeniedHandler;
        this.rememberMeServices = rememberMeServices;
    }

    public SecurityConfig(
            LocalizedAuthenticationEntryPoint localizedAuthenticationEntryPoint,
            LocalizedAccessDeniedHandler localizedAccessDeniedHandler) {
        this(localizedAuthenticationEntryPoint, localizedAccessDeniedHandler, null);
    }

    private static MediaTypeRequestMatcher htmlRequestMatcher() {
        MediaTypeRequestMatcher requestMatcher = new MediaTypeRequestMatcher(MediaType.TEXT_HTML);
        requestMatcher.setIgnoredMediaTypes(Set.of(MediaType.ALL));
        return requestMatcher;
    }

    private static SavedRequestAwareAuthenticationSuccessHandler
            defaultAuthenticationSuccessHandler() {
        SavedRequestAwareAuthenticationSuccessHandler successHandler =
                new SavedRequestAwareAuthenticationSuccessHandler();
        successHandler.setDefaultTargetUrl("/admin");
        return successHandler;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    @Order(3)
    SecurityFilterChain defaultSecurityFilterChain(
            HttpSecurity http,
            ApplicationProperties applicationProperties,
            BrowserSecurityDependencies browserDependencies,
            SocialSecurityDependencies socialDependencies,
            DefaultSecurityDependencies securityDependencies) {
        return buildDefaultSecurityFilterChain(
                http,
                applicationProperties,
                browserDependencies,
                socialDependencies,
                securityDependencies);
    }

    SecurityFilterChain defaultSecurityFilterChain(
            HttpSecurity http,
            ApplicationProperties applicationProperties,
            BrowserSecurityDependencies browserDependencies,
            SocialSecurityDependencies socialDependencies) {
        return buildDefaultSecurityFilterChain(
                http,
                applicationProperties,
                browserDependencies,
                socialDependencies,
                new DefaultSecurityDependencies(null, null, null, new ObservabilityMdcFilter()));
    }

    @Bean
    DefaultSecurityDependencies defaultSecurityDependencies(
            SamlRelyingPartyRegistrationRepository samlRegistrationRepository,
            SamlLoginAuthenticationSuccessHandler samlLoginSuccessHandler,
            SamlAuthenticationRequestResolver samlAuthenticationRequestResolver,
            LoggingProperties loggingProperties) {
        return new DefaultSecurityDependencies(
                samlRegistrationRepository,
                samlLoginSuccessHandler,
                samlAuthenticationRequestResolver,
                new ObservabilityMdcFilter(loggingProperties));
    }

    private SecurityFilterChain buildDefaultSecurityFilterChain(
            HttpSecurity http,
            ApplicationProperties applicationProperties,
            BrowserSecurityDependencies browserDependencies,
            SocialSecurityDependencies socialDependencies,
            DefaultSecurityDependencies securityDependencies) {
        http.authenticationManager(browserDependencies.formAuthenticationManager());
        http.securityContext(
                        securityContext ->
                                securityContext
                                        .securityContextRepository(
                                                browserDependencies.securityContextRepository())
                                        .requireExplicitSave(false))
                .csrf(
                        AbstractHttpConfigurer
                                ::disable) // NOSONAR - the SPA login contract intentionally posts
                // credentials without a CSRF token.
                .sessionManagement(
                        sessionManagement ->
                                sessionManagement
                                        .requireExplicitAuthenticationStrategy(true)
                                        .sessionFixation(
                                                org.springframework.security.config.annotation.web
                                                                .configurers
                                                                .SessionManagementConfigurer
                                                                .SessionFixationConfigurer
                                                        ::changeSessionId))
                .authorizeHttpRequests(
                        authorize ->
                                authorize
                                        .requestMatchers(
                                                "/avatars/**",
                                                "/apple-icon.png",
                                                "/brand/**",
                                                "/favicon.ico",
                                                "/icon.svg",
                                                "/oidc/session-iframe.html")
                                        .permitAll()
                                        .requestMatchers("/api/auth/mfa/**")
                                        .authenticated()
                                        .requestMatchers("/account/avatar")
                                        .authenticated()
                                        .requestMatchers("/account/social-links/**")
                                        .authenticated()
                                        .requestMatchers("/api/auth/**")
                                        .permitAll()
                                        .requestMatchers("/api/public/desktop-release")
                                        .permitAll()
                                        .requestMatchers("/oauth2/bc-authorize")
                                        .permitAll()
                                        .requestMatchers(
                                                "/admin",
                                                "/admin/**",
                                                "/",
                                                "/download",
                                                "/index.html",
                                                "/404.html",
                                                "/account/**",
                                                "/account",
                                                "/consent",
                                                "/auth-error",
                                                "/forgot-password",
                                                "/reset-password",
                                                "/verify-email",
                                                "/confirm-email",
                                                "/required-actions",
                                                "/mfa",
                                                LOGIN_PATH,
                                                "/login/**",
                                                "/register",
                                                "/_next/**",
                                                "/v3/api-docs/**",
                                                "/swagger-ui.html",
                                                "/swagger-ui/**",
                                                "/saml2/authenticate/**",
                                                "/saml2/metadata/**",
                                                "/saml2/service-provider-metadata/**",
                                                "/login/saml2/sso/**",
                                                "/actuator/health",
                                                "/actuator/health/**",
                                                "/actuator/metrics",
                                                "/actuator/metrics/**",
                                                "/actuator/prometheus",
                                                "/error")
                                        .permitAll()
                                        .anyRequest()
                                        .authenticated())
                .exceptionHandling(
                        exceptions ->
                                exceptions
                                        .defaultAuthenticationEntryPointFor(
                                                new LoginUrlAuthenticationEntryPoint(LOGIN_PATH),
                                                HTML_REQUEST_MATCHER)
                                        .defaultAuthenticationEntryPointFor(
                                                localizedAuthenticationEntryPoint,
                                                NON_HTML_REQUEST_MATCHER)
                                        .accessDeniedHandler(localizedAccessDeniedHandler))
                .formLogin(
                        formLogin ->
                                formLogin
                                        .loginPage(LOGIN_PATH)
                                        .successHandler(
                                                new SocialAccountLinkingAuthenticationSuccessHandler(
                                                        socialDependencies.socialLoginService(),
                                                        defaultAuthenticationSuccessHandler()))
                                        .securityContextRepository(
                                                browserDependencies.securityContextRepository())
                                        .permitAll())
                .rememberMe(rememberMe -> rememberMe.rememberMeServices(rememberMeServices));

        WebAuthnSettings webAuthnSettings = resolveWebAuthnSettings(applicationProperties);
        http.webAuthn(
                webAuthn ->
                        webAuthn.rpId(webAuthnSettings.rpId())
                                .allowedOrigins(webAuthnSettings.allowedOrigins())
                                .disableDefaultRegistrationPage(true));

        PublicKeyCredentialRequestOptionsFilter requestOptionsFilter =
                new PublicKeyCredentialRequestOptionsFilter(
                        browserDependencies.webAuthnRelyingPartyOperations());
        requestOptionsFilter.setRequestOptionsRepository(
                browserDependencies.webAuthnRequestOptionsRepository());
        WebAuthnAuthenticationFilter authenticationFilter = new WebAuthnAuthenticationFilter();
        authenticationFilter.setAuthenticationManager(
                browserDependencies.webAuthnAuthenticationManager());
        authenticationFilter.setRequestOptionsRepository(
                browserDependencies.webAuthnRequestOptionsRepository());
        authenticationFilter.setAuthenticationSuccessHandler(
                (request, response, authentication) -> {
                    var session = request.getSession(true);
                    MfaAuthorizationFilter.markCredentialVerified(session);
                    if (session.getAttribute(MfaAuthorizationFilter.MFA_PENDING_REQUEST) != null) {
                        MfaAuthorizationFilter.markVerified(session);
                    }
                    new WebAuthnAuthenticationSuccessHandler()
                            .onAuthenticationSuccess(request, response, authentication);
                });
        authenticationFilter.setAuthenticationFailureHandler(
                new SimpleUrlAuthenticationFailureHandler(LOGIN_ERROR_PATH));

        http.addFilterBefore(requestOptionsFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(authenticationFilter, UsernamePasswordAuthenticationFilter.class);

        http.addFilterBefore(
                        browserDependencies.loginRateLimitFilter(),
                        UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(
                        browserDependencies.loginCaptchaFilter(),
                        UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(
                        securityDependencies.observabilityMdcFilter(), AuthorizationFilter.class);

        if (socialDependencies.clientRegistrationRepository().getIfAvailable() != null) {
            http.oauth2Login(
                    oauth2 ->
                            oauth2.loginPage(LOGIN_PATH)
                                    .authorizedClientRepository(
                                            socialDependencies.socialAuthorizedClientRepository())
                                    .successHandler(
                                            socialDependencies
                                                    .socialLoginSuccessHandler()
                                                    .getObject())
                                    .authorizationEndpoint(
                                            authorizationEndpoint ->
                                                    authorizationEndpoint
                                                            .authorizationRequestResolver(
                                                                    socialDependencies
                                                                            .socialAuthorizationRequestResolver()
                                                                            .getObject()))
                                    .tokenEndpoint(
                                            tokenEndpoint ->
                                                    tokenEndpoint.accessTokenResponseClient(
                                                            socialDependencies
                                                                    .socialTokenResponseClient()))
                                    .failureHandler(
                                            new SimpleUrlAuthenticationFailureHandler(
                                                    LOGIN_ERROR_PATH))
                                    .permitAll());
        }

        if (securityDependencies.samlRegistrationRepository() != null
                && securityDependencies.samlLoginSuccessHandler() != null) {
            http.saml2Metadata(Customizer.withDefaults());
            http.saml2Logout(
                    saml2 ->
                            saml2.logoutRequest(
                                            request ->
                                                    request.logoutUrl(
                                                            "/logout/saml2/slo/{registrationId}"))
                                    .logoutResponse(
                                            response ->
                                                    response.logoutUrl(
                                                            "/logout/saml2/slo/{registrationId}")));
            http.saml2Login(
                    saml2 ->
                            saml2.loginPage(LOGIN_PATH)
                                    .relyingPartyRegistrationRepository(
                                            securityDependencies.samlRegistrationRepository())
                                    .authenticationManager(
                                            new ProviderManager(
                                                    samlAuthenticationProvider(
                                                            securityDependencies
                                                                    .samlRegistrationRepository())))
                                    .authenticationRequestResolver(
                                            securityDependencies
                                                    .samlAuthenticationRequestResolver())
                                    .successHandler(securityDependencies.samlLoginSuccessHandler())
                                    .failureHandler(
                                            new SimpleUrlAuthenticationFailureHandler(
                                                    LOGIN_ERROR_PATH))
                                    .permitAll());
        }

        http.oauth2ResourceServer(
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
                                        })
                                .protectedResourceMetadata(
                                        metadata -> {
                                            metadata.protectedResourceMetadataCustomizer(
                                                    builder ->
                                                            builder.resource(
                                                                            applicationProperties
                                                                                    .authorizationServer()
                                                                                    .issuer())
                                                                    .authorizationServer(
                                                                            applicationProperties
                                                                                    .authorizationServer()
                                                                                    .issuer())
                                                                    .claim(
                                                                            "dpop_signing_alg_values_supported",
                                                                            List.of(
                                                                                    "RS256",
                                                                                    "ES256")));
                                        }));

        return http.build();
    }

    static OpenSaml5AuthenticationProvider samlAuthenticationProvider(
            SamlRelyingPartyRegistrationRepository registrationRepository) {
        OpenSaml5AuthenticationProvider provider = new OpenSaml5AuthenticationProvider();
        OpenSaml5AuthenticationProvider.AssertionValidator defaultValidator =
                OpenSaml5AuthenticationProvider.AssertionValidator.withDefaults();
        provider.setAssertionValidator(
                assertionToken -> {
                    Saml2ResponseValidatorResult result = defaultValidator.convert(assertionToken);
                    if (result.hasErrors()
                            || !registrationRepository.requiresSignedAssertions(
                                    assertionToken
                                            .getToken()
                                            .getRelyingPartyRegistration()
                                            .getRegistrationId())
                            || assertionToken.getAssertion().getSignature() != null) {
                        return result;
                    }
                    return result.concat(
                            new Saml2Error(
                                    "invalid_assertion",
                                    "The SAML assertion must contain a signature"));
                });
        return provider;
    }

    @Bean
    BrowserSecurityDependencies browserSecurityDependencies(
            @Qualifier("browserSecurityContextRepository")
                    SecurityContextRepository securityContextRepository,
            LoginRateLimitFilter loginRateLimitFilter,
            LoginCaptchaFilter loginCaptchaFilter,
            @Qualifier("webAuthnAuthenticationManager")
                    AuthenticationManager webAuthnAuthenticationManager,
            @Qualifier("formAuthenticationManager") AuthenticationManager formAuthenticationManager,
            PublicKeyCredentialRequestOptionsRepository webAuthnRequestOptionsRepository,
            WebAuthnRelyingPartyOperations webAuthnRelyingPartyOperations) {
        return new BrowserSecurityDependencies(
                securityContextRepository,
                loginRateLimitFilter,
                loginCaptchaFilter,
                webAuthnAuthenticationManager,
                formAuthenticationManager,
                webAuthnRequestOptionsRepository,
                webAuthnRelyingPartyOperations);
    }

    @Bean
    SocialSecurityDependencies socialSecurityDependencies(
            ObjectProvider<ClientRegistrationRepository> clientRegistrationRepository,
            ObjectProvider<SocialLoginAuthenticationSuccessHandler> socialLoginSuccessHandler,
            ObjectProvider<OAuth2AuthorizationRequestResolver> socialAuthorizationRequestResolver,
            SocialLoginService socialLoginService,
            OAuth2AuthorizedClientRepository socialAuthorizedClientRepository,
            OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest>
                    socialTokenResponseClient) {
        return new SocialSecurityDependencies(
                clientRegistrationRepository,
                socialLoginSuccessHandler,
                socialAuthorizationRequestResolver,
                socialLoginService,
                socialAuthorizedClientRepository,
                socialTokenResponseClient);
    }

    record BrowserSecurityDependencies(
            SecurityContextRepository securityContextRepository,
            LoginRateLimitFilter loginRateLimitFilter,
            LoginCaptchaFilter loginCaptchaFilter,
            AuthenticationManager webAuthnAuthenticationManager,
            AuthenticationManager formAuthenticationManager,
            PublicKeyCredentialRequestOptionsRepository webAuthnRequestOptionsRepository,
            WebAuthnRelyingPartyOperations webAuthnRelyingPartyOperations) {}

    record SocialSecurityDependencies(
            ObjectProvider<ClientRegistrationRepository> clientRegistrationRepository,
            ObjectProvider<SocialLoginAuthenticationSuccessHandler> socialLoginSuccessHandler,
            ObjectProvider<OAuth2AuthorizationRequestResolver> socialAuthorizationRequestResolver,
            SocialLoginService socialLoginService,
            OAuth2AuthorizedClientRepository socialAuthorizedClientRepository,
            OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest>
                    socialTokenResponseClient) {}

    private static WebAuthnSettings resolveWebAuthnSettings(
            ApplicationProperties applicationProperties) {
        ApplicationProperties.WebAuthn policy = applicationProperties.webAuthn();
        String configuredRpId = policy.rpId() == null ? "" : policy.rpId().trim();
        String configuredOrigins = policy.allowedOrigins() == null ? "" : policy.allowedOrigins();
        URI issuer = URI.create(applicationProperties.authorizationServer().issuer());
        return new WebAuthnSettings(
                configuredRpId.isBlank() ? issuer.getHost() : configuredRpId,
                configuredOrigins.isBlank()
                        ? Set.of(issuer.getScheme() + "://" + issuer.getRawAuthority())
                        : Arrays.stream(configuredOrigins.split(","))
                                .map(String::trim)
                                .filter(value -> !value.isBlank())
                                .collect(java.util.stream.Collectors.toUnmodifiableSet()));
    }

    private record WebAuthnSettings(String rpId, Set<String> allowedOrigins) {}

    @Bean
    OAuth2AuthorizedClientRepository socialAuthorizedClientRepository() {
        return new HttpSessionOAuth2AuthorizedClientRepository();
    }

    @Bean
    OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest> socialTokenResponseClient(
            RestClient.Builder restClientBuilder) {
        RestClientAuthorizationCodeTokenResponseClient client =
                new RestClientAuthorizationCodeTokenResponseClient();
        client.setRestClient(restClientBuilder.build());
        return client;
    }

    @Bean
    OAuth2AuthorizationRequestResolver socialAuthorizationRequestResolver(
            ObjectProvider<ClientRegistrationRepository> clientRegistrationRepositoryProvider,
            SocialLoginService socialLoginService) {
        ClientRegistrationRepository clientRegistrationRepository =
                clientRegistrationRepositoryProvider.getIfAvailable();
        if (clientRegistrationRepository == null) {
            return new OAuth2AuthorizationRequestResolver() {
                @Override
                public OAuth2AuthorizationRequest resolve(
                        jakarta.servlet.http.HttpServletRequest request) {
                    return null;
                }

                @Override
                public OAuth2AuthorizationRequest resolve(
                        jakarta.servlet.http.HttpServletRequest request,
                        String clientRegistrationId) {
                    return null;
                }
            };
        }
        DefaultOAuth2AuthorizationRequestResolver delegate =
                new DefaultOAuth2AuthorizationRequestResolver(
                        clientRegistrationRepository,
                        DefaultOAuth2AuthorizationRequestResolver
                                .DEFAULT_AUTHORIZATION_REQUEST_BASE_URI);
        return new OAuth2AuthorizationRequestResolver() {
            @Override
            public OAuth2AuthorizationRequest resolve(
                    jakarta.servlet.http.HttpServletRequest request) {
                return withoutLinkedInNonce(
                        withShortStateParameter(
                                onlyEnabled(delegate.resolve(request), socialLoginService),
                                socialLoginService),
                        socialLoginService);
            }

            @Override
            public OAuth2AuthorizationRequest resolve(
                    jakarta.servlet.http.HttpServletRequest request, String clientRegistrationId) {
                if (!socialLoginService.isProviderLoginAllowed(clientRegistrationId)) {
                    return null;
                }
                return withoutLinkedInNonce(
                        withShortStateParameter(
                                delegate.resolve(request, clientRegistrationId),
                                socialLoginService),
                        socialLoginService);
            }
        };
    }

    private static OAuth2AuthorizationRequest onlyEnabled(
            OAuth2AuthorizationRequest authorizationRequest,
            SocialLoginService socialLoginService) {
        if (authorizationRequest == null) {
            return null;
        }
        String registrationId =
                authorizationRequest.getAttribute(OAuth2ParameterNames.REGISTRATION_ID);
        return socialLoginService.isProviderLoginAllowed(registrationId)
                ? authorizationRequest
                : null;
    }

    private static OAuth2AuthorizationRequest withoutLinkedInNonce(
            OAuth2AuthorizationRequest authorizationRequest,
            SocialLoginService socialLoginService) {
        if (authorizationRequest == null
                || !socialLoginService.isLinkedInProvider(
                        authorizationRequest.getAttribute(OAuth2ParameterNames.REGISTRATION_ID))) {
            return authorizationRequest;
        }
        return OAuth2AuthorizationRequest.from(authorizationRequest)
                .additionalParameters(parameters -> parameters.remove(OidcParameterNames.NONCE))
                .attributes(attributes -> attributes.remove(OidcParameterNames.NONCE))
                .build();
    }

    private static OAuth2AuthorizationRequest withShortStateParameter(
            OAuth2AuthorizationRequest authorizationRequest,
            SocialLoginService socialLoginService) {
        if (authorizationRequest == null
                || !socialLoginService.requiresShortStateParameter(
                        authorizationRequest.getAttribute(OAuth2ParameterNames.REGISTRATION_ID))) {
            return authorizationRequest;
        }
        return OAuth2AuthorizationRequest.from(authorizationRequest).state(shortState()).build();
    }

    static String shortState() {
        byte[] bytes = new byte[16];
        SOCIAL_STATE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    @Bean
    SecurityContextRepository browserSecurityContextRepository() {
        return new DelegatingSecurityContextRepository(
                new RequestAttributeSecurityContextRepository(),
                new HttpSessionSecurityContextRepository());
    }

    @Bean
    Saml2AuthenticationRequestRepository<AbstractSaml2AuthenticationRequest>
            saml2AuthenticationRequestRepository() {
        return new HttpSessionSaml2AuthenticationRequestRepository();
    }

    @Bean
    SocialLoginAuthenticationSuccessHandler socialLoginAuthenticationSuccessHandler(
            SocialLoginService socialLoginService,
            org.springframework.security.core.userdetails.UserDetailsService userDetailsService,
            @Qualifier("browserSecurityContextRepository")
                    SecurityContextRepository securityContextRepository,
            OAuth2AuthorizedClientRepository socialAuthorizedClientRepository,
            SocialTokenService socialTokenService,
            MfaService mfaService) {
        return new SocialLoginAuthenticationSuccessHandler(
                socialLoginService,
                userDetailsService,
                securityContextRepository,
                socialAuthorizedClientRepository,
                socialTokenService,
                mfaService);
    }

    @Bean
    SamlLoginAuthenticationSuccessHandler samlLoginAuthenticationSuccessHandler(
            SamlLoginService samlLoginService,
            org.springframework.security.core.userdetails.UserDetailsService userDetailsService,
            @Qualifier("browserSecurityContextRepository")
                    SecurityContextRepository securityContextRepository,
            MfaService mfaService) {
        return new SamlLoginAuthenticationSuccessHandler(
                samlLoginService, userDetailsService, securityContextRepository, mfaService);
    }

    @Bean(name = "formAuthenticationManager")
    AuthenticationManager formAuthenticationManager(
            org.springframework.security.core.userdetails.UserDetailsService userDetailsService,
            LdapAuthenticationProvider ldapAuthenticationProvider,
            PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider localProvider = new DaoAuthenticationProvider(userDetailsService);
        localProvider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(ldapAuthenticationProvider, localProvider);
    }

    @Bean
    SecurityContextRepository authorizationServerSecurityContextRepository() {
        return new AuthorizationServerSecurityContextRepository();
    }

    @Bean
    SocialProviderLogoutSuccessHandler socialProviderLogoutSuccessHandler(
            SocialProviderSettingsService providerSettingsService,
            SocialProviderLogoutEndpointResolver logoutEndpointResolver,
            OAuth2ObservabilityMetrics metrics) {
        return new SocialProviderLogoutSuccessHandler(
                providerSettingsService, logoutEndpointResolver, metrics);
    }

    SocialProviderLogoutSuccessHandler socialProviderLogoutSuccessHandler(
            SocialProviderSettingsService providerSettingsService,
            SocialProviderLogoutEndpointResolver logoutEndpointResolver) {
        return new SocialProviderLogoutSuccessHandler(
                providerSettingsService, logoutEndpointResolver);
    }

    @Bean
    AuthenticationEventPublisher authenticationEventPublisher(
            ApplicationEventPublisher applicationEventPublisher) {
        return new DefaultAuthenticationEventPublisher(applicationEventPublisher);
    }
}
