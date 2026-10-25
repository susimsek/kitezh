package io.github.susimsek.kitezh.validation.validator;

import io.github.susimsek.kitezh.web.admin.validation.OptionalPassword;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class OptionalPasswordValidator implements ConstraintValidator<OptionalPassword, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        return value == null || value.isBlank() || value.length() >= 8;
    }
}
