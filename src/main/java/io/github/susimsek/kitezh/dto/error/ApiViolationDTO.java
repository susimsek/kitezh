package io.github.susimsek.kitezh.dto.error;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ElementKind;
import jakarta.validation.Path;
import org.jspecify.annotations.Nullable;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;

@Schema(name = "ApiViolation", description = "A field that failed request validation.")
public record ApiViolationDTO(
        @Schema(description = "JSON field name that failed validation.", example = "clientId")
                String field,
        @Schema(
                        description = "Localized reason why validation failed.",
                        example = "Enter a valid email address.")
                @Nullable String message) {

    private static final String REQUEST = "request";

    public ApiViolationDTO {
        field = normalizeField(field);
    }

    public static ApiViolationDTO from(ObjectError error, @Nullable String message) {
        String field = error instanceof FieldError fieldError ? fieldError.getField() : REQUEST;
        return new ApiViolationDTO(field, message);
    }

    public static ApiViolationDTO from(ConstraintViolation<?> violation) {
        String field = REQUEST;
        for (Path.Node node : violation.getPropertyPath()) {
            if (node.getName() != null
                    && (node.getKind() == ElementKind.PROPERTY
                            || node.getKind() == ElementKind.PARAMETER)) {
                field = node.getName();
            }
        }
        return new ApiViolationDTO(field, violation.getMessage());
    }

    private static String normalizeField(String field) {
        if (field == null || field.isBlank()) {
            return REQUEST;
        }
        int indexedField = field.indexOf('[');
        int nestedField = field.indexOf('.');
        int end = field.length();
        if (indexedField >= 0) {
            end = indexedField;
        }
        if (nestedField >= 0) {
            end = Math.min(end, nestedField);
        }
        String normalized = field.substring(0, end);
        return normalized.isBlank() ? REQUEST : normalized;
    }
}
