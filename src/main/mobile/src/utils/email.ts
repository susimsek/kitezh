export function isValidEmailAddress(value: string) {
  const atIndex = value.indexOf("@");
  const lastDotIndex = value.lastIndexOf(".");

  return (
    value.length <= 254 &&
    atIndex > 0 &&
    atIndex === value.lastIndexOf("@") &&
    value[atIndex + 1] !== "." &&
    lastDotIndex > atIndex + 1 &&
    lastDotIndex < value.length - 1 &&
    !/\s/.test(value)
  );
}
