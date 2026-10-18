package io.github.susimsek.kitezh.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.security.MfaAuthorizationFilter;
import io.github.susimsek.kitezh.domain.CibaAuthenticationRequestEntity;
import io.github.susimsek.kitezh.domain.CibaAuthenticationRequestStatus;
import io.github.susimsek.kitezh.dto.account.MfaCodeRequestDTO;
import io.github.susimsek.kitezh.dto.oauth.CibaPendingRequestDTO;
import io.github.susimsek.kitezh.service.account.MfaService;
import io.github.susimsek.kitezh.service.ciba.CibaAuthenticationService;
import io.github.susimsek.kitezh.service.ciba.CibaClientAuthenticationService;
import io.github.susimsek.kitezh.service.ciba.CibaProtocolException;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.time.Instant;
import java.util.function.BooleanSupplier;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;

class CibaControllerTest {

    private final CibaAuthenticationService cibaService = mock(CibaAuthenticationService.class);
    private final CibaClientAuthenticationService clients =
            mock(CibaClientAuthenticationService.class);
    private final MfaService mfaService = mock(MfaService.class);
    private final CibaController controller = new CibaController(cibaService, clients, mfaService);

    @Test
    void createsBackchannelRequestAndReturnsProtocolShape() {
        RegisteredClient registeredClient =
                RegisteredClient.withId("client-id")
                        .clientId("client")
                        .clientSecret("secret")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(
                                new org.springframework.security.oauth2.core.AuthorizationGrantType(
                                        "urn:openid:params:grant-type:ciba"))
                        .scope("openid")
                        .build();
        OAuth2ClientAuthenticationToken client =
                new OAuth2ClientAuthenticationToken(
                        registeredClient, ClientAuthenticationMethod.CLIENT_SECRET_BASIC, "secret");
        CibaAuthenticationRequestEntity request =
                new CibaAuthenticationRequestEntity(
                        "request",
                        "client-id",
                        "admin",
                        "openid",
                        null,
                        Instant.EPOCH,
                        Instant.EPOCH.plusSeconds(300),
                        5);
        when(clients.authenticate(any())).thenReturn(client);
        when(cibaService.create(registeredClient, "openid", "admin", "Approve", 300))
                .thenReturn(request);

        var response =
                controller.authorize(
                        new MockHttpServletRequest(), "openid", "admin", "Approve", 300);

        assertThat(response.authReqId()).isEqualTo("request");
        assertThat(response.expiresIn()).isEqualTo(300);
        assertThat(response.interval()).isEqualTo(5);
    }

    @Test
    void delegatesApprovalDenialAndFormatsProtocolErrors() {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken("admin", "secret");
        assertThat(controller.approve(authentication, "request").getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.deny(authentication, "request").getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        verify(cibaService).approve("request", "admin");
        verify(cibaService).deny("request", "admin");

        CibaProtocolException exception =
                new CibaProtocolException("invalid_request", "invalid", HttpStatus.BAD_REQUEST);
        ResponseEntity<?> response = controller.protocolError(exception);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody())
                .hasToString(
                        "CibaErrorResponseDTO[error=invalid_request, errorDescription=invalid]");
    }

    @Test
    void omitsPollingIntervalForPushDeliveryAndAcceptsCredentialAssurance() {
        RegisteredClient registeredClient =
                RegisteredClient.withId("client-id")
                        .clientId("client")
                        .clientSecret("secret")
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(
                                new org.springframework.security.oauth2.core.AuthorizationGrantType(
                                        "urn:openid:params:grant-type:ciba"))
                        .scope("openid")
                        .build();
        OAuth2ClientAuthenticationToken client =
                new OAuth2ClientAuthenticationToken(
                        registeredClient, ClientAuthenticationMethod.CLIENT_SECRET_BASIC, "secret");
        CibaAuthenticationRequestEntity request =
                new CibaAuthenticationRequestEntity(
                        "request",
                        "client-id",
                        "admin",
                        "openid",
                        null,
                        Instant.EPOCH,
                        Instant.EPOCH.plusSeconds(300),
                        5);
        request.setDeliveryMode("push");
        when(clients.authenticate(any())).thenReturn(client);
        when(cibaService.create(registeredClient, "openid", "admin", null, null))
                .thenReturn(request);

        assertThat(
                        controller
                                .authorize(
                                        new MockHttpServletRequest(), "openid", "admin", null, null)
                                .interval())
                .isNull();

        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken("admin", "secret");
        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        servletRequest
                .getSession(true)
                .setAttribute(MfaAuthorizationFilter.MFA_CREDENTIAL_VERIFIED, true);
        controller.approve(authentication, servletRequest, "request");
        verify(cibaService).approve("request", "admin", false, true);
    }

