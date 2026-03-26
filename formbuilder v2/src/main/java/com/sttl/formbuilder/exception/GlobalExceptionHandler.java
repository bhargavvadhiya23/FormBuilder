package com.sttl.formbuilder.exception;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * Safe error messages that can be shown directly to the client.
     * These start with known prefixes that the application intentionally throws
     * as user-facing validation/business errors.
     */
    private static final String[] SAFE_PREFIXES = {
            // Validation / business errors — safe to expose
            "Field '", "Value for '", "The value for '", "\"",
            "Must be", "Must contain", "Does not match",
            "Special characters", "Please enter", "Please select",
            "Response is too long", "Date must", "Time must",
            "Week must", "Date/time must",
            "Cannot modify a published form",
            "This form is not published",
            "Form not found",
            "No valid data provided",
            "Field key", "A field with key",
            "Option value",
            "Cannot publish",
            "Already published",
            "Version not found",
            "This form is not published yet",
            "Business rule violation",
            "You do not have permission",
            "Input contains",
            "Input exceeds",
            "Rule not found",
            "Invalid operator",
            "Action type is required",
            "Rule name is required",
            "Maximum of",
            "A form with this name"
    };

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntimeException(RuntimeException ex) {

        String rawMessage = ex.getMessage();

        // Decide what to return to the client
        String clientMessage = toSafeMessage(rawMessage);

        Map<String, String> error = new HashMap<>();
        error.put("message", clientMessage);

        // Check if the message is "safe" (validation/business error)
        boolean isSafe = !clientMessage.equals("An unexpected error occurred. Please try again.");

        // If it's a permission error, return 403
        if (clientMessage.toLowerCase().contains("permission")) {
            return ResponseEntity.status(403).body(error);
        }

        // If it's a "not found" error, return 404
        if (clientMessage.toLowerCase().contains("not found")) {
            return ResponseEntity.status(404).body(error);
        }

        // If it's a safe message (validation/business), return 400 Bad Request
        if (isSafe) {
            return ResponseEntity.status(400).body(error);
        }

        return ResponseEntity.internalServerError().body(error);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, String>> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        log.error("Type mismatch error: {}", e.getMessage());
        Map<String, String> error = new HashMap<>();
        Class<?> requiredType = e.getRequiredType();
        String typeName = requiredType != null ? requiredType.getSimpleName() : "unknown";
        error.put("message", "Invalid parameter: " + e.getName() + " should be of type " + typeName);
        error.put("error", "Bad Request");
        return ResponseEntity.status(400).body(error);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException e) {
        log.error("Illegal argument error: {}", e.getMessage());
        Map<String, String> error = new HashMap<>();
        error.put("message", e.getMessage());
        error.put("error", "Bad Request");
        return ResponseEntity.status(400).body(error);
    }

    private String toSafeMessage(String message) {
        if (message == null)
            return "An unexpected error occurred. Please try again.";

        // Specific case-insensitive check for Business rule violations to ensure
        // details are kept
        if (message.toLowerCase().startsWith("business rule violation")) {
            return message;
        }

        for (String prefix : SAFE_PREFIXES) {
            if (message.startsWith(prefix))
                return message;
        }
        // Unknown / internal error — return generic message
        return "An unexpected error occurred. Please try again.";
    }
}