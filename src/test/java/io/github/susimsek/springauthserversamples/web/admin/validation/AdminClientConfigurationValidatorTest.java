package io.github.susimsek.springauthserversamples.web.admin.validation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.dto.admin.AdminClientRequestDTO;
import io.github.susimsek.springauthserversamples.security.AuthorizationGrantTypes;
import java.time.Duration;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;

class AdminClientConfigurationValidatorTest {

    private final AdminClientConfigurationValidator validator =
            new AdminClientConfigurationValidator();

    @Test
    void acceptsNullRequestAndMissingCollections() {
        ConstraintContextFixture context = new ConstraintContextFixture();

        assertThat(validator.isValid(null, context.context)).isTrue();
        assertThat(
                        validator.isValid(
                                new AdminClientRequestDTO(
                                        "client",
                                        "Client",
                                        null,
                                        null,
                                        Set.of(),
                                        Set.of(),
                                        Set.of("openid"),
                                        false,
                                        false,
                                        Duration.ofMinutes(5),
                                        Duration.ofMinutes(5),
                                        Duration.ofHours(1)),
                                context.context))
                .isTrue();

        verify(context.context, never()).disableDefaultConstraintViolation();
    }

    @Test
    void acceptsValidConfidentialAuthorizationCodeClient() {
        ConstraintContextFixture context = new ConstraintContextFixture();

        boolean valid =
                validator.isValid(
                        request(
                                Set.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC.getValue()),
                                Set.of(AuthorizationGrantType.AUTHORIZATION_CODE.getValue()),
                                Set.of("https://example.test/callback"),
                                false),
                        context.context);

