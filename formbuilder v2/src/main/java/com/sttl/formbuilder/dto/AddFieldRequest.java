package com.sttl.formbuilder.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AddFieldRequest {

	private String fieldKey;

	@NotBlank(message = "Field label is required")
	private String fieldLabel;

	@NotBlank(message = "Field type is required")
	private String fieldType;

	@NotNull(message = "Required flag must be specified")
	private Boolean required = false;

	@NotNull(message = "Field order is required")
	private Integer fieldOrder;

	// For MULTIPLE_CHOICE, CHECKBOXES, DROPDOWN, MC_GRID, CHECKBOX_GRID
	private Object options;

	// For LINEAR_SCALE and RATING
	private Integer minValue;
	private Integer maxValue;
	private String minLabel;
	private String maxLabel;

	// For NUMBER, DATE, TIME, DATE_TIME, MONTH, WEEK — min/max as string (null = no
	// constraint)
	private String minValueStr;
	private String maxValueStr;

	// Optional help/hint text shown below the question
	private String helpText;

	// ── Text validation settings ────────────────────────────────────────────────
	/** LETTERS / NUMBERS / BOTH / null */
	private String charType;

	/** Min character count (null = no limit) */
	private Integer minLength;

	/** Max character count (null = no limit) */
	private Integer maxLength;

	/** Trim leading/trailing spaces (default true) */
	private Boolean trimWhitespace = true;

	/** Collapse internal whitespace (default true) */
	private Boolean removeExtraSpaces = true;

	/** Allow special characters (default true) */
	private Boolean allowSpecialChars = true;

	/** Custom regex pattern (null = none) */
	private String customRegex;

	/** Comma-separated allowed file categories or extensions */
	private String allowedFileTypes;

	// For dynamic options
	private String dataSourceTable;
	private String dataSourceColumn;

	private Boolean isUnique = false;

	private String defaultValue;

	private String customPlaceholder;
}