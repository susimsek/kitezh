package io.github.susimsek.kitezh.service;

import io.github.susimsek.kitezh.dto.desktop.DesktopReleaseDTO;
import io.github.susimsek.kitezh.dto.desktop.GitHubReleaseAssetDTO;
import io.github.susimsek.kitezh.dto.desktop.GitHubReleaseDTO;
import io.github.susimsek.kitezh.service.client.DesktopReleaseClient;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DesktopReleaseService {

    public static final String LATEST_DESKTOP_RELEASE_CACHE = "desktopLatestRelease";

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
                    new AssetRule("macosUniversal", "-macos-universal.dmg"),
                    new AssetRule("macosIntel", "-macos-x64.dmg"));

    private final DesktopReleaseClient desktopReleaseClient;

    @Cacheable(cacheNames = LATEST_DESKTOP_RELEASE_CACHE, sync = true)
    public DesktopReleaseDTO getLatestRelease() {
        GitHubReleaseDTO release = desktopReleaseClient.latest();
        if (release == null || release.tagName() == null || release.assets() == null) {
            throw new IllegalStateException("GitHub returned an incomplete desktop release.");
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

        return new DesktopReleaseDTO(
                release.tagName(),
                version,
                "https://github.com/" + REPOSITORY + "/releases/tag/" + release.tagName(),
                assets);
    }

    private record AssetRule(String key, String suffix) {}
}
