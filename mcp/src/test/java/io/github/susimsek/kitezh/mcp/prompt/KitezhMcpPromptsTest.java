package io.github.susimsek.kitezh.mcp.prompt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import io.modelcontextprotocol.spec.McpSchema.CompleteRequest.CompleteArgument;
import org.junit.jupiter.api.Test;

class KitezhMcpPromptsTest {

    private final KitezhMcpPrompts prompts = new KitezhMcpPrompts();

    @Test
    void createsReadOnlyResourceReviewPrompt() {
        assertThat(prompts.reviewResource("USERS", "42"))
                .contains("kitezh://users/42", "do not suggest or perform changes");
    }

    @Test
    void validatesResourceTypeAndIdentifier() {
        assertThatIllegalArgumentException().isThrownBy(() -> prompts.reviewResource(null, "42"));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> prompts.reviewResource("unknown", "42"));
        assertThatIllegalArgumentException().isThrownBy(() -> prompts.reviewResource("users", " "));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> prompts.reviewResource("users", "42/43"));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> prompts.reviewResource("clients", "record?extra=value"));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> prompts.reviewResource("groups", "not-numeric"));
    }

    @Test
    void completesOnlyResourceTypeArguments() {
        assertThat(prompts.completeResourceType(new CompleteArgument("resourceType", "g")))
                .containsExactly("groups");
        assertThat(prompts.completeResourceType(new CompleteArgument("resourceType", "")))
                .containsExactly("users", "groups", "clients");
        assertThat(prompts.completeResourceType(new CompleteArgument("resourceId", "g"))).isEmpty();
    }
}
