"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, Button, Col, Container, Row, Spinner, Stack } from "react-bootstrap";

import type { Dictionary } from "@/i18n/get-dictionary";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { Icon, type IconName } from "@/components/shared/Icon";
import {
  DESKTOP_RELEASES_URL,
  fetchLatestDesktopRelease,
  findReleaseAssetUrl,
  type DesktopRelease,
} from "@/lib/desktop-downloads";

type DownloadAsset = {
  matcher: RegExp;
  label: string;
};

type DownloadGroup = {
  label: string;
  assets: DownloadAsset[];
};

type DownloadPlatform = {
  icon: IconName;
  title: string;
  description: string;
  installationNote?: string;
  helpLinks?: { label: string; href: string }[];
  groups: DownloadGroup[];
};

const platformAssets = {
  windows: {
    installer: /-win-x64-setup\.exe$/,
    portable: /-win-x64-portable\.exe$/,
    appx: /-win-x64-appx\.appx$/,
  },
  linux: {
    x64: {
      appImage: /-linux-x86_64\.AppImage$/,
      deb: /-linux-amd64\.deb$/,
      rpm: /-linux-x86_64\.rpm$/,
      snap: /-linux-amd64\.snap$/,
    },
    arm64: {
      appImage: /-linux-arm64\.AppImage$/,
      deb: /-linux-arm64\.deb$/,
    },
  },
  macos: {
    universal: /-macos-universal\.dmg$/,
    intel: /-macos-x64\.dmg$/,
  },
  android: /-android\.apk$/,
  ios: /-ios(?:-unsigned)?\.ipa$/,
  iosSigned: /-ios\.ipa$/,
};

function asset(matcher: RegExp, label: string): DownloadAsset {
  return { matcher, label };
}

function DownloadLink({
  asset: downloadAsset,
  release,
  unavailableLabel,
}: {
  asset: DownloadAsset;
  release: DesktopRelease | null;
  unavailableLabel: string;
}) {
  const href = findReleaseAssetUrl(release, downloadAsset.matcher);
  if (!href) {
    return (
      <div className="download-asset-unavailable">
        <Button
          type="button"
          variant="primary"
          className="download-asset-button"
          disabled
          aria-disabled="true"
        >
          <ActionIcon action="download" />
          {downloadAsset.label}
        </Button>
        <span className="small text-body-secondary">{unavailableLabel}</span>
      </div>
    );
  }

  return (
    <Button as="a" href={href} variant="primary" className="download-asset-button" download>
      <ActionIcon action="download" />
      {downloadAsset.label}
    </Button>
  );
}

