package io.github.susimsek.kitezh.web.admin.validation;

import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.ElementType.PARAMETER;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

/** Validates an optional PEM value using the supplied PEM label. */
@Documented
@Constraint(validatedBy = OptionalPemValidator.class)
@Retention(RUNTIME)
@Target({FIELD, PARAMETER})
public @interface OptionalPem {

    String message() default "{app.api.problem.violation.pem}";

    String label();

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
