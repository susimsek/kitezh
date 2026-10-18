package io.github.susimsek.kitezh.mcp.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import org.junit.jupiter.api.Test;

class McpPageTest {

    @Test
    void acceptsFirstAndMaximumPages() {
        assertThat(McpPage.validated(0, 1)).isEqualTo(new McpPage(0, 1));
        assertThat(McpPage.validated(4, 100)).isEqualTo(new McpPage(4, 100));
    }

    @Test
    void rejectsNegativePage() {
        assertThatIllegalArgumentException().isThrownBy(() -> McpPage.validated(-1, 20));
    }

    @Test
    void rejectsPageSizesOutsideAllowedRange() {
        assertThatIllegalArgumentException().isThrownBy(() -> McpPage.validated(0, 0));
        assertThatIllegalArgumentException().isThrownBy(() -> McpPage.validated(0, 101));
    }
}