export function DownloadPage({ dictionary }: { dictionary: Dictionary }) {
  const copy = dictionary.download;
  const [release, setRelease] = useState<DesktopRelease | null>(null);
  const [releaseLoading, setReleaseLoading] = useState(true);
  const [releaseError, setReleaseError] = useState(false);
  const signedIpa = findReleaseAssetUrl(release, platformAssets.iosSigned);

  const fetchRelease = useCallback((signal?: AbortSignal) => {
    return fetchLatestDesktopRelease(signal)
      .then((latestRelease) => {
        setRelease(latestRelease);
        setReleaseLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setReleaseLoading(false);
        setReleaseError(true);
        console.warn("Unable to resolve the latest desktop release", error);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchRelease(controller.signal);
    return () => controller.abort();
  }, [fetchRelease]);

  const platforms: DownloadPlatform[] = [
    {
      icon: "windows",
      title: copy.windows.title,
      description: copy.windows.description,
      groups: [
        {
          label: copy.windows.architecture,
          assets: [
            asset(platformAssets.windows.installer, copy.windows.assets.installer),
            asset(platformAssets.windows.portable, copy.windows.assets.portable),
            asset(platformAssets.windows.appx, copy.windows.assets.appx),
          ],
        },
      ],
    },
    {
      icon: "linux",
      title: copy.linux.title,
      description: copy.linux.description,
      groups: [
        {
          label: copy.linux.architectures.x64,
          assets: [
            asset(platformAssets.linux.x64.appImage, copy.linux.assets.appImage),
            asset(platformAssets.linux.x64.deb, copy.linux.assets.deb),
            asset(platformAssets.linux.x64.rpm, copy.linux.assets.rpm),
            asset(platformAssets.linux.x64.snap, copy.linux.assets.snap),
          ],
        },
        {
          label: copy.linux.architectures.arm64,
          assets: [
            asset(platformAssets.linux.arm64.appImage, copy.linux.assets.appImage),
            asset(platformAssets.linux.arm64.deb, copy.linux.assets.deb),
          ],
        },
      ],
    },
    {
      icon: "apple",
      title: copy.macos.title,
      description: copy.macos.description,
      groups: [
        {
          label: copy.macos.architecture,
          assets: [
            asset(platformAssets.macos.universal, copy.macos.assets.universal),
            asset(platformAssets.macos.intel, copy.macos.assets.intel),
          ],
        },
      ],
    },
    {
      icon: "android",
      title: copy.android.title,
      description: copy.android.description,
      installationNote: copy.android.installationNote,
      groups: [
        {
          label: copy.android.architecture,
          assets: [asset(platformAssets.android, copy.android.asset)],
        },
      ],
    },
    {
      icon: "apple",
      title: copy.ios.title,
      description: signedIpa ? copy.ios.signedDescription : copy.ios.description,
      installationNote: signedIpa ? copy.ios.signedInstallationNote : copy.ios.installationNote,
      helpLinks: signedIpa
        ? undefined
        : [
            { label: copy.ios.altStore, href: "https://altstore.io/" },
            { label: copy.ios.sideloadly, href: "https://sideloadly.io/" },
          ],
      groups: [
        {
          label: copy.ios.architecture,
          assets: [asset(platformAssets.ios, signedIpa ? copy.ios.signedAsset : copy.ios.asset)],
        },
      ],
    },
  ];

  return (
    <main className="download-page py-4 py-md-5">
      <Container>
        <Stack gap={2} className="download-page-heading text-center mx-auto mb-4 mb-md-5">
          <span className="text-primary text-uppercase fw-semibold small">{copy.eyebrow}</span>
          <h1 className="display-5 fw-bold mb-0">{copy.title}</h1>
          <p className="lead text-body-secondary mb-0">{copy.subtitle}</p>
        </Stack>

        {releaseLoading ? (
          <div
            className="download-release-loading d-flex flex-column align-items-center justify-content-center gap-3 py-5"
            role="status"
          >
            <Spinner animation="border" aria-hidden="true" />
            <span>{copy.loading}</span>
          </div>
        ) : releaseError ? (
          <Alert variant="danger" className="download-release-error text-center mx-auto">
            {copy.loadError}
          </Alert>
        ) : (
          <Row className="download-platforms g-4 g-lg-5 justify-content-center">
            {platforms.map((platform) => (
              <Col key={platform.title} xs={12} md={6} lg={4}>
                <section className="download-platform h-100">
                  <div className="download-platform-icon text-primary mb-3" aria-hidden="true">
                    <Icon icon={platform.icon} size="3x" />
                  </div>
                  <h2 className="h3 mb-2">{platform.title}</h2>
                  <p className="text-body-secondary mb-4">{platform.description}</p>
                  <Stack gap={4}>
                    {platform.groups.map((group) => (
                      <div key={group.label}>
                        <h3 className="h6 text-uppercase text-body-secondary mb-2">
                          {group.label}
                        </h3>
                        <div className="download-asset-grid">
                          {group.assets.map((downloadAsset) => (
                            <DownloadLink
                              key={downloadAsset.label}
                              asset={downloadAsset}
                              release={release}
                              unavailableLabel={copy.unavailable}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </Stack>
                  {platform.installationNote && (
                    <p className="download-installation-note small text-body-secondary mt-3 mb-0">
                      {platform.installationNote}
                    </p>
                  )}
                  {platform.helpLinks && (
                    <div className="download-installation-links d-flex flex-wrap gap-3 mt-2">
                      {platform.helpLinks.map((link) => (
                        <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                          {link.label}
                        </a>
                      ))}
                    </div>
                  )}
                </section>
              </Col>
            ))}
          </Row>
        )}

        {!releaseLoading && !releaseError && (
          <div className="download-page-footer text-center mt-4 mt-md-5">
            <p className="text-body-secondary mb-3">{copy.checksums}</p>
            <Stack direction="horizontal" gap={2} className="justify-content-center flex-wrap">
              <Button
                as="a"
                href="https://github.com/susimsek/kitezh/releases/latest/download/SHA256SUMS"
                variant="secondary"
                download
              >
                <ActionIcon action="download" />
                {copy.downloadChecksums}
              </Button>
              <Button
                as="a"
                href={DESKTOP_RELEASES_URL}
                variant="secondary"
                target="_blank"
                rel="noreferrer"
              >
                {copy.releaseNotes}
              </Button>
            </Stack>
          </div>
        )}
      </Container>
    </main>
  );
}
