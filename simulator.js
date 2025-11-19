// Global state
let webformData = null;
let translations = null;
let allFields = [];
let workflowRules = [];
let currentSelections = {};
let visibleFields = new Set();
let showInactiveFields = false;
let defaultWorkflowId = null;
let workflowSettings = {};
let uiFields = [];
let submitButtonRules = null;
let attachmentRules = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadTranslations();
});

function setupEventListeners() {
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileSelect);
}

async function loadTranslations() {
    try {
        // Add cache-busting parameter to force fresh load
        const response = await fetch(`field_translations.json?t=${Date.now()}`);
        translations = await response.json();
    } catch (error) {
        console.warn('Could not load translations', error);
        translations = { fields: {}, options: {}, requestTypes: {}, subjectTypes: {} };
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) processFile(file);
}

function processFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            webformData = JSON.parse(e.target.result);
            parseWebform();
            startSimulator();
        } catch (error) {
            alert('Error parsing JSON: ' + error.message);
        }
    };
    reader.readAsText(file);
}

function parseWebform() {
    allFields = [];
    workflowRules = [];
    defaultWorkflowId = null;
    workflowSettings = {};
    uiFields = [];
    submitButtonRules = null;
    attachmentRules = null;

    // Parse uiFields for submit button and attachment
    if (webformData.uiFields) {
        webformData.uiFields.forEach(field => {
            if (field.fieldKey === 'DSAR.Webform.VisibilityRule.SubmitButton') {
                submitButtonRules = field;
            } else if (field.fieldKey === 'DSAR.Webform.VisibilityRule.Attachment') {
                attachmentRules = field;
            }
        });
    }

    // Create GUID to key mappings for requestTypes and subjectTypes
    const guidToKeyMap = {};

    if (webformData.webFormDto) {
        // Map requestTypes GUIDs to keys
        if (webformData.webFormDto.requestTypes) {
            webformData.webFormDto.requestTypes.forEach(rt => {
                guidToKeyMap[rt.id] = rt.fieldName;
            });
        }

        // Map subjectTypes GUIDs to keys
        if (webformData.webFormDto.subjectTypes) {
            webformData.webFormDto.subjectTypes.forEach(st => {
                guidToKeyMap[st.id] = st.fieldName;
            });
        }
    }

    // Parse workflow settings
    if (webformData.settings) {
        const settings = webformData.settings;
        const workflowsSetting = settings.find(s => s.fieldName === 'Workflows');
        if (workflowsSetting && workflowsSetting.value) {
            defaultWorkflowId = workflowsSetting.value.workflowRefId;
        }

        const defaultDays = settings.find(s => s.fieldName === 'DefaultDaysToRespond');
        if (defaultDays) {
            workflowSettings.defaultDaysToRespond = defaultDays.value;
        }

        const defaultReminder = settings.find(s => s.fieldName === 'DefaultReminder');
        if (defaultReminder) {
            workflowSettings.defaultReminder = defaultReminder.value;
        }
    }

    // Parse fields
    if (webformData.fields) {
        webformData.fields.forEach(field => {
            allFields.push({
                key: field.fieldKey,
                label: getFieldLabel(field.fieldKey),
                type: field.inputType,
                description: field.description,
                isRequired: field.isRequired,
                hasVisibilityRule: field.hasVisibilityRule,
                visibilityRules: field.visibilityRules,
                options: field.options || [],
                isMasked: field.isMasked,
                status: field.status,
                isSelected: field.isSelected
            });
        });
    }

    // Parse workflow rules - convert criteriaInformation to ruleCriteria format
    if (webformData.rules) {
        if (webformData.rules.REQUEST_CREATION) {
            workflowRules = webformData.rules.REQUEST_CREATION.map(rule => {
                // Parse action parameters
                let ruleActionParameters = [];
                try {
                    ruleActionParameters = JSON.parse(rule.ruleActionParameters || '[]');
                } catch (e) {
                    console.error('Failed to parse ruleActionParameters', e);
                }

                // Convert criteriaInformation.conditionGroups to ruleCriteria format
                const ruleCriteria = [];
                const criteriaInfo = rule.criteriaInformation || {};
                const conditionGroups = criteriaInfo.conditionGroups || [];

                conditionGroups.forEach(group => {
                    const conditions = group.conditions || [];
                    conditions.forEach(condition => {
                        // Clean field name (remove "multiselectFields." prefix)
                        const field = condition.field.replace('multiselectFields.', '');

                        // Map GUID to friendly key if available
                        let value = condition.value;
                        if (guidToKeyMap[value]) {
                            value = guidToKeyMap[value];
                        }

                        // Check if we already have this field in ruleCriteria
                        let existingCriteria = ruleCriteria.find(c => c.field === field);

                        if (!existingCriteria) {
                            existingCriteria = {
                                field: field,
                                values: []
                            };
                            ruleCriteria.push(existingCriteria);
                        }

                        // Add value if not already present
                        if (value && !existingCriteria.values.includes(value)) {
                            existingCriteria.values.push(value);
                        }
                    });
                });

                return {
                    ...rule,
                    type: 'REQUEST_CREATION',
                    ruleActionParameters: ruleActionParameters,
                    ruleCriteria: ruleCriteria
                };
            });
        }
    }

    console.log('Parsed:', allFields.length, 'fields,', workflowRules.length, 'workflows');
    console.log('Workflow Settings:', workflowSettings);
    console.log('Note: No default workflow - all workflows are rule-based');

    // Log workflow criteria for debugging
    workflowRules.forEach(wf => {
        console.log(`Workflow: ${wf.ruleName}`);
        console.log(`  Criteria count: ${wf.ruleCriteria.length}`);
        wf.ruleCriteria.forEach(c => {
            console.log(`    ${c.field}: ${c.values.length} value(s)`);
        });
    });
}

