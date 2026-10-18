package io.github.susimsek.kitezh.service.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.config.security.SecurityJsonMapper;
import io.github.susimsek.kitezh.domain.AuthenticationFlowBindingType;
import io.github.susimsek.kitezh.domain.MobileLoginTransactionEntity;
import io.github.susimsek.kitezh.dto.account.MfaSetupDTO;
import io.github.susimsek.kitezh.dto.account.MfaStatusDTO;
import io.github.susimsek.kitezh.dto.account.MobileGoogleLoginRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobileLoginActionRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobileLoginMfaRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobileLoginPlatform;
import io.github.susimsek.kitezh.dto.account.MobileLoginRequestDTO;
import io.github.susimsek.kitezh.dto.account.MobileLoginResponseDTO;
import io.github.susimsek.kitezh.dto.account.MobilePasskeyLoginRequestDTO;
import io.github.susimsek.kitezh.dto.account.RecoveryCodesDTO;
import io.github.susimsek.kitezh.dto.account.RequiredActionDTO;
import io.github.susimsek.kitezh.repository.MobileLoginTransactionRepository;
import io.github.susimsek.kitezh.service.DomainUserDetailsService;
import io.github.susimsek.kitezh.service.account.MfaService;
import io.github.susimsek.kitezh.service.account.RecoveryCodeService;
import io.github.susimsek.kitezh.service.account.WebAuthnService;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.requiredaction.RequiredActionService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.PkceParameterNames;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationCode;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;
import org.springframework.security.web.webauthn.api.Bytes;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialRequestOptions;
import org.springframework.security.web.webauthn.management.PublicKeyCredentialRequestOptionsRequest;
import org.springframework.security.web.webauthn.management.WebAuthnRelyingPartyOperations;

class MobileNativeLoginServiceTest {

    private static final String CLIENT_ID = "mobile-account-console";
    private static final String REDIRECT_URI = "kitezh://oauth/callback";
    private static final String STATE = "state_0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final String CHALLENGE = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    private RegisteredClientRepository clients;
    private OAuth2AuthorizationService authorizations;
    private MobileLoginTransactionRepository transactions;
    private DomainUserDetailsService userDetailsService;
    private AuthenticationManager authenticationManager;
    private LoginRateLimitService rateLimitService;
    private RegistrationCaptchaService captchaService;
    private MfaService mfaService;
    private RecoveryCodeService recoveryCodeService;
    private RequiredActionService requiredActionService;
    private AuthenticationFlowRuntimeService flowRuntime;
    private ApplicationEventPublisher eventPublisher;
    private AdminAuditEventService auditEventService;
    private WebAuthnRelyingPartyOperations webAuthnRelyingPartyOperations;
    private WebAuthnService webAuthnService;
    private MobileNativeLoginService service;
    private HttpServletRequest servletRequest;

