package io.github.susimsek.kitezh.mcp.tool;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.github.susimsek.kitezh.mcp.service.McpWritePreviewRegistry;
import io.github.susimsek.kitezh.mcp.service.McpWritePreviewRegistry.Preview;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/** Exposes narrowly scoped writes through an explicit preview and one-time apply flow. */
@Component
@RequiredArgsConstructor
public class KitezhMcpWriteTools {

    private static final String USER_ENABLED = "user-enabled";
    private static final String ADD_USER_TO_GROUP = "add-user-to-group";
    private static final String REMOVE_USER_FROM_GROUP = "remove-user-from-group";
    private static final String REVOKE_SESSION = "revoke-session";
    private static final int MAX_MEMBERSHIP_PAGES = 100;

    private final KitezhAdminApiClient apiClient;
    private final McpWritePreviewRegistry previewRegistry;
    private final MeterRegistry meterRegistry;

    @McpTool(
            name = "preview_set_user_enabled",
            description = "Preview enabling or disabling a user before applying the change.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Preview user status change",
                            readOnlyHint = false,
                            destructiveHint = true,
                            idempotentHint = false,
                            openWorldHint = false))
    public Map<String, Object> previewSetUserEnabled(
            @McpToolParam(description = "Internal Kitezh user ID.") Long userId,
            @McpToolParam(description = "Whether the account should be enabled.") Boolean enabled) {
        return measured(
                "preview_set_user_enabled",
                () -> {
                    long id = positiveId(userId);
                    if (enabled == null) {
                        throw new IllegalArgumentException("enabled is required");
                    }
                    Map<?, ?> user = getUser(id, "preview_set_user_enabled");
                    boolean currentState = booleanValue(user.get("enabled"), "enabled");
                    if (currentState == enabled) {
                        throw new IllegalArgumentException("User already has the requested state");
                    }
                    return preview(
                            previewRegistry.create(
                                    caller(),
                                    USER_ENABLED,
                                    Long.toString(id),
                                    Boolean.toString(currentState),
                                    enabled.toString()),
                            "Change user enabled state",
                            Map.of(
                                    "wasEnabled",
                                    currentState,
                                    "willBeEnabled",
                                    enabled,
                                    "sideEffects",
                                    enabled
                                            ? "No sessions are revoked."
                                            : "Kitezh invalidates the user's active access."));
                });
    }

    @McpTool(
            name = "apply_set_user_enabled",
            description = "Apply a user status change from a valid preview after user approval.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Apply user status change",
                            readOnlyHint = false,
                            destructiveHint = true,
                            idempotentHint = false,
                            openWorldHint = false))
    public Map<String, Object> applySetUserEnabled(
            @McpToolParam(description = "Single-use preview token returned by the preview tool.")
                    String previewToken) {
        return measured(
                "apply_set_user_enabled",
                () -> {
                    Preview preview = consume(previewToken, USER_ENABLED);
                    long id = Long.parseLong(preview.target());
                    boolean currentState =
                            booleanValue(
                                    getUser(id, "apply_set_user_enabled").get("enabled"),
                                    "enabled");
                    requireUnchanged(preview, Boolean.toString(currentState));
                    boolean enabled = Boolean.parseBoolean(preview.newState());
                    apiClient.put(
                            "apply_set_user_enabled",
                            "/api/admin/users/" + id + "/enabled",
                            Map.of("enabled", enabled));
                    return applied(preview, "User enabled state updated");
                });
    }

    @McpTool(
            name = "preview_add_user_to_group",
            description = "Preview adding a user to a group before applying the membership change.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Preview group membership addition",
                            readOnlyHint = false,
                            destructiveHint = false,
                            idempotentHint = false,
                            openWorldHint = false))
    public Map<String, Object> previewAddUserToGroup(
            @McpToolParam(description = "Internal Kitezh group ID.") Long groupId,
            @McpToolParam(description = "Internal Kitezh user ID.") Long userId) {
        return previewMembership(groupId, userId, true);
    }

    @McpTool(
            name = "apply_add_user_to_group",
            description = "Apply a group membership addition from a valid preview after approval.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Apply group membership addition",
                            readOnlyHint = false,
                            destructiveHint = false,
                            idempotentHint = false,
                            openWorldHint = false))
    public Map<String, Object> applyAddUserToGroup(
            @McpToolParam(description = "Single-use preview token returned by the preview tool.")
                    String previewToken) {
        return applyMembership(previewToken, ADD_USER_TO_GROUP, true);
    }

    @McpTool(
            name = "preview_remove_user_from_group",
            description = "Preview removing a user from a group before applying the change.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Preview group membership removal",
                            readOnlyHint = false,
                            destructiveHint = true,
                            idempotentHint = false,
                            openWorldHint = false))
    public Map<String, Object> previewRemoveUserFromGroup(
            @McpToolParam(description = "Internal Kitezh group ID.") Long groupId,
            @McpToolParam(description = "Internal Kitezh user ID.") Long userId) {
        return previewMembership(groupId, userId, false);
    }

    @McpTool(
            name = "apply_remove_user_from_group",
            description = "Apply a group membership removal from a valid preview after approval.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Apply group membership removal",
                            readOnlyHint = false,
                            destructiveHint = true,
                            idempotentHint = false,
                            openWorldHint = false))
    public Map<String, Object> applyRemoveUserFromGroup(
            @McpToolParam(description = "Single-use preview token returned by the preview tool.")
                    String previewToken) {
        return applyMembership(previewToken, REMOVE_USER_FROM_GROUP, false);
    }

    @McpTool(
            name = "preview_revoke_session",
            description = "Preview revoking one browser session before ending it.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Preview session revocation",
                            readOnlyHint = false,
                            destructiveHint = true,
                            idempotentHint = false,
                            openWorldHint = false))
    public Map<String, Object> previewRevokeSession(
            @McpToolParam(description = "Opaque browser session ID.") String sessionId) {
        return measured(
                "preview_revoke_session",
                () -> {
                    String id = validateSessionId(sessionId);
                    apiClient.get("preview_revoke_session", "/api/admin/sessions/" + id, Map.of());
                    return preview(
                            previewRegistry.create(
                                    caller(), REVOKE_SESSION, id, "exists", "revoked"),
                            "Revoke one browser session",
                            Map.of("sessionId", id));
                });
    }

    @McpTool(
            name = "apply_revoke_session",
            description = "Revoke one browser session from a valid preview after user approval.",
            annotations =
                    @McpTool.McpAnnotations(
                            title = "Apply session revocation",
                            readOnlyHint = false,
                            destructiveHint = true,
                            idempotentHint = false,
                            openWorldHint = false))
    public Map<String, Object> applyRevokeSession(
            @McpToolParam(description = "Single-use preview token returned by the preview tool.")
                    String previewToken) {
        return measured(
                "apply_revoke_session",
                () -> {
                    Preview preview = consume(previewToken, REVOKE_SESSION);
                    apiClient.get(
                            "apply_revoke_session",
                            "/api/admin/sessions/" + validateSessionId(preview.target()),
                            Map.of());
                    apiClient.delete(
                            "apply_revoke_session", "/api/admin/sessions/" + preview.target());
                    return applied(preview, "Browser session revoked");
                });
    }

    private Map<String, Object> previewMembership(
            Long groupId, Long userId, boolean addMembership) {
        String tool =
                addMembership ? "preview_add_user_to_group" : "preview_remove_user_from_group";
        String action = addMembership ? ADD_USER_TO_GROUP : REMOVE_USER_FROM_GROUP;
        return measured(
                tool,
                () -> {
                    long validatedGroupId = positiveId(groupId);
                    long validatedUserId = positiveId(userId);
                    apiClient.get("get_group", "/api/admin/groups/" + validatedGroupId, Map.of());
                    getUser(validatedUserId, tool);
                    boolean currentState = isGroupMember(validatedGroupId, validatedUserId, tool);
                    if (currentState == addMembership) {
                        throw new IllegalArgumentException(
                                addMembership
                                        ? "User is already a group member"
                                        : "User is not a group member");
                    }
                    Preview preview =
                            previewRegistry.create(
                                    caller(),
                                    action,
                                    validatedGroupId + ":" + validatedUserId,
                                    Boolean.toString(currentState),
                                    Boolean.toString(addMembership));
                    return preview(
                            preview,
                            addMembership ? "Add user to group" : "Remove user from group",
                            Map.of(
                                    "groupId",
                                    validatedGroupId,
                                    "userId",
                                    validatedUserId,
                                    "sideEffects",
                                    "Kitezh invalidates the user's active access."));
                });
    }

    private Map<String, Object> applyMembership(
            String previewToken, String action, boolean addMembership) {
        String tool = addMembership ? "apply_add_user_to_group" : "apply_remove_user_from_group";
        return measured(
                tool,
                () -> {
                    Preview preview = consume(previewToken, action);
                    String[] ids = preview.target().split(":", -1);
                    if (ids.length != 2) {
                        throw new IllegalArgumentException("Write preview is invalid");
                    }
                    long groupId = Long.parseLong(ids[0]);
                    long userId = Long.parseLong(ids[1]);
                    boolean currentState = isGroupMember(groupId, userId, tool);
                    requireUnchanged(preview, Boolean.toString(currentState));
                    if (addMembership) {
                        apiClient.post(
                                tool,
                                "/api/admin/groups/" + groupId + "/users",
                                Map.of("userId", userId));
                    } else {
                        apiClient.delete(tool, "/api/admin/groups/" + groupId + "/users/" + userId);
                    }
                    return applied(
                            preview,
                            addMembership ? "User added to group" : "User removed from group");
                });
    }

    private boolean isGroupMember(long groupId, long userId, String tool) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("size", 100);
        parameters.put("sort", "username,asc");
        Map<?, ?> page = apiClient.get(tool, "/api/admin/groups/" + groupId + "/users", parameters);
        int totalPages = totalPages(page.get("totalPages"));
        if (totalPages > MAX_MEMBERSHIP_PAGES) {
            throw new IllegalArgumentException("Group is too large for a safe membership preview");
        }
        if (containsUser(page, userId)) {
            return true;
        }
        for (int pageNumber = 1; pageNumber < totalPages; pageNumber++) {
            parameters.put("page", pageNumber);
            page = apiClient.get(tool, "/api/admin/groups/" + groupId + "/users", parameters);
            if (containsUser(page, userId)) {
                return true;
            }
        }
        return false;
    }

    private static boolean containsUser(Map<?, ?> page, long userId) {
        Object content = page.get("content");
        if (!(content instanceof List<?> users)) {
            return false;
        }
        return users.stream()
                .filter(Map.class::isInstance)
                .map(Map.class::cast)
                .anyMatch(user -> userId == pageNumber(user.get("id")));
    }

    private Map<?, ?> getUser(long userId, String tool) {
        return apiClient.get(tool, "/api/admin/users/" + userId, Map.of());
    }

    private Preview consume(String previewToken, String action) {
        return previewRegistry.consume(previewToken, caller(), action);
    }

    private static String caller() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new IllegalStateException("Authenticated MCP caller is required");
        }
        return authentication.getName();
    }

    private static long positiveId(Long id) {
        if (id == null || id < 1) {
            throw new IllegalArgumentException("ID must be a positive integer");
        }
        return id;
    }

    private static String validateSessionId(String sessionId) {
        if (sessionId == null || !sessionId.matches("[A-Za-z0-9._:-]{1,128}")) {
            throw new IllegalArgumentException("sessionId is invalid");
        }
        return sessionId;
    }

    private static boolean booleanValue(Object value, String field) {
        if (value instanceof Boolean booleanValue) {
            return booleanValue;
        }
        throw new IllegalArgumentException("Admin API response is missing " + field);
    }

    private static int pageNumber(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
    }

    private static int totalPages(Object value) {
        if (value instanceof Number number && number.intValue() > 0) {
            return number.intValue();
        }
        throw new IllegalArgumentException("Admin API response is missing page metadata");
    }

    private static void requireUnchanged(Preview preview, String currentState) {
        if (!preview.expectedState().equals(currentState)) {
            throw new IllegalStateException("The target changed after the preview; preview again");
        }
    }

    private static Map<String, Object> preview(
            Preview preview, String summary, Map<String, Object> targetDetails) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "preview_ready");
        result.put("summary", summary);
        result.put("target", targetDetails);
        result.put("previewToken", preview.token());
        result.put("expiresAt", preview.expiresAt().toString());
        result.put("requiresUserApproval", true);
        return result;
    }

    private static Map<String, Object> applied(Preview preview, String summary) {
        return Map.of(
                "status",
                "applied",
                "summary",
                summary,
                "target",
                preview.target(),
                "completedAt",
                java.time.Instant.now().toString());
    }

    private Map<String, Object> measured(String tool, Supplier<Map<String, Object>> operation) {
        Timer.Sample sample = Timer.start(meterRegistry);
        String status = "success";
        try {
            return operation.get();
        } catch (RuntimeException exception) {
            status = exception instanceof IllegalArgumentException ? "client_error" : "error";
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
