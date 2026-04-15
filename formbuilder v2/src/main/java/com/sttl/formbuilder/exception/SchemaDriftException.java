package com.sttl.formbuilder.exception;

/**
 * Thrown when a discrepancy is detected between the form definition 
 * and the actual database table structure.
 */
public class SchemaDriftException extends RuntimeException {
    public SchemaDriftException(String message) {
        super(message);
    }
}
