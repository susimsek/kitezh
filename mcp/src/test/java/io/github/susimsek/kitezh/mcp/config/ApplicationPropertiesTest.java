package io.github.susimsek.kitezh.mcp.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

class ApplicationPropertiesTest {

    @Test
    void bindsAdditionalMcpToolsProperty() {
        MapConfigurationPropertySource source =
                new MapConfigurationPropertySource(
                        Map.of(
                                "app.mcp.tools.toolsets", "users",
                                "app.mcp.tools.additional-tools", "get_client,search_events",
                                "app.mcp.tools.allowlist", "*"));

        ApplicationProperties properties =
                new Binder(source).bind("app", Bindable.of(ApplicationProperties.class)).get();

        assertThat(properties.mcp().tools().toolsets()).isEqualTo("users");
        assertThat(properties.mcp().tools().additionalTools())
                .isEqualTo("get_client,search_events");
        assertThat(properties.mcp().tools().allowlist()).isEqualTo("*");
    }
}
