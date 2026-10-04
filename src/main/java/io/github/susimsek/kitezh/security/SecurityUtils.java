package io.github.susimsek.kitezh.security;

import java.util.Optional;
import lombok.experimental.UtilityClass;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.jwt.Jwt;

@UtilityClass
public class SecurityUtils {

    public static final String AUTHORITIES_CLAIM = "auth";

    public Optional<String> getCurrentUserLogin() {
        String principal = extractPrincipal(SecurityContextHolder.getContext().getAuthentication());
        return Optional.ofNullable(principal);
    }

    private String extractPrincipal(Authentication authentication) {
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDetails userDetails) {
            return userDetails.getUsername();
        }
        if (principal instanceof Jwt jwt) {
            return jwt.getSubject();
        }
        if (principal instanceof String username) {
            return username;
        }
        return null;
    }
}
