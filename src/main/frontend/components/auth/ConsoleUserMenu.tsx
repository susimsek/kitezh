import Image from "next/image";
import { useState } from "react";
import { Dropdown, Spinner } from "react-bootstrap";
import { ActionIcon } from "@/components/shared/ActionIcon";
import { Icon } from "@/components/shared/Icon";

export function ConsoleUserMenu({
  username,
  accountHref,
  accountLabel,
  logoutLabel,
  signedInAsLabel,
  onLogout,
  avatarSrc,
}: {
  username: string;
  accountHref: string;
  accountLabel: string;
  logoutLabel: string;
  signedInAsLabel: string;
  onLogout: () => void | Promise<void>;
  avatarSrc?: string | null;
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const initial = username.trim().charAt(0).toUpperCase() || "?";
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <Dropdown align="end">
      <Dropdown.Toggle
        variant="link"
        className="console-user-toggle d-flex align-items-center gap-2 text-decoration-none"
        aria-label={username}
      >
        <span className="console-user-avatar" aria-hidden="true">
          {avatarSrc && !avatarFailed && (
            <Image
              src={avatarSrc}
              alt=""
              width={32}
              height={32}
              unoptimized
              className="console-user-avatar-image"
              onError={() => setAvatarFailed(true)}
            />
          )}
          <span className={avatarFailed ? undefined : "visually-hidden"}>{initial}</span>
        </span>
        <span className="console-user-name d-none d-md-inline text-truncate">{username}</span>
      </Dropdown.Toggle>
      <Dropdown.Menu className="console-user-menu shadow-sm">
        <div className="px-3 py-2 border-bottom">
          <div className="small text-body-secondary">{signedInAsLabel}</div>
          <div className="fw-semibold text-truncate">{username}</div>
        </div>
        <Dropdown.Item href={accountHref}>
          <Icon icon="user" className="me-2" />
          {accountLabel}
        </Dropdown.Item>
        <Dropdown.Divider />
        <Dropdown.Item disabled={loggingOut} onClick={() => void handleLogout()}>
          {loggingOut ? (
            <Spinner animation="border" aria-hidden="true" className="me-2" size="sm" />
          ) : (
            <ActionIcon action="logout" />
          )}
          {logoutLabel}
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}
