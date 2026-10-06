export type DesktopNotification = {
  on: (event: "click", listener: () => void) => void;
  show: () => void;
};

export type DesktopNotificationFactory = (options: {
  title: string;
  body: string;
}) => DesktopNotification;

export function showDesktopNotification(
  factory: DesktopNotificationFactory,
  title: string,
  body: string,
  onClick?: () => void,
) {
  const notification = factory({ title, body });
  if (onClick) notification.on("click", onClick);
  notification.show();
  return notification;
}
