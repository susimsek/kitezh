package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2TokenExchangeAuthenticationToken;
import org.springframework.security.web.authentication.AuthenticationConverter;

class TokenExchangeAuthenticationConverterTest {

    private final AuthenticationConverter converter = new TokenExchangeAuthenticationConverter();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void returnsNullForDifferentGrantType() {
        MockHttpServletRequest request = request();
        request.setParameter(
                OAuth2ParameterNames.GRANT_TYPE,
                AuthorizationGrantType.AUTHORIZATION_CODE.getValue());

        assertThat(converter.convert(request)).isNull();
    }

    @Test
    void returnsNullWhenRequestedTokenTypeIsMissing() {
        MockHttpServletRequest request = request();
        request.removeParameter(OAuth2ParameterNames.REQUESTED_TOKEN_TYPE);

        assertThat(converter.convert(request)).isNull();
    }

    @Test
    void returnsNullForStandardAccessTokenOutput() {
        MockHttpServletRequest request = request();
        request.setParameter(
                OAuth2ParameterNames.REQUESTED_TOKEN_TYPE,
                TokenExchangeAuthenticationConverter.ACCESS_TOKEN_TYPE);

        assertThat(converter.convert(request)).isNull();
    }

    @Test
    void rejectsMultipleRequestedTokenTypes() {
        MockHttpServletRequest request = request();
        request.setParameter(
                OAuth2ParameterNames.REQUESTED_TOKEN_TYPE,
                TokenExchangeAuthenticationConverter.REFRESH_TOKEN_TYPE,
                TokenExchangeAuthenticationConverter.ID_TOKEN_TYPE);

        assertThatThrownBy(() -> converter.convert(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertErrorCode(
                                        (OAuth2AuthenticationException) exception,
                                        "invalid_request"));
    }

    @Test
    void rejectsUnsupportedSubjectTokenType() {
        MockHttpServletRequest request = request();
        request.setParameter(OAuth2ParameterNames.SUBJECT_TOKEN_TYPE, "unsupported");

        assertThatThrownBy(() -> converter.convert(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertErrorCode(
                                        (OAuth2AuthenticationException) exception,
                                        "unsupported_token_type"));
    }

    @Test
    void rejectsMismatchedActorTokenParameters() {
        MockHttpServletRequest request = request();
        request.setParameter(OAuth2ParameterNames.ACTOR_TOKEN, "actor-token");

        assertThatThrownBy(() -> converter.convert(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertErrorCode(
                                        (OAuth2AuthenticationException) exception,
                                        "invalid_request"));
    }

    @Test
    void rejectsUnsupportedActorTokenType() {
        MockHttpServletRequest request = request();
        request.setParameter(OAuth2ParameterNames.ACTOR_TOKEN, "actor-token");
        request.setParameter(OAuth2ParameterNames.ACTOR_TOKEN_TYPE, "unsupported");

        assertThatThrownBy(() -> converter.convert(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertErrorCode(
                                        (OAuth2AuthenticationException) exception,
                                        "unsupported_token_type"));
    }

    @Test
    void rejectsMissingClientPrincipal() {
        MockHttpServletRequest request = request();

        assertThatThrownBy(() -> converter.convert(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertErrorCode(
                                        (OAuth2AuthenticationException) exception,
                                        "invalid_client"));
    }

    @Test
    void convertsExtendedRequestWithOptionalParameters() {
        MockHttpServletRequest request = request();
        request.setMethod("POST");
        request.setRequestURI("/oauth2/token");
        request.setParameter(
                OAuth2ParameterNames.SUBJECT_TOKEN_TYPE,
                TokenExchangeAuthenticationConverter.JWT_TOKEN_TYPE);
        request.setParameter(OAuth2ParameterNames.ACTOR_TOKEN, "actor-token");
        request.setParameter(
                OAuth2ParameterNames.ACTOR_TOKEN_TYPE,
                TokenExchangeAuthenticationConverter.ACCESS_TOKEN_TYPE);
        request.addParameter(OAuth2ParameterNames.RESOURCE, "resource-a", "resource-b");
        request.addParameter(OAuth2ParameterNames.AUDIENCE, "audience-a", "audience-b");
        request.setParameter(OAuth2ParameterNames.SCOPE, "openid profile openid");
        request.addHeader("DPoP", "proof");
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken("client", "credentials"));

        OAuth2TokenExchangeAuthenticationToken result =
                (OAuth2TokenExchangeAuthenticationToken) converter.convert(request);

        assertThat(result.getRequestedTokenType())
                .isEqualTo(TokenExchangeAuthenticationConverter.REFRESH_TOKEN_TYPE);
        assertThat(result.getSubjectToken()).isEqualTo("subject-token");
        assertThat(result.getSubjectTokenType())
                .isEqualTo(TokenExchangeAuthenticationConverter.JWT_TOKEN_TYPE);
        assertThat(result.getActorToken()).isEqualTo("actor-token");
        assertThat(result.getActorTokenType())
                .isEqualTo(TokenExchangeAuthenticationConverter.ACCESS_TOKEN_TYPE);
        assertThat(result.getResources()).containsExactly("resource-a", "resource-b");
        assertThat(result.getAudiences()).containsExactly("audience-a", "audience-b");
        assertThat(result.getScopes()).containsExactlyInAnyOrder("openid", "profile");
        assertThat(result.getAdditionalParameters())
                .containsExactlyInAnyOrderEntriesOf(
                        Map.of(
                                "dpop_proof", "proof",
                                "dpop_method", "POST",
                                "dpop_target_uri", "http://localhost/oauth2/token"));
    }

    @Test
    void convertsRequestWithoutScopesOrDpop() {
        MockHttpServletRequest request = request();
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken("client", "credentials"));

        OAuth2TokenExchangeAuthenticationToken result =
                (OAuth2TokenExchangeAuthenticationToken) converter.convert(request);

        assertThat(result.getActorToken()).isNull();
        assertThat(result.getScopes()).isEmpty();
        assertThat(result.getResources()).isEmpty();
        assertThat(result.getAudiences()).isEmpty();
        assertThat(result.getAdditionalParameters()).isEmpty();
    }

    @Test
    void rejectsDuplicateRequiredSubjectToken() {
        MockHttpServletRequest request = request();
        request.setParameter(OAuth2ParameterNames.SUBJECT_TOKEN, "subject-token", "another-token");
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken("client", "credentials"));

        assertThatThrownBy(() -> converter.convert(request))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .satisfies(
                        exception ->
                                assertErrorCode(
                                        (OAuth2AuthenticationException) exception,
                                        "invalid_request"));
    }

    private static MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setParameter(
                OAuth2ParameterNames.GRANT_TYPE, AuthorizationGrantType.TOKEN_EXCHANGE.getValue());
        request.setParameter(
                OAuth2ParameterNames.REQUESTED_TOKEN_TYPE,
                TokenExchangeAuthenticationConverter.REFRESH_TOKEN_TYPE);
        request.setParameter(
                OAuth2ParameterNames.SUBJECT_TOKEN_TYPE,
                TokenExchangeAuthenticationConverter.ACCESS_TOKEN_TYPE);
        request.setParameter(OAuth2ParameterNames.SUBJECT_TOKEN, "subject-token");
        return request;
    }

    private static void assertErrorCode(OAuth2AuthenticationException exception, String errorCode) {
        assertThat(exception.getError()).extracting(OAuth2Error::getErrorCode).isEqualTo(errorCode);
    }
}
