package io.github.susimsek.kitezh.mcp.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class McpToolCatalogPolicyTest {

    @Test
    void enablesAllKnownToolsByDefault() {
        McpToolCatalogPolicy policy = new McpToolCatalogPolicy("all", "", "*");

        assertThat(policy.isEnabled("search_users")).isTrue();
        assertThat(policy.isEnabled("search_clients")).isTrue();
        assertThat(policy.isEnabled("get_admin_dashboard_summary")).isTrue();
        assertThat(policy.isEnabled("unknown_tool")).isFalse();
    }

    @Test
    void narrowsToolsToConfiguredToolsets() {
        McpToolCatalogPolicy policy = new McpToolCatalogPolicy("users,groups", "", "*");

        assertThat(policy.isEnabled("search_users")).isTrue();
        assertThat(policy.isEnabled("search_groups")).isTrue();
        assertThat(policy.isEnabled("search_clients")).isFalse();
    }

    @Test
    void intersectsToolsetsWithExactNameAllowlist() {
        McpToolCatalogPolicy policy =
                new McpToolCatalogPolicy("users,clients", "", "search_users,get_client");

        assertThat(policy.isEnabled("search_users")).isTrue();
        assertThat(policy.isEnabled("get_client")).isTrue();
        assertThat(policy.isEnabled("get_user")).isFalse();
        assertThat(policy.isEnabled("search_clients")).isFalse();
    }

    @Test
    void addsIndividuallyConfiguredToolsToSelectedToolsets() {
        McpToolCatalogPolicy policy = new McpToolCatalogPolicy("users", "get_client", "*");

        assertThat(policy.isEnabled("search_users")).isTrue();
        assertThat(policy.isEnabled("get_client")).isTrue();
        assertThat(policy.isEnabled("search_clients")).isFalse();
    }

    @Test
    void allowlistRemainsRestrictiveForAdditionalTools() {
        McpToolCatalogPolicy policy =
                new McpToolCatalogPolicy("users", "get_client", "search_users");

        assertThat(policy.isEnabled("search_users")).isTrue();
        assertThat(policy.isEnabled("get_client")).isFalse();
        assertThat(policy.isEnabled("get_user")).isFalse();
    }

    @Test
    void rejectsUnknownToolsetsAndToolNames() {
        assertThatThrownBy(() -> new McpToolCatalogPolicy("user", "", "*"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new McpToolCatalogPolicy("all", "kitezh_unknown_tool", "*"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new McpToolCatalogPolicy("all", "", "kitezh_unknown_tool"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsEmptyValuesAndMixingAllWithNamedToolsets() {
        assertThatThrownBy(() -> new McpToolCatalogPolicy("", "", "*"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new McpToolCatalogPolicy("all,users", "", "*"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new McpToolCatalogPolicy("all", "", "*,search_users"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new McpToolCatalogPolicy("users", "*,get_client", "*"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void blankAllowlistDisablesAllTools() {
        McpToolCatalogPolicy policy = new McpToolCatalogPolicy("all", "", "");

        assertThat(policy.isEnabled("search_users")).isFalse();
        assertThat(policy.isEnabled("search_clients")).isFalse();
    }
}
