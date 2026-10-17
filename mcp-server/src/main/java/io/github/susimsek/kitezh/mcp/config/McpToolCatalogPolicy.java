package io.github.susimsek.kitezh.mcp.config;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Applies the operator-configured toolsets and exact-name allowlist. */
final class McpToolCatalogPolicy {

    private static final String ALL = "all";
    private static final String WILDCARD = "*";
    private static final Map<String, Set<String>> TOOLSETS = toolsets();
    private static final Set<String> ALL_TOOLS =
            TOOLSETS.values().stream().flatMap(Set::stream).collect(Collectors.toUnmodifiableSet());

    private final Set<String> enabledTools;

    McpToolCatalogPolicy(String configuredToolsets, String configuredAllowlist) {
        Set<String> selectedToolsets = parse(configuredToolsets, "toolsets", false);
        Set<String> allowlist = parse(configuredAllowlist, "allowlist", true);
        validateToolsets(selectedToolsets);
        validateAllowlist(allowlist);

        Set<String> selectedTools = new LinkedHashSet<>();
        if (selectedToolsets.contains(ALL)) {
            selectedTools.addAll(ALL_TOOLS);
        } else {
            selectedToolsets.stream().map(TOOLSETS::get).forEach(selectedTools::addAll);
        }
        if (!allowlist.contains(WILDCARD)) {
            selectedTools.retainAll(allowlist);
        }
        enabledTools = Set.copyOf(selectedTools);
    }

    boolean isEnabled(String toolName) {
        return enabledTools.contains(toolName);
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
        if (configuredToolsets.contains(ALL) && configuredToolsets.size() != 1) {
            throw new IllegalArgumentException(
                    "MCP toolset 'all' cannot be combined with categories");
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

    private static Map<String, Set<String>> toolsets() {
        Map<String, Set<String>> toolsets = new LinkedHashMap<>();
        toolsets.put(
                "users",
                Set.of(
                        "kitezh_search_users",
                        "kitezh_get_user",
                        "kitezh_search_consents",
                        "kitezh_list_user_consents",
                        "kitezh_get_user_consent",
                        "kitezh_list_sessions",
                        "kitezh_list_offline_sessions",
                        "kitezh_list_user_required_actions"));
        toolsets.put(
                "groups",
                Set.of(
                        "kitezh_search_groups",
                        "kitezh_get_group",
                        "kitezh_list_user_groups",
                        "kitezh_list_group_members",
                        "kitezh_get_group_permissions"));
        toolsets.put(
                "clients",
                Set.of(
                        "kitezh_search_clients",
                        "kitezh_get_client",
                        "kitezh_search_client_scopes",
                        "kitezh_get_client_scope",
                        "kitezh_get_client_scope_assignments",
                        "kitezh_evaluate_client_scopes",
                        "kitezh_search_client_roles",
                        "kitezh_get_client_role",
                        "kitezh_list_client_mappers",
                        "kitezh_list_client_scope_mappers",
                        "kitezh_get_service_account"));
        toolsets.put("roles", Set.of("kitezh_search_roles", "kitezh_get_role"));
        toolsets.put("events", Set.of("kitezh_search_events"));
        toolsets.put(
                "organizations",
                Set.of(
                        "kitezh_search_organizations",
                        "kitezh_get_organization",
                        "kitezh_list_organization_members",
                        "kitezh_list_organization_groups",
                        "kitezh_list_organization_domains",
                        "kitezh_list_organization_group_members",
                        "kitezh_list_organization_invitations",
                        "kitezh_list_organization_identity_providers",
                        "kitezh_list_organization_claims"));
        toolsets.put("context", Set.of("kitezh_get_context"));
        toolsets.put("dashboard", Set.of("kitezh_get_admin_dashboard_summary"));
        toolsets.put("notifications", Set.of("kitezh_list_admin_notifications"));
        toolsets.put("signing-keys", Set.of("kitezh_list_signing_key_metadata"));
        return Map.copyOf(toolsets);
    }
}