    @Test
    void listsPendingRequestsForAuthenticatedUser() {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken("admin", "secret");
        var request =
                new CibaPendingRequestDTO(
                        "request",
                        "K7P4M2Q9",
                        "Approve",
                        "openid",
                        "poll",
                        Instant.EPOCH,
                        Instant.EPOCH.plusSeconds(300),
                        CibaAuthenticationRequestStatus.PENDING,
                        false,
                        false);
        var pageable = PageRequest.of(0, 20);
        when(cibaService.pendingRequests("admin", pageable))
                .thenReturn(new PageImpl<>(java.util.List.of(request)));

        var response = controller.pendingRequests(authentication, pageable);

        assertThat(response.getContent()).containsExactly(request);
        verify(cibaService).pendingRequests("admin", pageable);
    }

    @Test
    void passesSessionAssuranceToApproval() {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken("admin", "secret");
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.getSession(true).setAttribute(MfaAuthorizationFilter.MFA_VERIFIED, true);

        assertThat(controller.approve(authentication, request, "request").getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        verify(cibaService).approve("request", "admin", true, true);
    }

    @Test
    void passesUserCodeToApprovalAndDenial() {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken("admin", "secret");
        MockHttpServletRequest request = new MockHttpServletRequest();

        assertThat(controller.approve(authentication, request, "request", "K7P4M2Q9"))
                .isEqualTo(ResponseEntity.noContent().build());
        assertThat(controller.deny(authentication, "request", "K7P4M2Q9"))
                .isEqualTo(ResponseEntity.noContent().build());

        verify(cibaService).approve("request", "admin", "K7P4M2Q9", false, false);
        verify(cibaService).deny("request", "admin", "K7P4M2Q9");
    }

    @Test
    void verifiesNativeTotpBeforeBindingApprovalToCibaRequest() {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken("admin", "secret");
        when(mfaService.validForStepUp("admin", "123456")).thenReturn(true);
        when(cibaService.approveWithNativeMfa(
                        eq("request"), eq("admin"), eq("K7P4M2Q9"), any(BooleanSupplier.class)))
                .thenAnswer(
                        invocation -> ((BooleanSupplier) invocation.getArgument(3)).getAsBoolean());

        assertThat(
                        controller.approveNative(
                                authentication,
                                "request",
                                "K7P4M2Q9",
                                new MfaCodeRequestDTO("123456")))
                .isEqualTo(ResponseEntity.noContent().build());

        verify(mfaService).validForStepUp("admin", "123456");
        verify(cibaService)
                .approveWithNativeMfa(
                        eq("request"), eq("admin"), eq("K7P4M2Q9"), any(BooleanSupplier.class));
    }

    @Test
    void rejectsInvalidNativeTotpWithoutApprovingCibaRequest() {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken("admin", "secret");
        when(mfaService.validForStepUp("admin", "123456")).thenReturn(false);
        when(cibaService.approveWithNativeMfa(
                        eq("request"), eq("admin"), eq("K7P4M2Q9"), any(BooleanSupplier.class)))
                .thenAnswer(
                        invocation -> ((BooleanSupplier) invocation.getArgument(3)).getAsBoolean());

        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () ->
                                controller.approveNative(
                                        authentication,
                                        "request",
                                        "K7P4M2Q9",
                                        new MfaCodeRequestDTO("123456")))
                .isInstanceOf(ApiException.class);

        verify(cibaService)
                .approveWithNativeMfa(
                        eq("request"), eq("admin"), eq("K7P4M2Q9"), any(BooleanSupplier.class));
    }

    @Test
    void rejectsUnownedNativeApprovalBeforeConsumingTotp() {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken("admin", "secret");
        doThrow(new CibaProtocolException("access_denied", "not owner", HttpStatus.FORBIDDEN))
                .when(cibaService)
                .approveWithNativeMfa(
                        eq("request"), eq("admin"), eq("K7P4M2Q9"), any(BooleanSupplier.class));

        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () ->
                                controller.approveNative(
                                        authentication,
                                        "request",
                                        "K7P4M2Q9",
                                        new MfaCodeRequestDTO("123456")))
                .isInstanceOf(CibaProtocolException.class);

        verify(mfaService, never()).validForStepUp("admin", "123456");
    }
}
