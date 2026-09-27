package io.github.susimsek.springauthserversamples.domain;

/** Lifecycle states for a Client-Initiated Backchannel Authentication request. */
public enum CibaAuthenticationRequestStatus {
    PENDING,
    APPROVED,
    DENIED,
    CONSUMED,
    EXPIRED
}
