package com.sttl.formbuilder.Enums;

/**
 * Fine-grained permission flags that can be assigned to an AppRole.
 * Permissions that touch Published forms are separated from their Draft equivalents
 * so that each can independently require admin approval.
 */
public enum Permission {

    // ----- Form creation -----
    /** User can create a new form (saves as DRAFT, admin publishes). */
    CREATE_DRAFT_FORM,

    // ----- Form editing -----
    /** User can edit a form that is still in DRAFT status. */
    EDIT_DRAFT_FORM,

    /** User can edit a form that has already been PUBLISHED. */
    EDIT_PUBLISHED_FORM,

    // ----- Form deletion -----
    /** User can delete a form that is in DRAFT status. */
    DELETE_DRAFT_FORM,

    /** User can request deletion of a PUBLISHED form (may require admin approval). */
    DELETE_PUBLISHED_FORM,

    // ----- Submission actions -----
    /** User can view all submissions for forms created under their admin. */
    VIEW_PUBLISHED_SUBMISSIONS
}
