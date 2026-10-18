type ResettablePreference = {
  reset: () => Promise<boolean>;
  restore: () => Promise<boolean>;
};

export async function resetSettingsPreferences(
  locale: ResettablePreference,
  theme: ResettablePreference,
): Promise<boolean> {
  const [localeReset, themeReset] = await Promise.all([
    locale.reset(),
    theme.reset(),
  ]);

  if (localeReset && !themeReset) await locale.restore();
  if (themeReset && !localeReset) await theme.restore();

  return localeReset && themeReset;
}
