import { act, renderHook } from "@testing-library/react";

import { useForm } from "./form";

type Values = {
  username: string;
  email: string;
};

describe("useForm", () => {
  it("clears a server field error when that field changes", () => {
    const { result } = renderHook(() =>
      useForm<Values>({ defaultValues: { username: "", email: "" } }),
    );

    act(() => {
      result.current.setError("username", { type: "server", message: "Already in use." });
    });
    expect(result.current.formState.errors.username?.message).toBe("Already in use.");

    act(() => {
      result.current.setValue("username", "new-user");
    });

    expect(result.current.formState.errors.username).toBeUndefined();
  });

  it("keeps non-server errors when a field changes", () => {
    const { result } = renderHook(() =>
      useForm<Values>({ defaultValues: { username: "", email: "" } }),
    );

    act(() => {
      result.current.setError("username", { type: "required", message: "Required." });
      result.current.setValue("username", "new-user");
    });

    expect(result.current.formState.errors.username?.message).toBe("Required.");
  });
});
