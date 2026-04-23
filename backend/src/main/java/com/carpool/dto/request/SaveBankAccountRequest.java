package com.carpool.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class SaveBankAccountRequest {
    @NotBlank
    private String accountHolderName;
    @NotBlank
    private String accountNumber;
    @NotBlank
    @Pattern(regexp = "^[A-Z]{4}0[A-Z0-9]{6}$", message = "Invalid IFSC code format")
    private String ifscCode;
    private String bankName;
}
