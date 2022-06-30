package org.nrg.xnatx.plugins.pixi;

import lombok.extern.slf4j.Slf4j;
import org.nrg.framework.annotations.XnatDataModel;
import org.nrg.framework.annotations.XnatPlugin;
import org.nrg.xdat.om.*;
import org.nrg.xnat.restlet.actions.importer.ImporterHandlerPackages;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;

@SuppressWarnings("SpringJavaInjectionPointsAutowiringInspection")
@XnatPlugin(value = "PIXIPlugin", name = "PIXI Plugin",
            logConfigurationFile = "pixi-logback.xml",
            entityPackages = "org.nrg.xnatx.plugins.pixi.entities",
            dataModels = {@XnatDataModel(value = PixiAnimaldemographicdata.SCHEMA_ELEMENT_NAME,
                                         singular = "Animal Demographic Data",
                                         plural = "Animal Demographics",
                                         code = "AD"),
                          @XnatDataModel(value = PixiWeightdata.SCHEMA_ELEMENT_NAME,
                                         singular = "Weight",
                                         plural = "Weights",
                                         code = "WT"),
                          @XnatDataModel(value = PixiDrugtherapydata.SCHEMA_ELEMENT_NAME,
                                         singular = "Drug Therapy",
                                         plural = "Drug Therapies",
                                         code = "DT"),
                          @XnatDataModel(value = PixiCalipermeasurementdata.SCHEMA_ELEMENT_NAME,
                                         singular = "Caliper Measurement",
                                         plural = "Caliper Measurements",
                                         code = "CM"),
                          @XnatDataModel(value = PixiBlisessiondata.SCHEMA_ELEMENT_NAME,
                                         singular = "BLI Session",
                                         plural = "BLI Sessions",
                                         code = "BLI"),
                          @XnatDataModel(value = PixiBliscandata.SCHEMA_ELEMENT_NAME,
                                         singular = "BLI Scan",
                                         plural = "BLI Scans",
                                         code = "BLIScan")
                          })
@ComponentScan({"org.nrg.xnatx.plugins.pixi.entities",
                "org.nrg.xnatx.plugins.pixi.repositories",
                "org.nrg.xnatx.plugins.pixi.services.impl",
                "org.nrg.xnatx.plugins.pixi.rest",
                "org.nrg.xnatx.plugins.pixi.preferences",
                "org.nrg.xnatx.plugins.pixi.bli.helpers",
                "org.nrg.xnatx.plugins.pixi.bli.helpers.impl"
})
@Slf4j
public class PIXIPlugin {

    @Autowired
    public PIXIPlugin() { }

    @Bean
    public ImporterHandlerPackages pixiImporterHandlerPackages() {
        return new ImporterHandlerPackages("org.nrg.xnatx.plugins.pixi.bli.importer");
    }

}
