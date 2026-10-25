package io.github.susimsek.kitezh.mcp.tool;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import io.github.susimsek.kitezh.mcp.service.KitezhAdminApiClient;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class KitezhSigningKeyMcpToolsTest {

    private KitezhAdminApiClient apiClient;
    private KitezhSigningKeyMcpTools tools;

    @BeforeEach
    void setUp() {
        apiClient = mock(KitezhAdminApiClient.class);
        tools = new KitezhSigningKeyMcpTools(apiClient, new SimpleMeterRegistry());
    }

    @Test
    void listsOnlySigningKeyPublicMetadata() {
        Map<String, Object> key =
                Map.of(
                        "id", "key-123",
                        "kid", "rsa-1",
                        "type", "RSA",
                        "algorithm", "RS256",
                        "use", "sig",
                        "active", true,
                        "createdAt", "2026-10-17T08:30:00Z",
                        "publicKey", "encoded-public-key",
                        "privateKey", "encoded-private-key");
        doReturn(
                        Map.of(
                                "content", List.of(key),
                                "number", 0,
                                "size", 20,
                                "totalElements", 1,
                                "privateKey", "unexpected-page-secret"))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());

        Map<String, Object> result = tools.listSigningKeyMetadata(null, null, null, null);

        assertThat(result)
                .containsEntry("number", 0)
                .containsEntry("totalElements", 1)
                .doesNotContainKey("privateKey");
        assertThat(result.get("content"))
                .isEqualTo(
                        List.of(
                                Map.of(
                                        "id", "key-123",
                                        "kid", "rsa-1",
                                        "type", "RSA",
                                        "algorithm", "RS256",
                                        "use", "sig",
                                        "active", true,
                                        "createdAt", "2026-10-17T08:30:00Z")));
        verify(apiClient)
                .get(
                        "list_signing_key_metadata",
                        "/api/admin/keys",
                        Map.of("q", "", "page", 0, "size", 20, "sort", "createdAt,desc"));
    }

    @Test
    void appliesSearchFiltersAndPagination() {
        doReturn(Map.of("content", List.of(), "number", 2))
                .when(apiClient)
                .get(anyString(), anyString(), anyMap());

        tools.listSigningKeyMetadata("rsa", false, 2, 10);

        verify(apiClient)
                .get(
                        "list_signing_key_metadata",
                        "/api/admin/keys",
                        Map.of(
                                "q",
                                "rsa",
                                "active",
                                false,
                                "page",
                                2,
                                "size",
                                10,
                                "sort",
                                "createdAt,desc"));
    }

    @Test
    void rejectsInvalidPaginationBeforeCallingApi() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.listSigningKeyMetadata(null, null, -1, 20));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.listSigningKeyMetadata(null, null, 0, 101));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> tools.listSigningKeyMetadata("x".repeat(257), null, 0, 20));
        verifyNoInteractions(apiClient);
    }
}
