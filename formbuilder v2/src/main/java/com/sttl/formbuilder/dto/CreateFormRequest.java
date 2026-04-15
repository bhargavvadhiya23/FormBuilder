package com.sttl.formbuilder.dto;

import jakarta.persistence.Column;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Getter
@Setter
public class CreateFormRequest {

	@NotBlank
	@Pattern(regexp = "^[a-zA-Z0-9_\\- ]+$", message = "Form Name can only contain letters, numbers, spaces, underscores, and hyphens")
	@Size(max = 150)
	private String name;

	private String description;

	private Boolean oneSubmissionPerUser;

	private java.time.LocalDateTime unpublishTime;

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}
}