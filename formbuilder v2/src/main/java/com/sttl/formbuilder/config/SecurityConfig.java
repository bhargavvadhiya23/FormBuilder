package com.sttl.formbuilder.config;

import com.sttl.formbuilder.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.session.HttpSessionEventPublisher;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    /** Injected from application.properties — e.g. /api/v1 */
    @Value("${api.base-path}")
    private String apiBasePath;

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userService);
        provider.setPasswordEncoder(passwordEncoder);
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public HttpSessionEventPublisher httpSessionEventPublisher() {
        return new HttpSessionEventPublisher();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        // Derive all versioned path prefixes from the single configurable property
        String adminBase   = apiBasePath + "/admin";
        String authBase    = apiBasePath + "/auth";
        String filesBase   = apiBasePath + "/files";
        String publishBase = apiBasePath + "/publish";

        http
                // Disable CSRF for REST API (frontend uses sessions with SameSite cookies)
                .csrf(csrf -> csrf.disable())

                // Session management — use existing session if present, create one for
                // authenticated requests
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                        .maximumSessions(5) // max concurrent sessions per user
                )

                // Security context stored in HTTP session
                .securityContext(ctx -> ctx
                        .securityContextRepository(new HttpSessionSecurityContextRepository()))

                // CORS — delegates to WebConfig
                .cors(cors -> cors.configure(http))

                // Route-level access control
                .authorizeHttpRequests(auth -> auth
                        // Public auth endpoints (admin login/register + user login/register)
                        .requestMatchers(
                                adminBase + "/auth/login",
                                adminBase + "/auth/register",
                                authBase  + "/login",
                                authBase  + "/register")
                        .permitAll()

                        // Public form endpoints (no authentication required)
                        .requestMatchers(
                                publishBase + "/**",
                                filesBase   + "/**")
                        .permitAll()

                        // Admin-only management routes
                        .requestMatchers(
                                adminBase + "/roles/**",
                                adminBase + "/users/**",
                                adminBase + "/approvals/**"
                        ).hasAnyRole("ADMIN", "USER")

                        // All admin routes accessible by either role
                        .requestMatchers(adminBase + "/**").hasAnyRole("ADMIN", "USER")

                        // All other versioned /api/** routes require authentication
                        .requestMatchers(apiBasePath + "/**").authenticated()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .anyRequest().authenticated())

                // Disable default form login and basic auth
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())

                // Return 401 JSON instead of redirect for unauthenticated requests
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(401);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"message\":\"Unauthorized - Please log in\"}");
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(403);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"message\":\"Forbidden - Insufficient permissions\"}");
                        }));

        return http.build();
    }
}