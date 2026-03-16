package com.sttl.formbuilder.entity;

import java.time.LocalDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "form_fields")
public class FormField {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "version_id", nullable = false)
	@JsonIgnore
	private FormVersion version;

	@Column(nullable = false)
	private String fieldKey;

	@Column(nullable = false)
	private String fieldLabel;

	@Column(nullable = false)
	private String fieldType;

	@Column(nullable = false)
	private Boolean required = false;

	@Column(nullable = false)
	private Integer fieldOrder = 1;

	// JSON array string for choice-type fields: ["Option A","Option B"]
	@Column(columnDefinition = "TEXT")
	private String options;

	// For LINEAR_SCALE / RATING
	private Integer minValue;
	private Integer maxValue;
	private String minLabel;
	private String maxLabel;

	// For NUMBER, DATE, TIME, DATE_TIME, MONTH, WEEK — min/max as string (null = no
	// constraint)
	@Column(length = 50)
	private String minValueStr;

	@Column(length = 50)
	private String maxValueStr;

	// Optional help/hint text shown below the question
	@Column(length = 500)
	private String helpText;

	// ── Text validation settings ────────────────────────────────────────────────
	// Applicable to: SHORT_ANSWER, PARAGRAPH, PASSWORD, SEARCH (full)
	// EMAIL, PHONE, URL (basic — minLength, maxLength, trim, regex)

	/**
	 * Character type restriction: LETTERS, NUMBERS, BOTH, or null (no restriction)
	 */
	@Column(length = 20)
	private String charType;

	/** Minimum character length (null = no minimum) */
	private Integer minLength;

	/** Maximum character length (null = no maximum) */
	private Integer maxLength;

	/** Trim leading/trailing whitespace before validation (default true) */
	private Boolean trimWhitespace = true;

	/** Collapse consecutive internal spaces to one (default true) */
	private Boolean removeExtraSpaces = true;

	/** Whether special characters (!@#$% etc.) are allowed (default true) */
	private Boolean allowSpecialChars = true;

	/** Custom regex pattern (null = no pattern) */
	@Column(length = 500)
	private String customRegex;

	/** Comma-separated allowed file categories or extensions (e.g., "IMAGE,PDF") */
	@Column(length = 500)
	private String allowedFileTypes;

	// For dynamic options (DROPDOWN)
	@Column(length = 100)
	private String dataSourceTable;

	@Column(length = 100)
	private String dataSourceColumn;

	@Column(nullable = false)
	private Boolean isUnique = false;

	// ───────────────────────────────────────────────────────────────────────────

	@Column(updatable = false)
	private LocalDateTime createdAt;

	@PrePersist
	protected void onCreate() {
		createdAt = LocalDateTime.now();
	}

	// Helper: returns parent version's id (for JSON serialisation)
	public UUID getVersionId() {
		return version != null ? version.getId() : null;
	}
}