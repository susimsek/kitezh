package io.github.susimsek.kitezh.service;

import java.util.Locale;

/** Synchronization policies for users federated through an identity provider. */
public enum SocialProviderSyncMode {
    LEGACY("legacy"),
    IMPORT("import"),
    READ_ONLY("read_only"),
    FORCE("force");

    private final String value;

    SocialProviderSyncMode(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static SocialProviderSyncMode from(String value) {
        if (value == null || value.isBlank()) {
            return IMPORT;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT).replace('-', '_');
        for (SocialProviderSyncMode mode : values()) {
            if (mode.value.equals(normalized)) {
                return mode;
            }
        }
        throw new IllegalArgumentException("Unsupported social provider sync mode: " + value);
    }

    /** Whether provider attributes may update an already linked local user. */
    public boolean updatesExistingUser() {
        return this == FORCE;
    }

    /** Whether a mapper can run for this login. New users are initialized in every mode. */
    public boolean applies(boolean firstLogin) {
        return firstLogin || updatesExistingUser();
    }
}
