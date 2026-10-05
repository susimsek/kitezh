package io.github.susimsek.kitezh.service;

import java.util.Locale;
import java.util.Set;

/** Allowlisted icon keys shared by provider administration and console responses. */
public final class SocialProviderIconKeys {

    public static final String GENERIC = "generic";
    private static final Set<String> ALLOWED =
            Set.of(
                    GENERIC,
                    "google",
                    "github",
                    "linkedin",
                    "microsoft",
                    "building",
                    "key",
                    "shield");

    private SocialProviderIconKeys() {}

    public static boolean isAllowed(String iconKey) {
        return iconKey != null && ALLOWED.contains(iconKey.trim().toLowerCase(Locale.ROOT));
    }

    public static String normalize(String iconKey, String providerType) {
        String normalized = iconKey == null ? "" : iconKey.trim().toLowerCase(Locale.ROOT);
        return isAllowed(normalized) ? normalized : defaultFor(providerType);
    }

    public static String defaultFor(String providerType) {
        String normalized =
                providerType == null ? "" : providerType.trim().toLowerCase(Locale.ROOT);
        return isAllowed(normalized) && !GENERIC.equals(normalized) ? normalized : GENERIC;
    }
}
