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

        hotContainer;

        projectSelectComponent;
        submitButton;

        prjSelErrMsgEl;
        subjsErrMsgEl;
        succMsgEl;

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
            this.container.innerHTML = '';

            this.hotContainer = spawn('div', {id: 'hot-table'})

            this.projectSelectComponent = spawn('div.form-component.containerItem', [
                spawn('label.required|for=\'project\'', 'Select a Project'),
                spawn('select.form-control', {
                        id: 'project',
                        name: 'project',
                        onchange: () => {
                            self.validateProjectSelection();
                            self.hot.validateCells();
                        }},
                    [spawn('option|', {selected: true, disabled: true, value: ''}, '')])
            ])

            this.prjSelErrMsgEl = spawn('div.error.prj-error', {id: 'prj-error-msg', style: {visibility: 'hidden'}}, 'Please select a project.');
            this.subjsErrMsgEl = spawn('div.error', {id: 'table-error-msg', style: {display: 'none'}});
            this.succMsgEl = spawn('div.success', {id: 'table-success-msg', style: {display: 'none'}});

            let titleEl = spawn('h2', 'New Subjects');

            let panel = spawn('div.container', [
                spawn('div.withColor containerTitle', 'Enter subject details'),
                spawn('div.containerBody', [
                    spawn('div.containerItem', 'After selecting a project, define the details of each subject. ' +
                        'The \'Subject ID\' should be a single word or acronym which will identify your subject and ' +
                        'cannot contain spaces or special characters.'),
                    spawn('hr'),
                    self.projectSelectComponent,
                    spawn('div.hot-container.containerIterm', [self.hotContainer]),
                    self.succMsgEl,
                    self.subjsErrMsgEl
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
                spawn('input.btn.pull-right|type=button|value=Add PDXs', {onclick: () => {self.reset(); XNAT.plugin.pixi.pdxEntryManager.init(self.containerId)}}),
                spawn('input.btn.pull-right|type=button|value=Add Cell Lines', {onclick: () => self.reset()}),
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
            this.hot = new Handsontable(this.hotContainer, {
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
                            self.errorMessages.set(key, `Row ${displayRow}: ${value} matches an existing subject id.`);
                        }
                    } else {
                        self.errorMessages.delete(key);
                    }

                    let isProjectValid = self.validateProjectSelection();
                    let isEmpty = self.isEmpty();
                    let isFirstSubject = isEmpty && prop === "subjectId" && value !== null && value !== '';

                    if (self.errorMessages.size > 0) {
                        self.subjsErrMsgEl.style.display = "";
                        self.subjsErrMsgEl.innerHTML = '';
                        self.subjsErrMsgEl.append(spawn('p', 'Errors found:'))
                        self.subjsErrMsgEl.append(spawn('ul', Array.from(self.errorMessages.values()).map(msg => spawn('li',msg))));

                        self.disableSubmitButton();
                    } else {
                        self.subjsErrMsgEl.innerHTML = '';
                        self.subjsErrMsgEl.style.display = "none";

                        // Valid project and ((table is not empty) or (table is empty and this is the first subjectId))
                        if (isProjectValid && (!isEmpty || isFirstSubject)) self.enableSubmitButton();
                    }
                },
                beforeChange: (changes, source) => {
                    console.log(source);
                    for (let i = changes.length - 1; i >= 0; i--) {
                        if (changes[i][1] === 'subjectId') {
                            if(changes[i][3] !== null){
                                changes[i][3] = changes[i][3].replaceAll(' ', '_'); // Remove spaces

                                changes[i][3] = changes[i][3].replaceAll(/[&]/g,"_"); // And special characters
                                changes[i][3] = changes[i][3].replaceAll(/[?]/g,"_");
                                changes[i][3] = changes[i][3].replaceAll(/[<]/g,"_");
                                changes[i][3] = changes[i][3].replaceAll(/[>]/g,"_");
                                changes[i][3] = changes[i][3].replaceAll(/[(]/g,"_");
                                changes[i][3] = changes[i][3].replaceAll(/[)]/g,"_");
                                changes[i][3] = changes[i][3].replaceAll(/[*]/g,"_");
                                changes[i][3] = changes[i][3].replaceAll(/[$]/g,"_");
                                changes[i][3] = changes[i][3].replaceAll(/[%]/g,"_");
                            }
                        }
                    }
                }
                // afterOnCellMouseDown: () => {
                //     if (self.projectSelectEl.value === '') {
                //         self.prjSelErrMsgEl.style.visibility = "";
                //         self.projectSelectEl.classList.add('invalid')
                //     }
                // },
                //afterChange: (changes) => {if (changes !== null) self.validateProjectSelection()},
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
                return false;
            } else {
                self.projectSelectComponent.classList.remove('invalid');
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

        async submit() {
            const self = this;

            console.debug('Submitting')

            if (!this.validateProjectSelection()) {
                return;
            }

            if (self.isEmpty()) {
                return;
            }

            let projectId =  this.getProjectSelection();
            let subjects = [];

            let successfullRows = [];
            let emptyRows = [];

            // TODO: Check for unique subject ids in table

            // Presume all subjects are valid
            for (let i = 0; i < this.hot.countRows(); i++) {
                const isNotEmptyRow = !this.hot.isEmptyRow(i)
                const rowMeta = this.hot.getCellMetaAtRow(0)
                const isNotReadOnly = rowMeta.filter(cellMeta =>
                    cellMeta['prop'] === 'subjectId'
                    && 'readOnly' in cellMeta && cellMeta['readOnly']).length === 0;

                console.log(`isNotReadOnly: ${isNotReadOnly}`);
                console.log(`isNotEmptyRow: ${isNotEmptyRow}`);

                if (isNotEmptyRow && isNotReadOnly) {
                    let subjectLabel = this.hot.getDataAtRowProp(i, 'subjectId');
                    let researchGroup = this.hot.getDataAtRowProp(i, 'researchGroup');
                    let species = this.hot.getDataAtRowProp(i, 'species');
                    let sex = this.hot.getDataAtRowProp(i, 'sex');
                    let dob = this.hot.getDataAtRowProp(i, 'dob');
                    let litter = this.hot.getDataAtRowProp(i, 'litter');
                    let strain = this.hot.getDataAtRowProp(i, 'strain');
                    let source = this.hot.getDataAtRowProp(i, 'vendor');
                    let stockNumber = this.hot.getDataAtRowProp(i, 'stockNumber');
                    let humanizationType = this.hot.getDataAtRowProp(i, 'humanizationType');
                    let geneticModifications = this.hot.getDataAtRowProp(i, 'geneticModifications');
                    let geneticModificationsNonStd = this.hot.getDataAtRowProp(i, 'geneticModificationsNonStd');

                    let url = await XNAT.plugin.pixi.subjects.create(projectId, subjectLabel,
                        researchGroup, species, sex, dob, litter, strain, source, stockNumber, humanizationType,
                        geneticModifications, geneticModificationsNonStd);

                    console.log(url);

                    successfullRows.push(i)

                    subjects.push({
                        'subjectId': subjectLabel,
                        'url': url
                    });
                } else if (!isNotEmptyRow) {
                    emptyRows.push(i);
                }
            }

            // Disable new inputs
            this.hot.updateSettings({
                cells: function (row, col) {
                    var cellProperties = {};

                    if (successfullRows.contains(row)) {
                        cellProperties.readOnly = true;
                    } else if (emptyRows.contains(row)) {
                        cellProperties.readOnly = true;
                    }

                    return cellProperties;
                },
                contextMenu: ['copy', 'cut'],
            });

            this.removeKeyboardShortCuts();
            this.disableProjectSelection()
            this.disableSubmitButton();

            console.log(successfullRows);

            if ((this.hot.countRows() - this.hot.countEmptyRows()) === successfullRows.length) {
                this.succMsgEl.style.display = '';
                this.succMsgEl.innerHTML = ''

                this.succMsgEl.append(spawn('p', 'Successful submissions:'))
                this.succMsgEl.append(spawn('ul', subjects.map(subject => spawn('li', [ spawn(`a`, {href: subject['url'], target: '_BLANK'}, subject['subjectId']) ]))));
            }

        }
    }

    XNAT.plugin.pixi.subjectEntryManager = new SubjectEntryManager();

}));
