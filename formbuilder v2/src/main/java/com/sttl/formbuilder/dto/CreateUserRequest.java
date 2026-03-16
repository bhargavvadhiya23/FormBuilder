package com.sttl.formbuilder.dto;


import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.Getter;

@Data
public class CreateUserRequest {


    @NotBlank
    @NotNull
    @NotEmpty
    @Email
    private String email;

    @NotBlank
    @NotNull
    @NotEmpty
    private String password;
}
