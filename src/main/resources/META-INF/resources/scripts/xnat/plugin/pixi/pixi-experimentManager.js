/*
 *  PIXI Experiment Manager
 */

console.debug('pixi-experimentManager.js');

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
    
    console.debug('pixi-experimentManager.js - AbstractBulkEntryManager');
    
    XNAT.plugin.pixi.abstractBulkEntryManager = class AbstractBulkEntryManager {
        containerId;
        container;
        
        #title;
        #subtitle;
        #description;
    
        projectSelector;
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
        async submitRow() { throw new Error("Method 'submitRow()' must be implemented."); }
        
        getXsiType() { throw new Error("Method 'getXsiType()' must be implemented."); }
        
        async init(containerId, hotSettings, project, subjects) {
            const self = this;
            
            this.containerId = containerId;
            this.container = document.getElementById(this.containerId);
    
            this.messageComponent = spawn('div', {id: 'table-msg', style: {display: 'none'}});
    
            let titleEl = spawn('h2', self.#title);
    
            let panel = spawn('div.container', [
                spawn('div.withColor containerTitle', self.#subtitle),
                spawn('div.containerBody', [
                    spawn('div.containerItem', self.#description),
                    spawn('hr'),
                    ...self.containerBody(),
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
            
            return XNAT.plugin.pixi.projects.populateSelectBox('project')
                       .then(() => {
                           this.hot = new Handsontable(this.container.querySelector('.hot-table'), hotSettings);
                
                           this.addKeyboardShortCuts();
                
                           this.updateHeight();
                
                           // Place cursor at first cell
                           this.hot.selectCell(0, 0, 0, 0);
                       })
                       .then(() => {
                           if (project !== null && project !== undefined && project !== '') {
                               this.setProjectSelection(project)
                               this.disableProjectSelection();
                           }
                       })
                       .then(() => this.populateSubjectSelector());
        }
        
        additionalButtons() { return []; }
        
        containerBody() {
            const self = this;
            
            this.projectSelector = spawn('div.form-component.col.containerItem.third', [
                spawn('label.required|for=\'project\'', 'Select a Project'),
                spawn('select.form-control', {
                          id: 'project',
                          name: 'project',
                          onchange: () => {
                              self.validateProjectSelection();
                              self.populateSubjectSelector().then(() => self.hot.validateCells());
                              document.dispatchEvent(new Event('project-changed'));
                          }
                      },
                      [spawn('option|', {selected: true, disabled: true, value: ''}, '')]),
                spawn('div.prj-error', {style: {display: 'none'}}, 'Please select a project')
            ])
            
            return [
                this.projectSelector
            ];
        }
        
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
        
        removeKeyboardShortCuts() {
            const self = this;
            
            // Remove keyboard shortcut for inserting a row
            this.hot.updateSettings({
                                        afterDocumentKeyDown: function (e) {
                                            self.lastKey = e.key;
                                        }
                                    });
        }
        
        getProjectSelection() { return this.projectSelector.getElementsByTagName('select')[0].value; }
        disableProjectSelection() { this.projectSelector.getElementsByTagName('select')[0].disabled = true; }
        
        setProjectSelection(project) {
            let options = this.projectSelector.getElementsByTagName('option');
            
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
                this.projectSelector.classList.add('invalid')
                this.projectSelector.querySelector('.prj-error').style.display = '';
                return false;
            } else {
                this.projectSelector.classList.remove('invalid');
                this.projectSelector.querySelector('.prj-error').style.display = 'none'
                return true;
            }
        }
        
        async populateSubjectSelector() {
            const self = this;
            
            let project = self.getProjectSelection();
            
            if (project === null || project === undefined || project === '') {
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
        
        isHotEmpty() {
            return (this.hot.countEmptyRows() === this.hot.countRows())
        }
        
        updateData(data) {
            this.hot.updateData(data);
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
            let height = 26 + 23 * (numRows + 2);
            let container = this.container.querySelector('.hot-container');
            container.style.height = `${height}px`;
    
            this.hot.render();
        }
    }
    
    console.debug('pixi-experimentManager.js - AbstractExperimentManager');
    
    XNAT.plugin.pixi.abstractExperimentManager = class AbstractExperimentManager extends XNAT.plugin.pixi.abstractBulkEntryManager {
    
        constructor(heading, subheading, description) {
            super(heading, subheading, description);
        }
    
        async init(containerId, hotSettings, project = null, subjects = []) {
            return super.init(containerId, hotSettings, project, subjects)
                        .then(() => {
                            this.setDateTime();
                            this.setTechnician();
                        });
        }
    
        async submit() {
            let validProject = this.validateProjectSelection(),
                validDate    = this.validateDate(),
                validTech    = this.validateTechnician(),
                isEmpty      = this.isHotEmpty();
        
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
            
                XNAT.ui.dialog.static.wait('Submitting to XNAT', {id: "submit"});
                
                let successfulRows = [];
                let failedRows = [];
            
                for (let iRow = 0; iRow < this.hot.countRows(); iRow++) {
                    await this.submitRow(iRow)
                              .then(submissionReport => successfulRows.push(submissionReport))
                              .catch(submissionReport => failedRows.push(submissionReport));
                }
            
                XNAT.ui.dialog.close('submit');
    
                document.dispatchEvent(new Event('submit'));
            
                // Disable new inputs to successful rows
                this.hot.updateSettings({
                                            cells: function (row, col) {
                                                var cellProperties = {};
                                                
                                                if (successfulRows.map(submissionReport => submissionReport['row']).contains(row)) {
                                                    cellProperties.readOnly = true;
                                                }
                    
                                                return cellProperties;
                                            },
                                            contextMenu: ['copy', 'cut'],
                                        });
            
                this.removeKeyboardShortCuts();
                this.disableProjectSelection();
            
                // TODO set experiment IDs after submit
                // experiments.forEach(experiment => {
                //     this.hot.setDataAtRowProp(experiment['row'], 'experimentId', experiment['experimentId']);
                // })
            
                if (failedRows.length === 0) {
                    // Success
                    let message = spawn('div', [
                        spawn('p', 'Successful submissions:'),
                        spawn('ul', successfulRows.map(submissionReport => {
                            return spawn('li', [
                                spawn(`a`, {
                                    href: submissionReport['url'],
                                    target: '_BLANK'
                                }, submissionReport['urlText'])
                            ])
                        }))
                    ])
                
                    this.displayMessage('success', message);
                
                    // Disable resubmissions
                    this.disableSubmitButton();
                } else if (successfulRows.length === 0 && failedRows.length > 0) {
                    // All submissions in error
                    let message = spawn('div', [
                        spawn('p', ''),
                        spawn('p', 'There were errors with your submission. Correct the issues and try resubmitting.'),
                        spawn('ul', failedRows.map(submissionReport => spawn('li', `Row: ${submissionReport['row'] + 1} ${submissionReport['error']}`))),
                    ])
                
                    this.displayMessage('error', message);
                } else if (successfulRows.length > 0 && failedRows.length > 0) {
                    // Some submitted successfully, some failed
                    let message = spawn('div', [
                        spawn('p', 'There were errors with your submission. Correct the issues and try resubmitting.'),
                        spawn('p', 'Error(s):'),
                        spawn('ul', failedRows.map(submissionReport => spawn('li', `Row: ${submissionReport['row'] + 1} ${submissionReport['error']}`))),
                        spawn('p', 'Successful submissions:'),
                        spawn('ul', successfulRows.map(submissionReport => spawn('li', [spawn(`a`, {
                            href: submissionReport['url'],
                            target: '_BLANK'
                        }, submissionReport['urlText'])])))
                    ])
                
                    this.displayMessage('warning', message);
                }
            
                XNAT.ui.dialog.close('submit');
                
            })
        }
        
        containerBody() {
            const containerBody = super.containerBody();
        
            this.dateComponent = spawn('div.form-component.col.containerItem', [
                spawn('label.required|for=\'date\'', 'Date'),
                spawn('input.form-control|type=\'date\'', {
                    id: 'date',
                    name: 'date',
                }),
                spawn('div.date-error', {style: {display: 'none'}}, 'Please select a date')
            ]);
        
            this.timeComponent = spawn('div.form-component.col.containerItem', [
                spawn('label|for=\'time\'', 'Time'),
                spawn('input.form-control|type=\'time\'|step=\'10\'', {
                    id: 'time',
                    name: 'time',
                    style: { width : '110px' }
                })
            ]);
        
            this.technicianComponent = spawn('div.form-component.col.containerItem', [
                spawn('label.required|for=\'technician\'', 'Technician'),
                spawn('input.form-control|type=\'text\'', {
                    id: 'technician',
                    name: 'technician',
                }),
                spawn('div.technician-error', {style: {display: 'none'}}, 'Please enter a technician')
            ]);
    
            containerBody.push(
                spawn('div.row', [
                    this.dateComponent,
                    this.timeComponent,
                    this.technicianComponent
                ])
            )
        
            return containerBody;
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
            let isEmpty = (item) => item === null || item === undefined || item === '';
        
            if (isEmpty(subjectId)) {
                callback(false);
            } else {
                callback(this.getColumn('subjectId').source.contains(subjectId));
            }
        }
        
    }
    
}));
