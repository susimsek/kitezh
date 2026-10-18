package io.github.susimsek.kitezh.mcp.resource;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.modelcontextprotocol.spec.McpSchema.CompleteRequest.CompleteArgument;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.ai.mcp.annotation.McpComplete;
import org.springframework.stereotype.Component;

/** Completes Kitezh resource identifiers using the caller-authorized Admin API. */
@Component
public class KitezhMcpResourceCompletions {

    private static final int MAX_SUGGESTIONS = 100;
    private static final String PAGE = "page";
    private static final String SIZE = "size";
    private static final String SORT = "sort";
    private static final Pattern NUMERIC_PREFIX = Pattern.compile("[0-9]*");
    private static final Pattern CLIENT_ID_PREFIX = Pattern.compile("[A-Za-z0-9-]*");

    private final KitezhAdminApiClient apiClient;

    public KitezhMcpResourceCompletions(KitezhAdminApiClient apiClient) {
        this.apiClient = apiClient;
    }

    @McpComplete(uri = "kitezh://users/{userId}")
    public List<String> completeUserId(CompleteArgument argument) {
        if (!"userId".equals(argument.name())
                || argument.value() == null
                || !NUMERIC_PREFIX.matcher(argument.value()).matches()) {
            return List.of();
        }
        return completeIds("users", "username,asc", argument.value());
    }

    @McpComplete(uri = "kitezh://groups/{groupId}")
    public List<String> completeGroupId(CompleteArgument argument) {
        if (!"groupId".equals(argument.name())
                || argument.value() == null
                || !NUMERIC_PREFIX.matcher(argument.value()).matches()) {
            return List.of();
        }
        return completeIds("groups", "name,asc", argument.value());
    }

    @McpComplete(uri = "kitezh://clients/{clientRecordId}")
    public List<String> completeClientRecordId(CompleteArgument argument) {
        if (!"clientRecordId".equals(argument.name())
                || argument.value() == null
                || !CLIENT_ID_PREFIX.matcher(argument.value()).matches()) {
            return List.of();
        }
        return completeIds("clients", "clientId,asc", argument.value());
    }

    private List<String> completeIds(String resource, String sort, String prefix) {
        Map<String, Object> parameters = Map.of(PAGE, 0, SIZE, MAX_SUGGESTIONS, SORT, sort);
        Map<?, ?> page =
                apiClient.get(
                        "complete_" + resource + "_resource_ids",
                        "/api/admin/" + resource,
                        parameters);
        Object content = page.get("content");
        if (!(content instanceof List<?> records)) {
            return List.of();
        }
        return records.stream()
                .map(KitezhMcpResourceCompletions::recordId)
                .filter(id -> id != null)
                .filter(id -> id.startsWith(prefix))
                .limit(MAX_SUGGESTIONS)
                .toList();
    }

    private static String recordId(Object value) {
        if (!(value instanceof Map<?, ?> record)) {
            return null;
        }
        Object id = record.get("id");
        return id == null ? null : id.toString();
    }
}
