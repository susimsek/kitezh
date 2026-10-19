import type { ConfigContext, ExpoConfig } from "expo/config";
import {
  withAppBuildGradle,
  withDangerousMod,
  withProjectBuildGradle,
} from "expo/config-plugins";
import * as fs from "node:fs";
import * as path from "node:path";

function googleIosUrlScheme(clientId: string): string | null {
  const match = clientId.match(/^([0-9]+-[a-z0-9]+)\.apps\.googleusercontent\.com$/i);
  return match ? `com.googleusercontent.apps.${match[1]}` : null;
}

function withAndroidCoreLibraryDesugaring(config: ExpoConfig): ExpoConfig {
  return withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes("coreLibraryDesugaringEnabled true")) {
      contents = contents.replace(
        /android\s*\{/,
        (androidBlock) =>
          `${androidBlock}\n    compileOptions {\n        coreLibraryDesugaringEnabled true\n    }`,
      );
    }
    if (!contents.includes("com.android.tools:desugar_jdk_libs")) {
      contents = contents.replace(
        /dependencies\s*\{/,
        (dependenciesBlock) =>
          `${dependenciesBlock}\n    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")`,
      );
    }
    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

function withRecaptchaKotlinPlugin(config: ExpoConfig): ExpoConfig {
  return withDangerousMod(config, ["android", async (modConfig) => {
    const gradlePath = path.join(
      modConfig.modRequest.projectRoot,
      "node_modules",
      "@google-cloud",
      "recaptcha-enterprise-react-native",
      "android",
      "build.gradle",
    );
    const contents = await fs.promises.readFile(gradlePath, "utf8");
    const kotlinPlugin = 'apply plugin: "org.jetbrains.kotlin.android"';
    if (
      !contents.includes(kotlinPlugin) &&
      !contents.includes('apply plugin: "kotlin-android"')
    ) {
      const androidPlugin = 'apply plugin: "com.android.library"';
      if (!contents.includes(androidPlugin)) {
        throw new Error(
          "Could not patch the reCAPTCHA React Native Kotlin plugin declaration.",
        );
      }
      await fs.promises.writeFile(
        gradlePath,
        contents.replace(androidPlugin, `${androidPlugin}\n${kotlinPlugin}`),
      );
    }
    return modConfig;
  }]);
}

function withKotlinGradlePluginVersion(config: ExpoConfig): ExpoConfig {
  return withProjectBuildGradle(config, (modConfig) => {
    const plugin = "org.jetbrains.kotlin:kotlin-gradle-plugin";
    const versionedPlugin = `${plugin}:2.3.0`;
    modConfig.modResults.contents = modConfig.modResults.contents.replace(
      /classpath\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin['"]\)/,
      `classpath('${versionedPlugin}')`,
    );
    if (!modConfig.modResults.contents.includes(versionedPlugin)) {
      throw new Error("Could not set the Kotlin Gradle plugin version to 2.3.0.");
    }
    return modConfig;
  });
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
  const iosUrlScheme = googleIosUrlScheme(iosClientId);
  const plugins = (config.plugins ?? []).filter(
    (plugin) =>
      !(
        Array.isArray(plugin) &&
        plugin[0] === "@react-native-google-signin/google-signin"
      ) && plugin !== "@react-native-google-signin/google-signin",
  );
  plugins.push([
    "expo-build-properties",
    { android: { kotlinVersion: "2.3.0" }, ios: { useFrameworks: "static" } },
  ]);
  if (iosUrlScheme) {
    plugins.push([
      "@react-native-google-signin/google-signin",
      { iosUrlScheme },
    ]);
  }
  return withRecaptchaKotlinPlugin(
    withKotlinGradlePluginVersion(
      withAndroidCoreLibraryDesugaring({ ...config, plugins } as ExpoConfig),
    ),
  );
};
