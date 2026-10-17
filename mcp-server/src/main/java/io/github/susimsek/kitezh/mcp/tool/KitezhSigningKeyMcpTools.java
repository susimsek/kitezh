package io.github.susimsek.kitezh.mcp.tool;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;

@Component
public class KitezhSigningKeyMcpTools {

    private static final List<String> PUBLIC_METADATA_FIELDS =
            List.of("id", "kid", "type", "algorithm", "use", "active", "createdAt");
    private static final List<String> PAGE_FIELDS =
            List.of(
                    "number",
                    "size",
                    "totalElements",
                    "totalPages",
                    "numberOfElements",
                    "first",
                    "last",
                    "empty",
                    "sort");

    private final KitezhAdminApiClient apiClient;
    private final MeterRegistry meterRegistry;

    public KitezhSigningKeyMcpTools(KitezhAdminApiClient apiClient, MeterRegistry meterRegistry) {
        this.apiClient = apiClient;
        this.meterRegistry = meterRegistry;
    }

    @McpTool(
            name = "kitezh_list_signing_key_metadata",
            description =
                    "List paged signing-key metadata. Key bytes and private material are omitted.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List signing-key metadata",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<String, Object> listSigningKeyMetadata(
            @McpToolParam(
                            description = "Optional key ID or public key identifier search text.",
                            required = false)
                    String q,
            @McpToolParam(description = "Optional active-state filter.", required = false)
                    Boolean active,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        McpPage paging = McpPage.validated(page == null ? 0 : page, size == null ? 20 : size);
        String query = validateQuery(q);
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("q", query);
        if (active != null) {
            parameters.put("active", active);
        }
        parameters.put("page", paging.page());
        parameters.put("size", paging.size());
        parameters.put("sort", "createdAt,desc");

        return measured(
                () -> {
                    Map<?, ?> response =
                            apiClient.get(
                                    "kitezh_list_signing_key_metadata",
                                    "/api/admin/keys",
                                    parameters);
                    return sanitizePage(response);
                });
    }

    private <T> T measured(Supplier<T> operation) {
        Timer.Sample sample = Timer.start(meterRegistry);
        String status = "success";
        try {
            return operation.get();
        } catch (RuntimeException exception) {
            status = exception instanceof IllegalArgumentException ? "client_error" : "error";
            throw exception;
        } finally {
            meterRegistry
                    .counter(
                            "kitezh_mcp_tool_calls_total",
                            "tool",
                            "kitezh_list_signing_key_metadata",
                            "status",
                            status)
                    .increment();
            sample.stop(
                    Timer.builder("kitezh_mcp_tool_call_duration_seconds")
                            .tag("tool", "kitezh_list_signing_key_metadata")
                            .register(meterRegistry));
        }
    }

    private static String validateQuery(String query) {
        if (query != null && query.length() > 256) {
            throw new IllegalArgumentException("The search text must not exceed 256 characters");
        }
        return query == null ? "" : query;
    }

    private static Map<String, Object> sanitizePage(Map<?, ?> response) {
        Map<String, Object> sanitized = new LinkedHashMap<>();
        response.forEach(
                (key, value) -> {
                    if ("content".equals(key) && value instanceof List<?> content) {
                        sanitized.put("content", sanitizeKeys(content));
                    } else if (PAGE_FIELDS.contains(key)) {
                        sanitized.put(String.valueOf(key), value);
                    }
                });
        return sanitized;
    }

    private static List<Map<String, Object>> sanitizeKeys(List<?> content) {
        List<Map<String, Object>> sanitized = new ArrayList<>(content.size());
        for (Object item : content) {
            if (item instanceof Map<?, ?> keyMetadata) {
                Map<String, Object> fields = new LinkedHashMap<>();
                for (String field : PUBLIC_METADATA_FIELDS) {
                    if (keyMetadata.containsKey(field)) {
                        fields.put(field, keyMetadata.get(field));
                    }
                }
                sanitized.add(fields);
            }
        }
        return sanitized;
    }
}
