package io.github.susimsek.kitezh.mcp.prompt;

import io.modelcontextprotocol.spec.McpSchema.CompleteRequest.CompleteArgument;
import java.util.List;
import java.util.Locale;
import org.springframework.ai.mcp.annotation.McpComplete;
import org.springframework.ai.mcp.annotation.McpPrompt;
import org.springframework.stereotype.Component;

/** Provides reusable, read-only Kitezh review prompts and bounded completions. */
@Component
public class KitezhMcpPrompts {

    private static final List<String> RESOURCE_TYPES = List.of("users", "groups", "clients");

    @McpPrompt(
            name = "review_resource",
            title = "Review a Kitezh resource",
            description = "Summarize a user, group, or OAuth client using its read-only resource.")
    public String reviewResource(String resourceType, String resourceId) {
        String type = validateResourceType(resourceType);
        if (resourceId == null || !resourceId.matches("[A-Za-z0-9_-]+")) {
            throw new IllegalArgumentException("resourceId is required");
        }
        if (!"clients".equals(type) && !resourceId.matches("[1-9][0-9]*")) {
            throw new IllegalArgumentException(
                    "User and group resource IDs must be positive numbers");
        }
        return "Read the Kitezh MCP resource kitezh://"
                + type
                + "/"
                + resourceId
                + " and summarize its access configuration. Base the review only on returned "
                + "data, call out missing or risky settings, and do not suggest or perform changes.";
    }

    @McpComplete(prompt = "review_resource")
    public List<String> completeResourceType(CompleteArgument argument) {
        if (!"resourceType".equals(argument.name())) {
            return List.of();
        }
        String prefix = argument.value().toLowerCase(Locale.ROOT);
        return RESOURCE_TYPES.stream().filter(type -> type.startsWith(prefix)).toList();
    }

    private static String validateResourceType(String resourceType) {
        if (resourceType == null) {
            throw new IllegalArgumentException("resourceType is required");
        }
        String normalized = resourceType.toLowerCase(Locale.ROOT);
        if (RESOURCE_TYPES.contains(normalized)) {
            return normalized;
        }
        throw new IllegalArgumentException("Unsupported Kitezh resource type");
    }
}
