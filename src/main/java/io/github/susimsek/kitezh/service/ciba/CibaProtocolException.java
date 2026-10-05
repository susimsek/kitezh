package io.github.susimsek.kitezh.service.ciba;

import org.springframework.http.HttpStatus;

/** Protocol error returned by the CIBA backchannel authentication endpoint. */
public class CibaProtocolException extends RuntimeException {

    private final String error;
    private final HttpStatus status;

    public CibaProtocolException(String error, String message, HttpStatus status) {
        super(message);
        this.error = error;
        this.status = status;
    }

    public String error() {
        return error;
    }

    public HttpStatus status() {
        return status;
    }
}
