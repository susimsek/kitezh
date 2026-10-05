package io.github.susimsek.kitezh.security;

import java.util.Locale;
import java.util.Set;

/** Supported OIDC protocol mapper types for the single-issuer application. */
public final class ProtocolMapperTypes {

    public static final String USER_PROPERTY = "user-property";
    public static final String USER_ATTRIBUTE = "user-attribute";
    public static final String GROUP_MEMBERSHIP = "group-membership";
    public static final String GROUP_ATTRIBUTE = "group-attribute";
    public static final String APPLICATION_ROLE = "application-role";
    public static final String CLIENT_ROLE = "client-role";
    public static final String AUDIENCE = "audience";
    public static final String AUDIENCE_RESOLVE = "audience-resolve";
    public static final String HARDCODED_CLAIM = "hardcoded-claim";
    public static final String EMAIL = "email";
    public static final String FULL_NAME = "full-name";
    public static final String LOCALE = "locale";
    public static final String USERNAME = "username";

    public static final String SUPPORTED_TYPES_REGEX =
            "user-property|user-attribute|group-membership|group-attribute|application-role|"
                    + "user-realm-role|client-role|user-client-role|audience|audience-resolve|"
                    + "hardcoded-claim|email|full-name|locale|username";

    private static final Set<String> SUPPORTED_TYPES =
            Set.of(
                    USER_PROPERTY,
                    USER_ATTRIBUTE,
                    GROUP_MEMBERSHIP,
                    GROUP_ATTRIBUTE,
                    APPLICATION_ROLE,
                    CLIENT_ROLE,
                    AUDIENCE,
                    AUDIENCE_RESOLVE,
                    HARDCODED_CLAIM,
                    EMAIL,
                    FULL_NAME,
                    LOCALE,
                    USERNAME);

    private ProtocolMapperTypes() {}

    public static String canonicalize(String type) {
        String normalized = type == null ? "" : type.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "user-realm-role" -> APPLICATION_ROLE;
            case "user-client-role" -> CLIENT_ROLE;
            default -> normalized;
        };
    }

    public static boolean isSupported(String type) {
        return SUPPORTED_TYPES.contains(canonicalize(type));
    }

    public static boolean requiresSource(String type) {
        String normalized = canonicalize(type);
        return USER_PROPERTY.equals(normalized)
                || USER_ATTRIBUTE.equals(normalized)
                || GROUP_ATTRIBUTE.equals(normalized);
    }

    public static boolean requiresValue(String type) {
        String normalized = canonicalize(type);
        return HARDCODED_CLAIM.equals(normalized) || AUDIENCE.equals(normalized);
    }

    public static boolean usesAudienceClaim(String type) {
        String normalized = canonicalize(type);
        return AUDIENCE.equals(normalized) || AUDIENCE_RESOLVE.equals(normalized);
    }
}
