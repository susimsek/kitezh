package io.github.susimsek.kitezh.config.observability;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/** Redacts and bounds HTTP bodies before they are written to an application log. */
final class HttpLogBodySanitizer {

    static final String BODY_OMITTED = "[omitted]";
    static final String BODY_TOO_LARGE = "[omitted: exceeds-limit]";
    static final String BODY_UNKNOWN_SIZE = "[omitted: unknown-size]";
    static final String BODY_TRUNCATED = " [truncated]";
    private static final JsonMapper JSON_MAPPER = JsonMapper.builder().build();

    private HttpLogBodySanitizer() {}

    static String sanitize(
            byte[] body,
            HttpHeaders headers,
            int maxBodyBytes,
            String replacement,
            Set<String> maskedFields) {
        if (body == null || body.length == 0) {
            return "";
        }
        if (maxBodyBytes == 0 || !isTextLike(headers)) {
            return BODY_OMITTED;
        }
        if (body.length > maxBodyBytes) {
            return BODY_TOO_LARGE;
        }
        String content = new String(body, StandardCharsets.UTF_8);
        String masked =
                isForm(headers)
                        ? maskForm(content, replacement, maskedFields)
                        : maskJsonOrText(content, replacement, maskedFields);
        byte[] maskedBytes = masked.getBytes(StandardCharsets.UTF_8);
        if (maskedBytes.length <= maxBodyBytes) {
            return masked;
        }
        return new String(Arrays.copyOf(maskedBytes, maxBodyBytes), StandardCharsets.UTF_8)
                + BODY_TRUNCATED;
    }

    static boolean isTextLike(HttpHeaders headers) {
        MediaType contentType = headers.getContentType();
        return contentType != null
                && ("text".equalsIgnoreCase(contentType.getType())
                        || isJson(contentType)
                        || MediaType.APPLICATION_FORM_URLENCODED.isCompatibleWith(contentType));
    }

    private static boolean isJson(MediaType contentType) {
        return MediaType.APPLICATION_JSON.isCompatibleWith(contentType)
                || contentType.getSubtype().toLowerCase(Locale.ROOT).endsWith("+json");
    }

    private static boolean isForm(HttpHeaders headers) {
        MediaType contentType = headers.getContentType();
        return contentType != null
                && MediaType.APPLICATION_FORM_URLENCODED.isCompatibleWith(contentType);
    }

    private static String maskJsonOrText(
            String content, String replacement, Set<String> maskedFields) {
        try {
            JsonNode root = JSON_MAPPER.readTree(content);
            maskJsonNode(root, replacement, maskedFields);
            return JSON_MAPPER.writeValueAsString(root);
        } catch (JacksonException _) {
            return maskText(content, replacement, maskedFields);
        }
    }

    private static void maskJsonNode(JsonNode node, String replacement, Set<String> maskedFields) {
        if (node instanceof ObjectNode objectNode) {
            for (Map.Entry<String, JsonNode> entry : new ArrayList<>(objectNode.properties())) {
                if (maskedFields.contains(entry.getKey().toLowerCase(Locale.ROOT))) {
                    objectNode.put(entry.getKey(), replacement);
                } else {
                    maskJsonNode(entry.getValue(), replacement, maskedFields);
                }
            }
        } else if (node instanceof ArrayNode arrayNode) {
            arrayNode.elements().forEach(value -> maskJsonNode(value, replacement, maskedFields));
        }
    }

    private static String maskForm(String content, String replacement, Set<String> maskedFields) {
        return Arrays.stream(content.split("&", -1))
                .map(
                        part -> {
                            int separator = part.indexOf('=');
                            if (separator < 0) {
                                return part;
                            }
                            String key = part.substring(0, separator);
                            return maskedFields.contains(key.toLowerCase(Locale.ROOT))
                                    ? key + "=" + replacement
                                    : part;
                        })
                .collect(Collectors.joining("&"));
    }

    private static String maskText(String content, String replacement, Set<String> maskedFields) {
        String masked = content;
        for (String field : maskedFields) {
            String quotedField = Pattern.quote(field);
            masked =
                    masked.replaceAll(
                            "(?i)(\\\"?"
                                    + quotedField
                                    + "\\\"?\\s*[:=]\\s*)(\\\"(?:\\\\.|[^\\\"\\\\])*\\\"|[^&\\s,}]+)",
                            "$1" + replacement);
        }
        return masked;
    }
}
