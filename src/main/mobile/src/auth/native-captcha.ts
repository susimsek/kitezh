type RecaptchaClient = { execute(action: { action: string }): Promise<string> };
type NativeCaptchaSdk = {
  Recaptcha: { fetchClient(siteKey: string): Promise<RecaptchaClient> };
  RecaptchaAction: { custom(action: string): { action: string } };
};

const clients = new Map<string, Promise<RecaptchaClient>>();
export const NATIVE_CAPTCHA_TIMEOUT_MS = 20_000;

/** Creates a short-lived, platform-attested reCAPTCHA Enterprise token. */
export async function createNativeCaptchaToken(
  siteKey: string,
  action: string,
  sdk?: NativeCaptchaSdk,
  timeoutMs = NATIVE_CAPTCHA_TIMEOUT_MS,
): Promise<string> {
  const key = siteKey.trim();
  const normalizedAction = action.trim();
  if (!key || !/^[A-Za-z0-9/]+$/.test(normalizedAction)) {
    throw new Error("native_captcha_configuration_invalid");
  }
  const provider = sdk ?? (await loadSdk());
  let client = clients.get(key);
  if (!client) {
    client = provider.Recaptcha.fetchClient(key);
    clients.set(key, client);
    void client.catch(() => clients.delete(key));
  }
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      clients.delete(key);
      reject(new Error("native_captcha_timeout"));
    }, timeoutMs);
  });
  let token: string;
  try {
    token = await Promise.race([
      (async () =>
        (await client).execute(
          provider.RecaptchaAction.custom(normalizedAction),
        ))(),
      timeout,
    ]);
  } catch (cause) {
    if (timedOut) clients.delete(key);
    throw cause;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
  if (!token.trim()) throw new Error("native_captcha_token_empty");
  return token;
}

async function loadSdk(): Promise<NativeCaptchaSdk> {
  return (await import(
    "@google-cloud/recaptcha-enterprise-react-native"
  )) as NativeCaptchaSdk;
}
