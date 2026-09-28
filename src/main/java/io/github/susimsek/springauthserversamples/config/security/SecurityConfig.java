package io.github.susimsek.springauthserversamples.config.security;

import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.github.susimsek.springauthserversamples.config.observability.LoggingProperties;
import io.github.susimsek.springauthserversamples.config.observability.ObservabilityMdcFilter;
import io.github.susimsek.springauthserversamples.security.LocalizedAccessDeniedHandler;
import io.github.susimsek.springauthserversamples.security.LocalizedAuthenticationEntryPoint;
import io.github.susimsek.springauthserversamples.service.SocialLoginService;
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

@Configuration(proxyBeanMethods = false)
public class SecurityConfig {

    private static final String LOGIN_PATH = "/login";

    private static final SecureRandom SOCIAL_STATE_RANDOM = new SecureRandom();

    private static final MediaTypeRequestMatcher HTML_REQUEST_MATCHER = htmlRequestMatcher();

    private static final NegatedRequestMatcher NON_HTML_REQUEST_MATCHER =
            new NegatedRequestMatcher(HTML_REQUEST_MATCHER);

    private final LocalizedAuthenticationEntryPoint localizedAuthenticationEntryPoint;
    private final LocalizedAccessDeniedHandler localizedAccessDeniedHandler;
    private final DynamicRememberMeServices rememberMeServices;

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
            LoggingProperties loggingProperties) {
        return defaultSecurityFilterChain(
                http,
                applicationProperties,
                browserDependencies,
                socialDependencies,
                new ObservabilityMdcFilter(loggingProperties.getAccess()));
    }

    SecurityFilterChain defaultSecurityFilterChain(
            HttpSecurity http,
            ApplicationProperties applicationProperties,
            BrowserSecurityDependencies browserDependencies,
            SocialSecurityDependencies socialDependencies) {
        return defaultSecurityFilterChain(
                http,
                applicationProperties,
                browserDependencies,
                socialDependencies,
                new ObservabilityMdcFilter());
    }

    private SecurityFilterChain defaultSecurityFilterChain(
            HttpSecurity http,
            ApplicationProperties applicationProperties,
            BrowserSecurityDependencies browserDependencies,
            SocialSecurityDependencies socialDependencies,
            ObservabilityMdcFilter observabilityMdcFilter) {
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
                                        .requestMatchers("/avatars/**", "/oidc/session-iframe.html")
                                        .permitAll()
                                        .requestMatchers("/api/auth/mfa/**")
                                        .authenticated()
                                        .requestMatchers("/account/avatar")
                                        .authenticated()
                                        .requestMatchers("/account/social-links/**")
                                        .authenticated()
                                        .requestMatchers("/api/auth/**")
                                        .permitAll()
                                        .requestMatchers("/oauth2/bc-authorize")
                                        .permitAll()
                                        .requestMatchers(
                                                "/admin",
                                                "/admin/**",
                                                "/",
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
                                                "/actuator/health",
                                                "/actuator/health/**",
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
                    MfaAuthorizationFilter.markCredentialVerified(request.getSession(true));
                    if (request.getSession(false) != null
                            && request.getSession(false)
                                            .getAttribute(
                                                    MfaAuthorizationFilter.MFA_PENDING_REQUEST)
                                    != null) {
                        MfaAuthorizationFilter.markVerified(request.getSession(false));
                    }
                    new WebAuthnAuthenticationSuccessHandler()
                            .onAuthenticationSuccess(request, response, authentication);
                });
        authenticationFilter.setAuthenticationFailureHandler(
                new SimpleUrlAuthenticationFailureHandler("/login?error"));

        http.addFilterBefore(requestOptionsFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(authenticationFilter, UsernamePasswordAuthenticationFilter.class);

        http.addFilterBefore(
                        browserDependencies.loginRateLimitFilter(),
                        UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(
                        browserDependencies.loginCaptchaFilter(),
                        UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(observabilityMdcFilter, AuthorizationFilter.class);

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
                                                    "/login?error"))
                                    .permitAll());
        }

        URI issuer = URI.create(applicationProperties.authorizationServer().issuer());
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
                                        metadata ->
                                                metadata.protectedResourceMetadataCustomizer(
                                                        builder ->
                                                                builder.resource(issuer.toString())
                                                                        .authorizationServer(
                                                                                issuer.toString())
                                                                        .claim(
                                                                                "dpop_signing_alg_values_supported",
                                                                                List.of(
                                                                                        "RS256",
                                                                                        "ES256")))));

        return http.build();
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
        URI issuer = URI.create(applicationProperties.authorizationServer().issuer());
        ApplicationProperties.WebAuthn policy = applicationProperties.webAuthn();
        String configuredRpId = policy.rpId() == null ? "" : policy.rpId().trim();
        String configuredOrigins = policy.allowedOrigins() == null ? "" : policy.allowedOrigins();
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
    OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest>
            socialTokenResponseClient() {
        return new RestClientAuthorizationCodeTokenResponseClient();
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
    SocialLoginAuthenticationSuccessHandler socialLoginAuthenticationSuccessHandler(
            io.github.susimsek.springauthserversamples.service.SocialLoginService
                    socialLoginService,
            org.springframework.security.core.userdetails.UserDetailsService userDetailsService,
            @Qualifier("browserSecurityContextRepository")
                    SecurityContextRepository securityContextRepository,
            OAuth2AuthorizedClientRepository socialAuthorizedClientRepository,
            io.github.susimsek.springauthserversamples.service.SocialTokenService
                    socialTokenService,
            io.github.susimsek.springauthserversamples.service.account.MfaService mfaService) {
        return new SocialLoginAuthenticationSuccessHandler(
                socialLoginService,
                userDetailsService,
                securityContextRepository,
                socialAuthorizedClientRepository,
                socialTokenService,
                mfaService);
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
            io.github.susimsek.springauthserversamples.service.SocialProviderSettingsService
                    providerSettingsService,
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
