package io.github.susimsek.kitezh.config.http;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.URI;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpMethod;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.mock.http.client.MockClientHttpResponse;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientHttpServiceGroupConfigurer;
import org.springframework.web.service.registry.HttpServiceGroupConfigurer;

class GitHubHttpServiceConfigurationTest {

    @Test
    void addsBearerTokenToGitHubReleaseRequests() throws Exception {
        RestClient.Builder builder = mock(RestClient.Builder.class);
        RestClientHttpServiceGroupConfigurer.Groups<RestClient.Builder> groups =
                mock(RestClientHttpServiceGroupConfigurer.Groups.class);
        when(groups.filterByName("github-release")).thenReturn(groups);
        doAnswer(
                        invocation -> {
                            HttpServiceGroupConfigurer.ClientCallback<RestClient.Builder> callback =
                                    invocation.getArgument(0);
                            callback.withClient(null, builder);
                            return null;
                        })
                .when(groups)
                .forEachClient(any(HttpServiceGroupConfigurer.ClientCallback.class));

        GitHubHttpServiceConfiguration configuration = new GitHubHttpServiceConfiguration();
        configuration
                .githubHttpServiceGroupConfigurer(new GitHubApiProperties("github-token"))
                .configureGroups(groups);

        ArgumentCaptor<org.springframework.http.client.ClientHttpRequestInterceptor> captor =
                ArgumentCaptor.forClass(
                        org.springframework.http.client.ClientHttpRequestInterceptor.class);
        verify(builder).requestInterceptor(captor.capture());

        MockClientHttpRequest request =
                new MockClientHttpRequest(HttpMethod.GET, URI.create("https://api.github.com"));
        MockClientHttpResponse response = new MockClientHttpResponse(new byte[0], 200);
        assertThat(
                        captor.getValue()
                                .intercept(
                                        request, new byte[0], (ignored, ignoredBody) -> response))
                .isSameAs(response);
        assertThat(request.getHeaders().getFirst("Authorization")).isEqualTo("Bearer github-token");
    }

    @Test
    void leavesGitHubRequestsUnauthenticatedWithoutToken() {
        RestClient.Builder builder = mock(RestClient.Builder.class);
        RestClientHttpServiceGroupConfigurer.Groups<RestClient.Builder> groups =
                mock(RestClientHttpServiceGroupConfigurer.Groups.class);
        when(groups.filterByName("github-release")).thenReturn(groups);
        doAnswer(
                        invocation -> {
                            HttpServiceGroupConfigurer.ClientCallback<RestClient.Builder> callback =
                                    invocation.getArgument(0);
                            callback.withClient(null, builder);
                            return null;
                        })
                .when(groups)
                .forEachClient(any(HttpServiceGroupConfigurer.ClientCallback.class));

        new GitHubHttpServiceConfiguration()
                .githubHttpServiceGroupConfigurer(new GitHubApiProperties(""))
                .configureGroups(groups);

        verify(builder, never()).requestInterceptor(any());
    }
}
