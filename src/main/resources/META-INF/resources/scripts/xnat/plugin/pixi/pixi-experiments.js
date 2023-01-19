/*
 * PIXI experiments
 *
 * experiment related functions
 */

console.debug('pixi-experiments.js');

var XNAT = getObject(XNAT || {});
XNAT.validate = getObject(XNAT.validate || {});
XNAT.plugin = getObject(XNAT.plugin || {});
XNAT.plugin.pixi = getObject(XNAT.plugin.pixi || {});
XNAT.plugin.pixi.experiments = getObject(XNAT.plugin.pixi.experiments || {});
XNAT.plugin.pixi.experiments.cellLine = getObject(XNAT.plugin.pixi.experiments.cellLine || {});
XNAT.plugin.pixi.experiments.pdx = getObject(XNAT.plugin.pixi.experiments.pdx || {});
XNAT.plugin.pixi.experiments.caliperMeasurement = getObject(XNAT.plugin.pixi.experiments.caliperMeasurement || {});
XNAT.plugin.pixi.experiments.drugTherapy = getObject(XNAT.plugin.pixi.experiments.drugTherapy || {});

(function(factory) {
    if (typeof define === 'function' && define.amd) {
        define(factory);
    }
    else if (typeof exports === 'object') {
        module.exports = factory();
    }
    else {
        return factory();
    }
}(function() {
    
    XNAT.plugin.pixi.experiments.cellLine.createOrUpdate = async function({
                                                                              project, subject, experimentId,
                                                                              experimentLabel, sourceId, date,
                                                                              injectionSite, injectionType,
                                                                              numCellsInjected, notes
                                                                          }) {
        console.debug(`pixi-experiments.js: XNAT.plugin.pixi.experiments.cellLine.createOrUpdate`);

        let cellLineExperimentUrl;

        if (experimentId) {
            cellLineExperimentUrl = XNAT.url.csrfUrl(`/data/projects/${project}/subjects/${subject}/experiments/${experimentId}`);
        } else {
            // If no experiment label, try to create one as SubjectID_CL_##
            if (!experimentLabel) {
                let response = await fetch(`/data/projects/${project}/subjects/${subject}/experiments?xsiType=pixi:cellLineData`, {method: 'GET'});

                if (!response.ok) {
                    throw new Error(`Error fetching cell line experiments for subject ${subject}: ${response.statusText}`);
                }

                let json = await response.json();
                let numCellLineExperiments = json['ResultSet']['Result'].length + 1;
                experimentLabel = `${subject}_CL_${numCellLineExperiments}`;
            }

            cellLineExperimentUrl = XNAT.url.csrfUrl(`/data/projects/${project}/subjects/${subject}/experiments/${experimentLabel}`);
        }

        let queryString = []
        let addQueryString = (xmlPath, data) => {
            if (data !== null && data !== undefined) {
                let encodedXmlPath = XNAT.url.encodeURIComponent(xmlPath);
                let encodedData = XNAT.url.encodeURIComponent(data);
                queryString.push(`${encodedXmlPath}=${encodedData}`)
            }
        }

        addQueryString('xsiType', 'pixi:cellLineData');

        addQueryString('xnat:experimentData/date', date);
        addQueryString('xnat:experimentData/note',  notes);
        addQueryString('pixi:cellLineData/sourceId', sourceId);
        addQueryString('pixi:cellLineData/injectionSite', injectionSite);
        addQueryString('pixi:cellLineData/injectionType', injectionType);
        addQueryString('pixi:cellLineData/numCellsInjected', numCellsInjected);

        cellLineExperimentUrl = XNAT.url.addQueryString(cellLineExperimentUrl, queryString);

        let response = await fetch(cellLineExperimentUrl, {method: 'PUT'});

        if (!response.ok) {
            throw new Error(`Error creating cell line experiment ${experimentLabel} for subject ${subject}: ${response.statusText}`);
        }

        return response.text();
    }
    
    XNAT.plugin.pixi.experiments.get = async function(project, subject, experiment, xsiType) {
        console.debug(`pixi-experiments.js: XNAT.plugin.pixi.experiments.pdx.get`);
        
        let url = '/data'
        
        if (project) {
            url = url + `/projects/${project}`
        }
    
        if (subject) {
            url = url + `/subjects/${subject}`
        }
    
        if (experiment) {
            url = url + `/experiments/${experiment}`
        } else {
            url = url + `/experiments`
        }
        
        if (xsiType) {
            url = url + `?xsiType=${xsiType}`;
            url = url + `&format=json`
        } else {
            url = url + `?format=json`
        }
        
        let response = await fetch(url, {
            method: 'GET',
            headers: {'Content-Type': 'application/json'},
        });
        
        if (!response.ok) {
            throw new Error(`Error fetching experiments for project: '${project}' subject: '${subject}' experiment: '${experiment}' xsiType: '${xsiType}'`);
        }
        
        return response.json();
    }
    
    XNAT.plugin.pixi.experiments.pdx.get = async function(project, subject, experiment) {
        return XNAT.plugin.pixi.experiments.get(project, subject, experiment, 'pixi:pdxData');
    }
    
    XNAT.plugin.pixi.experiments.pdx.cellLine = async function(project, subject, experiment) {
        return XNAT.plugin.pixi.experiments.get(project, subject, experiment, 'pixi:pdxData');
    }

    XNAT.plugin.pixi.experiments.pdx.createOrUpdate = async function({
                                                                         project, subject, experimentId,
                                                                         experimentLabel, sourceId, date,
                                                                         injectionSite, injectionType, numCellsInjected,
                                                                         passage, passageMethod, notes
                                                                     }) {
        console.debug(`pixi-experiments.js: XNAT.plugin.pixi.experiments.pdx.createOrUpdate`);

        let experimentUrl;

        if (experimentId) {
            experimentUrl = XNAT.url.csrfUrl(`/data/projects/${project}/subjects/${subject}/experiments/${experimentId}`);
        } else {
            // If no experiment label, try to create one as SubjectID_PDX_##
            if (!experimentLabel) {
                let response = await fetch(`/data/projects/${project}/subjects/${subject}/experiments?xsiType=pixi:pdxData`, {method: 'GET'});

                if (!response.ok) {
                    throw new Error(`Error fetching pdx experiments for subject ${subject}: ${response.statusText}`);
                }

                let json = await response.json();
                let numCellLineExperiments = json['ResultSet']['Result'].length + 1;
                experimentLabel = `${subject}_PDX_${numCellLineExperiments}`;
            }

            experimentUrl = XNAT.url.csrfUrl(`/data/projects/${project}/subjects/${subject}/experiments/${experimentLabel}`);
        }

        let queryString = []
        let addQueryString = (xmlPath, data) => {
            if (data !== null && data !== undefined) {
                let encodedXmlPath = XNAT.url.encodeURIComponent(xmlPath);
                let encodedData = XNAT.url.encodeURIComponent(data);
                queryString.push(`${encodedXmlPath}=${encodedData}`)
            }
        }

        addQueryString('xsiType', 'pixi:pdxData');

        addQueryString('xnat:experimentData/date', date);
        addQueryString('xnat:experimentData/note',  notes);
        addQueryString('pixi:pdxData/sourceId', sourceId);
        addQueryString('pixi:pdxData/injectionSite', injectionSite);
        addQueryString('pixi:pdxData/injectionType', injectionType);
        addQueryString('pixi:pdxData/numCellsInjected', numCellsInjected);
        addQueryString('pixi:pdxData/passage', passage);
        addQueryString('pixi:pdxData/passageMethod', passageMethod);

        experimentUrl = XNAT.url.addQueryString(experimentUrl, queryString);

        let response = await fetch(experimentUrl, {method: 'PUT'});

        if (!response.ok) {
            throw new Error(`Error creating pdx experiment ${experimentLabel} for subject ${subject}: ${response.statusText}`);
        }

        return response.text();
    }

    XNAT.plugin.pixi.experiments.caliperMeasurement.createOrUpdate = async function(
        projectId, subjectLabel, experimentId, experimentLabel, measurementDate, measurementTime, technician,
        tumorLength, tumorWidth, subjectWeight, notes) {

        console.debug(`pixi-experiments.js: XNAT.plugin.pixi.experiments.caliperMeasurement.createOrUpdate`);

        let experimentUrl;

        if (experimentId) {
            experimentUrl = XNAT.url.csrfUrl(`/data/projects/${projectId}/subjects/${subjectLabel}/experiments/${experimentId}`);
        } else {
            // If no experiment label, try to create one as SubjectID_CM_##
            if (!experimentLabel) {
                let response = await fetch(`/data/projects/${projectId}/subjects/${subjectLabel}/experiments?xsiType=pixi:caliperMeasurementData`, {method: 'GET'});

                if (!response.ok) {
                    throw new Error(`Error fetching cell line experiments for subject ${subjectLabel}: ${response.statusText}`);
                }

                let json = await response.json();
                let numExperiments = json['ResultSet']['Result'].length + 1;
                experimentLabel = `${subjectLabel}_CM_${numExperiments}`;
            }

            experimentUrl = XNAT.url.csrfUrl(`/data/projects/${projectId}/subjects/${subjectLabel}/experiments/${experimentLabel}`);
        }

        let queryString = []
        let addQueryString = (xmlPath, data) => {
            if (data !== null && data !== undefined) {
                let encodedXmlPath = XNAT.url.encodeURIComponent(xmlPath);
                let encodedData = XNAT.url.encodeURIComponent(data);
                queryString.push(`${encodedXmlPath}=${encodedData}`)
            }
        }

        addQueryString('xsiType', 'pixi:caliperMeasurementData');

        addQueryString('xnat:experimentData/date', measurementDate);
        addQueryString('xnat:experimentData/time', measurementTime);
        addQueryString('xnat:experimentData/note',  notes);

        addQueryString('pixi:caliperMeasurementData/technician', technician);
        addQueryString('pixi:caliperMeasurementData/length', tumorLength);
        addQueryString('pixi:caliperMeasurementData/width', tumorWidth);
        addQueryString('pixi:caliperMeasurementData/unit', 'mm');
        addQueryString('pixi:caliperMeasurementData/weight', subjectWeight);
        addQueryString('pixi:caliperMeasurementData/weightUnit', 'g');

        experimentUrl = XNAT.url.addQueryString(experimentUrl, queryString);

        let response = await fetch(experimentUrl, {method: 'PUT'});

        if (!response.ok) {
            throw new Error(`Error create/update of pixi:caliperMeasurementData ${experimentLabel} for subject ${subjectLabel}: ${response.statusText}`);
        }

        return response.text();
    }
    
    XNAT.plugin.pixi.experiments.drugTherapy.createOrUpdate = async function ({
                                                                                  project, subject, experimentId,
                                                                                  experimentLabel, date, time,
                                                                                  technician, drug, dose, doseUnit,
                                                                                  route, site, lotNumber, subjectWeight,
                                                                                  notes
                                                                              }) {
        
        console.debug(`pixi-experiments.js: XNAT.plugin.pixi.experiments.drugTherapy.createOrUpdate`);

        let experimentUrl;

        if (experimentId) {
            experimentUrl = XNAT.url.csrfUrl(`/data/projects/${project}/subjects/${subject}/experiments/${experimentId}`);
        } else {
            // If no experiment label, try to create one as SubjectID_DT_##
            if (!experimentLabel) {
                let response = await fetch(`/data/projects/${project}/subjects/${subject}/experiments?xsiType=pixi:drugTherapyData`, {method: 'GET'});

                if (!response.ok) {
                    throw new Error(`Error fetching pixi:drugTherapyData for subject ${subject}: ${response.statusText}`);
                }

                let json = await response.json();
                let numExperiments = json['ResultSet']['Result'].length + 1;
                experimentLabel = `${subject}_DT_${numExperiments}`;
            }

            experimentUrl = XNAT.url.csrfUrl(`/data/projects/${project}/subjects/${subject}/experiments/${experimentLabel}`);
        }

        let queryString = []
        let addQueryString = (xmlPath, data) => {
            if (data !== null && data !== undefined) {
                let encodedXmlPath = XNAT.url.encodeURIComponent(xmlPath);
                let encodedData = XNAT.url.encodeURIComponent(data);
                queryString.push(`${encodedXmlPath}=${encodedData}`)
            }
        }

        addQueryString('xsiType', 'pixi:drugTherapyData');

        addQueryString('xnat:experimentData/date', date);
        addQueryString('xnat:experimentData/time', time);
        addQueryString('xnat:experimentData/note',  notes);

        addQueryString('pixi:drugTherapyData/drug', drug);
        addQueryString('pixi:drugTherapyData/dose', dose);
        addQueryString('pixi:drugTherapyData/doseUnit', doseUnit);
        addQueryString('pixi:drugTherapyData/route', route);
        addQueryString('pixi:drugTherapyData/site', site);
        addQueryString('pixi:drugTherapyData/lotNumber', lotNumber);
        addQueryString('pixi:drugTherapyData/technician', technician);
        
        addQueryString('pixi:drugTherapyData/weight', subjectWeight);
        addQueryString('pixi:drugTherapyData/weightUnit', 'g');

        experimentUrl = XNAT.url.addQueryString(experimentUrl, queryString);

        let response = await fetch(experimentUrl, {method: 'PUT'});

        if (!response.ok) {
            throw new Error(`Error create/update of pixi:caliperMeasurementData ${experimentLabel} for subject ${subject}: ${response.statusText}`);
        }

        return response.text();
    }

}));