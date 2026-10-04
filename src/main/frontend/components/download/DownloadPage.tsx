"use client";

import { Button, Col, Container, Row, Stack } from "react-bootstrap";

import type { Dictionary } from "@/i18n/get-dictionary";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { Icon, type IconName } from "@/components/shared/Icon";

const RELEASES_URL =
  "https://github.com/susimsek/spring-authorization-server-samples/releases/latest";
const DOWNLOAD_URL =
  "https://github.com/susimsek/spring-authorization-server-samples/releases/latest/download";

type DownloadAsset = {
  file: string;
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
  groups: DownloadGroup[];
};

const platformAssets = {
  windows: {
    installer: "spring-authorization-server-0.1.0-win-x64-setup.exe",
    portable: "spring-authorization-server-0.1.0-win-x64-portable.exe",
    appx: "spring-authorization-server-0.1.0-win-x64-appx.appx",
  },
  linux: {
    x64: {
      appImage: "spring-authorization-server-0.1.0-linux-x86_64.AppImage",
      deb: "spring-authorization-server-0.1.0-linux-amd64.deb",
      rpm: "spring-authorization-server-0.1.0-linux-x86_64.rpm",
      snap: "spring-authorization-server-0.1.0-linux-amd64.snap",
    },
    arm64: {
      appImage: "spring-authorization-server-0.1.0-linux-arm64.AppImage",
      deb: "spring-authorization-server-0.1.0-linux-arm64.deb",
    },
  },
  macos: {
    universal: "spring-authorization-server-0.1.0-macos-universal.dmg",
    intel: "spring-authorization-server-0.1.0-macos-x64.dmg",
  },
};

function asset(file: string, label: string): DownloadAsset {
  return { file, label };
}

function DownloadLink({ asset: downloadAsset }: { asset: DownloadAsset }) {
  return (
    <Button
      as="a"
      href={`${DOWNLOAD_URL}/${downloadAsset.file}`}
      variant="primary"
      className="download-asset-button"
      download
    >
      <ActionIcon action="download" />
      {downloadAsset.label}
    </Button>
  );
}

export function DownloadPage({ dictionary }: { dictionary: Dictionary }) {
  const copy = dictionary.download;
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
  ];

  return (
    <main className="download-page py-4 py-md-5">
      <Container>
        <Stack gap={2} className="download-page-heading text-center mx-auto mb-4 mb-md-5">
          <span className="text-primary text-uppercase fw-semibold small">{copy.eyebrow}</span>
          <h1 className="display-5 fw-bold mb-0">{copy.title}</h1>
          <p className="lead text-body-secondary mb-0">{copy.subtitle}</p>
        </Stack>

        <Row className="download-platforms g-4 g-lg-5 justify-content-center">
          {platforms.map((platform) => (
            <Col key={platform.title} xs={12} md={4}>
              <section className="download-platform h-100">
                <div className="download-platform-icon text-primary mb-3" aria-hidden="true">
                  <Icon icon={platform.icon} size="3x" />
                </div>
                <h2 className="h3 mb-2">{platform.title}</h2>
                <p className="text-body-secondary mb-4">{platform.description}</p>
                <Stack gap={4}>
                  {platform.groups.map((group) => (
                    <div key={group.label}>
                      <h3 className="h6 text-uppercase text-body-secondary mb-2">{group.label}</h3>
                      <div className="download-asset-grid">
                        {group.assets.map((downloadAsset) => (
                          <DownloadLink key={downloadAsset.file} asset={downloadAsset} />
                        ))}
                      </div>
                    </div>
                  ))}
                </Stack>
              </section>
            </Col>
          ))}
        </Row>

        <div className="download-page-footer text-center mt-4 mt-md-5">
          <p className="text-body-secondary mb-3">{copy.checksums}</p>
          <Stack direction="horizontal" gap={2} className="justify-content-center flex-wrap">
            <Button as="a" href={`${DOWNLOAD_URL}/SHA256SUMS`} variant="secondary" download>
              <ActionIcon action="download" />
              {copy.downloadChecksums}
            </Button>
            <Button as="a" href={RELEASES_URL} variant="secondary" target="_blank" rel="noreferrer">
              {copy.releaseNotes}
            </Button>
          </Stack>
        </div>
      </Container>
    </main>
  );
}
