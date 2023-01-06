/*
 *  PIXI Caliper Measurement Manager
 *
 *  This script depends on functions in pixi-module.js
 */
console.log('pixi-caliperMeasurementWorkflow.js');

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

    XNAT.plugin.pixi.caliperMeasurementManager = class CaliperMeasurementManager extends XNAT.plugin.pixi.abstractBulkEntryManager {

        constructor() {
            super("Caliper Measurements",
                "Enter caliper measurements",
                "After selecting a project, enter a caliper measurements for the selected subjects.");
        }

        async init(containerId, project = null, subjects = []) {
            let colHeaders = [
                "Subject ID *",
                "Experiment ID",
                "Experiment Label",
                "Date *",
                "Time",
                "Technician *",
                "Length (mm) *",
                "Width (mm) *",
                "Subject Weight (g)",
                "Notes"
            ]

            let colWidths = [175, 100, 150, 100, 100, 100, 100, 100, 130, 175];

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
                    data: 'measurementDate',
                    type: 'date',
                    allowEmpty: true,
                    allowInvalid: true,
                    dateFormat: 'MM/DD/YYYY',
                    validator: (value, callback) => this.validateDate(value, callback)
                },
                {
                    data: 'measurementTime',
                    type: 'time',
                    timeFormat: 'h:mm:ss a',
                    correctFormat: true
                },
                {
                    data: 'technician',
                    type: 'text',
                    allowEmpty: false,
                    validator: (value, callback) => { value ? callback(true) : callback(false)}
                },
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

            return super.init(containerId, hotSettings)
                .then(() => {
                    if (project !== null && project !== undefined && project !== '') {
                        this.setProjectSelection(project)
                        this.disableProjectSelection();
                    }
                })
                .then(() => this.populateSubjectSelector())
                .then(() => this.hot.addHook('beforeChange', (changes, source) => this.beforeChange(changes, source)))
        }

        validateSubjectId(subjectId, callback) {
            let isEmpty = (item) => item === null || item === '';

            if (isEmpty(subjectId)) {
                callback(false);
            } else {
                callback(this.getColumn('subjectId').source.contains(subjectId));
            }
        }

        validateDate(injectionDate, callback) {
            let isEmpty = (item) => item === null || item === '';

            if (isEmpty(injectionDate)) {
                callback(false);
            } else {
                let date = Date.parse(injectionDate);

                if (isNaN(date)) {
                    callback(false);
                } else {
                    callback(true);
                }
            }
        }

        beforeChange(changes, source) {
            for (let i = changes.length - 1; i >= 0; i--) {
                if (changes[i][1] === 'measurementDate') {
                    if (changes[i][3] !== null || changes[i][3] !== '') {
                        let date = Date.parse(changes[i][3]);
                        if (isNaN(date)) {
                            continue;
                        }
                        changes[i][3] = this.formatDate(new Date(date));
                    }
                }
            }
        }

        async submit() {
            console.debug('Submitting')

            if (!this.validateProjectSelection()) {
                console.error('Invalid project selection.');
                return;
            }

            if (this.isEmpty()) {
                console.debug('Nothing to submit.');
                return;
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

                    let subject = this.hot.getDataAtRowProp(iRow, 'subjectId');
                    let experimentId = this.hot.getDataAtRowProp(iRow, 'experimentId');
                    let experimentLabel = this.hot.getDataAtRowProp(iRow, 'experimentLabel');
                    let measurementDate = this.hot.getDataAtRowProp(iRow, 'measurementDate');
                    let measurementTime = this.hot.getDataAtRowProp(iRow, 'measurementTime');
                    let technician = this.hot.getDataAtRowProp(iRow, 'technician');
                    let tumorLength = this.hot.getDataAtRowProp(iRow, 'tumorLength');
                    let tumorWidth = this.hot.getDataAtRowProp(iRow, 'tumorWidth');
                    let subjectWeight = this.hot.getDataAtRowProp(iRow, 'subjectWeight');
                    let notes = this.hot.getDataAtRowProp(iRow, 'notes');

                    await XNAT.plugin.pixi.experiments.caliperMeasurement.createOrUpdate(
                        projectId, subject, experimentId, experimentLabel, measurementDate, measurementTime, technician,
                        tumorLength, tumorWidth, subjectWeight, notes).then(id => {

                        successfulRows.push(iRow)
                        experiments.push({
                            'subjectId': subject,
                            'experimentId': id,
                            'row': iRow,
                            'url': `/data/projects/${projectId}/experiments/${id}?format=html`
                        });

                        return id;
                    } ).catch(error => {
                        failedRows.push(
                            {
                                'subjectId': subject,
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
