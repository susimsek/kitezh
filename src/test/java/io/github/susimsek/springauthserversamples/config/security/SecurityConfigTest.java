package io.github.susimsek.springauthserversamples.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.github.susimsek.springauthserversamples.security.LocalizedAccessDeniedHandler;
import io.github.susimsek.springauthserversamples.security.LocalizedAuthenticationEntryPoint;
import io.github.susimsek.springauthserversamples.service.SocialLoginService;
import io.github.susimsek.springauthserversamples.service.SocialProviderSettingsService;
import io.github.susimsek.springauthserversamples.service.SocialTokenService;
import io.github.susimsek.springauthserversamples.service.account.MfaService;
import java.time.Duration;
import java.util.HashMap;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationContext;
import org.springframework.context.support.StaticApplicationContext;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.config.ObjectPostProcessor;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.oauth2.client.endpoint.OAuth2AccessTokenResponseClient;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.webauthn.authentication.PublicKeyCredentialRequestOptionsRepository;
import org.springframework.security.web.webauthn.authentication.WebAuthnAuthenticationFilter;
import org.springframework.security.web.webauthn.management.WebAuthnRelyingPartyOperations;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClient;

class SecurityConfigTest {

    private final SecurityConfig config =
            new SecurityConfig(
                    mock(LocalizedAuthenticationEntryPoint.class),
                    mock(LocalizedAccessDeniedHandler.class));

    @Test
    void createsPasswordEncoder() {
        assertThat(config.passwordEncoder()).isInstanceOf(DelegatingPasswordEncoder.class);
    }

    @Test
    void createsCompactUrlSafeStateValues() {
        String state = SecurityConfig.shortState();

        assertThat(state).hasSize(22).matches("[A-Za-z0-9_-]+");
    }

    @Test
    void createsSecuritySupportBeansAndEmptySocialResolver() {
        assertThat(config.socialAuthorizedClientRepository()).isNotNull();
        assertThat(config.socialTokenResponseClient(RestClient.builder())).isNotNull();
        assertThat(config.browserSecurityContextRepository()).isNotNull();
        assertThat(config.authorizationServerSecurityContextRepository()).isNotNull();
        assertThat(config.authenticationEventPublisher(mock())).isNotNull();

        ObjectProvider<ClientRegistrationRepository> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(null);
        var resolver =
                config.socialAuthorizationRequestResolver(provider, mock(SocialLoginService.class));
        assertThat(resolver.resolve(new MockHttpServletRequest())).isNull();
        assertThat(resolver.resolve(new MockHttpServletRequest(), "google")).isNull();
    }

    @Test
    void filtersDisabledProvidersAndDecoratesAllowedAuthorizationRequests() {
        ClientRegistration registration =
                ClientRegistration.withRegistrationId("google")
                        .clientId("client")
                        .clientSecret("secret")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                        .authorizationUri("https://example.test/authorize")
                        .tokenUri("https://example.test/token")
                        .scope("openid")
                        .build();
        SocialLoginService socialLoginService = mock(SocialLoginService.class);
        when(socialLoginService.isProviderLoginAllowed("google")).thenReturn(true);
        when(socialLoginService.requiresShortStateParameter("google")).thenReturn(true);
        when(socialLoginService.isLinkedInProvider("google")).thenReturn(false);
        ObjectProvider<ClientRegistrationRepository> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable())
                .thenReturn(new InMemoryClientRegistrationRepository(registration));
        var resolver = config.socialAuthorizationRequestResolver(provider, socialLoginService);

