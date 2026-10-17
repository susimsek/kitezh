package io.github.susimsek.kitezh.mcp.tool;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;

@Component
public class KitezhOrganizationIdentityMcpTools {

    private static final Set<String> IDENTITY_PROVIDER_FIELDS =
            Set.of("providerAlias", "providerType", "displayName", "enabled");
    private static final Set<String> CLAIM_METADATA_FIELDS =
            Set.of("id", "claimName", "addToAccessToken", "addToIdToken", "addToUserInfo");

    private final KitezhAdminApiClient apiClient;
    private final MeterRegistry meterRegistry;

    public KitezhOrganizationIdentityMcpTools(
            KitezhAdminApiClient apiClient, MeterRegistry meterRegistry) {
        this.apiClient = apiClient;
        this.meterRegistry = meterRegistry;
    }

    @McpTool(
            name = "kitezh_list_organization_identity_providers",
            description = "List linked identity provider metadata for an organization.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List organization identity providers",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<String, Object> listOrganizationIdentityProviders(
            @McpToolParam(description = "Internal Kitezh organization ID.") Long organizationId) {
        return measured(
                "kitezh_list_organization_identity_providers",
                () -> {
                    List<Map<String, Object>> providers =
                            apiClient.getList(
                                    "kitezh_list_organization_identity_providers",
                                    "/api/admin/organizations/"
                                            + positiveId(organizationId)
                                            + "/identity-providers",
                                    Map.of());
                    return Map.of(
                            "identityProviders", allowFields(providers, IDENTITY_PROVIDER_FIELDS));
                });
    }

    @McpTool(
            name = "kitezh_list_organization_claims",
            description =
                    "List organization token claim names and destinations without exposing claim values.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List organization claim metadata",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<String, Object> listOrganizationClaims(
            @McpToolParam(description = "Internal Kitezh organization ID.") Long organizationId) {
        return measured(
                "kitezh_list_organization_claims",
                () -> {
                    List<Map<String, Object>> claims =
                            apiClient.getList(
                                    "kitezh_list_organization_claims",
                                    "/api/admin/organizations/"
                                            + positiveId(organizationId)
                                            + "/claims",
                                    Map.of());
                    return Map.of("claims", allowFields(claims, CLAIM_METADATA_FIELDS));
                });
    }

    private Map<String, Object> measured(String tool, Supplier<Map<String, Object>> operation) {
        Timer.Sample sample = Timer.start(meterRegistry);
        String status = "success";
        try {
            return operation.get();
        } catch (RuntimeException exception) {
            status =
                    exception instanceof IllegalArgumentException
                            ? "client_error"
                            : exception instanceof KitezhAdminApiClient.KitezhApiException
                                    ? "upstream_error"
                                    : "internal_error";
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

    private static List<Map<String, Object>> allowFields(
            List<Map<String, Object>> records, Set<String> allowedFields) {
        return records.stream()
                .map(
                        record -> {
                            Map<String, Object> safeRecord = new LinkedHashMap<>();
                            allowedFields.forEach(
                                    field -> {
                                        if (record.containsKey(field)) {
                                            safeRecord.put(field, record.get(field));
                                        }
                                    });
                            return safeRecord;
                        })
                .toList();
    }

    private static long positiveId(Long value) {
        if (value == null || value < 1) {
            throw new IllegalArgumentException("The identifier must be a positive integer");
        }
        return value;
    }
}
