package io.github.susimsek.kitezh.web.error;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import io.github.susimsek.kitezh.dto.error.ApiViolationDTO;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.ElementKind;
import jakarta.validation.Path;
import jakarta.validation.Validation;
import jakarta.validation.constraints.NotBlank;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Locale;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.context.support.DefaultMessageSourceResolvable;
import org.springframework.context.support.StaticMessageSource;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.http.MockHttpInputMessage;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.validation.method.MethodValidationResult;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

class ApiExceptionHandlerTest {

    @AfterEach
    void clearLocale() {
        LocaleContextHolder.resetLocaleContext();
    }

    @Test
    void localizesProblemDetailFromTheRequestLocale() {
        StaticMessageSource messages = new StaticMessageSource();
        messages.addMessage(
                "app.api.problem.title", Locale.forLanguageTag("tr"), "API isteği başarısız");
        messages.addMessage(
                "app.api.problem.user_invalid_username",
                Locale.forLanguageTag("tr"),
                "Kullanıcı adı gerekli.");
        LocaleContextHolder.setLocale(Locale.forLanguageTag("tr"));

        ApiExceptionHandler handler = handler(messages);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/admin/users");
        var problem =
                handler.handleApiException(
                        ApiException.badRequest(
                                "username",
                                ApiErrorCode.USER_INVALID_USERNAME,
                                "Username is required"),
                        request);

        assertThat(problem.getTitle()).isEqualTo("API isteği başarısız");
        assertThat(problem.getDetail()).isEqualTo("Kullanıcı adı gerekli.");
        assertThat(problem.getType()).hasToString("urn:problem:user_invalid_username");
        assertThat(problem.getInstance()).hasToString("/api/admin/users");
        assertThat(problem.getProperties())
                .containsEntry("errorCode", "user_invalid_username")
                .containsEntry("field", "username")
                .doesNotContainKey("violations");
    }

    @Test
    void returnsProblemWithoutViolationsWhenFieldIsMissing() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin");
        var problem =
                handler(new StaticMessageSource())
                        .handleApiException(
                                ApiException.forbidden(ApiErrorCode.FORBIDDEN, "Access denied"),
                                request);

