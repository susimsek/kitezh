import { Image, type ImageStyle, type StyleProp } from "react-native";

const kitezhIcon = require("../../assets/icon.png");

type BrandMarkProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function BrandMark({ size = 64, style }: BrandMarkProps) {
  return (
    <Image
      accessible
      accessibilityLabel="Kitezh logo"
      accessibilityRole="image"
      resizeMode="contain"
      source={kitezhIcon}
      style={[{ height: size, width: size }, style]}
      testID="kitezh-brand-mark"
    />
  );
}
