package io.github.susimsek.kitezh.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;

/** Signals that a verified social identity must be linked after local account re-authentication. */
public final class SocialAccountLinkRequiredException extends OAuth2AuthenticationException {

    public static final String ERROR_CODE = "account_link_required";

    private final transient Map<String, Object> pendingLink;

    public SocialAccountLinkRequiredException(
            String provider, String subject, String email, Map<String, Object> attributes) {
        super(
                new OAuth2Error(ERROR_CODE),
                "A local account with this email already exists; authenticate locally to link"
                        + " the social account");
        Map<String, Object> link = new LinkedHashMap<>();
        link.put("provider", provider);
        link.put("subject", subject);
        link.put("email", email == null ? "" : email);
        link.put("attributes", serializableAttributes(attributes));
        this.pendingLink = link;
    }

    public Map<String, Object> pendingLink() {
        return pendingLink;
    }

    private static Map<String, Object> serializableAttributes(Map<String, Object> attributes) {
        if (attributes == null || attributes.isEmpty()) {
            return Map.of();
        }
        Map<String, Object> result = new LinkedHashMap<>();
        attributes.entrySet().stream()
                .limit(50)
                .forEach(
                        entry -> {
                            Object value = entry.getValue();
                            if (value instanceof String
                                    || value instanceof Number
                                    || value instanceof Boolean) {
                                String text = String.valueOf(value);
                                if (text.length() <= 2000) {
                                    result.put(entry.getKey(), value);
                                }
                            } else if (value instanceof Iterable<?> values) {
                                List<String> strings =
                                        java.util.stream.StreamSupport.stream(
                                                        values.spliterator(), false)
                                                .map(String::valueOf)
                                                .filter(item -> item.length() <= 2000)
                                                .limit(50)
                                                .toList();
                                if (!strings.isEmpty()) {
                                    result.put(entry.getKey(), strings);
                                }
                            }
                        });
        return result;
    }
}