    @BeforeEach
    void setUp() {
        clients = mock(RegisteredClientRepository.class);
        authorizations = mock(OAuth2AuthorizationService.class);
        transactions = mock(MobileLoginTransactionRepository.class);
        userDetailsService = mock(DomainUserDetailsService.class);
        Map<String, MobileLoginTransactionEntity> transactionRows = new ConcurrentHashMap<>();
        when(transactions.saveAndFlush(any(MobileLoginTransactionEntity.class)))
                .thenAnswer(
                        invocation -> {
                            MobileLoginTransactionEntity entity = invocation.getArgument(0);
                            transactionRows.put(entity.getId(), entity);
                            return entity;
                        });
        when(transactions.findByIdForUpdate(any(String.class)))
                .thenAnswer(
                        invocation ->
                                java.util.Optional.ofNullable(
                                        transactionRows.get(invocation.getArgument(0))));
        when(userDetailsService.loadUserByUsername("admin"))
                .thenReturn(
                        User.withUsername("admin")
                                .password("encoded")
                                .authorities("ROLE_ADMIN")
                                .build());
        org.mockito.Mockito.doAnswer(
                        invocation -> {
                            transactionRows.remove(
                                    ((MobileLoginTransactionEntity) invocation.getArgument(0))
                                            .getId());
                            return null;
                        })
                .when(transactions)
                .delete(any(MobileLoginTransactionEntity.class));
        authenticationManager = mock(AuthenticationManager.class);
        rateLimitService = mock(LoginRateLimitService.class);
        captchaService = mock(RegistrationCaptchaService.class);
        mfaService = mock(MfaService.class);
        requiredActionService = mock(RequiredActionService.class);
        recoveryCodeService = mock(RecoveryCodeService.class);
        flowRuntime = mock(AuthenticationFlowRuntimeService.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        auditEventService = mock(AdminAuditEventService.class);
        webAuthnRelyingPartyOperations = mock(WebAuthnRelyingPartyOperations.class);
        webAuthnService = mock(WebAuthnService.class);
        when(webAuthnService.hasCredential("admin")).thenReturn(true);
        servletRequest = mock(HttpServletRequest.class);
        when(servletRequest.getRemoteAddr()).thenReturn("127.0.0.1");
        when(rateLimitService.check("admin", "127.0.0.1"))
                .thenReturn(new LoginRateLimitService.RateLimitDecision(true, 10, 9, 60));
        when(clients.findByClientId(CLIENT_ID)).thenReturn(client());
        when(clients.findById("mobile-account-console-id")).thenReturn(client());
        when(authenticationManager.authenticate(any(Authentication.class)))
                .thenReturn(
                        UsernamePasswordAuthenticationToken.authenticated(
                                "admin", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        when(mfaService.status("admin"))
                .thenReturn(new MfaStatusDTO(true, true, false, "Kitezh", "SHA1", 6, 30));
        when(flowRuntime.containsEnabledExecution(
                        AuthenticationFlowBindingType.BROWSER, "otp-form"))
                .thenReturn(true);
        when(requiredActionService.pending("admin")).thenReturn(List.of());
        service =
                new MobileNativeLoginService(
                        clients,
                        authorizations,
                        transactions,
                        userDetailsService,
                        Map.of("formAuthenticationManager", authenticationManager),
                        rateLimitService,
                        captchaService,
                        mfaService,
                        recoveryCodeService,
                        requiredActionService,
                        flowRuntime,
                        eventPublisher,
                        new ApplicationProperties(),
                        auditEventService,
                        webAuthnRelyingPartyOperations,
                        new SecurityJsonMapper(getClass().getClassLoader()),
                        webAuthnService);
    }

    @Test
    void beginsPasswordlessPasskeyWithRequestOptionsBoundToThePkceTransaction() {
        PublicKeyCredentialRequestOptions options =
                PublicKeyCredentialRequestOptions.builder()
                        .challenge(Bytes.fromBase64("AAECAwQFBgcICQoLDA0ODw"))
                        .rpId("localhost")
                        .build();
        when(webAuthnRelyingPartyOperations.createCredentialRequestOptions(
                        any(PublicKeyCredentialRequestOptionsRequest.class)))
                .thenReturn(options);

        MobileLoginResponseDTO response =
                service.beginPasskey(
                        new MobilePasskeyLoginRequestDTO(
                                CLIENT_ID,
                                REDIRECT_URI,
                                "openid profile email account-api",
                                STATE,
                                CHALLENGE,
                                "S256",
                                "nonce_0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                                MobileLoginPlatform.ANDROID,
                                "admin"),
                        servletRequest);

        assertThat(response.status()).isEqualTo("passkey_required");
        assertThat(response.transactionId()).isNotBlank();
        assertThat(response.publicKey()).containsEntry("rpId", "localhost");
        verify(transactions).saveAndFlush(any(MobileLoginTransactionEntity.class));
    }

    @Test
    void issuesCodeOnlyAfterRequestBoundMfaAndInvalidatesTransactionAfterSuccess() {
        MobileLoginResponseDTO challenge = service.begin(request(), servletRequest);

        assertThat(challenge.status()).isEqualTo("mfa_required");
        assertThat(challenge.transactionId()).isNotBlank();
        assertThat(challenge.code()).isNull();

        when(mfaService.valid("admin", "123456")).thenReturn(true);
        MobileLoginResponseDTO authorized =
                service.verifyMfa(
                        challenge.transactionId(),
                        new MobileLoginMfaRequestDTO("123456"),
                        servletRequest);

        assertThat(authorized.status()).isEqualTo("authorized");
        assertThat(authorized.redirectUri()).isEqualTo(REDIRECT_URI);
        assertThat(authorized.state()).isEqualTo(STATE);
        verify(authorizations).save(any(OAuth2Authorization.class));
        assertThatThrownBy(
                        () ->
                                service.verifyMfa(
                                        challenge.transactionId(),
                                        new MobileLoginMfaRequestDTO("123456"),
                                        servletRequest))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsRequiredActionUntilTheTransactionIsInThatChallengeState() {
        when(requiredActionService.pending("admin"))
                .thenReturn(
                        List.of(
                                new RequiredActionDTO(
                                        "UPDATE_PROFILE", "Profile", "Complete profile", 1)));
        when(mfaService.status("admin"))
                .thenReturn(new MfaStatusDTO(false, true, false, "Kitezh", "SHA1", 6, 30));
        MobileLoginResponseDTO challenge = service.begin(request(), servletRequest);

        assertThat(challenge.status()).isEqualTo("required_actions");
        assertThat(challenge.actions())
                .extracting(RequiredActionDTO::key)
                .containsExactly("UPDATE_PROFILE");
        assertThatThrownBy(
                        () ->
                                service.verifyMfa(
                                        challenge.transactionId(),
                                        new MobileLoginMfaRequestDTO("123456"),
                                        servletRequest))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(
                        () ->
                                service.completeAction(
                                        challenge.transactionId(),
                                        "CONFIGURE_PASSKEY",
                                        new MobileLoginActionRequestDTO(Map.of()),
                                        servletRequest))
                .isInstanceOf(ApiException.class);
        verify(requiredActionService, never()).complete(any(), any(), any(), any(), any());
    }

    @Test
    void storesTheValidatedS256ChallengeInTheSasAuthorizationRequest() {
        when(mfaService.status("admin"))
                .thenReturn(new MfaStatusDTO(false, true, false, "Kitezh", "SHA1", 6, 30));
        when(flowRuntime.containsEnabledExecution(
                        AuthenticationFlowBindingType.BROWSER, "otp-form"))
                .thenReturn(true);
        MobileLoginResponseDTO authorized = service.begin(request(), servletRequest);
        org.mockito.ArgumentCaptor<OAuth2Authorization> captor =
                org.mockito.ArgumentCaptor.forClass(OAuth2Authorization.class);
        verify(authorizations).save(captor.capture());
        OAuth2Authorization authorization = captor.getValue();
        OAuth2AuthorizationRequest oauthRequest =
                authorization.getAttribute(OAuth2AuthorizationRequest.class.getName());

        assertThat((String) oauthRequest.getAttribute(PkceParameterNames.CODE_CHALLENGE))
                .isEqualTo(CHALLENGE);
        assertThat((String) oauthRequest.getAttribute(PkceParameterNames.CODE_CHALLENGE_METHOD))
                .isEqualTo("S256");
        assertThat(oauthRequest.getAdditionalParameters())
                .containsEntry("nonce", request().nonce());
        assertThat(authorization.getToken(OAuth2AuthorizationCode.class).getToken().getTokenValue())
                .isEqualTo(authorized.code());
    }

    @Test
    void rejectsConfiguredCaptchaBeforePasswordAuthentication() {
        doThrow(ApiException.badRequest(ApiErrorCode.CAPTCHA_FAILED, "CAPTCHA required"))
                .when(captchaService)
                .verifyMobileLoginOrThrow(null, request().platform(), servletRequest);

        assertThatThrownBy(() -> service.begin(request(), servletRequest))
                .isInstanceOf(ApiException.class);

        verify(authenticationManager, never()).authenticate(any(Authentication.class));
        verify(authorizations, never()).save(any(OAuth2Authorization.class));
    }

    @Test
    void badCredentialsPublishFailureAndDoNotMintAuthorization() {
        when(authenticationManager.authenticate(any(Authentication.class)))
                .thenThrow(new BadCredentialsException("bad credentials"));

        assertThatThrownBy(() -> service.begin(request(), servletRequest))
                .isInstanceOf(ApiException.class);

        verify(eventPublisher)
                .publishEvent(
                        any(
                                org.springframework.security.authentication.event
                                        .AuthenticationFailureBadCredentialsEvent.class));
        verify(authorizations, never()).save(any(OAuth2Authorization.class));
    }

    @Test
    void validatesSocialRequestAndContinuesVerifiedProviderThroughMfa() {
        MobileGoogleLoginRequestDTO request = socialRequest();

        service.validateSocialLoginRequest(request);
        MobileLoginResponseDTO challenge = service.beginSocialLogin(request, "admin", false);

        assertThat(challenge.status()).isEqualTo("mfa_required");
        assertThat(challenge.transactionId()).isNotBlank();
        verify(auditEventService)
                .record("user.mobile-login.social-authenticated", "user", "admin", "android");
    }

    @Test
    void rejectsProviderMfaRequirementWhenUserHasNoAuthenticator() {
        when(mfaService.status("admin"))
                .thenReturn(new MfaStatusDTO(false, false, false, "Kitezh", "SHA1", 6, 30));

        assertThatThrownBy(() -> service.beginSocialLogin(socialRequest(), "admin", true))
                .isInstanceOf(ApiException.class);

        verify(transactions, never()).saveAndFlush(any(MobileLoginTransactionEntity.class));
    }

    @Test
    void completesRequiredProfileActionAndIssuesCodeAfterActionsAreCleared() {
        RequiredActionDTO profile =
                new RequiredActionDTO("UPDATE_PROFILE", "Profile", "Complete profile", 1);
        when(requiredActionService.pending("admin"))
                .thenReturn(List.of(profile), List.of(profile), List.of());
        when(mfaService.status("admin"))
                .thenReturn(new MfaStatusDTO(false, false, false, "Kitezh", "SHA1", 6, 30));
        MobileLoginResponseDTO challenge = service.begin(request(), servletRequest);

        MobileLoginResponseDTO completed =
                service.completeAction(
                        challenge.transactionId(),
                        "UPDATE_PROFILE",
                        new MobileLoginActionRequestDTO(Map.of("firstName", "Ada")),
                        servletRequest);

        assertThat(completed.status()).isEqualTo("authorized");
        verify(requiredActionService)
                .complete("admin", "UPDATE_PROFILE", Map.of("firstName", "Ada"), "127.0.0.1", null);
    }

    @Test
    void rejectsEmailActionUntilVerificationLinkCompletes() {
        RequiredActionDTO email = new RequiredActionDTO("UPDATE_EMAIL", "Email", "Verify email", 1);
        when(requiredActionService.pending("admin")).thenReturn(List.of(email));
        when(mfaService.status("admin"))
                .thenReturn(new MfaStatusDTO(false, false, false, "Kitezh", "SHA1", 6, 30));
        MobileLoginResponseDTO challenge = service.begin(request(), servletRequest);

        assertThatThrownBy(
                        () ->
                                service.completeAction(
                                        challenge.transactionId(),
                                        "UPDATE_EMAIL",
                                        new MobileLoginActionRequestDTO(Map.of()),
                                        servletRequest))
                .isInstanceOf(ApiException.class);

        verify(requiredActionService, never()).complete(any(), any(), any(), any(), any());
    }

    @Test
    void setsUpTotpForPendingEnrollmentAction() {
        RequiredActionDTO totp =
                new RequiredActionDTO("CONFIGURE_TOTP", "Authenticator", "Set up MFA", 1);
        when(requiredActionService.pending("admin")).thenReturn(List.of(totp));
        when(mfaService.status("admin"))
                .thenReturn(new MfaStatusDTO(false, false, false, "Kitezh", "SHA1", 6, 30));
        when(mfaService.setup("admin"))
                .thenReturn(new MfaSetupDTO("SECRET", "data:image/png;base64,abc", "SHA1", 6, 30));
        MobileLoginResponseDTO challenge = service.begin(request(), servletRequest);

        assertThat(service.setupTotp(challenge.transactionId()).secret()).isEqualTo("SECRET");
    }

    @Test
    void generatesRecoveryCodesOnceWhenMfaIsEnabledAndActionIsPending() {
        RequiredActionDTO recovery =
                new RequiredActionDTO("RECOVERY_CODES", "Recovery codes", "Generate codes", 1);
        RecoveryCodesDTO codes = new RecoveryCodesDTO(List.of("ABCD-EFGH"), 1);
        when(requiredActionService.pending("admin")).thenReturn(List.of(recovery));
        when(mfaService.status("admin"))
                .thenReturn(new MfaStatusDTO(true, true, false, "Kitezh", "SHA1", 6, 30));
        when(recoveryCodeService.generate("admin")).thenReturn(codes);
        MobileLoginResponseDTO challenge = service.begin(request(), servletRequest);

        assertThat(service.setupRecoveryCodes(challenge.transactionId())).isEqualTo(codes);
        assertThatThrownBy(() -> service.setupRecoveryCodes(challenge.transactionId()))
                .isInstanceOf(ApiException.class);
        verify(recoveryCodeService).generate("admin");
    }

    private static MobileGoogleLoginRequestDTO socialRequest() {
        return new MobileGoogleLoginRequestDTO(
                CLIENT_ID,
                REDIRECT_URI,
                "openid profile email account-api",
                STATE,
                CHALLENGE,
                "S256",
                "nonce_0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                MobileLoginPlatform.ANDROID,
                "signed-id-token");
    }

    private static MobileLoginRequestDTO request() {
        return new MobileLoginRequestDTO(
                CLIENT_ID,
                REDIRECT_URI,
                "openid profile email account-api",
                STATE,
                CHALLENGE,
                "S256",
                "nonce_0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                MobileLoginPlatform.ANDROID,
                "admin",
                "admin",
                null);
    }

    private static RegisteredClient client() {
        return RegisteredClient.withId("mobile-account-console-id")
                .clientId(CLIENT_ID)
                .clientName("Kitezh Mobile Account")
                .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .redirectUri(REDIRECT_URI)
                .scope("openid")
                .scope("profile")
                .scope("email")
                .scope("account-api")
                .clientSettings(
                        ClientSettings.builder()
                                .requireProofKey(true)
                                .requireAuthorizationConsent(false)
                                .build())
                .tokenSettings(TokenSettings.builder().build())
                .build();
    }
}
