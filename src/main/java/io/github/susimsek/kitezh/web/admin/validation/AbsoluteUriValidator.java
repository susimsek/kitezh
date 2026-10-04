package io.github.susimsek.kitezh.web.admin.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.net.URI;

public class AbsoluteUriValidator implements ConstraintValidator<AbsoluteUri, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return false;
        }
        try {
            URI uri = URI.create(value);
            return uri.isAbsolute() && uri.getScheme() != null && uri.getFragment() == null;
        } catch (IllegalArgumentException _) {
            return false;
        }
    }
}
