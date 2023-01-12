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
    
    let validationMixins = {
        isEmpty(item) {
            return item === null || item === undefined || item === '';
        },
        validateSubjectLabel(project, subject, method ,callback) {
            if (validationMixins.isEmpty(subject)) {
                callback(false);
                return;
            }
            
            let thenCb, catchCb;
            
            switch(method) {
                case 'create':
                case 'new':
                    thenCb = false;
                    catchCb = true;
                    break;
                case 'update':
                case 'existing':
                    thenCb = true;
                    catchCb = false;
                    break;
            }
    
            setTimeout(() => {
                XNAT.plugin.pixi.subjects.get(project, subject)
                    .then(() => callback(thenCb))
                    .catch(() => callback(catchCb));
            }, 150);
        },
        validateNewSubjectLabel(project, subject, callback) {
            validationMixins.validateSubjectLabel(project, subject, 'new', callback);
        },
        validateExistingSubjectLabel(project, subject, callback) {
            validationMixins.validateSubjectLabel(project, subject, 'update', callback);
        }
    };
    
    let actionMixins = {
        async populateMultiSubjectSelector(element, project) {
            while (element.options.length > 0) {
                element.options.remove(element.options.length - 1);
            }
        
            if (this.isEmpty(project)) {
                return;
            }
        
            return XNAT.plugin.pixi.subjects.getAll(project)
                       .then(resultSet => resultSet['ResultSet']['Result'])
                       .then(subjects => {
                           let options = [];
            
                           subjects.sort(pixi.compareGenerator('label'));
                           subjects.forEach(subject => {
                               element.options.add(new Option(subject['label'], subject['id']))
                           });
                       })
        },
        disableMultiSubjectSelector(element) {
            element.disabled = true;
        }
    }
    
    class AbstractXenograftEntryManager extends XNAT.plugin.pixi.abstractBulkEntryManager {

        constructor(heading, subheading, description) {
            super(heading, subheading, description);
            Object.assign(this, validationMixins);
            Object.assign(this, actionMixins);
        }

        async submitRow(row) { throw new Error("Method 'submitRow()' must be implemented."); }
    
        async init(containerId, hotSettings = null, project = null, subjects = []) {
            let initData = [];
            
            if (subjects.length > 0) {
                subjects.forEach(subject => {
                    initData.push({
                                  'subjectId':        subject,
                                  'experimentId':     '',
                                  'sourceId':         '',
                                  'injectionDate':    '',
                                  'injectionSite':    '',
                                  'injectionType':    '',
                                  'numCellsInjected': '',
                                  'notes':            ''
                              })
                })
            } else {
                initData = new Array(5).fill(undefined).map(u => ({
                    'subjectId':        '',
                    'experimentId':     '',
                    'sourceId':         '',
                    'injectionDate':    '',
                    'injectionSite':    '',
                    'injectionType':    '',
                    'numCellsInjected': '',
                    'notes':            ''
                }))
            }
            
            hotSettings = {
                data:               initData,
                colHeaders:         this.initialColumnHeaders(),
                colWidths:          this.initialColumnWidths(),
                columns:            this.initialColumns(),
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
        
            return super.init(containerId, hotSettings, project, subjects)
                        .then(() => this.hot.addHook('beforeChange',
                                                     (changes, source) => this.beforeChange(changes, source)))
                        .then(() => {
                            const subjectsSelectElement = document.getElementById('subjects');
                            const project = this.getProjectSelection();
                            this.populateMultiSubjectSelector(subjectsSelectElement, project);
                            
                            document.addEventListener('project-changed', () => this.populateMultiSubjectSelector(subjectsSelectElement, project));
                            document.addEventListener('submit', () => this.disableMultiSubjectSelector(subjectsSelectElement));
                        });
        }
        
        getXsiType() { return '' }
        
        containerBody() {
            let containerBody = super.containerBody();
    
            containerBody = [
                spawn('div.row', [
                    spawn('div.form-component.containerItem.half.action.create.active',
                          {onclick: () => this.toggleAction('create')}, // TODO clear experiment id??
                          [
                              spawn('input.form-control.action.create|type=\'radio\'',
                                    {
                                        id:      'createAction',
                                        name:    'action',
                                        checked: true,
                                    }),
                              spawn('label|for=\'createAction\'', 'New'),
                          ]),
                    spawn('div.form-component.containerItem.half.action.update.disabled',
                          {onclick: () => this.toggleAction('update')},
                          [
                              spawn('input.form-control.action.update|type=\'radio\'',
                                    {
                                        id:   'updateAction',
                                        name: 'action'
                                    }),
                              spawn('label|for=\'updateAction\'', 'Update'),
                          ])
                ]),
                spawn('hr'),
                spawn('div.row', [
                    containerBody[0],
                    spawn('div.subjects-component.form-component.col.containerItem.third', {style: {display: 'none'}}, [
                        spawn('label|for=\'subjects\'', 'Select Subjects'),
                        spawn('select.form-control|', {
                            id:       'subjects',
                            name:     'subjects',
                            multiple: true,
                            onchange: async () => {
                                let subjectsEl = document.getElementById('subjects');
                                let selectedSubjects = Array.from(subjectsEl.selectedOptions).map(option => option.text);

                                let hotData = JSON.parse(JSON.stringify(this.hot.getSourceData()));

                                // Remove deselected subjects
                                hotData = hotData.filter(row => selectedSubjects.contains(row['subjectId']))

                                // Add newly selected subjects
                                let currentSubjects = hotData.map(row => row['subjectId']);

                                for (const subject of selectedSubjects) {
                                    if (!currentSubjects.contains(subject)) {
                                        const response = await XNAT.plugin.pixi.experiments.get(this.getProjectSelection(), subject, '', this.getXsiType());
                                        
                                        // Skip subjects without experiments
                                        if (response['ResultSet']['Result'].length === 0) {
                                            continue;
                                        }
                                        
                                        // Add each experiment to hot
                                        for (const result of response['ResultSet']['Result']) {
                                            const response = await XNAT.plugin.pixi.experiments.get('', '', result['ID'], '');
                                            let data_fields = response['items'][0]['data_fields']
                                            
                                            let experiment = {
                                                'subjectId':        subject,
                                                'experimentId':     result['ID'],
                                                'sourceId':         data_fields['sourceId'],
                                                'injectionDate':    data_fields['date'],
                                                'injectionSite':    data_fields['injectionSite'],
                                                'injectionType':    data_fields['injectionType'],
                                                'numCellsInjected': data_fields['numCellsInjected'],
                                                'notes':            data_fields['note']
                                            }
                                            
                                            hotData.push(experiment);
                                        }
                                    }
                                }

                                hotData = hotData.sort(XNAT.plugin.pixi.compareGenerator('subjectId'));

                                this.updateData(hotData);
                                this.updateHeight();

                                this.hot.validateCells();
                            }
                        }),
                    ])
                ])
            ]
            
            return containerBody;
        }
        
        toggleAction(action) {
            document.querySelectorAll(`.form-component.action input.action`).forEach(input => {
                input.disabled = !input.classList.contains(action);
                input.checked = input.classList.contains(action);
            })
    
            document.querySelectorAll(`.form-component.action`).forEach(input => {
                if (input.classList.contains(action)) {
                    // Selected
                    input.classList.add('active');
                    input.classList.remove('disabled');
                    input.disabled = false;
                } else {
                    input.classList.add('disabled');
                    input.classList.remove('active');
                    input.disabled = true;
                }
            })
    
            if (action === 'create') {
                document.querySelector(`.subjects-component`).style.display = 'none';
                const subjectLabelColumn = this.getColumn('subjectId');
                subjectLabelColumn.validator = (value, callback) => this.validateNewSubjectLabel(this.getProjectSelection(), value, callback);
                subjectLabelColumn['readOnly'] = false;
                this.updateColumns();
            } else if (action === 'update') {
                document.querySelector(`.subjects-component`).style.display = '';
                const subjectLabelColumn = this.getColumn('subjectId');
                subjectLabelColumn.validator = (value, callback) => this.validateExistingSubjectLabel(this.getProjectSelection(), value, callback);
                subjectLabelColumn['readOnly'] = true;
                this.updateColumns();
            }
    
            this.hot.validateCells();
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

            if (this.isHotEmpty()) {
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

                XNAT.ui.dialog.static.wait('Submitting to XNAT', {id: "submit"});

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

                XNAT.ui.dialog.close('submit');
    
                document.dispatchEvent(new Event('submit'));

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
            super("Cell Line Data Manager",
                "Enter cell line injection details",
                "After selecting a project, define the details of each cell line injection in the table below. A subject id, cell line, and injection date are required for each entry.");
        }

        async init(containerId, hotSettings = null, project = null, subjects = []) {
            return super.init(containerId, hotSettings, project, subjects)
                        .then(() => this.initCellLineSelector())
        }
    
        getXsiType() {
            return 'pixi:cellLineData';
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
            super("PDX Data Manager Details",
                "Enter injection details",
                "After selecting a project, define the details of each injection in the table below. A subject id, PDX, and injection date are required for each entry.");
        }

        async init(containerId, hotSettings = null, project = null, subjects = []) {
            return super.init(containerId, hotSettings = null, project, subjects)
                .then(() => this.initPdxSelector())
        }
        
        getXsiType() {
            return 'pixi:pdxData';
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

    class SubjectEntryManager extends XNAT.plugin.pixi.abstractBulkEntryManager {

        constructor() {
            super("Small Animal Subjects Manager",
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
                    data: 'label',
                    validator: (value, callback) => this.validateNewSubjectLabel(value, callback),
                    allowInvalid: true
                },
                {data: 'group'},
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
            
            const initData = new Array(5).fill(undefined).map(u => ({
                'id': '',
                'label': '',
                'project': '',
                'group': '',
                'sex': '',
                'dob': '',
                'litter': '',
                'strain': '',
                'vendor': '',
                'stockNumber': '',
                'humanizationType': '',
                'geneticModifications': '',
                'geneticModificationsNonStd': '',
            }))
            
            let hotSettings = {
                data: initData,
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
                        .then(() => this.hot.addHook('beforeChange',
                                                     (changes, source) => this.beforeChange(changes, source)))
                        .then(() => this.hot.addHook('afterValidate',
                                                     (isValid, value, row, prop) => this.afterValidate(isValid,
                                                                                                       value,
                                                                                                       row,
                                                                                                       prop)));
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
                                let subjects = self.hot.getDataAtProp('label').filter(s => s !== null && s !== '');
                                XNAT.plugin.pixi.pdxEntryManager.init(self.containerId, null, project, subjects);
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
                                let subjects = self.hot.getDataAtProp('label').filter(s => s !== null && s !== '');
                                XNAT.plugin.pixi.cellLineEntryManager.init(self.containerId, null, project, subjects);
                            },
                        })
                    }
                })
            )

            return buttons;
        }
    
        containerBody() {
            let containerBody = super.containerBody();
        
            containerBody = [
                    spawn('div.row', [
                        spawn('div.form-component.containerItem.half.action.create.active',
                              {onclick: () => this.toggleAction('create')},
                              [
                                  spawn('input.form-control.action.create|type=\'radio\'',
                                        {
                                            id:      'createAction',
                                            name:    'action',
                                            checked: true,
                                        }),
                                  spawn('label|for=\'createAction\'', 'Create New Subjects'),
                              ]),
                        spawn('div.form-component.containerItem.half.action.update.disabled',
                              {onclick: () => this.toggleAction('update')},
                              [
                                  spawn('input.form-control.action.update|type=\'radio\'',
                                        {
                                            id:   'updateAction',
                                            name: 'action'
                                        }),
                                  spawn('label|for=\'updateAction\'', 'Update Existing Subjects'),
                              ])
                    ]),
                    spawn('hr'),
                    containerBody[0],
                    spawn('div.subjects-component.form-component.col.containerItem.third', {style: {display: 'none'}}, [
                        spawn('label|for=\'subjects\'', 'Select Subjects'),
                        spawn('select.form-control|', {
                            id:       'subjects',
                            name:     'subjects',
                            multiple: true,
                            onchange: async () => {
                                let subjectsEl = document.getElementById('subjects');
                                let selectedSubjects = Array.from(subjectsEl.selectedOptions).map(option => option.text);
                            
                                let data = JSON.parse(JSON.stringify(this.hot.getSourceData()));
                            
                                // Remove deselected subjects
                                data = data.filter(row => selectedSubjects.contains(row['label']))
                            
                                // Add newly selected subjects
                                let currentSubjects = data.map(row => row['label']);
                            
                                for (const subject of selectedSubjects) {
                                    if (!currentSubjects.contains(subject)) {
                                        const subjectDetails = await XNAT.plugin.pixi.subjects.get(this.getProjectSelection(),
                                                                                                   subject);
                                        data.push(subjectDetails);
                                    }
                                }
                            
                                data = data.sort(XNAT.plugin.pixi.compareGenerator('label'));
                            
                                this.updateData(data);
                                this.updateHeight();
                            
                                this.hot.validateCells();
                            }
                        }),
                    ])
                ]
        
            return containerBody;
        }
        
        async populateSubjectSelector() {
            const self = this;
        
            let project = self.getProjectSelection();
            
            let subjectSelectEl = document.getElementById('subjects');
            
            while (subjectSelectEl.options.length > 0) {
                subjectSelectEl.options.remove(subjectSelectEl.options.length - 1);
            }
            
            if (project === null || project === undefined || project === '') {
                return;
            }
        
            return XNAT.plugin.pixi.subjects.getAll(project)
                       .then(resultSet => resultSet['ResultSet']['Result'])
                       .then(subjects => {
                           let options = [];
            
                           subjects.sort(pixi.compareGenerator('label'));
                           subjects.forEach(subject => {
                               subjectSelectEl.options.add(new Option(subject['label'], subject['id']))
                           });
                       })
        }
        
        toggleAction(action) {
            document.querySelectorAll(`.form-component.action input.action`).forEach(input => {
                input.disabled = !input.classList.contains(action);
                input.checked = input.classList.contains(action);
            })
    
            document.querySelectorAll(`.form-component.action`).forEach(input => {
                if (input.classList.contains(action)) {
                    // Selected
                    input.classList.add('active');
                    input.classList.remove('disabled');
                    input.disabled = false;
                } else {
                    input.classList.add('disabled');
                    input.classList.remove('active');
                    input.disabled = true;
                }
            })
            
            if (action === 'create') {
                document.querySelector(`.subjects-component`).style.display = 'none';
                const subjectLabelColumn = this.getColumn('label');
                subjectLabelColumn.validator = (value, callback) => this.validateNewSubjectLabel(value, callback);
                subjectLabelColumn['readOnly'] = false;
                this.updateColumns();
            } else if (action === 'update') {
                document.querySelector(`.subjects-component`).style.display = '';
                const subjectLabelColumn = this.getColumn('label');
                subjectLabelColumn.validator = (value, callback) => this.validateExistingSubjectLabel(value, callback);
                subjectLabelColumn['readOnly'] = true;
                this.updateColumns();
            }
            
            this.hot.validateCells();
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

        validateNewSubjectLabel(value, callback) {
            let isEmpty = (item) => item === null || item === undefined || item === '';

            if (isEmpty(value)) {
                callback(false);
                return;
            }

            setTimeout(() => {
                let projectId = this.getProjectSelection();
                XNAT.plugin.pixi.subjects.get(projectId, value)
                    .then(() => callback(false))
                    .catch(() => callback(true));
            }, 150);
        }
    
        validateExistingSubjectLabel(value, callback) {
            let isEmpty = (item) => item === null || item === undefined || item === '';
        
            if (isEmpty(value)) {
                callback(false);
                return;
            }
        
            setTimeout(() => {
                let projectId = this.getProjectSelection();
                XNAT.plugin.pixi.subjects.get(projectId, value)
                    .then(() => callback(true))
                    .catch(() => callback(false));
            }, 150);
        }

        beforeChange(changes, source) {
            for (let i = changes.length - 1; i >= 0; i--) {
                if (changes[i][1] === 'label') {
                    if (changes[i][3] !== null && changes[i][3] !== undefined && changes[i][3] !== '') {
                        // Remove spaces and special characters from subject ids
                        changes[i][3] = changes[i][3].replaceAll(' ', '_');
                        changes[i][3] = changes[i][3].replaceAll(/[!@#&?<>()*$%]/g, "_");

                        // Append _1, _2, _3, ... to the subject ids to prevent entry of duplicate id's
                        let counter = 1;
                        if (changes[i][2] !== changes[i][3]) { // If the data changed
                            while (this.hot.getDataAtProp('label').contains(changes[i][3])) {
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

                if (prop === "label") {
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

            if (this.isHotEmpty()) {
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
                    let subjectLabel = this.hot.getDataAtRowProp(iRow, 'label');

                    let group = this.hot.getDataAtRowProp(iRow, 'group');
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

                    await XNAT.plugin.pixi.subjects.createOrUpdate(projectId, subjectLabel, group, species,
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
    
    // XNAT.plugin.pixi.abstractBulkEntryManager = AbstractBulkEntryManager;
    XNAT.plugin.pixi.subjectEntryManager = new SubjectEntryManager();
    XNAT.plugin.pixi.cellLineEntryManager = new CellLineEntryManager();
    XNAT.plugin.pixi.pdxEntryManager = new PdxEntryManager();
}));
