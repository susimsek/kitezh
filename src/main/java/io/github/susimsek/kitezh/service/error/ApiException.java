package io.github.susimsek.kitezh.service.error;

import org.springframework.http.HttpStatus;

/** A stable, transport-neutral API failure rendered as an RFC 9457 problem detail. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final ApiErrorCode errorCode;
    private final String field;

    private ApiException(HttpStatus status, ApiErrorCode errorCode, String field, String message) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
        this.field = field;
    }

    private ApiException(
            HttpStatus status, ApiErrorCode errorCode, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
        this.errorCode = errorCode;
        this.field = null;
    }

    public ApiErrorCode getErrorCode() {
        return errorCode;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getErrorCodeValue() {
        return errorCode.value();
    }

    public String getField() {
        return field;
    }

    public static ApiException badRequest(ApiErrorCode errorCode, String message) {
        return badRequest(null, errorCode, message);
    }

    public static ApiException badRequest(String field, ApiErrorCode errorCode, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, errorCode, field, message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(
                HttpStatus.NOT_FOUND, ApiErrorCode.RESOURCE_NOT_FOUND, null, message);
    }

    public static ApiException notFound(ApiErrorCode errorCode, String message) {
        return new ApiException(HttpStatus.NOT_FOUND, errorCode, null, message);
    }

    public static ApiException conflict(ApiErrorCode errorCode, String message) {
        return conflict(null, errorCode, message);
    }

    public static ApiException conflict(String field, ApiErrorCode errorCode, String message) {
        return new ApiException(HttpStatus.CONFLICT, errorCode, field, message);
    }

    public static ApiException forbidden(ApiErrorCode errorCode, String message) {
        return new ApiException(HttpStatus.FORBIDDEN, errorCode, null, message);
    }

    public static ApiException forbidden(String field, ApiErrorCode errorCode, String message) {
        return new ApiException(HttpStatus.FORBIDDEN, errorCode, field, message);
    }

    public static ApiException serverError(
            ApiErrorCode errorCode, String message, Throwable cause) {
        return new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, errorCode, message, cause);
    }
}
