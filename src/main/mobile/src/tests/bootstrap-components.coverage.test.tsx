import { render, screen } from "@/testing/native-testing-library";
import { AppIcon } from "@/components/AppIcon";
import { BrandMark } from "@/components/BrandMark";

jest.mock("@fortawesome/react-native-fontawesome", () => ({
  FontAwesomeIcon: (props: Record<string, unknown>) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, { testID: "font-awesome-icon", ...props });
  },
}));

test("BrandMark exposes its accessible image and applies custom sizing", () => {
  render(<BrandMark size={48} style={{ opacity: 0.8 }} />);

  const image = screen.getByTestId("kitezh-brand-mark");
  expect(image.type).toBe("Image");
  expect(image.props.accessibilityLabel).toBe("Kitezh logo");
  expect(image.props.accessibilityRole).toBe("image");
  expect(image.props.style).toEqual([
    { height: 48, width: 48 },
    { opacity: 0.8 },
  ]);
});

test("BrandMark uses its default dimensions", () => {
  render(<BrandMark />);

  expect(screen.getByTestId("kitezh-brand-mark").props.style).toEqual([
    { height: 64, width: 64 },
    undefined,
  ]);
});

test("AppIcon resolves the supported icon names to icon definitions", () => {
  const names = [
    "add", "bell", "arrowLeft", "arrowRight", "check", "delete", "disable",
    "edit", "enable", "logout", "remove", "reset", "save", "gear", "globe",
    "home", "layers", "moon", "shield", "send", "sun", "trash", "upload", "user",
  ] as const;

  for (const name of names) {
    const { unmount } = render(<AppIcon name={name} />);
    expect(screen.getByTestId("font-awesome-icon").props.icon).toBeTruthy();
    unmount();
  }
});
