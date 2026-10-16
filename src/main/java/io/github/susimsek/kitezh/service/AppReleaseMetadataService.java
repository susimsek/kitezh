package io.github.susimsek.kitezh.service;

import io.github.susimsek.kitezh.dto.release.AppReleaseMetadataDTO;
import io.github.susimsek.kitezh.dto.release.GitHubReleaseAssetDTO;
import io.github.susimsek.kitezh.dto.release.GitHubReleaseDTO;
import io.github.susimsek.kitezh.service.client.GitHubReleaseClient;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AppReleaseMetadataService {

    public static final String LATEST_APP_RELEASE_CACHE = "latestAppRelease";

    private static final String REPOSITORY = "susimsek/kitezh";

    private static final List<AssetRule> ASSET_RULES =
            List.of(
                    new AssetRule("windowsInstaller", "-win-x64-setup.exe"),
                    new AssetRule("windowsPortable", "-win-x64-portable.exe"),
                    new AssetRule("windowsAppx", "-win-x64-appx.appx"),
                    new AssetRule("linuxX64AppImage", "-linux-x86_64.AppImage"),
                    new AssetRule("linuxX64Deb", "-linux-amd64.deb"),
                    new AssetRule("linuxX64Rpm", "-linux-x86_64.rpm"),
                    new AssetRule("linuxX64Snap", "-linux-amd64.snap"),
                    new AssetRule("linuxArm64AppImage", "-linux-arm64.AppImage"),
                    new AssetRule("linuxArm64Deb", "-linux-arm64.deb"),
                    new AssetRule("macosAppleSilicon", "-macos-arm64.dmg"),
                    new AssetRule("macosIntel", "-macos-x64.dmg"),
                    new AssetRule("androidApk", "-android.apk"),
                    new AssetRule("iosIpa", "-ios.ipa"),
                    new AssetRule("iosUnsignedIpa", "-ios-unsigned.ipa"));

    private final GitHubReleaseClient gitHubReleaseClient;

    @Cacheable(cacheNames = LATEST_APP_RELEASE_CACHE, sync = true)
    public AppReleaseMetadataDTO getLatestReleaseMetadata() {
        GitHubReleaseDTO release = gitHubReleaseClient.latest();
        if (release == null || release.tagName() == null || release.assets() == null) {
            throw new IllegalStateException("GitHub returned an incomplete application release.");
        }

        String version = release.tagName().replaceFirst("^v", "");
        String baseUrl =
                "https://github.com/" + REPOSITORY + "/releases/download/" + release.tagName();
        Map<String, String> assets = new LinkedHashMap<>();
        ASSET_RULES.forEach(
                rule ->
                        release.assets().stream()
                                .map(GitHubReleaseAssetDTO::name)
                                .filter(name -> name != null && name.endsWith(rule.suffix()))
                                .findFirst()
                                .ifPresent(name -> assets.put(rule.key(), baseUrl + "/" + name)));

        return new AppReleaseMetadataDTO(
                release.tagName(),
                version,
                "https://github.com/" + REPOSITORY + "/releases/tag/" + release.tagName(),
                assets);
    }

    private record AssetRule(String key, String suffix) {}
}
