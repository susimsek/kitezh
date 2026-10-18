package io.github.susimsek.kitezh.mcp.resource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class KitezhMcpResourcesTest {

    private final KitezhAdminApiClient apiClient = mock(KitezhAdminApiClient.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final KitezhMcpResources resources = new KitezhMcpResources(apiClient, objectMapper);

    @Test
    void readsUserResourceThroughTypedAdminApi() {
        doReturn(Map.of("id", 42, "username", "demo"))
                .when(apiClient)
                .get("get_user", "/api/admin/users/42", Map.of());

        assertThat(resources.user("42")).contains("\"username\":\"demo\"");

        verify(apiClient).get("get_user", "/api/admin/users/42", Map.of());
    }

    @Test
    void readsGroupResourceThroughTypedAdminApi() {
        doReturn(Map.of("id", 7)).when(apiClient).get("get_group", "/api/admin/groups/7", Map.of());

        assertThat(resources.group("7")).contains("\"id\":7");

        verify(apiClient).get("get_group", "/api/admin/groups/7", Map.of());
    }

    @Test
    void validatesNumericResourceIds() {
        assertThatIllegalArgumentException().isThrownBy(() -> resources.user("0"));
        assertThatIllegalArgumentException().isThrownBy(() -> resources.group("not-a-number"));
        assertThatIllegalArgumentException().isThrownBy(() -> resources.user("-1"));
    }

    @Test
    void validatesClientRecordIdAndReadsSafeClientResource() {
        doReturn(Map.of("clientId", "demo"))
                .when(apiClient)
                .get("get_client", "/api/admin/clients/record-id", Map.of());

        assertThat(resources.client("record-id")).contains("\"clientId\":\"demo\"");

        verify(apiClient).get("get_client", "/api/admin/clients/record-id", Map.of());
        assertThatIllegalArgumentException().isThrownBy(() -> resources.client(" "));
        assertThatIllegalArgumentException().isThrownBy(() -> resources.client("id/extra"));
    }
}
