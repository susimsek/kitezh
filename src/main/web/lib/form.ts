import { useEffect, useRef } from "react";
import {
  useForm as useReactHookForm,
  useWatch,
  type Control,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormClearErrors,
  type UseFormProps,
  type UseFormReturn,
  type UseFormSetFocus,
} from "react-hook-form";

function errorPaths(errors: FieldErrors, prefix = ""): string[] {
  return Object.entries(errors).flatMap(([name, error]) => {
    if (!error || typeof error !== "object") return [];
    const path = prefix ? `${prefix}.${name}` : name;
    if ("type" in error) return error.type === "server" ? [path] : [];
    return errorPaths(error as FieldErrors, path);
  });
}

function firstServerErrorPath(errors: FieldErrors, prefix = ""): string | undefined {
  for (const [name, error] of Object.entries(errors)) {
    if (!error || typeof error !== "object") continue;
    const path = prefix ? `${prefix}.${name}` : name;
    if ("type" in error) {
      if (error.type === "server") return path;
      continue;
    }
    const nestedPath = firstServerErrorPath(error as FieldErrors, path);
    if (nestedPath) return nestedPath;
  }
  return undefined;
}

function readPath(value: unknown, path: string): unknown {
  return path.split(/[.[\]]+/).reduce<unknown>((current, segment) => {
    if (!segment || current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function equalValues(previous: unknown, current: unknown): boolean {
  if (Object.is(previous, current)) return true;
  if (
    previous === null ||
    current === null ||
    typeof previous !== "object" ||
    typeof current !== "object"
  ) {
    return false;
  }
  try {
    return JSON.stringify(previous) === JSON.stringify(current);
  } catch {
    return false;
  }
}

function useClearServerErrorsOnChange<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues extends FieldValues | undefined = TFieldValues,
>(
  control: Control<TFieldValues, TContext, TTransformedValues>,
  errors: FieldErrors<TFieldValues>,
  clearErrors: UseFormClearErrors<TFieldValues>,
) {
  const values = useWatch<TFieldValues, TTransformedValues>({ control });
  const previousValues = useRef<unknown>(values);

  useEffect(() => {
    for (const path of errorPaths(errors)) {
      if (!equalValues(readPath(previousValues.current, path), readPath(values, path))) {
        clearErrors(path as Path<TFieldValues>);
      }
    }
    previousValues.current = values;
  }, [clearErrors, errors, values]);
}

function useFocusServerErrorOnSubmit<TFieldValues extends FieldValues>(
  errors: FieldErrors<TFieldValues>,
  submitCount: number,
  setFocus: UseFormSetFocus<TFieldValues>,
) {
  const lastFocusedError = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (submitCount === 0) return;
    const path = firstServerErrorPath(errors);
    if (!path) return;
    const focusKey = `${submitCount}:${path}`;
    if (lastFocusedError.current === focusKey) return;
    lastFocusedError.current = focusKey;
    setFocus(path as Path<TFieldValues>);
  }, [errors, setFocus, submitCount]);
}

export function useForm<
  TFieldValues extends FieldValues = FieldValues,
  TContext = unknown,
  TTransformedValues extends FieldValues | undefined = TFieldValues,
>(
  props?: UseFormProps<TFieldValues, TContext, TTransformedValues>,
): UseFormReturn<TFieldValues, TContext, TTransformedValues> {
  const form = useReactHookForm<TFieldValues, TContext, TTransformedValues>({
    shouldFocusError: true,
    ...props,
  });
  useClearServerErrorsOnChange(form.control, form.formState.errors, form.clearErrors);
  useFocusServerErrorOnSubmit(form.formState.errors, form.formState.submitCount, form.setFocus);
  return form;
}
