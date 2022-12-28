/*
 *  PIXI Subject Entry Manager
 *
 *  This script depends on functions in pixi-module.js
 */

console.log('pixi-subjectEntryManager.js');

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

    console.log('pixi-subjectEntryManager.js - SubjectEntryManager');

    class AbstractBulkEntryManager {
        containerId;
        container;

        #title;
        #subtitle;
        #description;

        projectSelectComponent;
        submitButton;

        messageComponent;

        hot;
        errorMessages;
        successMessages;
        lastKey;

        constructor(heading, subheading, description) {
            if (new.target === AbstractBulkEntryManager) {
                throw new TypeError("Cannot construct Abstract instances directly");
            }

            this.#title = heading;
            this.#subtitle = subheading;
            this.#description = description;

            this.errorMessages = new Map();
            this.successMessages = new Map();
        }

        async submit() { throw new Error("Method 'submit()' must be implemented."); }

        async init(containerId, hotSettings) {
            const self = this;

            this.containerId = containerId;
            this.container = document.getElementById(this.containerId);

            return this.render()
                .then(() => {
                    this.hot = new Handsontable(this.container.querySelector('.hot-table'), hotSettings);

                    this.addKeyboardShortCuts();

                    this.updateHeight();
                    this.hot.addHook('afterCreateRow', (index, amount, source) => this.afterCreateRow(index, amount, source));
                    this.hot.addHook('afterRemoveRow', (index, amount, physicalRows, source) => this.afterRemoveRow(index, amount, physicalRows, source));

                    // Place cursor at first cell
                    this.hot.selectCell(0, 0, 0, 0);
                })
        }

        async render() {
            const self = this;

            this.projectSelectComponent = spawn('div.form-component.containerItem', [
                spawn('label.required|for=\'project\'', 'Select a Project'),
                spawn('select.form-control', {
                        id: 'project',
                        name: 'project',
                        onchange: () => {
                            self.validateProjectSelection();
                            self.populateSubjectSelector().then(() => self.hot.validateCells());
                        }
                    },
                    [spawn('option|', {selected: true, disabled: true, value: ''}, '')]),
                spawn('div.prj-error', {style: {display: 'none'}}, 'Please select a project')
            ])

            this.messageComponent = spawn('div', {id: 'table-msg', style: {display: 'none'}});

            let titleEl = spawn('h2', self.#title);

            let panel = spawn('div.container', [
                spawn('div.withColor containerTitle', self.#subtitle),
                spawn('div.containerBody', [
                    spawn('div.containerItem', self.#description),
                    spawn('hr'),
                    self.projectSelectComponent,
                    spawn('div.hot-container.containerIterm', [spawn('div.hot-table')]),
                    self.messageComponent
                ])
            ]);

            this.submitButton = spawn('input.btn1.pull-right|type=button|value=Submit', {
                onclick: () => {
                    xmodal.confirm({
                        title: "Confirm Submission",
                        height: 220,
                        scroll: false,
                        content: `<p>Are you ready to submit?</p>`,
                        okAction: () => self.submit(),
                    })
                }
            });

            let buttons = spawn('div.submit-right', [
                self.submitButton,
                ...self.additionalButtons(),
                spawn('div.clear')
            ])

            this.container.innerHTML = '';
            this.container.append(titleEl);
            this.container.append(panel);
            this.container.append(buttons);

            return XNAT.plugin.pixi.projects.populateSelectBox('project');
        }

        additionalButtons() { return []; }

        addKeyboardShortCuts() {
            const self = this;

            // Add new keyboard shortcut for inserting a row
            this.hot.updateSettings({
                afterDocumentKeyDown: function (e) {
                    if (self.lastKey === 'Control' && e.key === 'n') {
                        let row = self.hot.getSelected()[0][0];
                        self.hot.alter('insert_row_above', (row + 1), 1)
                    }
                    self.lastKey = e.key;
                }
            });
        }

        afterCreateRow(index, amount, source) { this.updateHeight(); }
        afterRemoveRow(index, amount, physicalRows, source) { this.updateHeight(); }

        removeKeyboardShortCuts() {
            const self = this;

            // Remove keyboard shortcut for inserting a row
            this.hot.updateSettings({
                afterDocumentKeyDown: function (e) {
                    self.lastKey = e.key;
                }
            });
        }

        getProjectSelection() { return this.projectSelectComponent.getElementsByTagName('select')[0].value; }
        disableProjectSelection() { this.projectSelectComponent.getElementsByTagName('select')[0].disabled = true; }

        setProjectSelection(project) {
            let options = this.projectSelectComponent.getElementsByTagName('option');

            for (let i = 0; i < options.length; i++) {
                let option = options[i];
                if (option.value === project) {
                    option.selected = true;
                    break;
                }
            }
        }

        validateProjectSelection() {
            if (this.getProjectSelection() === '') {
                this.projectSelectComponent.classList.add('invalid')
                this.projectSelectComponent.querySelector('.prj-error').style.display = '';
                return false;
            } else {
                this.projectSelectComponent.classList.remove('invalid');
                this.projectSelectComponent.querySelector('.prj-error').style.display = 'none'
                return true;
            }
        }

        async populateSubjectSelector() {
            const self = this;

            let project = self.getProjectSelection();

            if (project === null || project === '') {
                return;
            }

            return XNAT.plugin.pixi.subjects.getAll(project)
                .then(resultSet => resultSet['ResultSet']['Result'])
                .then(subjects => {
                    let options = [];

                    subjects.sort(pixi.compareGenerator('label'));
                    subjects.forEach(subject => {
                        options.push(subject['label'])
                    });

                    let subjectIdColumn = this.getColumn('subjectId');
                    subjectIdColumn['source'] = options;
                    this.updateColumns();
                })
        }

        enableSubmitButton() { this.submitButton.disabled = false; }
        disableSubmitButton() { this.submitButton.disabled = true; }

        clearAndHideMessage() {
            this.messageComponent.style.display = 'none';
            this.messageComponent.innerHTML = '';
            this.messageComponent.classList.remove('success');
            this.messageComponent.classList.remove('error');
            this.messageComponent.classList.remove('warning');
            this.messageComponent.classList.remove('info');
        }

        displayMessage(type, message) {
            this.messageComponent.style.display = '';
            this.messageComponent.innerHTML = '';
            this.messageComponent.classList.add(type);
            this.messageComponent.append(message)
        }

        isEmpty() {
            return (this.hot.countEmptyRows() === this.hot.countRows())
        }

        updateData(data) {
            this.hot.updateData(data);
        }

        loadData(data) {
            this.hot.loadData(data);
        }

        getColumns() {
            let settings = this.hot.getSettings();
            return settings['columns'];
        }

        getColumn(data) {
            let columns = this.getColumns();
            return columns.find(col => col['data'] === data);
        }

        updateColumns() {
            this.hot.updateSettings({columns: this.getColumns()});
        }

        formatDate(inputDate) {
            let date, month, year;

            date = inputDate.getDate();
            month = inputDate.getMonth() + 1;
            year = inputDate.getFullYear();

            date = date
                .toString()
                .padStart(2, '0');

            month = month
                .toString()
                .padStart(2, '0');

            return `${month}/${date}/${year}`;
        }

        updateHeight() {
            let numRows = this.hot.countRows();
            let height = 26 + 23 * numRows + 4;
            let container = this.container.querySelector('.hot-container');
            container.style.height = `${height}px`;
        }
    }

    class AbstractXenograftEntryManager extends AbstractBulkEntryManager {

        constructor(heading, subheading, description) {
            super(heading, subheading, description);
        }

        async submitRow(row) { throw new Error("Method 'submitRow()' must be implemented."); }

        async init(containerId, project = null, subjects = []) {
           let hotSettings = {
                colHeaders: this.initialColumnHeaders(),
                colWidths: this.initialColumnWidths(),
                columns: this.initialColumns(),
                rowHeaders: true,
                manualColumnResize: true,
                contextMenu: ['row_above', 'row_below', '---------', 'remove_row', '---------', 'undo', 'redo', '---------', 'copy', 'cut'],
                width: '100%',
                licenseKey: 'non-commercial-and-evaluation',
                minRows: 1,
                hiddenColumns: {
                    columns: [1],
                    // show UI indicators to mark hidden columns
                    indicators: false
                }
            }

            return super.init(containerId, hotSettings, project, subjects)
                .then(() => {
                    if (project !== null && project !== undefined && project !== '') {
                        this.setProjectSelection(project);
                        this.disableProjectSelection();
                    }
                })
                .then(() => this.populateSubjectSelector())
                .then(() => {
                    if (subjects.length > 0) {
                        let data = [];

                        subjects.forEach(subject => {
                            data.push({
                                'subjectId': subject,
                                'experimentId': '',
                                'sourceId': '',
                                'injectionDate': '',
                                'injectionSite': '',
                                'injectionType': '',
                                'numCellsInjected': '',
                                'notes': ''
                            })
                        })

                        this.updateData(data);
                        this.hot.validateCells();
                        this.updateHeight();
                    }
                })
                .then(() => this.hot.addHook('beforeChange', (changes, source) => this.beforeChange(changes, source)));
        }

        validateSubjectId(subjectId, callback) {
            let isEmpty = (item) => item === null || item === '';

            if (isEmpty(subjectId)) {
                callback(false);
            } else {
                callback(this.getColumn('subjectId').source.contains(subjectId));
            }
        }

        validateSourceId(sourceId, callback) {
            let isEmpty = (item) => item === null || item === '';

            if (isEmpty(sourceId)) {
                callback(false);
            } else {
                callback(true);
            }
        }

        validateInjectionDate(injectionDate, callback) {
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
                if (changes[i][1] === 'injectionDate') {
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

        initialColumns() {
            return [
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
                {
                    data: 'experimentId'
                },
                {
                    data: 'sourceId',
                    type: 'autocomplete',
                    filter: true,
                    strict: false,
                    source: [],
                    allowEmpty: true,
                    allowInvalid: true,
                    validator: (value, callback) => this.validateSourceId(value, callback)
                },
                {
                    data: 'injectionDate',
                    type: 'date',
                    allowEmpty: true,
                    allowInvalid: true,
                    dateFormat: 'MM/DD/YYYY',
                    validator: (value, callback) => this.validateInjectionDate(value, callback)
                },
                {data: 'injectionSite'},
                {
                    data: 'injectionType',
                    type: 'autocomplete',
                    filter: true,
                    strict: false,
                    source: ['Subcutaneous', 'Orthotopic']
                },
                {
                    data: 'numCellsInjected',
                    type: 'numeric'
                },
                {data: 'notes'}
            ];
        }

        initialColumnHeaders() {
            return [
                "Subject ID *",
                "Experiment ID",
                "Injection *",
                "Injection Date *",
                "Injection Site",
                "Injection Type",
                "Num Cells Injected",
                "Notes"
            ];
        }

        initialColumnWidths() {
            return [
                150, 100, 150, 100, 150, 150, 150, 150
            ];
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
                    let subjectLabel = this.hot.getDataAtRowProp(iRow, 'subjectId');

                    await this.submitRow(iRow)
                        .then(id => {
                            successfulRows.push(iRow)
                            experiments.push({
                                'subjectId': subjectLabel,
                                'experimentId': id,
                                'row': iRow,
                                'url': `/data/projects/${projectId}/experiments/${id}?format=html`
                            });

                            return id;
                        })
                        .catch(error => {
                            console.error(`Error creating experiment: ${error}`);
                            failedRows.push(
                                {
                                    'subjectId': subjectLabel,
                                    'row': iRow,
                                    'error': error
                                }
                            )

                            return error;
                        });
                }

                XNAT.ui.dialog.close('submit_injection');

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

                XNAT.ui.dialog.close('submit_injection');
            })
        }
    }

    class CellLineEntryManager extends AbstractXenograftEntryManager {

        constructor() {
            super("Cell Line Details",
                "Enter cell line injection details",
                "After selecting a project, define the details of each cell line injection in the table below. A subject id, cell line, and injection date are required for each entry.");
        }

        async init(containerId, project = null, subjects = []) {
            return super.init(containerId, project, subjects)
                .then(() => this.initCellLineSelector())
        }

        initialColumnHeaders() {
            let columnHeaders = super.initialColumnHeaders();
            columnHeaders[2] = 'Cell Line *';
            return columnHeaders;
        }

        initCellLineSelector() {
            XNAT.plugin.pixi.cellLines.get().then(cellLines => {
                let options = [];

                cellLines.sort(pixi.compareGenerator('sourceId'));
                cellLines.forEach(cellLine => {
                    options.push(cellLine['sourceId'])
                });

                let columns = this.getColumns();
                columns[2]['source'] = options;
                this.hot.updateSettings({columns: columns});
            })
        }

        async submitRow(row) {
            let projectId = this.getProjectSelection();
            let subjectLabel = this.hot.getDataAtRowProp(row, 'subjectId');
            let experimentId = this.hot.getDataAtRowProp(row, 'experimentId');
            let sourceId = this.hot.getDataAtRowProp(row, 'sourceId');
            let injectionDate = this.hot.getDataAtRowProp(row, 'injectionDate');
            let injectionSite = this.hot.getDataAtRowProp(row, 'injectionSite');
            let injectionType = this.hot.getDataAtRowProp(row, 'injectionType');
            let numCellsInjected = this.hot.getDataAtRowProp(row, 'numCellsInjected');
            let notes = this.hot.getDataAtRowProp(row, 'notes');

            return XNAT.plugin.pixi.experiments.cellLine.createOrUpdate(projectId, subjectLabel, experimentId, '', sourceId,
                injectionDate, injectionSite, injectionType, numCellsInjected, notes)
        }
    }

    class PdxEntryManager extends AbstractXenograftEntryManager {

        constructor() {
            super("PDX Details",
                "Enter injection details",
                "After selecting a project, define the details of each injection in the table below. A subject id, PDX, and injection date are required for each entry.");
        }

        async init(containerId, project = null, subjects = []) {
            return super.init(containerId, project, subjects)
                .then(() => this.initPdxSelector())
        }

        initialColumnHeaders() {
            let columnHeaders = super.initialColumnHeaders();
            columnHeaders[2] = 'PDX *';
            columnHeaders.splice(7, 0, 'Passage');
            columnHeaders.splice(8, 0, 'Passage Method');
            return columnHeaders;
        }

        initialColumns() {
            let columns = super.initialColumns();
            columns.splice(7, 0, {data: 'passage'});
            columns.splice(8, 0, {data: 'passageMethod'});
            return columns;
        }

        initialColumnWidths() {
            let columnWidths = super.initialColumnWidths();
            columnWidths.splice(7, 0, 100);
            columnWidths.splice(8, 0, 130);
            return columnWidths;
        }

        initPdxSelector() {
            XNAT.plugin.pixi.pdxs.get().then(pdxs => {
                let options = [];

                pdxs.sort(pixi.compareGenerator('sourceId'));
                pdxs.forEach(cellLine => {
                    options.push(cellLine['sourceId'])
                });

                let columns = this.getColumns();
                columns[2]['source'] = options;
                this.hot.updateSettings({columns: columns});
            })
        }

        async submitRow(row) {
            let projectId = this.getProjectSelection();
            let subjectLabel = this.hot.getDataAtRowProp(row, 'subjectId');
            let experimentId = this.hot.getDataAtRowProp(row, 'experimentId');
            let sourceId = this.hot.getDataAtRowProp(row, 'sourceId');
            let injectionDate = this.hot.getDataAtRowProp(row, 'injectionDate');
            let injectionSite = this.hot.getDataAtRowProp(row, 'injectionSite');
            let injectionType = this.hot.getDataAtRowProp(row, 'injectionType');
            let numCellsInjected = this.hot.getDataAtRowProp(row, 'numCellsInjected');
            let passage = this.hot.getDataAtRowProp(row, 'passage');
            let passageMethod = this.hot.getDataAtRowProp(row, 'passageMethod');
            let notes = this.hot.getDataAtRowProp(row, 'notes');

            return XNAT.plugin.pixi.experiments.pdx.createOrUpdate(projectId, subjectLabel, experimentId, '', sourceId,
                injectionDate, injectionSite, injectionType, numCellsInjected, passage, passageMethod, notes);
        }
    }

    class SubjectEntryManager extends AbstractBulkEntryManager {

        constructor() {
            super("New Subjects",
                "Enter subject details",
                "After selecting a project, define the details of each subject. The 'Subject ID' should be a " +
                "single word or acronym which will identify your subject and cannot contain spaces or special " +
                "characters.");
        }

        async init(containerId, project = null, subjects = []) {
            let colHeaders = [
                "Subject ID *",
                "Research Group",
                "Species",
                "Sex",
                "Date of Birth",
                "Litter ID",
                "Strain",
                "Vendor",
                "Stock #",
                "Humanization Type",
                "Genetic Mods",
                "Genetic Mods (non-std)"
            ];

            let colWidths = [175, 115, 150, 50, 100, 100, 150, 150, 75, 115, 150, 150];

            // Columns
            let columns = [
                {
                    data: 'subjectId',
                    validator: (value, callback) => this.validateSubjectId(value, callback),
                    allowInvalid: true
                },
                {data: 'researchGroup'},
                {
                    data: 'species',
                    type: 'autocomplete',
                    filter: true,
                    strict: false,
                    source: []
                },
                {
                    data: 'sex',
                    type: 'dropdown',
                    source: ['', 'F', 'M']
                },
                {
                    data: 'dob',
                    type: 'date',
                    dateFormat: 'MM/DD/YYYY'
                },
                {data: 'litter'},
                {data: 'strain'},
                {
                    data: 'vendor',
                    type: 'autocomplete',
                    filter: true,
                    strict: false,
                    source: []
                },
                {data: 'stockNumber'},
                {data: 'humanizationType'},
                {data: 'geneticModifications'},
                {data: 'geneticModificationsNonStd'}
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

            }

            return super.init(containerId, hotSettings, project, subjects)
                .then(() => this.initSpeciesSelector())
                .then(() => this.initVendorSelector())
                .then(() => {
                    if (project !== null && project !== undefined && project !== '') {
                        this.setProjectSelection(project)
                        this.disableProjectSelection();
                    }
                })
                .then(() => this.hot.addHook('beforeChange', (changes, source) => this.beforeChange(changes, source)))
                .then(() => this.hot.addHook('afterValidate', (isValid, value, row, prop)=> this.afterValidate(isValid, value, row, prop)));
        }

        additionalButtons() {
            const self = this;

            let buttons = super.additionalButtons();

            buttons.push(
                spawn('input.btn.pull-right|type=button|value=Enter PDX Details', {
                    onclick: () => {
                        xmodal.confirm({
                            title: "Leave Subject Editor",
                            height: 150,
                            scroll: false,
                            okLabel: 'Yes',
                            cancelLabel: 'No',
                            content: `<p>Are you finished? Any unsubmitted data will be lost.</p>`,
                            okAction: () => {
                                let project = self.getProjectSelection();
                                let subjects = self.hot.getDataAtProp('subjectId').filter(s => s !== null && s !== '');
                                XNAT.plugin.pixi.pdxEntryManager.init(self.containerId, project, subjects);
                            },
                        })
                    }
                }),
                spawn('input.btn.pull-right|type=button|value=Enter Cell Line Details', {
                    onclick: () => {
                        xmodal.confirm({
                            title: "Leave Subject Editor",
                            height: 150,
                            scroll: false,
                            okLabel: 'Yes',
                            cancelLabel: 'No',
                            content: `<p>Are you finished? Any unsubmitted data will be lost.</p>`,
                            okAction: () => {
                                let project = self.getProjectSelection();
                                let subjects = self.hot.getDataAtProp('subjectId').filter(s => s !== null && s !== '');
                                XNAT.plugin.pixi.cellLineEntryManager.init(self.containerId, project, subjects);
                            },
                        })
                    }
                })
            )

            return buttons;
        }

        initSpeciesSelector() {
            XNAT.plugin.pixi.speices.get().then(species => {
                let options = [];

                species.sort(pixi.compareGenerator('scientificName'))
                species.forEach(specie => {
                    options.push(specie['scientificName'])
                });

                let columns = this.getColumns();
                columns[2]['source'] = options;
                this.hot.updateSettings({columns: columns});
            })
        }

        initVendorSelector() {
            XNAT.plugin.pixi.vendors.get().then(vendors => {
                let options = [];

                vendors.sort(pixi.compareGenerator('vendor'));
                vendors.forEach(vendor => options.push(vendor['vendor']));

                let columns = this.getColumns();
                columns[7]['source'] = options;
                this.hot.updateSettings({columns: columns});
            });
        }

        validateSubjectId(subjectId, callback) {
            let isEmpty = (item) => item === null || item === undefined || item === '';

            if (isEmpty(subjectId)) {
                callback(false);
                return;
            }

            setTimeout(() => {
                let projectId = this.getProjectSelection();
                XNAT.plugin.pixi.subjects.get(projectId, subjectId)
                    .then(() => callback(false))
                    .catch(() => callback(true));
            }, 150);
        }

        beforeChange(changes, source) {
            for (let i = changes.length - 1; i >= 0; i--) {
                if (changes[i][1] === 'subjectId') {
                    if (changes[i][3] !== null && changes[i][3] !== undefined && changes[i][3] !== '') {
                        // Remove spaces and special characters from subject ids
                        changes[i][3] = changes[i][3].replaceAll(' ', '_');
                        changes[i][3] = changes[i][3].replaceAll(/[!@#&?<>()*$%]/g, "_");

                        // Append _1, _2, _3, ... to the subject ids to prevent entry of duplicate id's
                        let counter = 1;
                        if (changes[i][2] !== changes[i][3]) { // If the data changed
                            while (this.hot.getDataAtProp('subjectId').contains(changes[i][3])) {
                                if (counter === 1) {
                                    changes[i][3] = `${changes[i][3]}_${counter}`;
                                } else {
                                    changes[i][3] = changes[i][3].slice(0, -1).concat(counter);
                                }
                                counter = counter + 1;
                            }
                        }
                    }
                }
            }
        }

        afterValidate(isValid, value, row, prop) {
            let key = `${prop}.${row}`;

            if (!isValid) {
                let displayRow = row + 1;

                if (prop === "subjectId") {
                    if (value !== null && value !== undefined && value !== '') {
                        // Failed because it matches an existing subject
                        this.errorMessages.set(key, `${value} matches an existing subject id in 
                            ${XNAT.app.displayNames.singular.project.toLowerCase()} ${this.getProjectSelection()}.`);
                    } else {
                        this.errorMessages.delete(key);
                    }
                }
            } else {
                this.errorMessages.delete(key);
            }

            if (this.errorMessages.size > 0) {
                let message = spawn('div', [
                    spawn('p', 'Errors found:'),
                    spawn('ul', Array.from(this.errorMessages.values()).map(msg => spawn('li', msg)))
                ])

                this.displayMessage('error', message);
            } else {
                this.clearAndHideMessage();
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

                XNAT.ui.dialog.static.wait('Submitting to XNAT', {id: "submit_form"});

                let projectId = this.getProjectSelection();
                let subjects = [];

                let successfulRows = [];
                let failedRows = [];

                for (let iRow = 0; iRow < this.hot.countRows(); iRow++) {
                    let subjectLabel = this.hot.getDataAtRowProp(iRow, 'subjectId');

                    let researchGroup = this.hot.getDataAtRowProp(iRow, 'researchGroup');
                    let species = this.hot.getDataAtRowProp(iRow, 'species');
                    let sex = this.hot.getDataAtRowProp(iRow, 'sex');
                    let dob = this.hot.getDataAtRowProp(iRow, 'dob');
                    let litter = this.hot.getDataAtRowProp(iRow, 'litter');
                    let strain = this.hot.getDataAtRowProp(iRow, 'strain');
                    let source = this.hot.getDataAtRowProp(iRow, 'vendor');
                    let stockNumber = this.hot.getDataAtRowProp(iRow, 'stockNumber');
                    let humanizationType = this.hot.getDataAtRowProp(iRow, 'humanizationType');
                    let geneticModifications = this.hot.getDataAtRowProp(iRow, 'geneticModifications');
                    let geneticModificationsNonStd = this.hot.getDataAtRowProp(iRow, 'geneticModificationsNonStd');

                    await XNAT.plugin.pixi.subjects.createOrUpdate(projectId, subjectLabel, researchGroup, species,
                        sex, dob, litter, strain, source, stockNumber, humanizationType, geneticModifications,
                        geneticModificationsNonStd)
                        .then(url => {
                            successfulRows.push(iRow)
                            subjects.push({
                                'subjectId': subjectLabel,
                                'url': url
                            });

                            return url;
                        })
                        .catch(error => {
                            console.error(`Error creating subject: ${error}`);

                            failedRows.push(
                                {
                                    'subjectId': subjectLabel,
                                    'row': iRow,
                                    'error': error
                                }
                            )

                            return error;
                        })
                }

                XNAT.ui.dialog.close('submit_form');

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

                if (failedRows.length === 0) {
                    // Success
                    let message = spawn('div', [
                        spawn('p', 'Successful submissions:'),
                        spawn('ul', subjects.map(subject => spawn('li', [spawn(`a`, {
                            href: subject['url'],
                            target: '_BLANK'
                        }, subject['subjectId'])])))
                    ])

                    this.displayMessage('success', message);

                    // Disable resubmissions
                    this.disableSubmitButton();
                } else if (successfulRows.length === 0 && failedRows.length > 0) {
                    // All submissions in error
                    let message = spawn('div', [
                        spawn('p', ''),
                        spawn('p', 'There were errors with your submission. Correct the issues and try resubmitting.'),
                        spawn('ul', failedRows.map(subject => spawn('li', `Row: ${subject['row'] + 1} ${XNAT.app.displayNames.singular.subject} ID: ${subject['subjectId']} ${subject['error']}`))),
                    ])

                    this.displayMessage('error', message);
                } else if (successfulRows.length > 0 && failedRows.length > 0) {
                    // Some submitted successfully, some failed
                    let message = spawn('div', [
                        spawn('p', 'There were errors with your submission. Correct the issues and try resubmitting.'),
                        spawn('p', 'Error(s):'),
                        spawn('ul', failedRows.map(subject => spawn('li', `Row: ${subject['row'] + 1} ${XNAT.app.displayNames.singular.subject} ID: ${subject['subjectId']} ${subject['error']}`))),
                        spawn('p', 'Successful submissions:'),
                        spawn('ul', subjects.map(subject => spawn('li', [spawn(`a`, {
                            href: subject['url'],
                            target: '_BLANK'
                        }, subject['subjectId'])])))
                    ])

                    this.displayMessage('warning', message);
                }

                XNAT.ui.dialog.close('submit_form');

            });
        }
    }

    XNAT.plugin.pixi.subjectEntryManager = new SubjectEntryManager();
    XNAT.plugin.pixi.cellLineEntryManager = new CellLineEntryManager();
    XNAT.plugin.pixi.pdxEntryManager = new PdxEntryManager();

}));
