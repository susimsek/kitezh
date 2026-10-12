export function isValidEmail(value: string) {
  if (/\s/.test(value)) return false;

  const atIndex = value.indexOf("@");
  const domainSeparatorIndex = value.lastIndexOf(".");
  return (
    atIndex > 0 &&
    domainSeparatorIndex > atIndex + 1 &&
    domainSeparatorIndex < value.length - 1
  );
}
