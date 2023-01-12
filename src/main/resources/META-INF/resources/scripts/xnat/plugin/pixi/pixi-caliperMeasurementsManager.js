/*
 *  PIXI Caliper Measurement Manager
 *
 *  This script depends on functions in pixi-module.js
 */
console.log('pixi-caliperMeasurementsManager.js');

var XNAT = getObject(XNAT || {});
XNAT.plugin = getObject(XNAT.plugin || {});
XNAT.plugin.pixi = pixi = getObject(XNAT.plugin.pixi || {});

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        return factory();
    }
}(function () {

    XNAT.plugin.pixi.caliperMeasurementManager = class CaliperMeasurementManager extends XNAT.plugin.pixi.abstractExperimentManager {

        constructor() {
            super("Caliper Measurements",
                  "Enter caliper measurements",
                  "After selecting a project, enter a caliper measurements for the selected subjects.");
        }

        static async create(containerId, project = null, subjects = []) {
            let caliperMeasurementManager = new CaliperMeasurementManager();
            
            let colHeaders = [
                "Subject ID *",
                "Experiment ID",
                "Experiment Label",
                "Length (mm) *",
                "Width (mm) *",
                "Subject Weight (g)",
                "Notes"
            ]

            let colWidths = [175, 100, 150, 100, 100, 130, 200];

            let columns = [
                {
                    data: 'subjectId',
                    type: 'autocomplete',
                    filter: true,
                    strict: true,
                    source: [],
                    allowEmpty: true,
                    allowInvalid: true,
                    validator: (value, callback) => caliperMeasurementManager.validateSubjectId(value, callback)
                },
                { data: 'experimentId' },
                { data: 'experimentLabel' },
                {
                    data: 'tumorLength',
                    type: 'numeric',
                    allowEmpty: false,
                },
                {
                    data: 'tumorWidth',
                    type: 'numeric',
                    allowEmpty: false,
                },
                {
                    data: 'subjectWeight',
                    type: 'numeric'
                },
                { data: 'notes' }
            ]

            let hotSettings = {
                colHeaders: colHeaders,
                colWidths: colWidths,
                columns: columns,
                rowHeaders: true,
                manualColumnResize: true,
                contextMenu: ['row_above', 'row_below', '---------', 'remove_row', '---------', 'undo', 'redo', '---------', 'copy', 'cut'],
                width: '100%',
                licenseKey: 'non-commercial-and-evaluation',
                minRows: 1,
                hiddenColumns: {
                    columns: [1, 2], // Experiment ID and Experiment Label
                    // show UI indicators to mark hidden columns
                    indicators: false
                }
            }

            return caliperMeasurementManager.init(containerId, hotSettings, project, subjects)
                                            .then(() => caliperMeasurementManager);
        }
        
        getXsiType() { return 'pixi:caliperMeasurementData' }
    
        async submitRow(row) {
            console.debug(`Submitting caliper measurements for row ${row}`);
            
            let project = this.getProjectSelection();
            let subject = this.hot.getDataAtRowProp(row, 'subjectId');
            let experimentId = this.hot.getDataAtRowProp(row, 'experimentId');
            let experimentLabel = this.hot.getDataAtRowProp(row, 'experimentLabel');
            let measurementDate = this.getDate();
            let measurementTime = this.getTime();
            let technician = this.getTechnician();
            let tumorLength = this.hot.getDataAtRowProp(row, 'tumorLength');
            let tumorWidth = this.hot.getDataAtRowProp(row, 'tumorWidth');
            let subjectWeight = this.hot.getDataAtRowProp(row, 'subjectWeight');
            let notes = this.hot.getDataAtRowProp(row, 'notes');
        
            return XNAT.plugin.pixi.experiments.caliperMeasurement.createOrUpdate(project, subject, experimentId,
                                                                                  experimentLabel, measurementDate,
                                                                                  measurementTime, technician,
                                                                                  tumorLength, tumorWidth,
                                                                                  subjectWeight, notes)
                       .then(id => {
                           return {
                               'subject':      subject,
                               'experimentId': id,
                               'row':          row,
                               'url':          `/data/projects/${project}/experiments/${id}?format=html`,
                               'urlText':      `${subject}`,
                           }
                       })
                       .catch(error => {
                           return {
                               'subject': subject,
                               'row':     row,
                               'error':   error,
                           }
                       })
        }
    }


}));
