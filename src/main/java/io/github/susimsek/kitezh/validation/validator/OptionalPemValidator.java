package io.github.susimsek.kitezh.validation.validator;

import io.github.susimsek.kitezh.web.admin.validation.OptionalPem;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class OptionalPemValidator implements ConstraintValidator<OptionalPem, String> {

    private String label;

    @Override
    public void initialize(OptionalPem annotation) {
        label = annotation.label();
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return true;
        }
        String pem = value.trim();
        return pem.startsWith("-----BEGIN " + label + "-----")
                && pem.endsWith("-----END " + label + "-----")
                && pem.contains("\n");
    }
}
