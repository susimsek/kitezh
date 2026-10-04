package io.github.susimsek.kitezh.web.admin.validation;

import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.ElementType.PARAMETER;
import static java.lang.annotation.ElementType.TYPE_USE;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

@Documented
@Constraint(validatedBy = AbsoluteUriValidator.class)
@Retention(RUNTIME)
@Target({FIELD, PARAMETER, TYPE_USE})
public @interface AbsoluteUri {

    String message() default "{app.api.problem.violation.uri}";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
