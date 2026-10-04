package io.github.susimsek.kitezh.web.error;

import io.github.susimsek.kitezh.dto.error.ApiViolationDTO;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.web.ApiController;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.context.MessageSource;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.context.NoSuchMessageException;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.ObjectError;
import org.springframework.validation.method.ParameterValidationResult;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** Renders one RFC 9457 error contract for the Administration and Account APIs. */
@RestControllerAdvice(annotations = ApiController.class)
@Slf4j
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ProblemDetail handleApiException(ApiException exception, HttpServletRequest request) {
        return problemDetail(exception, request);
    }

    @ExceptionHandler(Exception.class)
    public @Nullable ResponseEntity<Object> handleUnhandled(
            Exception exception, WebRequest request) {
        log.error("Unhandled API exception", exception);
        ProblemDetail problemDetail =
                createProblemDetail(HttpStatus.INTERNAL_SERVER_ERROR, ApiErrorCode.INTERNAL_ERROR);
        requestUri(request).ifPresent(problemDetail::setInstance);
        return createResponseEntity(
                problemDetail, HttpHeaders.EMPTY, HttpStatus.INTERNAL_SERVER_ERROR, request);
    }

    @Override
    public ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException exception,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {
        List<ApiViolationDTO> violations =
                exception.getBindingResult().getAllErrors().stream()
                        .map(this::violation)
                        .collect(
                                java.util.stream.Collectors.toMap(
                                        ApiViolationDTO::field,
                                        violation -> violation,
                                        (first, ignored) -> first,
                                        LinkedHashMap::new))
                        .values()
                        .stream()
                        .toList();
        return validationProblem(violations, headers, status, request);
    }

    @Override
    public ResponseEntity<Object> handleHandlerMethodValidationException(
            HandlerMethodValidationException exception,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {
        List<ApiViolationDTO> violations =
                exception.getParameterValidationResults().stream()
                        .flatMap(result -> violations(result).stream())
                        .toList();
        return validationProblem(violations, headers, status, request);
    }

    @Override
    public ResponseEntity<Object> handleHttpMessageNotReadable(
            HttpMessageNotReadableException exception,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {
        return validationProblem(null, headers, status, request);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Object> handleConstraintViolation(
            ConstraintViolationException exception, WebRequest request) {
        List<ApiViolationDTO> violations =
                exception.getConstraintViolations().stream()
                        .map(ApiViolationDTO::from)
                        .distinct()
                        .toList();
        return validationProblem(violations, HttpHeaders.EMPTY, HttpStatus.BAD_REQUEST, request);
    }

    private ProblemDetail problemDetail(ApiException exception, HttpServletRequest request) {
        ProblemDetail problemDetail =
                createProblemDetail(exception.getStatus(), exception.getErrorCode());
        if (request != null) {
            problemDetail.setInstance(URI.create(request.getRequestURI()));
        }
        if (exception.getField() != null) {
            problemDetail.setProperty("field", exception.getField());
        }
        return problemDetail;
    }

    private ResponseEntity<Object> validationProblem(
            @Nullable List<ApiViolationDTO> violations,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {
        ProblemDetail problemDetail =
                createProblemDetail(HttpStatus.BAD_REQUEST, ApiErrorCode.VALIDATION_FAILED);
        requestUri(request).ifPresent(problemDetail::setInstance);
        if (violations != null) {
            problemDetail.setProperty("violations", violations);
        }
        return createResponseEntity(problemDetail, headers, status, request);
    }

    private ProblemDetail createProblemDetail(HttpStatus status, ApiErrorCode errorCode) {
        ProblemDetail problemDetail =
                ProblemDetail.forStatusAndDetail(
                        status, message(errorCode.messageCode(), errorCode.defaultMessage()));
        problemDetail.setTitle(message("app.api.problem.title", "API request failed"));
        problemDetail.setType(URI.create(errorCode.type()));
        problemDetail.setProperty("errorCode", errorCode.value());
        return problemDetail;
    }

    private ApiViolationDTO violation(ObjectError error) {
        return ApiViolationDTO.from(error, error.getDefaultMessage());
    }

    private List<ApiViolationDTO> violations(ParameterValidationResult result) {
        String field = result.getMethodParameter().getParameterName();
        String resolvedField = field == null ? "request" : field;
        return result.getResolvableErrors().stream()
                .map(error -> new ApiViolationDTO(resolvedField, message(error)))
                .toList();
    }

    private String message(MessageSourceResolvable error) {
        MessageSource messageSource = getMessageSource();
        if (messageSource == null) {
            return error.getDefaultMessage();
        }
        String defaultMessage = error.getDefaultMessage();
        try {
            return messageSource.getMessage(error, LocaleContextHolder.getLocale());
        } catch (NoSuchMessageException _) {
            return defaultMessage == null ? "The request contains invalid data." : defaultMessage;
        }
    }

    private String message(String code, String defaultMessage) {
        MessageSource messageSource = getMessageSource();
        return messageSource == null
                ? defaultMessage
                : messageSource.getMessage(
                        code, null, defaultMessage, LocaleContextHolder.getLocale());
    }

    private static java.util.Optional<URI> requestUri(WebRequest request) {
        if (request instanceof ServletWebRequest servletWebRequest) {
            return java.util.Optional.of(
                    URI.create(servletWebRequest.getRequest().getRequestURI()));
        }
        return java.util.Optional.empty();
    }
}
