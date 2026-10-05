package io.github.susimsek.kitezh.config.observability;

/** Controls how much HTTP request and response detail is written to diagnostics logs. */
public enum HttpLoggingLevel {
    BASIC,
    HEADERS,
    FULL
}