function startSimulator() {
    document.getElementById('uploadSection').classList.add('hidden');
    document.getElementById('mainSection').classList.remove('hidden');

    currentSelections = {};
    visibleFields = new Set();

    renderForm();
}

function resetForm() {
    currentSelections = {};
    visibleFields = new Set();
    renderForm();
}

function toggleInactiveFields() {
    const checkbox = document.getElementById('showInactiveFields');
    showInactiveFields = checkbox.checked;
    renderForm();
}

function renderForm() {
    calculateVisibleFields();
    renderFormFields();
    evaluateWorkflows();
}

function calculateVisibleFields() {
    const previousVisibleFields = new Set(visibleFields);
    visibleFields.clear();

    allFields.forEach(field => {
        // CRITICAL: Only show fields where isSelected = true AND status != 20 (enabled in OneTrust)
        // Use explicit check: only show if isSelected is explicitly true AND status is not 20
        const isEnabled = field.isSelected === true && field.status !== 20;

        if (!isEnabled) {
            console.log(`Field ${field.key} (${field.label}) - DISABLED (isSelected=${field.isSelected}, status=${field.status})`);
            // If showInactiveFields is true, add inactive fields to visibleFields but mark them as inactive
            if (showInactiveFields) {
                visibleFields.add(field.key);
            }
            return;
        }

        // Always show enabled fields without visibility rules
        if (!field.hasVisibilityRule) {
            visibleFields.add(field.key);
            console.log(`Field ${field.key} (${field.label}) - NO visibility rule, always visible`);
            return;
        }

        // Evaluate visibility rules for enabled fields
        const rules = field.visibilityRules?.rules || [];
        if (rules.length === 0) {
            console.log(`Field ${field.key} (${field.label}) - Has visibility rule flag but no rules, HIDDEN`);
            return;
        }

        for (let rule of rules) {
            const ruleResult = evaluateRule(rule);
            console.log(`Field ${field.key} (${field.label}) - Rule "${rule.ruleName}": ${ruleResult ? 'SHOW' : 'HIDE'}`);
            if (ruleResult) {
                visibleFields.add(field.key);
                break;
            }
        }
    });

    // Check if fields disappeared - if so, clear their selections
    previousVisibleFields.forEach(fieldKey => {
        if (!visibleFields.has(fieldKey) && currentSelections[fieldKey]) {
            console.log(`Field ${fieldKey} is no longer visible, clearing its selection`);
            delete currentSelections[fieldKey];
        }
    });

    console.log('Total visible fields:', visibleFields.size);
}

