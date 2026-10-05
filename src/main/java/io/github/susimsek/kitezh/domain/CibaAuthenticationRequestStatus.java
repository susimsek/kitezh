package io.github.susimsek.kitezh.domain;

/** Lifecycle states for a Client-Initiated Backchannel Authentication request. */
public enum CibaAuthenticationRequestStatus {
    PENDING,
    APPROVED,
    DENIED,
    CONSUMED,
    EXPIRED
}
