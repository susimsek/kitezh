package io.github.susimsek.kitezh.service.client;

import io.github.susimsek.kitezh.dto.desktop.GitHubReleaseDTO;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;

/** Typed HTTP client for the public Kitezh GitHub release metadata. */
@HttpExchange(accept = "application/vnd.github+json", headers = "User-Agent=kitezh-download-page")
public interface DesktopReleaseClient {

    @GetExchange("/repos/susimsek/kitezh/releases/latest")
    GitHubReleaseDTO latest();
}
