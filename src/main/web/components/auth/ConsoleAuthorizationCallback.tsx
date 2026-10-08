import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/routing/navigation";
import { Alert, Spinner } from "react-bootstrap";

type ConsoleAuthorizationCallbackProps = {
  completeAuthorization: (code: string, state: string) => Promise<string>;
  errorMessage: string;
};

export function ConsoleAuthorizationCallback({
  completeAuthorization,
  errorMessage,
}: ConsoleAuthorizationCallbackProps) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const completed = useRef(false);

  useEffect(() => {
    if (completed.current) return;
    completed.current = true;

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const code = hash.get("code") ?? query.get("code");
    const state = hash.get("state") ?? query.get("state");
    const error = hash.get("error") ?? query.get("error");
    window.history.replaceState(window.history.state, "", window.location.pathname);

    if (error || !code || !state) {
      queueMicrotask(() => setFailed(true));
      return;
    }

    void completeAuthorization(code, state)
      .then((returnTo) => router.replace(returnTo))
      .catch(() => setFailed(true));
  }, [completeAuthorization, router]);

  if (failed) return <Alert variant="danger">{errorMessage}</Alert>;

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary">
      <Spinner />
    </div>
  );
}
