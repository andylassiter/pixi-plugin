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
            super("Drug Therapies",
                "Enter drug therapies",
                "After selecting a project, enter drug therapies applied to the selected subjects.");
        }
        
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
        
        async submit() {
            console.debug('Submitting')
            
            let validProject = this.validateProjectSelection(),
                validDate    = this.validateDate(),
                validTech    = this.validateTechnician(),
                isEmpty      = this.isEmpty();

            if (!validProject) {
                return Promise.reject('Invalid project selection');
            } else if (!validDate) {
                return Promise.reject('Invalid date');
            } else if (!validTech) {
                return Promise.reject('Invalid technician');
            } else if (isEmpty) {
                return Promise.reject('Empty');
            }

            this.hot.validateCells(async (valid) => {
                if (!valid) {
                    let message = spawn('div', [
                        spawn('p', 'Invalid inputs. Please correct before resubmitting.'),
                    ])

                    this.displayMessage('error', message);

                    return;
                }

                // Everything is valid, remove old messages
                this.clearAndHideMessage();

                XNAT.ui.dialog.static.wait('Submitting to XNAT', {id: "submit_injection"});

                let projectId = this.getProjectSelection();
                let experiments = [];
                let successfulRows = [];
                let failedRows = [];

                for (let iRow = 0; iRow < this.hot.countRows(); iRow++) {
                    
                    let drugTherapy = {
                        project: this.getProjectSelection(),
                        subject: this.hot.getDataAtRowProp(iRow, 'subjectId'),
                        experimentId: this.hot.getDataAtRowProp(iRow, 'experimentId'),
                        experimentLabel: this.hot.getDataAtRowProp(iRow, 'experimentLabel'),
                        date: this.getDate(),
                        time: this.getTime(),
                        technician: this.getTechnician(),
                        drug: this.hot.getDataAtRowProp(iRow, 'drug'),
                        dose: this.hot.getDataAtRowProp(iRow, 'dose'),
                        doseUnit: this.hot.getDataAtRowProp(iRow, 'doseUnit'),
                        route: this.hot.getDataAtRowProp(iRow, 'route'),
                        site: this.hot.getDataAtRowProp(iRow, 'site'),
                        lotNumber: this.hot.getDataAtRowProp(iRow, 'lotNumber'),
                        subjectWeight: this.hot.getDataAtRowProp(iRow, 'subjectWeight'),
                        notes: this.hot.getDataAtRowProp(iRow, 'notes'),
                    }
                    
                    await XNAT.plugin.pixi.experiments.drugTherapy.createOrUpdate(drugTherapy).then(id => {

                        successfulRows.push(iRow)
                        experiments.push({
                            'subjectId': drugTherapy.subject,
                            'experimentId': id,
                            'row': iRow,
                            'url': `/data/projects/${projectId}/experiments/${id}?format=html`
                        });

                        return id;
                    } ).catch(error => {
                        failedRows.push(
                            {
                                'subjectId': drugTherapy.subject,
                                'row': iRow,
                                'error': error
                            }
                        )

                        return error;
                    });
                }

                XNAT.ui.dialog.close('submit_experiment');

                // Disable new inputs to successful rows
                this.hot.updateSettings({
                    cells: function (row, col) {
                        var cellProperties = {};

                        if (successfulRows.contains(row)) {
                            cellProperties.readOnly = true;
                        }

                        return cellProperties;
                    },
                    contextMenu: ['copy', 'cut'],
                });

                this.removeKeyboardShortCuts();
                this.disableProjectSelection();

                experiments.forEach(experiment => {
                    this.hot.setDataAtRowProp(experiment['row'], 'experimentId', experiment['experimentId']);
                })

                if (failedRows.length === 0) {
                    // Success
                    let message = spawn('div', [
                        spawn('p', 'Successful submissions:'),
                        spawn('ul', experiments.map(experiment => spawn('li', [spawn(`a`, {
                            href: experiment['url'],
                            target: '_BLANK'
                        }, experiment['subjectId'])])))
                    ])

                    this.displayMessage('success', message);

                    // Disable resubmissions
                    this.disableSubmitButton();
                } else if (successfulRows.length === 0 && failedRows.length > 0) {
                    // All submissions in error
                    let message = spawn('div', [
                        spawn('p', ''),
                        spawn('p', 'There were errors with your submission. Correct the issues and try resubmitting.'),
                        spawn('ul', failedRows.map(experiments => spawn('li', `Row: ${experiments['row'] + 1} ${XNAT.app.displayNames.singular.subject} ID: ${experiments['subjectId']} ${experiments['error']}`))),
                    ])

                    this.displayMessage('error', message);
                } else if (successfulRows.length > 0 && failedRows.length > 0) {
                    // Some submitted successfully, some failed
                    let message = spawn('div', [
                        spawn('p', 'There were errors with your submission. Correct the issues and try resubmitting.'),
                        spawn('p', 'Error(s):'),
                        spawn('ul', failedRows.map(experiments => spawn('li', `Row: ${experiments['row'] + 1} ${XNAT.app.displayNames.singular.subject} ID: ${experiments['subjectId']} ${experiments['error']}`))),
                        spawn('p', 'Successful submissions:'),
                        spawn('ul', experiments.map(experiment => spawn('li', [spawn(`a`, {
                            href: experiment['url'],
                            target: '_BLANK'
                        }, experiment['subjectId'])])))
                    ])

                    this.displayMessage('warning', message);
                }

                XNAT.ui.dialog.close('submit_experiment');
            })
        }
    }
    
}));
