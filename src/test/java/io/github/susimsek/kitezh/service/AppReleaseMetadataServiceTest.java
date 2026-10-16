package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import io.github.susimsek.kitezh.config.http.HttpServiceClientFactory;
import io.github.susimsek.kitezh.dto.release.AppReleaseMetadataDTO;
import io.github.susimsek.kitezh.service.client.GitHubReleaseClient;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class AppReleaseMetadataServiceTest {

    @Test
    void mapsAllowlistedAssetsFromLatestGitHubRelease() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.github.com");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.github.com/repos/susimsek/kitezh/releases/latest"))
                .andExpect(header(HttpHeaders.ACCEPT, "application/vnd.github+json"))
                .andExpect(header(HttpHeaders.USER_AGENT, "kitezh-release-metadata"))
                .andRespond(
                        withSuccess(
                                """
                                {
                                  "tag_name": "v0.1.0",
                                  "assets": [
                                    {"name": "kitezh-0.1.0-win-x64-setup.exe"},
                                    {"name": "kitezh-0.1.0-linux-x86_64.AppImage"},
                                    {"name": "kitezh-0.1.0-linux-arm64.deb"},
                                    {"name": "kitezh-0.1.0-macos-arm64.dmg"},
                                    {"name": "kitezh-0.1.0-android.apk"},
                                    {"name": "kitezh-0.1.0-ios.ipa"},
                                    {"name": "kitezh-0.1.0-ios-unsigned.ipa"},
                                    {"name": "kitezh-0.1.0-SHA256SUMS"}
                                  ]
                                }
                                """,
                                MediaType.APPLICATION_JSON));

        AppReleaseMetadataDTO release =
                new AppReleaseMetadataService(
                                HttpServiceClientFactory.create(
                                        GitHubReleaseClient.class, builder.build()))
                        .getLatestReleaseMetadata();

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
                        "macosAppleSilicon",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-macos-arm64.dmg")
                .containsEntry(
                        "androidApk",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-android.apk")
                .containsEntry(
                        "iosIpa",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-ios.ipa")
                .containsEntry(
                        "iosUnsignedIpa",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-ios-unsigned.ipa")
                .doesNotContainKey("linuxX64Snap");
        server.verify();
    }
}
