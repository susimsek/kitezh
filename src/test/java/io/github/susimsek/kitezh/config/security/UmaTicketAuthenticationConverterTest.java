package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;

class UmaTicketAuthenticationConverterTest {

    private final UmaTicketAuthenticationConverter converter =
            new UmaTicketAuthenticationConverter();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void ignoresDifferentGrantType() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setParameter(OAuth2ParameterNames.GRANT_TYPE, "client_credentials");

        assertThat(converter.convert(request)).isNull();
    }

    @Test
    void rejectsMissingOrBlankTicket() {
        MockHttpServletRequest missingTicketRequest = umaRequest();

        assertInvalidRequest(missingTicketRequest);

        MockHttpServletRequest blankTicketRequest = umaRequest();
        blankTicketRequest.setParameter("ticket", "  ");

        assertInvalidRequest(blankTicketRequest);
    }

    @Test
    void rejectsDuplicateRequiredAndOptionalParameters() {
        MockHttpServletRequest duplicateTicketRequest = umaRequest();
        duplicateTicketRequest.addParameter("ticket", "first", "second");
        assertInvalidRequest(duplicateTicketRequest);

        MockHttpServletRequest duplicateSubjectTokenRequest = umaRequest();
        duplicateSubjectTokenRequest.setParameter("ticket", "ticket-value");
        duplicateSubjectTokenRequest.addParameter("subject_token", "first", "second");
        assertInvalidRequest(duplicateSubjectTokenRequest);

        MockHttpServletRequest duplicateIncludeNameRequest = umaRequest();
        duplicateIncludeNameRequest.setParameter("ticket", "ticket-value");
        duplicateIncludeNameRequest.addParameter("response_include_resource_name", "true", "false");
        assertInvalidRequest(duplicateIncludeNameRequest);
    }

    @Test
    void rejectsRequestWithoutAuthenticatedClient() {
        MockHttpServletRequest request = umaRequest();
        request.setParameter("ticket", "ticket-value");

        assertThatThrownBy(() -> converter.convert(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertThat(
                                                ((OAuth2AuthenticationException) exception)
                                                        .getError()
                                                        .getErrorCode())
                                        .isEqualTo("invalid_client"));
    }

    @Test
    void convertsTicketWithDefaultsAndOptionalSubjectToken() {
        Authentication client = new TestingAuthenticationToken("client", "credentials");
        SecurityContextHolder.getContext().setAuthentication(client);
        MockHttpServletRequest request = umaRequest();
        request.setParameter("ticket", "ticket-value");
        request.setParameter("subject_token", "subject-token-value");

        UmaTicketAuthenticationToken result =
                (UmaTicketAuthenticationToken) converter.convert(request);

        assertThat(result.getPrincipal()).isSameAs(client);
        assertThat(result.getGrantType().getValue()).isEqualTo(AuthorizationGrantTypes.UMA_TICKET);
        assertThat(result.getAdditionalParameters())
                .containsExactlyInAnyOrderEntriesOf(
                        Map.of(
                                "ticket", "ticket-value",
                                "subject_token", "subject-token-value",
                                "response_include_resource_name", true));
    }

    @Test
    void omitsBlankSubjectTokenAndHonorsFalseIncludeResourceNameCaseInsensitively() {
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken("client", "credentials"));
        MockHttpServletRequest request = umaRequest();
        request.setParameter("ticket", "ticket-value");
        request.setParameter("subject_token", " ");
        request.setParameter("response_include_resource_name", "FALSE");

        UmaTicketAuthenticationToken result =
                (UmaTicketAuthenticationToken) converter.convert(request);

        assertThat(result.getAdditionalParameters())
                .containsExactlyInAnyOrderEntriesOf(
                        Map.of("ticket", "ticket-value", "response_include_resource_name", false));
    }

    private static MockHttpServletRequest umaRequest() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setParameter(OAuth2ParameterNames.GRANT_TYPE, AuthorizationGrantTypes.UMA_TICKET);
        return request;
    }

    private static void assertInvalidRequest(MockHttpServletRequest request) {
        assertThatThrownBy(() -> new UmaTicketAuthenticationConverter().convert(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertThat(
                                                ((OAuth2AuthenticationException) exception)
                                                        .getError()
                                                        .getErrorCode())
                                        .isEqualTo("invalid_request"));
    }
}
