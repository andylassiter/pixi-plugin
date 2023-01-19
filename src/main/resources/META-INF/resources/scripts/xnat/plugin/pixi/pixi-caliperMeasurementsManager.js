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
                "Date *",
                "Time",
                "Technician *",
                "Notes"
            ]
            
            let colWidths = [175, 100, 150, 100, 100, 150, 100, 100, 130, 175];
            
            let columns = [
                {
                    data:         'subjectId',
                    type:         'autocomplete',
                    filter:       true,
                    strict:       true,
                    source:       [],
                    allowEmpty:   true,
                    allowInvalid: true,
                    validator:    (value, callback) => caliperMeasurementManager.validateExistingSubjectLabel(caliperMeasurementManager.getProjectSelection(), value, callback)
                },
                { data: 'experimentId' },
                { data: 'experimentLabel' },
                {
                    data:       'tumorLength',
                    type:       'numeric',
                    allowEmpty: false,
                },
                {
                    data:       'tumorWidth',
                    type:       'numeric',
                    allowEmpty: false,
                },
                {
                    data: 'subjectWeight',
                    type: 'numeric'
                },
                {
                    data:         'measurementDate',
                    type:         'date',
                    allowEmpty:   true,
                    allowInvalid: true,
                    dateFormat:   'MM/DD/YYYY',
                    validator:    (value, callback) => caliperMeasurementManager.validateDate(value, callback)
                },
                {
                    data:          'measurementTime',
                    type:          'time',
                    timeFormat:    'h:mm:ss a',
                    correctFormat: true
                },
                {
                    data:       'technician',
                    type:       'text',
                    allowEmpty: false,
                    validator:  (value, callback) => value ? callback(true) : callback(false),
                },
                { data: 'notes' }
            ]
            
            let hotSettings = {
                colHeaders:         colHeaders,
                colWidths:          colWidths,
                columns:            columns,
                rowHeaders:         true,
                manualColumnResize: true,
                contextMenu:        ['row_above', 'row_below', '---------', 'remove_row', '---------', 'undo', 'redo', '---------', 'copy', 'cut'],
                width:              '100%',
                licenseKey:         'non-commercial-and-evaluation',
                minRows:            1,
                hiddenColumns:      {
                    columns: [1, 2], // Experiment ID and Experiment Label
                    // show UI indicators to mark hidden columns
                    indicators: false
                }
            }
            
            return caliperMeasurementManager.init(containerId, hotSettings, project, subjects)
                                            .then(() => caliperMeasurementManager.hot.addHook('beforeChange', (changes, source) => caliperMeasurementManager.changeDate('measurementDate', changes, source)))
                                            .then(() => caliperMeasurementManager);
        }
        
        getXsiType() {
            return 'pixi:caliperMeasurementData'
        }
        
        createActionLabel() {
            return 'New caliper measurements'
        }
        
        updateActionLabel() {
            return 'Update existing caliper measurements'
        }
        
        async submitRow(row) {
            console.debug(`Submitting caliper measurements for row ${row}`);
            
            let project = this.getProjectSelection();
            let subject = this.hot.getDataAtRowProp(row, 'subjectId');
            let experimentId = this.hot.getDataAtRowProp(row, 'experimentId');
            let experimentLabel = this.hot.getDataAtRowProp(row, 'experimentLabel');
            let measurementDate = this.hot.getDataAtRowProp(row, 'measurementDate');
            let measurementTime = this.hot.getDataAtRowProp(row, 'measurementTime');
            let technician = this.hot.getDataAtRowProp(row, 'technician');
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
        
        async getDataForSubject(subject) {
            const response = await XNAT.plugin.pixi.experiments.get(this.getProjectSelection(),
                                                                    subject,
                                                                    '',
                                                                    this.getXsiType());
            
            // Skip subjects without experiments
            if (response['ResultSet']['Result'].length === 0) {
                return Promise.resolve([]);
            }
            
            let data = []
            
            for (const result of response['ResultSet']['Result']) {
                const response = await XNAT.plugin.pixi.experiments.get('', '', result['ID'], '');
                let data_fields = response['items'][0]['data_fields']
                
                let experiment = {
                    'subjectId':       subject,
                    'experimentId':    result['ID'],
                    'experimentLabel': data_fields['label'],
                    'measurementDate': data_fields['date'] ? data_fields['date'].replace(/(\d{4})-(\d{2})-(\d{2})/, '$2/$3/$1') : '',
                    'measurementTime': data_fields['time'] ? data_fields['time'] : '',
                    'technician':      data_fields['technician'],
                    'tumorLength':     data_fields['length'],
                    'tumorWidth':      data_fields['width'],
                    'subjectWeight':   data_fields['weight'],
                    'notes':           data_fields['note']
                }
                
                data.push(experiment);
            }
            
            return Promise.resolve(data);
        }
    }
}));
