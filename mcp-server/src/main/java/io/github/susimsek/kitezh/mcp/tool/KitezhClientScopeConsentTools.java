package io.github.susimsek.kitezh.mcp.tool;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;

/** Read-only OAuth client-scope and consent inspection tools. */
@Component
public class KitezhClientScopeConsentTools {

    private static final String CLIENT_ID_PATTERN = "[A-Za-z0-9._~+-]{1,128}";
    private static final String USERNAME_PATTERN = "[A-Za-z0-9._@+-]{1,128}";
    private static final String SCOPE_ID_PATTERN = "[A-Za-z0-9._~-]{1,128}";
    private static final int MAX_SEARCH_LENGTH = 256;
    private static final int MAX_SCOPES_LENGTH = 4096;

    private final KitezhAdminApiClient apiClient;
    private final MeterRegistry meterRegistry;

    public KitezhClientScopeConsentTools(
            KitezhAdminApiClient apiClient, MeterRegistry meterRegistry) {
        this.apiClient = apiClient;
        this.meterRegistry = meterRegistry;
    }

    @McpTool(
            name = "kitezh_search_client_scopes",
            description = "Search the Kitezh OAuth client-scope catalogue with bounded pagination.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Search OAuth client scopes",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> searchClientScopes(
            @McpToolParam(description = "Optional scope name search text.", required = false)
                    String q,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        McpPage paging = McpPage.validated(valueOr(page, 0), valueOr(size, 20));
        Map<String, Object> parameters = pageParameters(paging, "name,asc");
        addOptional(parameters, "q", validatedOptional(q, MAX_SEARCH_LENGTH, "q"));
        return measured(
                "kitezh_search_client_scopes",
                () ->
                        apiClient.get(
                                "kitezh_search_client_scopes",
                                "/api/admin/client-scopes",
                                parameters));
    }

    @McpTool(
            name = "kitezh_get_client_scope",
            description = "Get one OAuth client-scope catalogue entry.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Get OAuth client scope",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> getClientScope(
            @McpToolParam(description = "Internal client-scope record ID.") String scopeRecordId) {
        String scopeId = validatePathId(scopeRecordId, SCOPE_ID_PATTERN, "scopeRecordId");
        return measured(
                "kitezh_get_client_scope",
                () ->
                        apiClient.get(
                                "kitezh_get_client_scope",
                                "/api/admin/client-scopes/" + scopeId,
                                Map.of()));
    }

    @McpTool(
            name = "kitezh_get_client_scope_assignments",
            description = "Get a client's default, optional, and available OAuth scopes.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Get OAuth client scope assignments",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> getClientScopeAssignments(
            @McpToolParam(description = "Internal registered-client record ID.")
                    String clientRecordId) {
        String clientId = validatePathId(clientRecordId, CLIENT_ID_PATTERN, "clientRecordId");
        return measured(
                "kitezh_get_client_scope_assignments",
                () ->
                        apiClient.get(
                                "kitezh_get_client_scope_assignments",
                                "/api/admin/clients/" + clientId + "/scope-assignments",
                                Map.of()));
    }

    @McpTool(
            name = "kitezh_evaluate_client_scopes",
            description =
                    "Preview effective OAuth scopes, mapped claims, and roles without issuing a token.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Evaluate OAuth client scopes",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> evaluateClientScopes(
            @McpToolParam(description = "Internal registered-client record ID.")
                    String clientRecordId,
            @McpToolParam(description = "Space-separated requested scope names.", required = false)
                    String scopes,
            @McpToolParam(
                            description = "Optional username whose effective roles are previewed.",
                            required = false)
                    String subject) {
        String clientId = validatePathId(clientRecordId, CLIENT_ID_PATTERN, "clientRecordId");
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("scopes", validatedOptional(scopes, MAX_SCOPES_LENGTH, "scopes"));
        parameters.put("subject", validatedOptional(subject, 128, "subject"));
        return measured(
                "kitezh_evaluate_client_scopes",
                () ->
                        apiClient.get(
                                "kitezh_evaluate_client_scopes",
                                "/api/admin/clients/" + clientId + "/scope-evaluation",
                                parameters));
    }

    @McpTool(
            name = "kitezh_search_consents",
            description = "Search OAuth user consents by client, username, or granted scope.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Search OAuth consents",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> searchConsents(
            @McpToolParam(
                            description = "Optional client or username search text.",
                            required = false)
                    String q,
            @McpToolParam(description = "Optional registered OAuth client ID.", required = false)
                    String clientId,
            @McpToolParam(description = "Optional username filter.", required = false)
                    String username,
            @McpToolParam(description = "Optional granted scope filter.", required = false)
                    String scope,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        McpPage paging = McpPage.validated(valueOr(page, 0), valueOr(size, 20));
        Map<String, Object> parameters = pageParameters(paging, "id.principalName,asc");
        addOptional(parameters, "q", validatedOptional(q, MAX_SEARCH_LENGTH, "q"));
        addOptional(parameters, "clientId", validatedOptional(clientId, 128, "clientId"));
        addOptional(parameters, "username", validatedOptional(username, 128, "username"));
        addOptional(parameters, "scope", validatedOptional(scope, 128, "scope"));
        return measured(
                "kitezh_search_consents",
                () -> apiClient.get("kitezh_search_consents", "/api/admin/consents", parameters));
    }

    @McpTool(
            name = "kitezh_list_user_consents",
            description = "List OAuth consents granted by a Kitezh user.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "List user OAuth consents",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> listUserConsents(
            @McpToolParam(description = "Internal Kitezh user ID.") Long userId,
            @McpToolParam(description = "Zero-based page number.", required = false) Integer page,
            @McpToolParam(description = "Page size from 1 to 100.", required = false)
                    Integer size) {
        if (userId == null || userId < 1) {
            throw new IllegalArgumentException("userId must be a positive integer");
        }
        McpPage paging = McpPage.validated(valueOr(page, 0), valueOr(size, 20));
        Map<String, Object> parameters = pageParameters(paging, "id.registeredClientId,asc");
        return measured(
                "kitezh_list_user_consents",
                () ->
                        apiClient.get(
                                "kitezh_list_user_consents",
                                "/api/admin/users/" + userId + "/consents",
                                parameters));
    }

    @McpTool(
            name = "kitezh_get_user_consent",
            description = "Get the scopes and metadata a user consented to for one OAuth client.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Get user OAuth consent",
                            readOnlyHint = true,
                            destructiveHint = false,
                            idempotentHint = true,
                            openWorldHint = false))
    public Map<?, ?> getUserConsent(
            @McpToolParam(description = "Registered OAuth client ID.") String clientId,
            @McpToolParam(description = "Username that granted consent.") String username) {
        String validatedClientId = validatePathId(clientId, CLIENT_ID_PATTERN, "clientId");
        String validatedUsername = validatePathId(username, USERNAME_PATTERN, "username");
        return measured(
                "kitezh_get_user_consent",
                () ->
                        apiClient.get(
                                "kitezh_get_user_consent",
                                "/api/admin/consents/"
                                        + validatedClientId
                                        + "/"
                                        + validatedUsername,
                                Map.of()));
    }

    private Map<?, ?> measured(String tool, Supplier<Map<?, ?>> operation) {
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

    private static Map<String, Object> pageParameters(McpPage page, String sort) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("page", page.page());
        parameters.put("size", page.size());
        parameters.put("sort", sort);
        return parameters;
    }

    private static String validatePathId(String value, String pattern, String field) {
        if (value == null || !value.matches(pattern) || value.equals(".") || value.equals("..")) {
            throw new IllegalArgumentException(field + " has an invalid format");
        }
        return value;
    }

    private static String validatedOptional(String value, int maxLength, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if (value.length() > maxLength || value.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException(field + " has an invalid length or character");
        }
        return value;
    }

    private static int valueOr(Integer value, int defaultValue) {
        return value == null ? defaultValue : value;
    }

    private static void addOptional(Map<String, Object> parameters, String name, Object value) {
        if (value != null) {
            parameters.put(name, value);
        }
    }
}
