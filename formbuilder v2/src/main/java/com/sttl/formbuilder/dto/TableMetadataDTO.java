package com.sttl.formbuilder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TableMetadataDTO {
    private String tableName;
    private String displayName;
}