        assertThat(valid).isTrue();
        verify(context.context).disableDefaultConstraintViolation();
        verify(context.context, never()).buildConstraintViolationWithTemplate(anyString());
    }

    @Test
    void acceptsValidPublicPkceClient() {
        ConstraintContextFixture context = new ConstraintContextFixture();

        boolean valid =
                validator.isValid(
                        request(
                                Set.of(ClientAuthenticationMethod.NONE.getValue()),
                                Set.of(AuthorizationGrantType.AUTHORIZATION_CODE.getValue()),
                                Set.of("https://example.test/callback"),
                                true),
                        context.context);

        assertThat(valid).isTrue();
        verify(context.context).disableDefaultConstraintViolation();
        verify(context.context, never()).buildConstraintViolationWithTemplate(anyString());
    }

    @Test
    void rejectsUnknownAuthenticationMethod() {
        ConstraintContextFixture context = new ConstraintContextFixture();

        boolean valid =
                validator.isValid(
                        request(
                                Set.of("private_key_jwt"),
                                Set.of(AuthorizationGrantType.AUTHORIZATION_CODE.getValue()),
                                Set.of("https://example.test/callback"),
                                false),
                        context.context);

        assertThat(valid).isFalse();
        assertThat(context.fields()).containsExactly("clientAuthenticationMethods");
    }

    @Test
    void rejectsPublicMethodCombinedWithAnotherMethod() {
        ConstraintContextFixture context = new ConstraintContextFixture();

        boolean valid =
                validator.isValid(
                        request(
                                Set.of(
                                        ClientAuthenticationMethod.NONE.getValue(),
                                        ClientAuthenticationMethod.CLIENT_SECRET_POST.getValue()),
                                Set.of(AuthorizationGrantType.AUTHORIZATION_CODE.getValue()),
                                Set.of("https://example.test/callback"),
                                true),
                        context.context);

        assertThat(valid).isFalse();
        assertThat(context.fields()).containsExactly("clientAuthenticationMethods");
    }

    @Test
    void acceptsTokenExchangeGrantType() {
        ConstraintContextFixture context = new ConstraintContextFixture();

        boolean valid =
                validator.isValid(
                        request(
                                Set.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC.getValue()),
                                Set.of(AuthorizationGrantTypes.TOKEN_EXCHANGE),
                                Set.of(),
                                false),
                        context.context);

        assertThat(valid).isTrue();
        verify(context.context).disableDefaultConstraintViolation();
        verify(context.context, never()).buildConstraintViolationWithTemplate(anyString());
    }

    @Test
    void rejectsUnknownGrantType() {
        ConstraintContextFixture context = new ConstraintContextFixture();

        boolean valid =
                validator.isValid(
                        request(
                                Set.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC.getValue()),
                                Set.of("urn:ietf:params:oauth:grant-type:unknown"),
                                Set.of(),
                                false),
                        context.context);

        assertThat(valid).isFalse();
        assertThat(context.fields()).containsExactly("authorizationGrantTypes");
    }

    @Test
    void rejectsPublicClientCredentialsGrant() {
        ConstraintContextFixture context = new ConstraintContextFixture();

        boolean valid =
                validator.isValid(
                        request(
                                Set.of(ClientAuthenticationMethod.NONE.getValue()),
                                Set.of(AuthorizationGrantType.CLIENT_CREDENTIALS.getValue()),
                                Set.of(),
                                false),
                        context.context);

        assertThat(valid).isFalse();
        assertThat(context.fields()).containsExactly("authorizationGrantTypes");
    }

    @Test
    void rejectsAuthorizationCodeWithoutRedirectUri() {
        ConstraintContextFixture context = new ConstraintContextFixture();

        boolean valid =
                validator.isValid(
                        request(
                                Set.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC.getValue()),
                                Set.of(AuthorizationGrantType.AUTHORIZATION_CODE.getValue()),
                                Set.of(),
                                false),
                        context.context);

        assertThat(valid).isFalse();
        assertThat(context.fields()).containsExactly("redirectUris");
    }

    @Test
    void rejectsPublicAuthorizationCodeClientWithoutPkce() {
        ConstraintContextFixture context = new ConstraintContextFixture();

        boolean valid =
                validator.isValid(
                        request(
                                Set.of(ClientAuthenticationMethod.NONE.getValue()),
                                Set.of(AuthorizationGrantType.AUTHORIZATION_CODE.getValue()),
                                Set.of("https://example.test/callback"),
                                false),
                        context.context);

        assertThat(valid).isFalse();
        assertThat(context.fields()).containsExactly("authorizationGrantTypes");
    }

    @Test
    void rejectsPkceWithoutAuthorizationCodeGrant() {
        ConstraintContextFixture context = new ConstraintContextFixture();

        boolean valid =
                validator.isValid(
                        request(
                                Set.of(ClientAuthenticationMethod.CLIENT_SECRET_BASIC.getValue()),
                                Set.of(AuthorizationGrantType.CLIENT_CREDENTIALS.getValue()),
                                Set.of(),
                                true),
                        context.context);

        assertThat(valid).isFalse();
        assertThat(context.fields()).containsExactly("authorizationGrantTypes");
    }

    @Test
    void reportsEveryApplicableViolation() {
        ConstraintContextFixture context = new ConstraintContextFixture();

        boolean valid =
                validator.isValid(
                        request(
                                Set.of(
                                        ClientAuthenticationMethod.NONE.getValue(),
                                        ClientAuthenticationMethod.CLIENT_SECRET_BASIC.getValue()),
                                Set.of(
                                        "urn:ietf:params:oauth:grant-type:unknown",
                                        AuthorizationGrantType.CLIENT_CREDENTIALS.getValue(),
                                        AuthorizationGrantType.AUTHORIZATION_CODE.getValue()),
                                Set.of(),
                                false),
                        context.context);

        assertThat(valid).isFalse();
        assertThat(context.fields())
                .containsExactly(
                        "clientAuthenticationMethods",
                        "authorizationGrantTypes",
                        "redirectUris",
                        "authorizationGrantTypes");
        assertThat(context.templates())
                .containsExactly(
                        "{app.api.problem.violation.selection}",
                        "{app.api.problem.violation.selection}",
                        "{app.api.problem.violation.required}",
                        "{app.api.problem.violation.selection}");
    }

    private static AdminClientRequestDTO request(
            Set<String> methods,
            Set<String> grants,
            Set<String> redirectUris,
            boolean requireProofKey) {
        return new AdminClientRequestDTO(
                "client",
                "Client",
                methods,
                grants,
                redirectUris,
                Set.of(),
                Set.of("openid"),
                false,
                requireProofKey,
                Duration.ofMinutes(5),
                Duration.ofMinutes(5),
                Duration.ofHours(1));
    }

    private static final class ConstraintContextFixture {
        private final jakarta.validation.ConstraintValidatorContext context =
                mock(jakarta.validation.ConstraintValidatorContext.class);
        private final jakarta.validation.ConstraintValidatorContext.ConstraintViolationBuilder
                builder =
                        mock(
                                jakarta.validation.ConstraintValidatorContext
                                        .ConstraintViolationBuilder.class);
        private final jakarta.validation.ConstraintValidatorContext.ConstraintViolationBuilder
                        .NodeBuilderCustomizableContext
                node =
                        mock(
                                jakarta.validation.ConstraintValidatorContext
                                        .ConstraintViolationBuilder.NodeBuilderCustomizableContext
                                        .class);
        private final ArgumentCaptor<String> templates = ArgumentCaptor.forClass(String.class);
        private final ArgumentCaptor<String> fields = ArgumentCaptor.forClass(String.class);

        private ConstraintContextFixture() {
            when(context.buildConstraintViolationWithTemplate(templates.capture()))
                    .thenReturn(builder);
            when(builder.addPropertyNode(fields.capture())).thenReturn(node);
            when(node.addConstraintViolation()).thenReturn(context);
        }

        private java.util.List<String> templates() {
            return templates.getAllValues();
        }

        private java.util.List<String> fields() {
            return fields.getAllValues();
        }
    }
}
