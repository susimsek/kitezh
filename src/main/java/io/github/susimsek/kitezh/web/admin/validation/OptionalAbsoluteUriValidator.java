package io.github.susimsek.kitezh.web.admin.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.net.URI;

public class OptionalAbsoluteUriValidator
        implements ConstraintValidator<OptionalAbsoluteUri, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return true;
        }
        try {
            URI uri = URI.create(value.trim());
            return uri.isAbsolute() && uri.getScheme() != null && uri.getFragment() == null;
        } catch (IllegalArgumentException _) {
            return false;
        }
    }
}