function evaluateRule(rule) {
    const conditions = rule.ruleConditions || [];
    const operator = rule.logicalOperatorForConditions || 'AND';

    const results = conditions.map(condition => evaluateCondition(condition));

    if (operator === 'AND') {
        return results.every(r => r);
    } else {
        return results.some(r => r);
    }
}

function evaluateCondition(condition) {
    const fieldKey = condition.selectedField;
    const subConditions = condition.ruleSubConditions || [];
    const operator = condition.logicalOperatorForSubConditions || 'OR';

    const userSelection = currentSelections[fieldKey];

    // If field not selected yet, check if all subconditions are NOT_EQUALS
    // In that case, the condition is considered false (field must be selected first)
    const allNotEquals = subConditions.every(sub => sub.comparisonOperator === 'NOT_EQUALS');
    if (!userSelection && allNotEquals) {
        return false;
    }

    // If field not selected and has EQUALS conditions, it's false
    if (!userSelection) {
        return false;
    }

    const results = subConditions.map(sub => {
        if (sub.comparisonOperator === 'EQUALS') {
            return userSelection === sub.valueToCompareWith;
        } else if (sub.comparisonOperator === 'NOT_EQUALS') {
            return userSelection !== sub.valueToCompareWith;
        }
        return false;
    });

    if (operator === 'OR') {
        return results.some(r => r);
    } else {
        return results.every(r => r);
    }
}


function renderFormFields() {
    const formFields = document.getElementById('formFields');

    // ONLY exclude TextBlock fields (informational only, not form inputs)
    const excludeTypes = ['TextBlock'];

    // Get all visible fields in their ORIGINAL ORDER from allFields
    const fieldsToShow = allFields.filter(field =>
        visibleFields.has(field.key) &&
        !excludeTypes.includes(field.type)
    );

    // Log for debugging
    console.log('Visible fields:', fieldsToShow.map(f => ({ key: f.key, label: f.label, type: f.type })));

    formFields.innerHTML = fieldsToShow.map(field => renderField(field)).join('');
}

