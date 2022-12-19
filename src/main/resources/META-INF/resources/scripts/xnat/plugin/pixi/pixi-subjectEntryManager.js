/*
 *  PIXI Subject Entry Manager
 *
 *  This script depends on functions in pixi-module.js
 */

console.log('pixi-subjectEntryManager.js');

var XNAT = getObject(XNAT || {});
XNAT.plugin = getObject(XNAT.plugin || {});
XNAT.plugin.pixi = pixi = getObject(XNAT.plugin.pixi || {});

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

    console.log('pixi-subjectEntryManager.js - SubjectEntryManager');

    class SubjectEntryManager {
        containerId;
        container;

        projectSelectComponent;
        submitButton;

        messageComponent;

        columns;
        hot;
        errorMessages;
        successMessages;
        lastKey;

        constructor() {
            this.errorMessages = new Map();
            this.successMessages = new Map();
        }

        spawn() {
            const self = this;

            this.container = document.getElementById(this.containerId);

            this.projectSelectComponent = spawn('div.form-component.containerItem', [
                spawn('label.required|for=\'project\'', 'Select a Project'),
                spawn('select.form-control', {
                        id: 'project',
                        name: 'project',
                        onchange: () => {
                            self.validateProjectSelection();
                            self.hot.validateCells();
                        }},
                    [spawn('option|', {selected: true, disabled: true, value: ''}, '')]),
                spawn('div.prj-error', {style: {display: 'none'}}, 'Please select a project')
            ]);


            this.messageComponent = spawn('div', {id: 'table-msg', style: {display: 'none'}});

            let titleEl = spawn('h2', 'New Subjects');

            let panel = spawn('div.container', [
                spawn('div.withColor containerTitle', 'Enter subject details'),
                spawn('div.containerBody', [
                    spawn('div.containerItem', 'After selecting a project, define the details of each subject. ' +
                        'The \'Subject ID\' should be a single word or acronym which will identify your subject and ' +
                        'cannot contain spaces or special characters.'),
                    spawn('hr'),
                    self.projectSelectComponent,
                    spawn('div.hot-container.containerIterm', [spawn('div.hot-table')]),
                    self.messageComponent
                ])
            ]);

            this.submitButton = spawn('input.btn1.pull-right|type=button|value=Create Subjects', {
                disabled: true,
                onclick: () => {
                    xmodal.confirm({
                        title: "Confirm Submission",
                        height: 220,
                        scroll: false,
                        content: `<p>Are you ready to submit these ${XNAT.app.displayNames.plural.subject.toLowerCase()}?</p>`,
                        okAction: () => self.submit(),
                    })
                }
            });

            let buttons = spawn('div.submit-right', [
                self.submitButton,
                spawn('input.btn.pull-right|type=button|value=Enter PDX Details', {onclick: () => {self.reset(); XNAT.plugin.pixi.pdxEntryManager.init(self.containerId)}}),
                spawn('input.btn.pull-right|type=button|value=Enter Cell Line Details', {onclick: () => self.reset()}),
                spawn('div.clear')
            ])

            this.container.innerHTML = '';
            this.container.append(titleEl);
            this.container.append(panel);
            this.container.append(buttons);

            XNAT.plugin.pixi.projects.populateSelectBox('project');
        }

        reset() {
            this.container.innerHTML = '';
        }

        init(containerId) {
            const self = this;

            this.containerId = containerId;
            this.spawn();

            // Column headers and widths
            let colHeaders = [
                "Subject ID",
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

            // Column validators
            const subjectValidator = (value, callback) => {
                if (value == null || value === '' ) {
                    callback(true);
                    return;
                }

                setTimeout(() => {
                    let projectId = self.getProjectSelection();
                    XNAT.plugin.pixi.subjects.get(projectId, value)
                        .then(() => callback(false))
                        .catch((e) => {
                            console.error(e);
                            callback(true);
                        });
                }, 150);
            }

            // Columns
            this.columns =  [
                {
                    data: 'subjectId',
                    validator: subjectValidator,
                    allowInvalid: true
                },
                { data: 'researchGroup' },
                {
                    data: 'species',
                    type: 'autocomplete',
                    filter: false,
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
                { data: 'litter' },
                { data: 'strain' },
                {
                    data: 'vendor',
                    type: 'autocomplete',
                    filter: false,
                    strict: false,
                    source: []
                },
                { data: 'stockNumber' },
                { data: 'humanizationType' },
                { data: 'geneticModifications' },
                { data: 'geneticModifications2' }
            ]

            // Handsontable
            this.hot = new Handsontable(self.container.querySelector('.hot-table'), {
                data: [
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""],
                    ["", "", "", "", "", "", "", "", "" ,"" ,"", ""]
                ],
                rowHeaders: true,
                colHeaders: colHeaders,
                manualColumnResize: true,
                colWidths: colWidths,
                columns: this.columns,
                contextMenu: ['row_above', 'row_below', '---------', 'remove_row',  '---------',  'undo', 'redo', '---------', 'copy', 'cut'],
                hiddenColumns: true,
                width: '100%',
                licenseKey: 'non-commercial-and-evaluation',
                afterValidate: (isValid, value, row, prop) => {
                    let key = `${prop}.${row}`;

                    if (!isValid) {
                        if (prop === "subjectId") {
                            let displayRow = row + 1;

                            // Otherwise presume it matches an existing subject id in the project.
                            self.errorMessages.set(key, `Row ${displayRow}: ${value} matches an existing subject id in 
                            ${XNAT.app.displayNames.singular.project.toLowerCase()} ${self.getProjectSelection()}.`);
                        }
                    } else {
                        self.errorMessages.delete(key);
                    }

                    let isProjectValid = self.validateProjectSelection();
                    let isEmpty = self.isEmpty();
                    let isFirstSubject = isEmpty && prop === "subjectId" && value !== null && value !== '';

                    if (self.errorMessages.size > 0) {
                        let message = spawn('div', [
                            spawn('p', 'Errors found:'),
                            spawn('ul', Array.from(self.errorMessages.values()).map(msg => spawn('li',msg)))
                        ])

                        self.displayMessage('error', message);

                        self.disableSubmitButton();
                    } else {
                        self.clearAndHideMessage();

                        // Valid project and ((table is not empty) or (table is empty and this is the first subjectId))
                        if (isProjectValid && (!isEmpty || isFirstSubject)) self.enableSubmitButton();
                    }
                },
                beforeChange: (changes, source) => {
                    for (let i = changes.length - 1; i >= 0; i--) {
                        if (changes[i][1] === 'subjectId') {
                            if(changes[i][3] !== null){
                                // Remove spaces and special characters from subject ids
                                changes[i][3] = changes[i][3].replaceAll(' ', '_');
                                changes[i][3] = changes[i][3].replaceAll(/[!@#&?<>()*$%]/g,"_");

                                // Append _1, _2, _3, ... to the subject ids to prevent entry of duplicate id's
                                let counter = 1;
                                if (changes[i][2] !== changes[i][3]) { // If the data changed
                                    while(self.hot.getDataAtProp('subjectId').contains(changes[i][3])) {
                                        if (counter === 1) {
                                            changes[i][3] = `${changes[i][3]}_${counter}`;
                                        } else {
                                            changes[i][3] = changes[i][3].slice(0,-1).concat(counter);
                                        }
                                        counter = counter + 1;
                                    }
                                }
                            }
                        }
                    }
                }
            });

            this.initSpeciesSelector();
            this.initVendorSelector();
            this.addKeyboardShortCuts();

            // Place cursor at first cell
            this.hot.selectCell(0, 0, 0, 0);
        }

        addKeyboardShortCuts() {
            const self = this;

            // Add new keyboard shortcut for inserting a row
            this.hot.updateSettings({
                afterDocumentKeyDown: function(e) {
                    if (self.lastKey === 'Control' && e.key === 'n') {
                        let row = self.hot.getSelected()[0][0];
                        self.hot.alter('insert_row_above', (row + 1), 1)
                    }
                    self.lastKey = e.key;
                }
            });
        }

        removeKeyboardShortCuts() {
            const self = this;

            // Add new keyboard shortcut for inserting a row
            this.hot.updateSettings({
                afterDocumentKeyDown: function(e) {
                    self.lastKey = e.key;
                }
            });
        }

        getProjectSelection() {
            const self = this;
            return self.projectSelectComponent.getElementsByTagName('select')[0].value;
        }

        disableProjectSelection() {
            const self = this;
            self.projectSelectComponent.getElementsByTagName('select')[0].disabled = true
        }

        validateProjectSelection() {
            const self = this;

            if (self.getProjectSelection() === '') {
                self.projectSelectComponent.classList.add('invalid')
                self.projectSelectComponent.querySelector('.prj-error').style.display = '';
                return false;
            } else {
                self.projectSelectComponent.classList.remove('invalid');
                self.projectSelectComponent.querySelector('.prj-error').style.display = 'none'
                return true;
            }
        }

        enableSubmitButton() {
            const self = this;
            self.submitButton.disabled = false;
        }

        disableSubmitButton() {
            const self = this;
            self.submitButton.disabled = true;
        }

        initSpeciesSelector() {
            const self = this;
            XNAT.plugin.pixi.speices.get().then(species => {
                let options = [];

                species.sort(pixi.compareGenerator('scientificName'))
                species.forEach(specie => {
                    options.push(specie['scientificName'])
                });

                self.columns[2]['source'] = options;
                self.hot.updateSettings({columns: self.columns});
            })
        }

        initVendorSelector() {
            const self = this;

            XNAT.plugin.pixi.vendors.get().then(vendors => {
                let options = [];

                vendors.sort(pixi.compareGenerator('vendor'));
                vendors.forEach(vendor => options.push(vendor['vendor']));

                self.columns[7]['source'] = options;
                self.hot.updateSettings({columns: self.columns});
            });
        }

        isEmpty() {
            const self = this;

            //let isTableEmpty = self.hot.countEmptyRows() === self.hot.countRows();
            let isSubjectIdsEmpty = self.hot.isEmptyCol(0);

            return isSubjectIdsEmpty
        }

        clearAndHideMessage() {
            const self = this;
            self.messageComponent.style.display = 'none';
            self.messageComponent.innerHTML = '';
            self.messageComponent.classList.remove('success');
            self.messageComponent.classList.remove('error');
            self.messageComponent.classList.remove('warning');
            self.messageComponent.classList.remove('info');
        }

        displayMessage(type, message) {
            const self = this;
            self.messageComponent.style.display = '';
            self.messageComponent.innerHTML = '';
            self.messageComponent.classList.add(type);
            self.messageComponent.append(message)
        }

        async submit() {
            const self = this;

            console.debug('Submitting.')

            if (!this.validateProjectSelection()) {
                console.error('Invalid project selection.');
                return;
            }

            if (self.isEmpty()) {
                console.debug('Nothing to submit.');
                return;
            }

            if (self.errorMessages.size > 0) {
                console.error('Cannot submit with invalid data.');
                return;
            }

            XNAT.ui.dialog.static.wait('Submitting to XNAT', {id: "create_subjects"});

            let projectId =  this.getProjectSelection();
            let subjects = [];

            let successfulRows = [];
            let failedRows = [];
            let emptyRows = [];

            for (let iRow = 0; iRow < this.hot.countRows(); iRow++) {
                let subjectLabel = this.hot.getDataAtRowProp(iRow, 'subjectId');
                const hasSubjectId = !(subjectLabel === null || subjectLabel === undefined || subjectLabel === '');
                const isEmptyRow = this.hot.isEmptyRow(iRow)
                const isNotEmptyRow = !isEmptyRow

                if (!hasSubjectId && isNotEmptyRow) {
                    failedRows.push(
                        {
                            'subjectId': '',
                            'row': iRow,
                            'error': 'Id field is missing but row is not empty.'
                        }
                    )
                } else if (isEmptyRow) {
                    emptyRows.push(iRow);
                } else if (hasSubjectId) {
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

                    try {
                        let url = await XNAT.plugin.pixi.subjects.createOrUpdate(projectId, subjectLabel,
                            researchGroup, species, sex, dob, litter, strain, source, stockNumber, humanizationType,
                            geneticModifications, geneticModificationsNonStd);

                        successfulRows.push(iRow)
                        subjects.push({
                            'subjectId': subjectLabel,
                            'url': url
                        });
                    } catch (e) {
                        failedRows.push(
                            {
                                'subjectId': subjectLabel,
                                'row': iRow,
                                'error': e
                            }
                        )
                    }
                }
            }

            // Disable new inputs to successful rows
            this.hot.updateSettings({
                cells: function (row, col) {
                    var cellProperties = {};

                    if (successfulRows.contains(row)) {
                        cellProperties.readOnly = true;
                    } else if (emptyRows.contains(row)) {
                        cellProperties.readOnly = true;
                    }

                    return cellProperties;
                },
                contextMenu: ['copy', 'cut'],
            });

            this.removeKeyboardShortCuts();
            this.disableProjectSelection();

            XNAT.ui.dialog.close('create_subjects');

            const nonEmptyRows = this.hot.countRows() - this.hot.countEmptyRows();
            if (nonEmptyRows === successfulRows.length) { // All submissions successful
                // Display success message
                let message = spawn('div', [
                    spawn('p', 'Successful submissions:'),
                    spawn('ul', subjects.map(subject => spawn('li', [ spawn(`a`, {href: subject['url'], target: '_BLANK'}, subject['subjectId']) ])))
                ])

                self.displayMessage('success', message);

                // Disable resubmissions
                this.disableSubmitButton();
            } else if (successfulRows.length === 0 && failedRows.length > 0) {
                // All submissions in error
                let message = spawn('div', [
                    spawn('p', ''),
                    spawn('p', 'There were errors with your submission. Correct the issues and try resubmitting.'),
                    spawn('ul', failedRows.map(subject => spawn('li', `Row: ${subject['row'] + 1} ${XNAT.app.displayNames.singular.subject} ID: ${subject['subjectId']} ${subject['error']}`))),
                ])

                self.displayMessage('error', message);
            } else if (successfulRows.length > 0 && failedRows.length > 0) {
                // Some submitted successfully, some failed
                let message = spawn('div', [
                    spawn('p', 'There were errors with your submission. Correct the issues and try resubmitting.'),
                    spawn('p', 'Error(s):'),
                    spawn('ul', failedRows.map(subject => spawn('li', `Row: ${subject['row'] + 1} ${XNAT.app.displayNames.singular.subject} ID: ${subject['subjectId']} ${subject['error']}`))),
                    spawn('p', 'Successful submissions:'),
                    spawn('ul', subjects.map(subject => spawn('li', [ spawn(`a`, {href: subject['url'], target: '_BLANK'}, subject['subjectId']) ])))
                ])

                self.displayMessage('warning', message);
            }
        }
    }

    XNAT.plugin.pixi.subjectEntryManager = new SubjectEntryManager();

}));
