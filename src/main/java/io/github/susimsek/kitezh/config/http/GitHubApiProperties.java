package io.github.susimsek.kitezh.config.http;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.github-api")
public record GitHubApiProperties(@DefaultValue("") String token) {}
