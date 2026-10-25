package io.github.susimsek.kitezh.mcp.resource;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.mcp.annotation.McpResource;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/** Exposes read-only Kitezh records through MCP resource templates. */
@Component
@RequiredArgsConstructor
public class KitezhMcpResources {

    private final KitezhAdminApiClient apiClient;
    private final ObjectMapper objectMapper;

    @McpResource(
            uri = "kitezh://users/{userId}",
            name = "Kitezh user",
            title = "Kitezh user record",
            description = "Read a user summary by internal ID. Credentials are not included.",
            mimeType = "application/json")
    public String user(String userId) {
        return json(apiClient.get("get_user", "/api/admin/users/" + positiveId(userId), Map.of()));
    }

    @McpResource(
            uri = "kitezh://groups/{groupId}",
            name = "Kitezh group",
            title = "Kitezh group record",
            description = "Read a group summary and its safe role information by internal ID.",
            mimeType = "application/json")
    public String group(String groupId) {
        return json(
                apiClient.get("get_group", "/api/admin/groups/" + positiveId(groupId), Map.of()));
    }

    @McpResource(
            uri = "kitezh://clients/{clientRecordId}",
            name = "Kitezh OAuth client",
            title = "Kitezh OAuth client record",
            description = "Read an OAuth client configuration without secrets or hashes.",
            mimeType = "application/json")
    public String client(String clientRecordId) {
        if (clientRecordId == null || clientRecordId.isBlank() || clientRecordId.contains("/")) {
            throw new IllegalArgumentException("clientRecordId is required");
        }
        return json(apiClient.get("get_client", "/api/admin/clients/" + clientRecordId, Map.of()));
    }

    private String json(Map<?, ?> value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JacksonException exception) {
            throw new IllegalStateException("Unable to serialize Kitezh resource", exception);
        }
    }

    private static long positiveId(String value) {
        try {
            long id = Long.parseLong(value);
            if (id > 0) {
                return id;
            }
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Resource ID must be a positive number", exception);
        }
        throw new IllegalArgumentException("Resource ID must be a positive number");
    }
}
