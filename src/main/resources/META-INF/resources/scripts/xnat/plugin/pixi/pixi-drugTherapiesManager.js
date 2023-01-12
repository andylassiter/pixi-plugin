/*
 *  PIXI Drug Therapies Manager
 */
console.log('pixi-drugTherapiesManager.js');

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
    
    XNAT.plugin.pixi.drugTherapiesManager = class DrugTherapiesManager extends XNAT.plugin.pixi.abstractExperimentManager {

        constructor() {
            super("Drug Therapies Manager",
                  "Enter drug therapies",
                  "After selecting a project, enter drug therapies applied to the selected subjects.");
        }
    
        getXsiType() { return 'pixi:drugTherapyData' }
        
        static async create(containerId, project = null, subjects = []) {
            let drugTherapiesManager = new DrugTherapiesManager();
            
            let colHeaders = [
                "Subject ID *",
                "Experiment ID",
                "Experiment Label",
                "Drug *",
                "Dose *",
                "Dose Unit *",
                "Route *",
                "Site *",
                "Lot Number",
                "Subject Weight (g)",
                "Notes"
            ]

            let colWidths = [175, 100, 150, 120, 60, 80, 100, 100, 100, 130, 175];

            let columns = [
                {
                    data: 'subjectId',
                    type: 'autocomplete',
                    filter: true,
                    strict: true,
                    source: [],
                    allowEmpty: true,
                    allowInvalid: true,
                    validator: (value, callback) => drugTherapiesManager.validateSubjectId(value, callback)
                },
                { data: 'experimentId' },
                { data: 'experimentLabel' },
                {
                    data: 'drug',
                    type: 'text',
                    allowEmpty: false,
                    validator: (value, callback) => { value ? callback(true) : callback(false)}
                },
                {
                    data: 'dose',
                    type: 'numeric',
                    allowEmpty: false,
                },
                {
                    data: 'doseUnit',
                    type: 'text',
                    allowEmpty: false,
                    validator: (value, callback) => { value ? callback(true) : callback(false)}
                },
                {
                    data: 'route',
                    type: 'text',
                    allowEmpty: false,
                    validator: (value, callback) => { value ? callback(true) : callback(false)}
                },
                {
                    data: 'site',
                    type: 'text',
                    allowEmpty: false,
                    validator: (value, callback) => { value ? callback(true) : callback(false)}
                },
                { data: 'lotNumber' },
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
    
            return drugTherapiesManager.init(containerId, hotSettings, project, subjects).then(() => drugTherapiesManager);
        }
    
        async submitRow(row) {
            console.debug(`Submitting drug therapy experiment for row ${row}`);
        
            let drugTherapy = {
                project:         this.getProjectSelection(),
                subject:         this.hot.getDataAtRowProp(row, 'subjectId'),
                experimentId:    this.hot.getDataAtRowProp(row, 'experimentId'),
                experimentLabel: this.hot.getDataAtRowProp(row, 'experimentLabel'),
                date:            this.getDate(),
                time:            this.getTime(),
                technician:      this.getTechnician(),
                drug:            this.hot.getDataAtRowProp(row, 'drug'),
                dose:            this.hot.getDataAtRowProp(row, 'dose'),
                doseUnit:        this.hot.getDataAtRowProp(row, 'doseUnit'),
                route:           this.hot.getDataAtRowProp(row, 'route'),
                site:            this.hot.getDataAtRowProp(row, 'site'),
                lotNumber:       this.hot.getDataAtRowProp(row, 'lotNumber'),
                subjectWeight:   this.hot.getDataAtRowProp(row, 'subjectWeight'),
                notes:           this.hot.getDataAtRowProp(row, 'notes'),
            }
        
            return XNAT.plugin.pixi.experiments.drugTherapy.createOrUpdate(drugTherapy)
                      .then(id => {
                          return {
                              'subject':      drugTherapy.subject,
                              'experimentId': id,
                              'row':          row,
                              'url':          `/data/projects/${drugTherapy.project}/experiments/${id}?format=html`,
                              'urlText':      `${drugTherapy.subject}`,
                          }
                      })
                      .catch(error => {
                          return {
                              'subject': drugTherapy.subject,
                              'row':     row,
                              'error':   error,
                          }
                      })
        }
    }
    
}));
