/*
 *  PIXI Xenograft Experiment Manager
 *
 *  This script depends on functions in pixi-module.js
 */
console.log('pixi-xenograftExperimentManager.js');

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
    
    XNAT.plugin.pixi.pdxExperimentManager = class PdxExperimentManager extends XNAT.plugin.pixi.abstractExperimentManager {
        
        constructor() {
            super("PDX Data Manager",
                  "Enter tumor tissue implant details",
                  "After selecting a project, define the details of each tissue implant in the table below. A Subject ID, PDX ID, and Injection Date are required for each entry.");
        }
        
        static async create(containerId, project = null, subjects = []) {
            let pdxExperimentManager = new PdxExperimentManager();
            
            let initData = subjects.length ?
                subjects.map(subject => ({
                    'subjectId':        subject,
                    'experimentId':     '',
                    'sourceId':         '',
                    'injectionDate':    '',
                    'injectionSite':    '',
                    'injectionType':    '',
                    'numCellsInjected': '',
                    'passage':          '',
                    'passageMethod':    '',
                    'notes':            ''
                }))
                : new Array(5).fill({
                                        'subjectId':        '',
                                        'experimentId':     '',
                                        'sourceId':         '',
                                        'injectionDate':    '',
                                        'injectionSite':    '',
                                        'injectionType':    '',
                                        'numCellsInjected': '',
                                        'passage':          '',
                                        'passageMethod':    '',
                                        'notes':            ''
                                    });
            
            
            let colHeaders = [
                "Subject ID *",
                "Experiment ID",
                "PDX ID *",
                "Injection Date *",
                "Injection Site",
                "Injection Type",
                "Num Cells Injected",
                "Passage",
                "Passage Method",
                "Notes"
            ];
            
            let colWidths = [150, 100, 150, 100, 150, 150, 150, 150, 100, 130];
    
            const pdxs = await XNAT.plugin.pixi.pdxs.get()
                                   .then(pdxs => pdxs.sort(pixi.compareGenerator('sourceId')))
                                   .then(pdxs => pdxs.map(pdx => pdx['sourceId']));
            
            let columns = [
                {
                    data:         'subjectId',
                    type:         'autocomplete',
                    filter:       true,
                    strict:       true,
                    source:       [],
                    allowEmpty:   true,
                    allowInvalid: true,
                    validator:    (value, callback) => pdxExperimentManager.validateExistingSubjectLabel(pdxExperimentManager.getProjectSelection(), value, callback)
                },
                {
                    data: 'experimentId'
                },
                {
                    data:         'sourceId',
                    type:         'autocomplete',
                    filter:       true,
                    strict:       false,
                    source:       pdxs,
                    allowEmpty:   true,
                    allowInvalid: true,
                    validator:    (value, callback) => value ? callback(true) : callback(false),
                },
                {
                    data:         'injectionDate',
                    type:         'date',
                    allowEmpty:   true,
                    allowInvalid: true,
                    dateFormat:   'MM/DD/YYYY',
                    validator:    (value, callback) => pdxExperimentManager.validateDate(value, callback)
                },
                { data: 'injectionSite' },
                {
                    data:   'injectionType',
                    type:   'autocomplete',
                    filter: true,
                    strict: false,
                    source: ['Subcutaneous', 'Orthotopic']
                },
                {
                    data: 'numCellsInjected',
                    type: 'numeric'
                },
                { data: 'passage' },
                { data: 'passageMethod' },
                { data: 'notes' }
            ];
            
            let hotSettings = {
                data:               initData,
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
                    columns: [1],
                    // show UI indicators to mark hidden columns
                    indicators: false
                }
            }
            
            return pdxExperimentManager.init(containerId, hotSettings, project, subjects)
                                       .then(() => pdxExperimentManager.hot.addHook('beforeChange', (changes, source) => pdxExperimentManager.changeDate('injectionDate', changes, source)))
                                       .then(() => pdxExperimentManager);
        }
        
        getXsiType() {
            return 'pixi:pdxData';
        }
        
        createActionLabel() {
            return 'New patient-derived tumor engraftments';
        }
        
        updateActionLabel() {
            return 'Update existing engraftments';
        }
        
        async submitRow(row) {
            console.debug(`Submitting pdx experiment for row ${row}`);
            
            let experiment = {
                project:          this.getProjectSelection(),
                subject:          this.getDataAtRowProp(row, 'subjectId'),
                experimentId:     this.getDataAtRowProp(row, 'experimentId'),
                sourceId:         this.getDataAtRowProp(row, 'sourceId'),
                date:             this.getDataAtRowProp(row, 'injectionDate'),
                injectionSite:    this.getDataAtRowProp(row, 'injectionSite'),
                injectionType:    this.getDataAtRowProp(row, 'injectionType'),
                numCellsInjected: this.getDataAtRowProp(row, 'numCellsInjected'),
                passage:          this.getDataAtRowProp(row, 'passage'),
                passageMethod:    this.getDataAtRowProp(row, 'passageMethod'),
                notes:            this.getDataAtRowProp(row, 'notes'),
            }
            
            return XNAT.plugin.pixi.experiments.pdx.createOrUpdate(experiment)
                       .then(id => {
                           return {
                               'subject':      experiment.subject,
                               'experimentId': id,
                               'row':          row,
                               'url':          `/data/projects/${experiment.project}/experiments/${id}?format=html`,
                               'urlText':      `${experiment.subject}`,
                           }
                       })
                       .catch(error => {
                           return {
                               'subject': experiment.subject,
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
                    'subjectId':        subject,
                    'experimentId':     result['ID'],
                    'sourceId':         data_fields['sourceId'],
                    'injectionDate':    data_fields['date'] ? data_fields['date'].replace(/(\d{4})-(\d{2})-(\d{2})/, '$2/$3/$1') : '',
                    'injectionSite':    data_fields['injectionSite'],
                    'injectionType':    data_fields['injectionType'],
                    'numCellsInjected': data_fields['numCellsInjected'],
                    'passage':          data_fields['passage'],
                    'passageMethod':    data_fields['passageMethod'],
                    'notes':            data_fields['note']
                }
                
                data.push(experiment);
            }
            
            return Promise.resolve(data);
        }
    }
    
    XNAT.plugin.pixi.cellLineExperimentManager = class CellLineExperimentManager extends XNAT.plugin.pixi.abstractExperimentManager {
        
        constructor() {
            super("Cell Line Data Manager",
                  "Enter cell line injection details",
                  "After selecting a project, define the details of each cell line injection in the table below. A Subject ID, Cell Line ID, and Injection Date are required for each entry.");
        }
        
        static async create(containerId, project = null, subjects = []) {
            let cellLineExperimentManager = new CellLineExperimentManager();
            
            let initData = subjects.length ?
                subjects.map(subject => ({
                    'subjectId':        subject,
                    'experimentId':     '',
                    'sourceId':         '',
                    'injectionDate':    '',
                    'injectionSite':    '',
                    'injectionType':    '',
                    'numCellsInjected': '',
                    'notes':            ''
                }))
                : new Array(5).fill({
                                        'subjectId':        '',
                                        'experimentId':     '',
                                        'sourceId':         '',
                                        'injectionDate':    '',
                                        'injectionSite':    '',
                                        'injectionType':    '',
                                        'numCellsInjected': '',
                                        'notes':            ''
                                    });
            
            
            let colHeaders = [
                "Subject ID *",
                "Experiment ID",
                "Cell Line ID *",
                "Injection Date *",
                "Injection Site",
                "Injection Type",
                "Num Cells Injected",
                "Notes"
            ];
            
            let colWidths = [150, 100, 150, 100, 150, 150, 150, 130];
    
            const cellLines = await XNAT.plugin.pixi.cellLines.get()
                                   .then(cellLines => cellLines.sort(pixi.compareGenerator('sourceId')))
                                   .then(cellLines => cellLines.map(cellLine => cellLine['sourceId']));
            
            let columns = [
                {
                    data:         'subjectId',
                    type:         'autocomplete',
                    filter:       true,
                    strict:       true,
                    source:       [],
                    allowEmpty:   true,
                    allowInvalid: true,
                    validator:    (value, callback) => cellLineExperimentManager.validateExistingSubjectLabel(cellLineExperimentManager.getProjectSelection(), value, callback),
                },
                {
                    data: 'experimentId'
                },
                {
                    data:         'sourceId',
                    type:         'autocomplete',
                    filter:       true,
                    strict:       false,
                    source:       cellLines,
                    allowEmpty:   true,
                    allowInvalid: true,
                    validator:    (value, callback) => value ? callback(true) : callback(false),
                },
                {
                    data:         'injectionDate',
                    type:         'date',
                    allowEmpty:   true,
                    allowInvalid: true,
                    dateFormat:   'MM/DD/YYYY',
                    validator:    (value, callback) => cellLineExperimentManager.validateDate(value, callback)
                },
                { data: 'injectionSite' },
                {
                    data:   'injectionType',
                    type:   'autocomplete',
                    filter: true,
                    strict: false,
                    source: ['Subcutaneous', 'Orthotopic']
                },
                {
                    data: 'numCellsInjected',
                    type: 'numeric'
                },
                { data: 'notes' }
            ];
            
            let hotSettings = {
                data:               initData,
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
                    columns: [1],
                    // show UI indicators to mark hidden columns
                    indicators: false
                }
            }
            
            return cellLineExperimentManager.init(containerId, hotSettings, project, subjects)
                                            .then(() => cellLineExperimentManager.hot.addHook('beforeChange', (changes, source) => cellLineExperimentManager.changeDate('injectionDate', changes, source)))
                                            .then(() => cellLineExperimentManager);
        }
        
        getXsiType() {
            return 'pixi:cellLineData';
        }
        
        createActionLabel() {
            return 'New cell line injections';
        }
        
        updateActionLabel() {
            return 'Update existing cell line injections';
        }
        
        async submitRow(row) {
            console.debug(`Submitting cell line experiment for row ${row}`);
            
            let experiment = {
                project:          this.getProjectSelection(),
                subject:          this.getDataAtRowProp(row, 'subjectId'),
                experimentId:     this.getDataAtRowProp(row, 'experimentId'),
                sourceId:         this.getDataAtRowProp(row, 'sourceId'),
                date:             this.getDataAtRowProp(row, 'injectionDate'),
                injectionSite:    this.getDataAtRowProp(row, 'injectionSite'),
                injectionType:    this.getDataAtRowProp(row, 'injectionType'),
                numCellsInjected: this.getDataAtRowProp(row, 'numCellsInjected'),
                notes:            this.getDataAtRowProp(row, 'notes'),
            }
            
            return XNAT.plugin.pixi.experiments.cellLine.createOrUpdate(experiment)
                       .then(id => {
                           return {
                               'subject':      experiment.subject,
                               'experimentId': id,
                               'row':          row,
                               'url':          `/data/projects/${experiment.project}/experiments/${id}?format=html`,
                               'urlText':      `${experiment.subject}`,
                           }
                       })
                       .catch(error => {
                           return {
                               'subject': experiment.subject,
                               'row':     row,
                               'error':   error,
                           }
                       })
        }
        
        async getDataForSubject(subject) {
            const response = await XNAT.plugin.pixi.experiments.get(this.getProjectSelection(), subject, '', this.getXsiType());
            
            // Skip subjects without experiments
            if (response['ResultSet']['Result'].length === 0) {
                return Promise.resolve([]);
            }
            
            let data = []
            
            for (const result of response['ResultSet']['Result']) {
                const response = await XNAT.plugin.pixi.experiments.get('', '', result['ID'], '');
                let data_fields = response['items'][0]['data_fields']
    
                let date = data_fields['date'];
                date;
                
                let experiment = {
                    'subjectId':        subject,
                    'experimentId':     result['ID'],
                    'sourceId':         data_fields['sourceId'],
                    'injectionDate':    data_fields['date'] ? data_fields['date'].replace(/(\d{4})-(\d{2})-(\d{2})/, '$2/$3/$1') : '',
                    'injectionSite':    data_fields['injectionSite'],
                    'injectionType':    data_fields['injectionType'],
                    'numCellsInjected': data_fields['numCellsInjected'],
                    'notes':            data_fields['note']
                }
                
                data.push(experiment);
            }
            
            return Promise.resolve(data);
        }
    }
}));
