package com.sttl.formbuilder.dto;

import lombok.Getter;
import lombok.Setter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Getter
@Setter
public class CreateFormRequest {

	@NotBlank
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