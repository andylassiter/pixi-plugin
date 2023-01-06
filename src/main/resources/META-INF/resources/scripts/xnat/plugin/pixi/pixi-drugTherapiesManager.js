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
    
    XNAT.plugin.pixi.drugTherapiesManager = class DrugTherapiesManager extends XNAT.plugin.pixi.abstractBulkEntryManager {

        constructor() {
            super("Drug Therapies",
                "Enter drug therapies",
                "After selecting a project, enter drug therapies applied to the selected subjects.");
        }
        
        additionalComponents() {
            const components = super.additionalComponents();
            
            this.dateComponent = spawn('div.form-component.containerItem', [
                spawn('label.required|for=\'date\'', 'Treatment Date'),
                spawn('input.form-control|type=\'date\'', {
                    id: 'date',
                    name: 'date',
                }),
                spawn('div.date-error', {style: {display: 'none'}}, 'Please select a date')
            ]);
    
            this.timeComponent = spawn('div.form-component.containerItem', [
                spawn('label|for=\'time\'', 'Treatment Time'),
                spawn('input.form-control|type=\'time\'|step=\'10\'', {
                    id: 'time',
                    name: 'time',
                    style: { width : '110px' }
                })
            ]);
    
            this.technicianComponent = spawn('div.form-component.containerItem', [
                spawn('label.required|for=\'technician\'', 'Technician'),
                spawn('input.form-control|type=\'text\'', {
                    id: 'technician',
                    name: 'technician',
                }),
                spawn('div.technician-error', {style: {display: 'none'}}, 'Please enter a technician')
            ]);
            
            components.push(
                spawn('div.row', [
                    this.dateComponent,
                    this.timeComponent,
                    this.technicianComponent
                ])
            )
            
            return components;
        }
    
        async init(containerId, project = null, subjects = []) {
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
                    validator: (value, callback) => this.validateSubjectId(value, callback)
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
    
            return super.init(containerId, hotSettings)
                        .then(() => {
                            this.setDateTime();
                            this.setTechnician();
                        })
                        .then(() => {
                            if (project !== null && project !== undefined && project !== '') {
                                this.setProjectSelection(project)
                                this.disableProjectSelection();
                            }
                        })
                        .then(() => this.populateSubjectSelector())
        }
        
        getDate() { return this.dateComponent.getElementsByTagName('input')[0].value }
        
        setDate(date = new Date()) {
            const year = date.getFullYear(),
                  month = String(date.getMonth() + 1).padStart(2, '0'),
                  day = String(date.getDate()).padStart(2, '0')
            
            this.dateComponent.getElementsByTagName('input')[0].value =
                `${year}-${month}-${day}`
        }
        
        validateDate() {
            if (this.getDate()) {
                this.dateComponent.classList.remove('invalid');
                this.dateComponent.querySelector('.date-error').style.display = 'none'
                return true;
            } else {
                this.dateComponent.classList.add('invalid')
                this.dateComponent.querySelector('.date-error').style.display = '';
                return false;
            }
        }
        
        getTime() { return this.timeComponent.getElementsByTagName('input')[0].value }
        
        setTime(date = new Date()) {
            const hours = String(date.getHours()).padStart(2, '0'),
                  mins = String(date.getMinutes()).padStart(2, '0'),
                  secs = String(date.getSeconds()).padStart(2, '0')
            
            this.timeComponent.getElementsByTagName('input')[0].value =
                `${hours}:${mins}:${secs}`
        }
        
        setDateTime(datetime = new Date()) {
            this.setDate(datetime);
            this.setTime(datetime);
        }
        
        getTechnician() { return this.technicianComponent.getElementsByTagName('input')[0].value }
        
        setTechnician(technician = window.username) {
            this.technicianComponent.getElementsByTagName('input')[0].value = technician;
        }
        
        validateTechnician() {
            if (this.getTechnician()) {
                this.technicianComponent.classList.remove('invalid');
                this.technicianComponent.querySelector('.technician-error').style.display = 'none'
                return true;
            } else {
                this.technicianComponent.classList.add('invalid')
                this.technicianComponent.querySelector('.technician-error').style.display = '';
                return false;
            }
        }

        validateSubjectId(subjectId, callback) {
            let isEmpty = (item) => item === null || item === '';

            if (isEmpty(subjectId)) {
                callback(false);
            } else {
                callback(this.getColumn('subjectId').source.contains(subjectId));
            }
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