        MockHttpServletRequest request =
                new MockHttpServletRequest("GET", "/oauth2/authorization/google");
        var authorizationRequest = resolver.resolve(request, "google");
        assertThat(authorizationRequest).isNotNull();
        assertThat(authorizationRequest.getState()).hasSize(22);
        when(socialLoginService.isProviderLoginAllowed("google")).thenReturn(false);
        assertThat(resolver.resolve(request, "google")).isNull();
    }

    @Test
    void appliesProviderSpecificStateAndNonceRules() {
        ClientRegistration registration =
                ClientRegistration.withRegistrationId("linkedin")
                        .clientId("client")
                        .clientSecret("secret")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                        .authorizationUri("https://example.test/authorize")
                        .tokenUri("https://example.test/token")
                        .scope("openid")
                        .build();
        SocialLoginService socialLoginService = mock(SocialLoginService.class);
        when(socialLoginService.isProviderLoginAllowed("linkedin")).thenReturn(true);
        when(socialLoginService.requiresShortStateParameter("linkedin")).thenReturn(false);
        when(socialLoginService.isLinkedInProvider("linkedin")).thenReturn(true);
        ObjectProvider<ClientRegistrationRepository> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable())
                .thenReturn(new InMemoryClientRegistrationRepository(registration));
        var resolver = config.socialAuthorizationRequestResolver(provider, socialLoginService);

        var authorizationRequest =
                resolver.resolve(
                        new MockHttpServletRequest("GET", "/oauth2/authorization/linkedin"),
                        "linkedin");

        assertThat(authorizationRequest).isNotNull();
        assertThat(authorizationRequest.getState()).isNotBlank();
        assertThat(authorizationRequest.getAdditionalParameters())
                .doesNotContainKey(OidcParameterNames.NONCE);
    }

    @Test
    void buildsDefaultSecurityFilterChainWithoutSocialProviders() throws Exception {
        SecurityConfig securityConfig =
                new SecurityConfig(
                        mock(LocalizedAuthenticationEntryPoint.class),
                        mock(LocalizedAccessDeniedHandler.class),
                        mock(DynamicRememberMeServices.class));

        SecurityFilterChain chain =
                securityConfig.defaultSecurityFilterChain(
                        httpSecurity(),
                        new ApplicationProperties(),
                        browserDependencies(),
                        socialDependencies());

        assertThat(chain).isNotNull();
        assertThat(chain.getFilters()).isNotEmpty();

        WebAuthnAuthenticationFilter webAuthnFilter =
                chain.getFilters().stream()
                        .filter(WebAuthnAuthenticationFilter.class::isInstance)
                        .map(WebAuthnAuthenticationFilter.class::cast)
                        .findFirst()
                        .orElseThrow();
        AuthenticationSuccessHandler successHandler =
                (AuthenticationSuccessHandler)
                        ReflectionTestUtils.getField(webAuthnFilter, "successHandler");
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        successHandler.onAuthenticationSuccess(request, response, mock());
        assertThat(response.getStatus()).isEqualTo(204);
        assertThat(
                        request.getSession()
                                .getAttribute(MfaAuthorizationFilter.MFA_CREDENTIAL_VERIFIED))
                .isEqualTo(true);

        MockHttpServletRequest pendingRequest = new MockHttpServletRequest();
        pendingRequest
                .getSession()
                .setAttribute(MfaAuthorizationFilter.MFA_PENDING_REQUEST, "/oauth2/authorize");
        successHandler.onAuthenticationSuccess(
                pendingRequest, new MockHttpServletResponse(), mock());
        assertThat(pendingRequest.getSession().getAttribute(MfaAuthorizationFilter.MFA_VERIFIED))
                .isEqualTo(true);
        assertThat(
                        pendingRequest
                                .getSession()
                                .getAttribute(MfaAuthorizationFilter.MFA_PENDING_REQUEST))
                .isNull();
    }

    @Test
    void buildsDefaultSecurityFilterChainWithSocialProviders() throws Exception {
        ClientRegistration registration =
                ClientRegistration.withRegistrationId("google")
                        .clientId("client")
                        .clientSecret("secret")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                        .authorizationUri("https://example.test/authorize")
                        .tokenUri("https://example.test/token")
                        .scope("openid")
                        .build();
        ClientRegistrationRepository repository =
                new InMemoryClientRegistrationRepository(registration);
        ObjectProvider<ClientRegistrationRepository> clientProvider = mock(ObjectProvider.class);
        ObjectProvider<SocialLoginAuthenticationSuccessHandler> successProvider =
                mock(ObjectProvider.class);
        ObjectProvider<OAuth2AuthorizationRequestResolver> resolverProvider =
                mock(ObjectProvider.class);
        SocialLoginAuthenticationSuccessHandler successHandler =
                mock(SocialLoginAuthenticationSuccessHandler.class);
        OAuth2AuthorizationRequestResolver resolver =
                mock(OAuth2AuthorizationRequestResolver.class);
        when(clientProvider.getIfAvailable()).thenReturn(repository);
        when(successProvider.getObject()).thenReturn(successHandler);
        when(resolverProvider.getObject()).thenReturn(resolver);

        SecurityConfig securityConfig =
                new SecurityConfig(
                        mock(LocalizedAuthenticationEntryPoint.class),
                        mock(LocalizedAccessDeniedHandler.class),
                        mock(DynamicRememberMeServices.class));

        assertThat(
                        securityConfig.defaultSecurityFilterChain(
                                httpSecurity(repository),
                                new ApplicationProperties(),
                                browserDependencies(),
                                new SecurityConfig.SocialSecurityDependencies(
                                        clientProvider,
                                        successProvider,
                                        resolverProvider,
                                        mock(SocialLoginService.class),
                                        mock(OAuth2AuthorizedClientRepository.class),
                                        mock(OAuth2AccessTokenResponseClient.class))))
                .isNotNull();
    }

    @Test
    void resolvesDefaultSocialRequestsAndUsesConfiguredWebAuthnValues() throws Exception {
        ClientRegistration registration =
                ClientRegistration.withRegistrationId("google")
                        .clientId("client")
                        .clientSecret("secret")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                        .authorizationUri("https://example.test/authorize")
                        .tokenUri("https://example.test/token")
                        .scope("openid")
                        .build();
        SocialLoginService socialLoginService = mock(SocialLoginService.class);
        when(socialLoginService.isProviderLoginAllowed("google")).thenReturn(true);
        when(socialLoginService.requiresShortStateParameter("google")).thenReturn(false);
        when(socialLoginService.isLinkedInProvider("google")).thenReturn(false);
        ObjectProvider<ClientRegistrationRepository> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable())
                .thenReturn(new InMemoryClientRegistrationRepository(registration));
        var resolver = config.socialAuthorizationRequestResolver(provider, socialLoginService);

        var authorizationRequest =
                resolver.resolve(new MockHttpServletRequest("GET", "/oauth2/authorization/google"));

        assertThat(authorizationRequest).isNotNull();
        assertThat((String) authorizationRequest.getAttribute("registration_id"))
                .isEqualTo("google");
        assertThat(resolver.resolve(new MockHttpServletRequest("GET", "/not-social"))).isNull();
        when(socialLoginService.isProviderLoginAllowed("google")).thenReturn(false);
        assertThat(
                        resolver.resolve(
                                new MockHttpServletRequest("GET", "/oauth2/authorization/google")))
                .isNull();

        ApplicationProperties properties =
                new ApplicationProperties(
                        new ApplicationProperties.Cache(
                                new ApplicationProperties.Caffeine(Duration.ofHours(1), 1, 10)),
                        new ApplicationProperties.Session("0 * * * * *"),
                        new ApplicationProperties.AuthorizationServer("https://issuer.example"),
                        new ApplicationProperties.Mail(
                                false, "no-reply@example.test", "https://issuer.example"),
                        new ApplicationProperties.Security(),
                        new ApplicationProperties.WebAuthn(
                                "Example",
                                "example.test",
                                "https://issuer.example, ,https://other.example",
                                300,
                                "REQUIRED",
                                "REQUIRED",
                                "NONE"),
                        new ApplicationProperties.RegistrationCaptcha());

        SecurityConfig securityConfig =
                new SecurityConfig(
                        mock(LocalizedAuthenticationEntryPoint.class),
                        mock(LocalizedAccessDeniedHandler.class),
                        mock(DynamicRememberMeServices.class));
        assertThat(
                        securityConfig.defaultSecurityFilterChain(
                                httpSecurity(),
                                properties,
                                browserDependencies(),
                                socialDependencies()))
                .isNotNull();

        ApplicationProperties nullWebAuthnProperties =
                new ApplicationProperties(
                        new ApplicationProperties.Cache(
                                new ApplicationProperties.Caffeine(Duration.ofHours(1), 1, 10)),
                        new ApplicationProperties.Session("0 * * * * *"),
                        new ApplicationProperties.AuthorizationServer("https://issuer.example"),
                        new ApplicationProperties.Mail(
                                false, "no-reply@example.test", "https://issuer.example"),
                        new ApplicationProperties.Security(),
                        new ApplicationProperties.WebAuthn(
                                "Example", null, null, 300, "REQUIRED", "REQUIRED", "NONE"),
                        new ApplicationProperties.RegistrationCaptcha());
        assertThat(
                        securityConfig.defaultSecurityFilterChain(
                                httpSecurity(),
                                nullWebAuthnProperties,
                                browserDependencies(),
                                socialDependencies()))
                .isNotNull();
    }

    @Test
    void createsAuthenticationAndLogoutSupportBeans() {
        assertThat(
                        config.socialLoginAuthenticationSuccessHandler(
                                mock(SocialLoginService.class),
                                mock(
                                        org.springframework.security.core.userdetails
                                                .UserDetailsService.class),
                                mock(SecurityContextRepository.class),
                                mock(OAuth2AuthorizedClientRepository.class),
                                mock(SocialTokenService.class),
                                mock(MfaService.class)))
                .isNotNull();
        assertThat(
                        config.socialProviderLogoutSuccessHandler(
                                mock(SocialProviderSettingsService.class),
                                mock(SocialProviderLogoutEndpointResolver.class)))
                .isNotNull();
    }

    @SuppressWarnings("unchecked")
    private static <T> ObjectProvider<T> emptyProvider() {
        return mock(ObjectProvider.class);
    }

    private static SecurityConfig.BrowserSecurityDependencies browserDependencies() {
        org.springframework.security.authentication.AuthenticationManager authenticationManager =
                mock(org.springframework.security.authentication.AuthenticationManager.class);
        return new SecurityConfig.BrowserSecurityDependencies(
                mock(SecurityContextRepository.class),
                mock(LoginRateLimitFilter.class),
                mock(LoginCaptchaFilter.class),
                authenticationManager,
                authenticationManager,
                mock(PublicKeyCredentialRequestOptionsRepository.class),
                mock(WebAuthnRelyingPartyOperations.class));
    }

    private static SecurityConfig.SocialSecurityDependencies socialDependencies() {
        return new SecurityConfig.SocialSecurityDependencies(
                emptyProvider(),
                emptyProvider(),
                emptyProvider(),
                mock(SocialLoginService.class),
                mock(OAuth2AuthorizedClientRepository.class),
                mock(OAuth2AccessTokenResponseClient.class));
    }

    private static HttpSecurity httpSecurity() {
        return httpSecurity(null);
    }

    private static HttpSecurity httpSecurity(
            ClientRegistrationRepository clientRegistrationRepository) {
        ObjectPostProcessor<Object> postProcessor =
                new ObjectPostProcessor<>() {
                    @Override
                    public <O> O postProcess(O object) {
                        return object;
                    }
                };
        final HttpSecurity httpSecurity =
                new HttpSecurity(
                        postProcessor,
                        new AuthenticationManagerBuilder(postProcessor),
                        new HashMap<>());
        StaticApplicationContext applicationContext = new StaticApplicationContext();
        applicationContext
                .getBeanFactory()
                .registerSingleton("pathPatternBuilder", PathPatternRequestMatcher.withDefaults());
        applicationContext.getBeanFactory().registerSingleton("jwtDecoder", mock(JwtDecoder.class));
        if (clientRegistrationRepository != null) {
            applicationContext
                    .getBeanFactory()
                    .registerSingleton(
                            "clientRegistrationRepository", clientRegistrationRepository);
        }
        applicationContext
                .getBeanFactory()
                .registerSingleton(
                        "userDetailsService",
                        mock(
                                org.springframework.security.core.userdetails.UserDetailsService
                                        .class));
        httpSecurity.setSharedObject(ApplicationContext.class, applicationContext);
        httpSecurity.setSharedObject(
                jakarta.servlet.ServletContext.class, new MockServletContext());
        httpSecurity.setSharedObject(
                PathPatternRequestMatcher.Builder.class, PathPatternRequestMatcher.withDefaults());
        httpSecurity.setSharedObject(JwtDecoder.class, mock(JwtDecoder.class));
        return httpSecurity;
    }
}
