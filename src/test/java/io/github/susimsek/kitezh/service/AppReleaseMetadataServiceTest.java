package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import io.github.susimsek.kitezh.config.http.HttpServiceClientFactory;
import io.github.susimsek.kitezh.dto.release.AppReleaseMetadataDTO;
import io.github.susimsek.kitezh.dto.release.GitHubReleaseAssetDTO;
import io.github.susimsek.kitezh.dto.release.GitHubReleaseDTO;
import io.github.susimsek.kitezh.service.client.GitHubReleaseClient;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class AppReleaseMetadataServiceTest {

    @Test
    void rejectsMissingReleaseTagAndAssets() {
        GitHubReleaseClient client = mock(GitHubReleaseClient.class);
        AppReleaseMetadataService service = new AppReleaseMetadataService(client);

        when(client.latest()).thenReturn(null);
        assertThatThrownBy(service::getLatestReleaseMetadata)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("GitHub returned an incomplete application release.");

        when(client.latest()).thenReturn(new GitHubReleaseDTO(null, List.of()));
        assertThatThrownBy(service::getLatestReleaseMetadata)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("GitHub returned an incomplete application release.");

        when(client.latest()).thenReturn(new GitHubReleaseDTO("1.2.3", null));
        assertThatThrownBy(service::getLatestReleaseMetadata)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("GitHub returned an incomplete application release.");
    }

    @Test
    void returnsNoAssetLinksWhenReleaseContainsNoAllowlistedAssets() {
        GitHubReleaseClient client = mock(GitHubReleaseClient.class);
        when(client.latest())
                .thenReturn(
                        new GitHubReleaseDTO(
                                "1.2.3",
                                List.of(
                                        new GitHubReleaseAssetDTO(null),
                                        new GitHubReleaseAssetDTO("SHA256SUMS"))));

        AppReleaseMetadataDTO release =
                new AppReleaseMetadataService(client).getLatestReleaseMetadata();

        assertThat(release.version()).isEqualTo("1.2.3");
        assertThat(release.assets()).isEmpty();
    }

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
                                    {"name": "kitezh-0.1.0-win-x64-portable.exe"},
                                    {"name": "kitezh-0.1.0-win-x64-appx.appx"},
                                    {"name": "kitezh-0.1.0-linux-x86_64.AppImage"},
                                    {"name": "kitezh-0.1.0-linux-amd64.deb"},
                                    {"name": "kitezh-0.1.0-linux-x86_64.rpm"},
                                    {"name": "kitezh-0.1.0-linux-amd64.snap"},
                                    {"name": "kitezh-0.1.0-linux-arm64.AppImage"},
                                    {"name": "kitezh-0.1.0-linux-arm64.deb"},
                                    {"name": "kitezh-0.1.0-macos-arm64.dmg"},
                                    {"name": "kitezh-0.1.0-macos-x64.dmg"},
                                    {"name": "kitezh-0.1.0-android.apk"},
                                    {"name": "kitezh-0.1.0-ios.ipa"},
                                    {"name": "kitezh-0.1.0-ios-unsigned.ipa"},
                                    {"name": null},
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
                        "windowsPortable",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-win-x64-portable.exe")
                .containsEntry(
                        "windowsAppx",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-win-x64-appx.appx")
                .containsEntry(
                        "linuxX64AppImage",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-linux-x86_64.AppImage")
                .containsEntry(
                        "linuxX64Deb",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-linux-amd64.deb")
                .containsEntry(
                        "linuxX64Rpm",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-linux-x86_64.rpm")
                .containsEntry(
                        "linuxX64Snap",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-linux-amd64.snap")
                .containsEntry(
                        "linuxArm64AppImage",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-linux-arm64.AppImage")
                .containsEntry(
                        "linuxArm64Deb",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-linux-arm64.deb")
                .containsEntry(
                        "macosAppleSilicon",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-macos-arm64.dmg")
                .containsEntry(
                        "macosIntel",
                        "https://github.com/susimsek/kitezh/releases/download/v0.1.0/"
                                + "kitezh-0.1.0-macos-x64.dmg")
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
                .hasSize(14);
        server.verify();
    }
}
