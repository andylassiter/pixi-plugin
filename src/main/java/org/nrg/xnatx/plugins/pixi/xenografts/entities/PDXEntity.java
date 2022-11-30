package org.nrg.xnatx.plugins.pixi.xenografts.entities;

import lombok.*;
import lombok.extern.slf4j.Slf4j;

import javax.annotation.Nullable;
import javax.persistence.Entity;
import javax.validation.constraints.NotBlank;

@Entity
@Data
@NoArgsConstructor
@EqualsAndHashCode(callSuper = false)
@Slf4j
public class PDXEntity extends XenograftEntity {

    @Builder
    public PDXEntity(@NotBlank final String sourceId,
                     @Nullable final String source,
                     @Nullable final String sourceURL,
                     @Nullable final String createdBy) {
        super(sourceId, source, sourceURL, createdBy);
    }

}