        assertThat(problem.getStatus()).isEqualTo(403);
        assertThat(problem.getDetail()).isEqualTo("You are not allowed to perform this operation.");
        assertThat(problem.getType()).hasToString("urn:problem:forbidden");
        assertThat(problem.getProperties())
                .containsEntry("errorCode", "forbidden")
                .doesNotContainKey("violations");
    }

    @Test
    void supportsMissingServletRequestAndUnconfiguredMessageSource() {
        ApiExceptionHandler handler = new ApiExceptionHandler();
        var problem =
                handler.handleApiException(
                        ApiException.forbidden(ApiErrorCode.FORBIDDEN, "Access denied"), null);

        assertThat(problem.getDetail()).isEqualTo("You are not allowed to perform this operation.");
        assertThat(problem.getInstance()).isNull();

        WebRequest nonServletRequest = mock(WebRequest.class);
        var response =
                handler.handleUnhandled(
                        new IllegalStateException("internal details"), nonServletRequest);
        var unhandled = (org.springframework.http.ProblemDetail) response.getBody();
        assertThat(unhandled).isNotNull();
        assertThat(unhandled.getInstance()).isNull();
    }

    @Test
    void usesDefaultResolvableMessagesWhenNoMessageSourceIsConfigured()
            throws NoSuchMethodException {
        BeanPropertyBindingResult bindingResult =
                new BeanPropertyBindingResult(new Object(), "clientRequest");
        bindingResult.addError(
                new FieldError("clientRequest", "clientId", "Client ID is required"));
        Method method = ApiExceptionHandlerTest.class.getDeclaredMethod("request", String.class);
        MethodArgumentNotValidException exception =
                new MethodArgumentNotValidException(new MethodParameter(method, 0), bindingResult);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/admin/clients");

        var response =
                new ApiExceptionHandler()
                        .handleMethodArgumentNotValid(
                                exception,
                                HttpHeaders.EMPTY,
                                HttpStatus.BAD_REQUEST,
                                new ServletWebRequest(request));
        var problem = (org.springframework.http.ProblemDetail) response.getBody();

        assertThat(problem).isNotNull();
        assertThat(problem.getProperties())
                .containsEntry(
                        "violations",
                        List.of(new ApiViolationDTO("clientId", "Client ID is required")));
    }

    @Test
    void returnsLocalizedViolationsForBeanValidationFailures() throws NoSuchMethodException {
        StaticMessageSource messages = new StaticMessageSource();
        messages.addMessage(
                "app.api.problem.title", Locale.forLanguageTag("tr"), "API isteği başarısız");
        messages.addMessage(
                "app.api.problem.validation_failed",
                Locale.forLanguageTag("tr"),
                "İstek geçersiz veri içeriyor.");
        LocaleContextHolder.setLocale(Locale.forLanguageTag("tr"));
        BeanPropertyBindingResult bindingResult =
                new BeanPropertyBindingResult(new Object(), "adminClientRequest");
        bindingResult.addError(
                new FieldError(
                        "adminClientRequest",
                        "redirectUris[0]",
                        "Geçerli mutlak URI değerleri girin."));
        bindingResult.addError(
                new FieldError(
                        "adminClientRequest",
                        "redirectUris[1]",
                        "Geçerli mutlak URI değerleri girin."));
        bindingResult.addError(new ObjectError("adminClientRequest", "İstek geçersiz."));
        Method method = ApiExceptionHandlerTest.class.getDeclaredMethod("request", String.class);
        MethodArgumentNotValidException exception =
                new MethodArgumentNotValidException(new MethodParameter(method, 0), bindingResult);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/admin/clients");

        var response =
                handler(messages)
                        .handleMethodArgumentNotValid(
                                exception,
                                HttpHeaders.EMPTY,
                                HttpStatus.BAD_REQUEST,
                                new ServletWebRequest(request));
        var problem = (org.springframework.http.ProblemDetail) response.getBody();

        assertThat(problem).isNotNull();
        assertThat(problem.getStatus()).isEqualTo(400);
        assertThat(problem.getTitle()).isEqualTo("API isteği başarısız");
        assertThat(problem.getDetail()).isEqualTo("İstek geçersiz veri içeriyor.");
        assertThat(problem.getType()).hasToString("urn:problem:validation_failed");
        assertThat(problem.getInstance()).hasToString("/api/admin/clients");
        assertThat(problem.getProperties())
                .containsEntry("errorCode", "validation_failed")
                .containsEntry(
                        "violations",
                        java.util.List.of(
                                new ApiViolationDTO(
                                        "redirectUris", "Geçerli mutlak URI değerleri girin."),
                                new ApiViolationDTO("request", "İstek geçersiz.")));
    }

    @Test
    void returnsRequestViolationForUnreadablePayload() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/admin/clients");

        var response =
                handler(new StaticMessageSource())
                        .handleHttpMessageNotReadable(
                                new HttpMessageNotReadableException(
                                        "broken payload", new MockHttpInputMessage(new byte[0])),
                                HttpHeaders.EMPTY,
                                HttpStatus.BAD_REQUEST,
                                new ServletWebRequest(request));
        var problem = (org.springframework.http.ProblemDetail) response.getBody();

        assertThat(problem).isNotNull();
        assertThat(problem.getStatus()).isEqualTo(400);
        assertThat(problem.getTitle()).isEqualTo("API request failed");
        assertThat(problem.getDetail()).isEqualTo("The request contains invalid data.");
        assertThat(problem.getInstance()).hasToString("/api/admin/clients");
        assertThat(problem.getProperties())
                .containsEntry("errorCode", "validation_failed")
                .doesNotContainKey("violations");
    }

    @Test
    void returnsParameterNamesForHandlerMethodValidation() throws NoSuchMethodException {
        Method method =
                ApiExceptionHandlerTest.class.getDeclaredMethod(
                        "validatedRequest", String.class, String.class);
        MethodParameter namedParameter = mock(MethodParameter.class);
        when(namedParameter.getParameterName()).thenReturn("clientId");
        MethodParameter unnamedParameter = mock(MethodParameter.class);
        when(unnamedParameter.getParameterName()).thenReturn(null);
        ParameterValidationResult namedResult = parameterResult(namedParameter);
        ParameterValidationResult unnamedResult = parameterResult(unnamedParameter);
        MethodValidationResult validationResult = mock(MethodValidationResult.class);
        when(validationResult.getTarget()).thenReturn(new Object());
        when(validationResult.getMethod()).thenReturn(method);
        when(validationResult.isForReturnValue()).thenReturn(false);
        when(validationResult.getCrossParameterValidationResults()).thenReturn(List.of());
        when(validationResult.getParameterValidationResults())
                .thenReturn(List.of(namedResult, unnamedResult));
        HandlerMethodValidationException exception =
                new HandlerMethodValidationException(validationResult);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/admin/clients");

        var response =
                handler(new StaticMessageSource())
                        .handleHandlerMethodValidationException(
                                exception,
                                HttpHeaders.EMPTY,
                                HttpStatus.BAD_REQUEST,
                                new ServletWebRequest(request));
        var problem = (org.springframework.http.ProblemDetail) response.getBody();

        assertThat(problem).isNotNull();
        assertThat(problem.getStatus()).isEqualTo(400);
        assertThat(problem.getDetail()).isEqualTo("The request contains invalid data.");
        assertThat(problem.getProperties())
                .containsEntry("errorCode", "validation_failed")
                .containsEntry(
                        "violations",
                        java.util.List.of(
                                new ApiViolationDTO(
                                        "clientId", "The request contains invalid data."),
                                new ApiViolationDTO(
                                        "request", "The request contains invalid data.")));
    }

    @Test
    void handlesConstraintViolationsFromValidatedMethods() throws NoSuchMethodException {
        ValidatedTarget target = new ValidatedTarget();
        Method method = ValidatedTarget.class.getDeclaredMethod("update", String.class);
        var validator = Validation.buildDefaultValidatorFactory().getValidator().forExecutables();
        var violations = validator.validateParameters(target, method, new Object[] {""});
        ConstraintViolationException exception = new ConstraintViolationException(violations);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/admin/users");

        var response =
                handler(new StaticMessageSource())
                        .handleConstraintViolation(exception, new ServletWebRequest(request));
        var problem = (org.springframework.http.ProblemDetail) response.getBody();

        assertThat(problem).isNotNull();
        assertThat(problem.getStatus()).isEqualTo(400);
        assertThat(problem.getProperties())
                .containsEntry(
                        "violations",
                        java.util.List.of(new ApiViolationDTO("clientId", "must not be blank")));
    }

    @Test
    void normalizesIndexedNestedAndMissingViolationFields() {
        assertThat(new ApiViolationDTO("items[0].name", "invalid").field()).isEqualTo("items");
        assertThat(new ApiViolationDTO("profile.name", "invalid").field()).isEqualTo("profile");
        assertThat(new ApiViolationDTO("items[0]", "invalid").field()).isEqualTo("items");
        assertThat(new ApiViolationDTO(".name", "invalid").field()).isEqualTo("request");
        assertThat(new ApiViolationDTO("", "invalid").field()).isEqualTo("request");
        assertThat(new ApiViolationDTO(null, "invalid").field()).isEqualTo("request");
    }

    @Test
    @SuppressWarnings("unchecked")
    void ignoresNonPropertyConstraintPathNodes() {
        Path path = mock(Path.class);
        Path.Node beanNode = mock(Path.Node.class);
        when(path.iterator()).thenReturn(List.of(beanNode).iterator());
        when(beanNode.getName()).thenReturn("target");
        when(beanNode.getKind()).thenReturn(ElementKind.BEAN);
        ConstraintViolation<Object> violation = mock(ConstraintViolation.class);
        when(violation.getPropertyPath()).thenReturn(path);
        when(violation.getMessage()).thenReturn("invalid");

        assertThat(ApiViolationDTO.from(violation).field()).isEqualTo("request");
    }

    @Test
    @SuppressWarnings("unchecked")
    void extractsPropertyConstraintPathNodes() {
        Path path = mock(Path.class);
        Path.Node propertyNode = mock(Path.Node.class);
        when(path.iterator()).thenReturn(List.of(propertyNode).iterator());
        when(propertyNode.getName()).thenReturn("email");
        when(propertyNode.getKind()).thenReturn(ElementKind.PROPERTY);
        ConstraintViolation<Object> violation = mock(ConstraintViolation.class);
        when(violation.getPropertyPath()).thenReturn(path);
        when(violation.getMessage()).thenReturn("invalid");

        assertThat(ApiViolationDTO.from(violation).field()).isEqualTo("email");
    }

    @Test
    void doesNotExposeUnhandledExceptionDetails() {
        StaticMessageSource messages = new StaticMessageSource();
        messages.addMessage("app.api.problem.title", Locale.ENGLISH, "API request failed");
        messages.addMessage(
                "app.api.problem.internal_error", Locale.ENGLISH, "An unexpected error occurred.");
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/admin/clients");
        Logger logger = (Logger) LoggerFactory.getLogger(ApiExceptionHandler.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);

        var response = handleUnhandled(handler(messages), request);
        logger.detachAppender(appender);
        appender.stop();
        var problem = (org.springframework.http.ProblemDetail) response.getBody();

        assertThat(problem).isNotNull();
        assertThat(problem.getStatus()).isEqualTo(500);
        assertThat(problem.getTitle()).isEqualTo("API request failed");
        assertThat(problem.getDetail()).isEqualTo("An unexpected error occurred.");
        assertThat(problem.getDetail()).doesNotContain("database connection details");
        assertThat(problem.getType()).hasToString("urn:problem:internal_error");
        assertThat(problem.getInstance()).hasToString("/api/admin/clients");
        assertThat(problem.getProperties()).containsEntry("errorCode", "internal_error");
        assertThat(appender.list)
                .singleElement()
                .satisfies(
                        event -> {
                            assertThat(event.getFormattedMessage())
                                    .contains("Unhandled API exception (IllegalStateException)")
                                    .doesNotContain("database connection details");
                            assertThat(event.getThrowableProxy()).isNull();
                        });
    }

    private static ResponseEntity<Object> handleUnhandled(
            ApiExceptionHandler handler, MockHttpServletRequest request) {
        return handler.handleUnhandled(
                new IllegalStateException("database connection details"),
                new ServletWebRequest(request));
    }

    @SuppressWarnings("unused")
    private void request(String value) {
        // The fixture only exposes a parameter for validation metadata.
    }

    @SuppressWarnings("unused")
    private void validatedRequest(String clientId, String ignored) {
        // The fixture only exposes parameters for validation metadata.
    }

    private static class ValidatedTarget {
        @SuppressWarnings("unused")
        void update(@NotBlank(message = "must not be blank") String clientId) {
            // The fixture only exposes a validation constraint.
        }
    }

    private static ParameterValidationResult parameterResult(MethodParameter parameter) {
        return new ParameterValidationResult(
                parameter,
                null,
                List.of(new DefaultMessageSourceResolvable("invalid")),
                null,
                null,
                null,
                (error, sourceType) -> null);
    }

    private static ApiExceptionHandler handler(StaticMessageSource messages) {
        ApiExceptionHandler handler = new ApiExceptionHandler();
        handler.setMessageSource(messages);
        return handler;
    }
}
