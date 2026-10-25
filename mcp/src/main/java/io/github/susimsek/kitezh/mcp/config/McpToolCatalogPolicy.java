package io.github.susimsek.kitezh.mcp.config;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Applies operator-configured toolsets, additional tools, and exact-name allowlist. */
final class McpToolCatalogPolicy {

    private static final String ALL = "all";
    private static final String WILDCARD = "*";
    private static final Map<String, Set<String>> TOOLSETS = toolsets();
    private static final Set<String> ALL_TOOLS =
            TOOLSETS.values().stream().flatMap(Set::stream).collect(Collectors.toUnmodifiableSet());

    private final Set<String> enabledTools;

    McpToolCatalogPolicy(
            String configuredToolsets,
            String configuredAdditionalTools,
            String configuredAllowlist) {
        Set<String> selectedToolsets = parse(configuredToolsets, "toolsets", false);
        Set<String> additionalTools = parse(configuredAdditionalTools, "additional-tools", true);
        Set<String> allowlist = parse(configuredAllowlist, "allowlist", true);
        validateToolsets(selectedToolsets);
        validateAdditionalTools(additionalTools);
        validateAllowlist(allowlist);

        Set<String> selectedTools = new LinkedHashSet<>();
        if (selectedToolsets.contains(ALL)) {
            TOOLSETS.entrySet().stream()
                    .filter(entry -> !entry.getKey().endsWith("_write"))
                    .flatMap(entry -> entry.getValue().stream())
                    .forEach(selectedTools::add);
            selectedToolsets.stream()
                    .filter(toolset -> toolset.endsWith("_write"))
                    .map(TOOLSETS::get)
                    .forEach(selectedTools::addAll);
        } else {
            selectedToolsets.stream().map(TOOLSETS::get).forEach(selectedTools::addAll);
        }
        selectedTools.addAll(additionalTools);
        if (!allowlist.contains(WILDCARD)) {
            selectedTools.retainAll(allowlist);
        }
        enabledTools = Set.copyOf(selectedTools);
    }

    boolean isEnabled(String toolName) {
        return enabledTools.contains(toolName);
    }

    boolean isKnownTool(String toolName) {
        return ALL_TOOLS.contains(toolName);
    }

    private static Set<String> parse(String value, String propertyName, boolean allowEmpty) {
        if (value == null || value.isBlank()) {
            if (allowEmpty) {
                return Set.of();
            }
            throw new IllegalArgumentException("MCP tool " + propertyName + " must not be empty");
        }
        Set<String> parsed =
                Arrays.stream(value.split(",", -1))
                        .map(String::trim)
                        .collect(Collectors.toCollection(LinkedHashSet::new));
        if (parsed.contains("")) {
            throw new IllegalArgumentException(
                    "MCP tool " + propertyName + " contains an empty value");
        }
        return parsed;
    }

    private static void validateToolsets(Set<String> configuredToolsets) {
        Set<String> nonWriteToolsets = new LinkedHashSet<>(configuredToolsets);
        nonWriteToolsets.remove(ALL);
        nonWriteToolsets.removeIf(toolset -> toolset.endsWith("_write"));
        if (configuredToolsets.contains(ALL) && !nonWriteToolsets.isEmpty()) {
            throw new IllegalArgumentException(
                    "MCP toolset 'all' cannot be combined with read categories");
        }
        Set<String> unknownToolsets = new LinkedHashSet<>(configuredToolsets);
        unknownToolsets.remove(ALL);
        unknownToolsets.removeAll(TOOLSETS.keySet());
        if (!unknownToolsets.isEmpty()) {
            throw new IllegalArgumentException("Unknown MCP toolsets: " + unknownToolsets);
        }
    }

    private static void validateAllowlist(Set<String> allowlist) {
        if (allowlist.contains(WILDCARD) && allowlist.size() != 1) {
            throw new IllegalArgumentException(
                    "MCP tool allowlist '*' cannot be combined with tool names");
        }
        Set<String> unknownTools = new LinkedHashSet<>(allowlist);
        unknownTools.remove(WILDCARD);
        unknownTools.removeAll(ALL_TOOLS);
        if (!unknownTools.isEmpty()) {
            throw new IllegalArgumentException(
                    "Unknown MCP tool names in allowlist: " + unknownTools);
        }
    }

    private static void validateAdditionalTools(Set<String> additionalTools) {
        if (additionalTools.contains(WILDCARD)) {
            throw new IllegalArgumentException(
                    "MCP additional tools must use exact tool names; use toolsets 'all' for every tool");
        }
        Set<String> unknownTools = new LinkedHashSet<>(additionalTools);
        unknownTools.removeAll(ALL_TOOLS);
        if (!unknownTools.isEmpty()) {
            throw new IllegalArgumentException(
                    "Unknown MCP tool names in additional-tools: " + unknownTools);
        }
    }

    private static Map<String, Set<String>> toolsets() {
        Map<String, Set<String>> toolsets = new LinkedHashMap<>();
        toolsets.put(
                "users",
                Set.of(
                        "search_users",
                        "get_user",
                        "search_consents",
                        "list_user_consents",
                        "get_user_consent",
                        "list_sessions",
                        "list_offline_sessions",
                        "list_user_required_actions"));
        toolsets.put(
                "groups",
                Set.of(
                        "search_groups",
                        "get_group",
                        "list_user_groups",
                        "list_group_members",
                        "get_group_permissions"));
        toolsets.put(
                "clients",
                Set.of(
                        "search_clients",
                        "get_client",
                        "search_client_scopes",
                        "get_client_scope",
                        "get_client_scope_assignments",
                        "evaluate_client_scopes",
                        "search_client_roles",
                        "get_client_role",
                        "list_client_mappers",
                        "list_client_scope_mappers",
                        "get_service_account"));
        toolsets.put("roles", Set.of("search_roles", "get_role"));
        toolsets.put("events", Set.of("search_events"));
        toolsets.put(
                "organizations",
                Set.of(
                        "search_organizations",
                        "get_organization",
                        "list_organization_members",
                        "list_organization_groups",
                        "list_organization_domains",
                        "list_organization_group_members",
                        "list_organization_invitations",
                        "list_organization_identity_providers",
                        "list_organization_claims"));
        toolsets.put("context", Set.of("get_context"));
        toolsets.put("dashboard", Set.of("get_admin_dashboard_summary"));
        toolsets.put("notifications", Set.of("list_admin_notifications"));
        toolsets.put("signing-keys", Set.of("list_signing_key_metadata"));
        toolsets.put("users_write", Set.of("preview_set_user_enabled", "apply_set_user_enabled"));
        toolsets.put(
                "groups_write",
                Set.of(
                        "preview_add_user_to_group",
                        "apply_add_user_to_group",
                        "preview_remove_user_from_group",
                        "apply_remove_user_from_group"));
        toolsets.put("sessions_write", Set.of("preview_revoke_session", "apply_revoke_session"));
        return Map.copyOf(toolsets);
    }
}
