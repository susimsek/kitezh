package io.github.susimsek.kitezh.service.admin;

import java.util.Locale;
import java.util.Set;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

final class SensitiveDataRedactor {

    private static final String REDACTED_VALUE = "[REDACTED]";
    private static final Set<String> SENSITIVE_KEY_PARTS =
            Set.of("password", "secret", "token", "authorization", "credential");
    private static final JsonMapper JSON_MAPPER = JsonMapper.builder().build();

    private SensitiveDataRedactor() {}

    static String sanitize(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return value;
        }
        String redacted = redactJson(value);
        return redacted.length() <= maxLength ? redacted : redacted.substring(0, maxLength);
    }

    private static String redactJson(String value) {
        try {
            JsonNode root = JSON_MAPPER.readTree(value);
            redactNode(root);
            return root == null ? value : JSON_MAPPER.writeValueAsString(root);
        } catch (JacksonException _) {
            return value;
        }
    }

    private static void redactNode(JsonNode node) {
        if (node == null) {
            return;
        }
        if (node.isObject()) {
            ObjectNode object = (ObjectNode) node;
            object.properties()
                    .forEach(
                            entry -> {
                                if (isSensitiveKey(entry.getKey())) {
                                    object.put(entry.getKey(), REDACTED_VALUE);
                                } else {
                                    redactNode(entry.getValue());
                                }
                            });
        } else if (node.isArray()) {
            ((ArrayNode) node).elements().forEach(SensitiveDataRedactor::redactNode);
        }
    }

    private static boolean isSensitiveKey(String key) {
        String normalized = key.toLowerCase(Locale.ROOT);
        return SENSITIVE_KEY_PARTS.stream().anyMatch(normalized::contains);
    }
}
