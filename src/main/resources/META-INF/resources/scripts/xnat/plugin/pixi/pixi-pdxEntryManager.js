/*
 *  PIXI PDX Entry Manager
 *
 *  This script depends on functions in pixi-module.js
 */

console.log('pixi-pdxEntryManager.js');

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

    console.log('pixi-pdxEntryManager.js - PdxEntryManager');

    class PdxEntryManager {
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
                spawn('label|for=\'project\'', 'Select a Project'),
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

            let titleEl = spawn('h2', 'New PDXs');

            let panel = spawn('div.container', [
                spawn('div.withColor containerTitle', 'Enter PDX event details'),
                spawn('div.containerBody', [
                    spawn('div.containerItem', 'After selecting a project, define the details of each PDX event in the table below.'),
                    spawn('hr'),
                    self.projectSelectComponent,
                    spawn('div.hot-container.containerIterm', [self.hotContainer]),
                    self.succMsgEl,
                    self.subjsErrMsgEl
                ])
            ]);

            this.submitButton = spawn('input.btn1.pull-right|type=button|value=Submit PDXs', {
                disabled: true,
                onclick: () => {
                    xmodal.confirm({
                        title: "Confirm Submission",
                        height: 220,
                        scroll: false,
                        content: `<p>Are you ready to submit these PDX events?</p>`,
                        okAction: () => self.submit(),
                    })
                }
            });

            let buttons = spawn('div.submit-right', [
                self.submitButton,
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
                "PDX ID",
                "TODO...",
            ];

            let colWidths = [175, 175, 175];

            // Columns
            this.columns =  [
                {
                    data: 'subjectId',
                    allowInvalid: true
                },
                {
                    data: 'pdxId',
                    type: 'dropdown',
                    source: ['', 'PDX-1', 'PDX-2']
                },
                { data: 'todo' },
            ]

            // Handsontable
            this.hot = new Handsontable(this.hotContainer, {
                data: [
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""],
                    ["", "", ""]
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
            });

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

        isEmpty() {
            const self = this;
            return (self.hot.countEmptyRows() === self.hot.countRows())
        }

        async submit() {
            const self = this;

            console.debug('Submitting')

        }
    }

    XNAT.plugin.pixi.pdxEntryManager = new PdxEntryManager();

}));