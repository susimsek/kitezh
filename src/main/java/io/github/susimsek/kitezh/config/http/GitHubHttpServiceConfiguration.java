package io.github.susimsek.kitezh.config.http;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import org.springframework.web.client.support.RestClientHttpServiceGroupConfigurer;

@Configuration(proxyBeanMethods = false)
public class GitHubHttpServiceConfiguration {

    private static final String GITHUB_RELEASE_GROUP = "github-release";

    @Bean
    RestClientHttpServiceGroupConfigurer githubHttpServiceGroupConfigurer(
            GitHubApiProperties properties) {
        return groups ->
                groups.filterByName(GITHUB_RELEASE_GROUP)
                        .forEachClient(
                                (group, builder) -> {
                                    if (StringUtils.hasText(properties.token())) {
                                        builder.requestInterceptor(
                                                (request, body, execution) -> {
                                                    request.getHeaders()
                                                            .setBearerAuth(properties.token());
                                                    return execution.execute(request, body);
                                                });
                                    }
                                });
    }
}
