package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import io.github.susimsek.kitezh.config.http.HttpServiceClientFactory;
import io.github.susimsek.kitezh.dto.desktop.DesktopReleaseDTO;
import io.github.susimsek.kitezh.service.client.DesktopReleaseClient;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class DesktopReleaseServiceTest {

    @Test
    void mapsAllowlistedAssetsFromLatestGitHubRelease() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.github.com");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.github.com/repos/susimsek/kitezh/releases/latest"))
                .andExpect(header(HttpHeaders.ACCEPT, "application/vnd.github+json"))
                .andExpect(header(HttpHeaders.USER_AGENT, "kitezh-download-page"))
                .andRespond(
                        withSuccess(
                                """
                                {
                                  "tag_name": "v0.1.0",
                                  "assets": [
                                    {"name": "kitezh-0.1.0-win-x64-setup.exe"},
                                    {"name": "kitezh-0.1.0-linux-x86_64.AppImage"},
                                    {"name": "kitezh-0.1.0-linux-arm64.deb"},
                                    {"name": "kitezh-0.1.0-macos-universal.dmg"},
                                    {"name": "kitezh-0.1.0-SHA256SUMS"}
                                  ]
                                }
                                """,
                                MediaType.APPLICATION_JSON));

        DesktopReleaseDTO release =
                new DesktopReleaseService(
                                HttpServiceClientFactory.create(
                                        DesktopReleaseClient.class, builder.build()))
                        .getLatestRelease();

        assertThat(release.tag()).isEqualTo("v0.1.0");
        assertThat(release.version()).isEqualTo("0.1.0");
        assertThat(release.releaseUrl())
                .isEqualTo("https://github.com/susimsek/kitezh/releases/tag/v0.1.0");
        assertThat(release.assets())
                .containsEntry(
                        "windowsInstaller",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-win-x64-setup.exe")
                .containsEntry(
                        "linuxX64AppImage",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-linux-x86_64.AppImage")
                .containsEntry(
                        "linuxArm64Deb",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-linux-arm64.deb")
                .containsEntry(
                        "macosUniversal",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-macos-universal.dmg")
                .doesNotContainKey("linuxX64Snap");
        server.verify();
    }
}
