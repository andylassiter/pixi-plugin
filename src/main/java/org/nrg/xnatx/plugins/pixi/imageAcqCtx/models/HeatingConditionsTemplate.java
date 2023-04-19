package org.nrg.xnatx.plugins.pixi.imageAcqCtx.models;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Used to store pixi:heatingConditionsData templates/protocols
 */
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Data
public class HeatingConditionsTemplate {

    private String name;
    private boolean defaultTemplate;
    private HeatingConditions heatingConditions;

}
