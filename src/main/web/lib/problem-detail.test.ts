import { applyProblemToForm, problemErrorCode, problemViolations } from "./problem-detail";

describe("problem detail helpers", () => {
  it("extracts valid violations and the error code", () => {
    const problem = {
      errorCode: "validation_failed",
      violations: [{ field: "clientId", message: "Client ID is required." }],
    };

    expect(problemViolations(problem)).toEqual([
      { field: "clientId", message: "Client ID is required." },
    ]);
    expect(problemErrorCode(problem)).toBe("validation_failed");
  });

  it("exposes a field-specific business error as a single violation", () => {
    expect(
      problemViolations({ detail: "Username is already registered.", field: "username" }),
    ).toEqual([{ field: "username", message: "Username is already registered." }]);
  });

  it("rejects malformed problem detail properties", () => {
    expect(problemViolations(null)).toEqual([]);
    expect(problemViolations({ violations: "clientId" })).toEqual([]);
    expect(problemViolations({ violations: [{ field: 42 }] })).toEqual([]);
    expect(problemErrorCode(null)).toBeUndefined();
    expect(problemErrorCode({ errorCode: 400 })).toBeUndefined();
  });

  it("applies only known violations to a form and returns the first field", () => {
    const setError = jest.fn();
    const result = applyProblemToForm(
      {
        violations: [
          { field: "email", message: "Email is already registered." },
          { field: "unknown", message: "Unknown field." },
        ],
      },
      setError,
      { fields: ["email"], fallbackMessage: "Invalid value." },
    );

    expect(setError).toHaveBeenCalledWith("email", {
      type: "server",
      message: "Email is already registered.",
    });
    expect(result).toEqual({
      handled: [{ field: "email", message: "Email is already registered." }],
      unhandled: [{ field: "unknown", message: "Unknown field." }],
      firstField: "email",
    });
  });
});