function renderField(field) {
    // Check if field is active
    const isActive = field.isSelected === true && field.status !== 20;
    const inactiveBadge = !isActive ? '<span style="display: inline-block; background: #95a5a6; color: white; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; margin-left: 0.5rem;">Inactive</span>' : '';

    const required = field.isRequired ? '<span class="required">*</span>' : '';
    const description = field.description ? `<div class="form-description">${getFieldLabel(field.description)}</div>` : '';

    // Multi-choice fields (buttons)
    if (field.options && field.options.length > 0) {
        // Filter options based on visibility rules
        let availableOptions = field.options;
        if (field.visibilityRules && field.visibilityRules.rules) {
            for (let rule of field.visibilityRules.rules) {
                if (evaluateRule(rule)) {
                    const action = rule.actions?.[0];
                    if (action && action.action === 'SHOW_QUESTION_WITH_CONFIGURED_OPTIONS' && action.selectedOptions) {
                        availableOptions = field.options.filter(opt =>
                            action.selectedOptions.includes(opt.key)
                        );
                        break;
                    }
                }
            }
        }

        const currentSelection = currentSelections[field.key];

        // Use dropdown for many options
        if (availableOptions.length > 10) {
            return `
                <div class="form-field">
                    <label class="form-label">${field.label}${required}${inactiveBadge}</label>
                    ${description}
                    <select class="form-select" onchange="selectOption('${field.key}', this.value)" ${!isActive ? 'disabled style="opacity: 0.6;"' : ''}>
                        <option value="">-- Choose ${field.label} --</option>
                        ${availableOptions.map(opt => `
                            <option value="${opt.key}" ${opt.key === currentSelection ? 'selected' : ''}>${getOptionLabel(opt.key) || opt.value}</option>
                        `).join('')}
                    </select>
                </div>
            `;
        }

        // Button group for fewer options
        return `
            <div class="form-field">
                <label class="form-label">${field.label}${required}${inactiveBadge}</label>
                ${description}
                <div class="button-group">
                    ${availableOptions.map(opt => `
                        <button class="form-button ${opt.key === currentSelection ? 'selected' : ''}" onclick="selectOption('${field.key}', '${opt.key}')" ${!isActive ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}>
                            ${getOptionLabel(opt.key) || opt.value}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Text input fields
    if (field.type === 'Text Field' || field.type === 'Email' || field.type === 'Phone') {
        const inputType = field.type === 'Email' ? 'email' : field.type === 'Phone' ? 'tel' : 'text';
        const placeholder = `${field.label} of data subject this request concerns`;
        const savedValue = currentSelections[field.key] || '';
        return `
            <div class="form-field">
                <label class="form-label">${field.label}${required}${inactiveBadge}</label>
                ${description}
                <input type="${inputType}"
                       class="form-input"
                       placeholder="${placeholder}"
                       value="${savedValue}"
                       oninput="updateTextInput('${field.key}', this.value)"
                       ${!isActive ? 'disabled style="opacity: 0.6;"' : ''}>
            </div>
        `;
    }

    // Textarea
    if (field.type === 'Text Area') {
        const savedValue = currentSelections[field.key] || '';
        return `
            <div class="form-field">
                <label class="form-label">${field.label}${required}${inactiveBadge}</label>
                ${description}
                <textarea class="form-textarea"
                          oninput="updateTextInput('${field.key}', this.value)"
                          ${!isActive ? 'disabled style="opacity: 0.6;"' : ''}>${savedValue}</textarea>
            </div>
        `;
    }

    // Select dropdown
    if (field.type === 'Select') {
        return `
            <div class="form-field">
                <label class="form-label">${field.label}${required}${inactiveBadge}</label>
                ${description}
                <select class="form-select" ${!isActive ? 'disabled style="opacity: 0.6;"' : ''}>
                    <option value="">-- Choose --</option>
                </select>
            </div>
        `;
    }

    // DateTime
    if (field.type === 'DateTime') {
        return `
            <div class="form-field">
                <label class="form-label">${field.label}${required}${inactiveBadge}</label>
                ${description}
                <input type="date" class="form-input" ${!isActive ? 'disabled style="opacity: 0.6;"' : ''}>
            </div>
        `;
    }

    return '';
}

function selectOption(fieldKey, optionKey) {
    if (!optionKey) {
        // Deselect if empty value
        delete currentSelections[fieldKey];
        renderForm();
        return;
    }

    // Toggle: if clicking the same option, deselect it
    if (currentSelections[fieldKey] === optionKey) {
        delete currentSelections[fieldKey];
    } else {
        currentSelections[fieldKey] = optionKey;
    }

    renderForm();
}

function updateTextInput(fieldKey, value) {
    // Store text input values but don't re-render on every keystroke
    currentSelections[fieldKey] = value;

    // Only re-evaluate workflows without full re-render
    evaluateWorkflows();
}

function evaluateWorkflows() {
    const workflowList = document.getElementById('workflowList');
    const formActionsDiv = document.getElementById('formActions');

    // Evaluate all workflows and score them
    const scoredWorkflows = [];

    workflowRules.forEach(workflow => {
        const result = evaluateWorkflowRule(workflow);
        // Only show workflows with at least 1 match
        if (result.matchedCount > 0) {
            scoredWorkflows.push({
                workflow,
                reasons: result.reasons,
                unmatchedReasons: result.unmatchedReasons,
                matchedCount: result.matchedCount,
                totalCriteria: result.totalCriteria,
                isComplete: result.triggered,
                matchPercentage: result.totalCriteria > 0 ? (result.matchedCount / result.totalCriteria) * 100 : 0
            });
        }
    });

    // Sort by match percentage (best matches first)
    scoredWorkflows.sort((a, b) => b.matchPercentage - a.matchPercentage);

    if (scoredWorkflows.length === 0) {
        workflowList.innerHTML = `
            <div class="workflow-empty">
                Make selections to see matching workflows
            </div>
        `;
    } else {
        renderWorkflows(workflowList, scoredWorkflows);
    }

    // Evaluate form actions
    evaluateFormActions(formActionsDiv);
}

function evaluateFormActions(formActionsDiv) {
    if (!formActionsDiv) return;

    const actions = [];

    // Check submit button state
    if (submitButtonRules) {
        const submitResult = evaluateUIField(submitButtonRules);
        if (submitResult.disabled) {
            actions.push({
                type: 'Submit Button',
                status: 'DISABLED',
                reason: submitResult.message,
                color: '#e74c3c'
            });
        } else {
            actions.push({
                type: 'Submit Button',
                status: 'ENABLED',
                reason: 'Form can be submitted',
                color: '#27ae60'
            });
        }
    }

    // Check attachment field state
    if (attachmentRules) {
        const attachmentResult = evaluateUIField(attachmentRules);
        if (attachmentResult.shown) {
            actions.push({
                type: 'Attachment Field',
                status: 'VISIBLE',
                reason: attachmentResult.message,
                color: '#3498db'
            });
        } else {
            actions.push({
                type: 'Attachment Field',
                status: 'HIDDEN',
                reason: 'No conditions met to show attachments',
                color: '#95a5a6'
            });
        }
    }

    if (actions.length === 0) {
        formActionsDiv.innerHTML = `
            <div class="workflow-empty">
                Make selections to see form actions
            </div>
        `;
        return;
    }

    formActionsDiv.innerHTML = actions.map(action => `
        <div style="background: white; border: 2px solid ${action.color}; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div style="font-weight: 600; color: #2c3e50;">${action.type}</div>
                <span style="background: ${action.color}; color: white; padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${action.status}</span>
            </div>
            <div style="font-size: 0.9rem; color: #7f8c8d;">${action.reason}</div>
        </div>
    `).join('');
}

function evaluateUIField(uiField) {
    if (!uiField || !uiField.visibilityRules) {
        return { shown: false, disabled: false };
    }

    const rules = uiField.visibilityRules.rules || [];

    for (let rule of rules) {
        const ruleConditions = rule.ruleConditions || [];
        const operator = rule.logicalOperatorForConditions || 'AND';

        const conditionResults = ruleConditions.map(condition => {
            const fieldKey = condition.selectedField;
            const subConditions = condition.ruleSubConditions || [];
            const subOperator = condition.logicalOperatorForSubConditions || 'OR';

            const userSelection = currentSelections[fieldKey];
            if (!userSelection) return false;

            const subResults = subConditions.map(sub => {
                if (sub.comparisonOperator === 'EQUALS') {
                    return userSelection === sub.valueToCompareWith;
                } else if (sub.comparisonOperator === 'NOT_EQUALS') {
                    return userSelection !== sub.valueToCompareWith;
                }
                return false;
            });

            return subOperator === 'OR' ? subResults.some(r => r) : subResults.every(r => r);
        });

        const ruleMatched = operator === 'AND'
            ? conditionResults.every(r => r)
            : conditionResults.some(r => r);

        if (ruleMatched) {
            const action = rule.actions?.[0];
            if (action) {
                if (action.action === 'DISABLE_SUBMIT_BUTTON') {
                    return { disabled: true, message: action.errorMessage || 'Submit is disabled', shown: false };
                } else if (action.action === 'SHOW_ATTACHMENT') {
                    return { shown: true, message: `Triggered by: ${rule.ruleName}`, disabled: false };
                }
            }
        }
    }

    return { shown: false, disabled: false };
}

function renderWorkflows(workflowList, scoredWorkflows) {
    if (!workflowList) return;

    workflowList.innerHTML = scoredWorkflows.map(({ workflow, reasons, unmatchedReasons, matchedCount, totalCriteria, isComplete, matchPercentage }) => {
        const params = Array.isArray(workflow.ruleActionParameters)
            ? workflow.ruleActionParameters
            : [];
        const workflowId = params.find(p => p.field === 'WORKFLOWID')?.value || 'N/A';
        const deadline = params.find(p => p.field === 'DEADLINE')?.value || 'N/A';
        const isDefaultWorkflow = workflowId === defaultWorkflowId;

        let cardStyle, statusBadge;

        if (isComplete) {
            cardStyle = 'background: #e8f5e9; border: 2px solid #27ae60;';
            statusBadge = '<span style="background: #27ae60; color: white; padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">WILL TRIGGER</span>';
        } else if (matchedCount > 0) {
            cardStyle = 'background: #fff9e6; border: 2px solid #f39c12;';
            statusBadge = `<span style="background: #f39c12; color: white; padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">PARTIAL (${matchedCount}/${totalCriteria})</span>`;
        } else {
            cardStyle = 'background: #f5f5f5; border: 2px solid #bdc3c7;';
            statusBadge = `<span style="background: #95a5a6; color: white; padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">NOT MATCHED (0/${totalCriteria})</span>`;
        }

        // Don't show DEFAULT badge - there is no default workflow, all are rule-based
        const defaultBadge = '';

        const matchedSection = reasons.length > 0 ? `
            <div class="workflow-reason">
                <strong style="color: #27ae60;">Matched Criteria:</strong><br>
                ${reasons.join('<br>')}
            </div>
        ` : '';

        const unmatchedSection = unmatchedReasons.length > 0 ? `
            <div class="workflow-reason" style="margin-top: 0.5rem;">
                <strong style="color: #95a5a6;">Unmatched Criteria:</strong><br>
                ${unmatchedReasons.join('<br>')}
            </div>
        ` : '';

        return `
            <div class="workflow-card" style="${cardStyle}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div class="workflow-name" style="flex: 1; min-width: 200px;">${workflow.ruleName || 'Unnamed Workflow'}</div>
                    <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
                        ${statusBadge}
                        ${defaultBadge}
                    </div>
                </div>
                ${matchedSection}
                ${unmatchedSection}
                ${isComplete ? `
                    <div class="workflow-detail">
                        <div class="workflow-detail-label">Deadline:</div>
                        ${deadline} days
                    </div>
                ` : ''}
                <div class="workflow-detail" style="font-size: 0.7rem; color: #95a5a6;">
                    Workflow ID: ${workflowId.substring(0, 8)}...
                </div>
            </div>
        `;
    }).join('');
}

function evaluateWorkflowRule(workflow) {
    const criteria = workflow.ruleCriteria || [];
    const reasons = [];
    const unmatchedReasons = [];
    let matchedCount = 0;
    let triggered = true;

    for (let criterion of criteria) {
        const field = criterion.field;
        const values = criterion.values || [];
        const userSelection = currentSelections[field];

        const fieldLabel = getFieldLabel(field);

        if (!userSelection) {
            triggered = false;
            // Show what's needed (with OR since any value matches)
            const expectedValues = values.map(v => getOptionLabel(v)).join(' OR ');
            unmatchedReasons.push(`${fieldLabel} = ${expectedValues}`);
            continue;
        }

        // OR logic: if user selected ANY of the values, it's a match
        const matches = values.includes(userSelection);
        if (matches) {
            matchedCount++;
            const valueLabel = getOptionLabel(userSelection);
            reasons.push(`${fieldLabel} = ${valueLabel}`);
        } else {
            triggered = false;
            const valueLabel = getOptionLabel(userSelection);
            const expectedValues = values.map(v => getOptionLabel(v)).join(' OR ');
            unmatchedReasons.push(`${fieldLabel} = ${expectedValues} (currently: ${valueLabel})`);
        }
    }

    return {
        triggered,
        reasons,
        unmatchedReasons,
        matchedCount,
        totalCriteria: criteria.length
    };
}

function exportToExcel() {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Current Form State
    const formStateData = [];
    formStateData.push(['Field', 'Selected Value']);

    Object.keys(currentSelections).forEach(fieldKey => {
        const fieldLabel = getFieldLabel(fieldKey);
        const valueLabel = getOptionLabel(currentSelections[fieldKey]);
        formStateData.push([fieldLabel, valueLabel]);
    });

    const formStateSheet = XLSX.utils.aoa_to_sheet(formStateData);
    XLSX.utils.book_append_sheet(workbook, formStateSheet, 'Current Selections');

    // Sheet 2: Triggered Workflows
    const workflowData = [];
    workflowData.push(['Workflow Name', 'Status', 'Matched', 'Total Criteria', 'Match %', 'Deadline (days)', 'Workflow ID']);

    workflowRules.forEach(workflow => {
        const result = evaluateWorkflowRule(workflow);
        if (result.matchedCount > 0) {
            const params = Array.isArray(workflow.ruleActionParameters) ? workflow.ruleActionParameters : [];
            const workflowId = params.find(p => p.field === 'WORKFLOWID')?.value || 'N/A';
            const deadline = params.find(p => p.field === 'DEADLINE')?.value || 'N/A';
            const matchPercentage = result.totalCriteria > 0 ? Math.round((result.matchedCount / result.totalCriteria) * 100) : 0;
            const status = result.triggered ? 'WILL TRIGGER' : `PARTIAL (${result.matchedCount}/${result.totalCriteria})`;

            workflowData.push([
                workflow.ruleName || 'Unnamed Workflow',
                status,
                result.matchedCount,
                result.totalCriteria,
                matchPercentage + '%',
                deadline,
                workflowId
            ]);
        }
    });

    const workflowSheet = XLSX.utils.aoa_to_sheet(workflowData);
    XLSX.utils.book_append_sheet(workbook, workflowSheet, 'Workflows');

    // Sheet 3: Workflow Criteria Details
    const criteriaData = [];
    criteriaData.push(['Workflow Name', 'Criteria Status', 'Field', 'Expected Value(s)', 'Current Value']);

    workflowRules.forEach(workflow => {
        const result = evaluateWorkflowRule(workflow);
        if (result.matchedCount > 0) {
            const workflowName = workflow.ruleName || 'Unnamed Workflow';

            // Matched criteria
            result.reasons.forEach(reason => {
                criteriaData.push([workflowName, 'MATCHED', reason, '', '']);
            });

            // Unmatched criteria
            result.unmatchedReasons.forEach(reason => {
                criteriaData.push([workflowName, 'UNMATCHED', reason, '', '']);
            });
        }
    });

    const criteriaSheet = XLSX.utils.aoa_to_sheet(criteriaData);
    XLSX.utils.book_append_sheet(workbook, criteriaSheet, 'Workflow Criteria');

    // Sheet 4: Form Actions
    const actionsData = [];
    actionsData.push(['Action Type', 'Status', 'Reason']);

    if (submitButtonRules) {
        const submitResult = evaluateUIField(submitButtonRules);
        actionsData.push([
            'Submit Button',
            submitResult.disabled ? 'DISABLED' : 'ENABLED',
            submitResult.disabled ? submitResult.message : 'Form can be submitted'
        ]);
    }

    if (attachmentRules) {
        const attachmentResult = evaluateUIField(attachmentRules);
        actionsData.push([
            'Attachment Field',
            attachmentResult.shown ? 'VISIBLE' : 'HIDDEN',
            attachmentResult.shown ? attachmentResult.message : 'No conditions met to show attachments'
        ]);
    }

    const actionsSheet = XLSX.utils.aoa_to_sheet(actionsData);
    XLSX.utils.book_append_sheet(workbook, actionsSheet, 'Form Actions');

    // Sheet 5: All Fields Configuration
    const allFieldsData = [];
    allFieldsData.push(['Field Key', 'Label', 'Type', 'Required', 'Status', 'Has Visibility Rule', 'Currently Visible']);

    allFields.forEach(field => {
        allFieldsData.push([
            field.key,
            field.label,
            field.type,
            field.required ? 'Yes' : 'No',
            field.status === 10 ? 'Active' : 'Inactive',
            field.hasVisibilityRule ? 'Yes' : 'No',
            visibleFields.has(field.key) ? 'Yes' : 'No'
        ]);
    });

    const allFieldsSheet = XLSX.utils.aoa_to_sheet(allFieldsData);
    XLSX.utils.book_append_sheet(workbook, allFieldsSheet, 'All Fields');

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `webform-analysis-${timestamp}.xlsx`;

    // Export
    XLSX.writeFile(workbook, filename);
}

function getFieldLabel(fieldKey) {
    if (translations && translations.fields && translations.fields[fieldKey]) {
        return translations.fields[fieldKey];
    }
    return fieldKey;
}

function getOptionLabel(optionKey) {
    if (translations && translations.options && translations.options[optionKey]) {
        return translations.options[optionKey];
    }
    if (translations && translations.requestTypes && translations.requestTypes[optionKey]) {
        return translations.requestTypes[optionKey];
    }
    if (translations && translations.subjectTypes && translations.subjectTypes[optionKey]) {
        return translations.subjectTypes[optionKey];
    }
    return optionKey;
}
