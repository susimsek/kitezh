package io.github.susimsek.kitezh.mcp.tool;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;

/** Read-only, redacted protocol-mapper inspection tools. */
@Component
public class KitezhMapperMcpTools {

    private static final String RECORD_ID_PATTERN = "[A-Za-z0-9._~-]{1,128}";
    private static final int MAX_SEARCH_LENGTH = 256;
    private static final Set<String> SAFE_MAPPER_FIELDS =
            Set.of(
                    "id",
                    "name",
                    "mapperType",
                    "source",
                    "claimName",
                    "addToIdToken",
                    "addToAccessToken",
                    "priority");

    private final KitezhAdminApiClient apiClient;
    private final MeterRegistry meterRegistry;

    public KitezhMapperMcpTools(KitezhAdminApiClient apiClient, MeterRegistry meterRegistry) {
        this.apiClient = apiClient;
        this.meterRegistry = meterRegistry;
    }

    @McpTool(
            name = "kitezh_list_client_mappers",
            description =
                    "List a registered OAuth client's protocol mappers. Hardcoded mapper values and all unrecognized fields are redacted.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List OAuth client protocol mappers",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<String, Object> listClientMappers(
            @McpToolParam(description = "Internal registered-client record ID.") String clientId,
            @McpToolParam(description = "Optional mapper name search text.", required = false)
                    String q,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        String recordId = validateId(clientId, "clientId");
        Map<String, Object> parameters = mapperParameters(q, page, size);
        return measured(
                "kitezh_list_client_mappers",
                () ->
                        redactPage(
                                apiClient.get(
                                        "kitezh_list_client_mappers",
                                        "/api/admin/clients/" + recordId + "/mappers",
                                        parameters)));
    }

    @McpTool(
            name = "kitezh_list_client_scope_mappers",
            description =
                    "List protocol mappers configured on an OAuth client scope. Hardcoded mapper values and all unrecognized fields are redacted.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List OAuth client-scope protocol mappers",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<String, Object> listClientScopeMappers(
            @McpToolParam(description = "Internal client-scope record ID.") String scopeId,
            @McpToolParam(description = "Optional mapper name search text.", required = false)
                    String q,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        String recordId = validateId(scopeId, "scopeId");
        Map<String, Object> parameters = mapperParameters(q, page, size);
        return measured(
                "kitezh_list_client_scope_mappers",
                () ->
                        redactPage(
                                apiClient.get(
                                        "kitezh_list_client_scope_mappers",
                                        "/api/admin/client-scopes/" + recordId + "/mappers",
                                        parameters)));
    }

    private static Map<String, Object> mapperParameters(String q, Integer page, Integer size) {
        McpPage paging = McpPage.validated(valueOr(page, 0), valueOr(size, 20));
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("page", paging.page());
        parameters.put("size", paging.size());
        parameters.put("sort", "name,asc");
        if (q != null && !q.isBlank()) {
            if (q.length() > MAX_SEARCH_LENGTH) {
                throw new IllegalArgumentException("q must not exceed 256 characters");
            }
            parameters.put("q", q);
        }
        return parameters;
    }

    private static Map<String, Object> redactPage(Map<?, ?> response) {
        Map<String, Object> safeResponse = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : response.entrySet()) {
            if (!"content".equals(entry.getKey())) {
                safeResponse.put(String.valueOf(entry.getKey()), entry.getValue());
            }
        }
        Object content = response.get("content");
        if (content instanceof List<?> mapperList) {
            List<Map<String, Object>> safeMappers = new ArrayList<>();
            for (Object mapper : mapperList) {
                if (mapper instanceof Map<?, ?> mapperFields) {
                    safeMappers.add(redactMapper(mapperFields));
                }
            }
            safeResponse.put("content", safeMappers);
        } else {
            safeResponse.put("content", List.of());
        }
        return safeResponse;
    }

    private static Map<String, Object> redactMapper(Map<?, ?> mapper) {
        Map<String, Object> safeMapper = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : mapper.entrySet()) {
            String field = String.valueOf(entry.getKey());
            if (SAFE_MAPPER_FIELDS.contains(field)) {
                safeMapper.put(field, entry.getValue());
            }
        }
        return safeMapper;
    }

    private static String validateId(String value, String parameterName) {
        if (value == null || !value.matches(RECORD_ID_PATTERN)) {
            throw new IllegalArgumentException(parameterName + " has an invalid format");
        }
        return value;
    }

    private static int valueOr(Integer value, int defaultValue) {
        return value == null ? defaultValue : value;
    }

    private <T> T measured(String tool, Supplier<T> operation) {
        Timer.Sample sample = Timer.start(meterRegistry);
        String status = "success";
        try {
            return operation.get();
        } catch (RuntimeException exception) {
            status = "error";
            throw exception;
        } finally {
            meterRegistry
                    .counter("kitezh_mcp_tool_calls_total", "tool", tool, "status", status)
                    .increment();
            sample.stop(
                    Timer.builder("kitezh_mcp_tool_call_duration_seconds")
                            .tag("tool", tool)
                            .register(meterRegistry));
        }
    }
}
