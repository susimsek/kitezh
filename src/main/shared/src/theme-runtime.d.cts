declare const themeTokens: {
  readonly colors: {
    readonly light: Readonly<Record<string, string>>;
    readonly dark: Readonly<Record<string, string>>;
  };
  readonly typography: Readonly<Record<string, number>>;
  readonly controlSizes: Readonly<Record<string, number>>;
  readonly spacing: Readonly<Record<string, number>>;
  readonly radii: Readonly<Record<string, number>>;
};

export = themeTokens;
