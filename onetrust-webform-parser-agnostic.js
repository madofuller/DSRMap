/**
 * ============================================================================
 * TRULY AGNOSTIC ONETRUST WEBFORM PARSER
 * ============================================================================
 *
 * This parser recognizes OneTrust DSAR webform components by their DATA SHAPE,
 * not by hardcoded paths. It works on ANY webform structure by identifying
 * characteristics of each data type through recursive traversal.
 *
 * Key Detection Strategies:
 * 1. Fields: Arrays of objects with 'fieldKey', 'inputType', 'isRequired'
 * 2. Workflow Rules: Objects with 'ruleName', 'criteriaInformation', 'ruleEventType'
 * 3. Translations: Objects with language codes as keys (en-us, fr, de, etc.)
 * 4. UI Fields: Objects with fieldKeys matching pattern 'DSAR.Webform.*'
 * 5. Metadata: Objects with 'templateName', 'languageList', 'defaultLanguage'
 */

/**
 * Recursively searches an object for arrays/objects matching a predicate function
 * @param {any} obj - The object to search
 * @param {Function} predicate - Function that returns true if the item matches
 * @param {string} path - Current path (for debugging)
 * @returns {Array} - Array of found items with their paths
 */
function recursiveFind(obj, predicate, path = 'root', maxDepth = 10, currentDepth = 0) {
    const results = [];

    // Prevent infinite recursion
    if (currentDepth > maxDepth || obj === null || obj === undefined) {
        return results;
    }

    // Check if current object matches
    if (predicate(obj, path)) {
        results.push({ data: obj, path: path });
    }

    // Recursively search object properties
    if (typeof obj === 'object' && obj !== null) {
        // Handle arrays
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                const childResults = recursiveFind(
                    item,
                    predicate,
                    `${path}[${index}]`,
                    maxDepth,
                    currentDepth + 1
                );
                results.push(...childResults);
            });
        }
        // Handle objects
        else {
            Object.keys(obj).forEach(key => {
                const childResults = recursiveFind(
                    obj[key],
                    predicate,
                    `${path}.${key}`,
                    maxDepth,
                    currentDepth + 1
                );
                results.push(...childResults);
            });
        }
    }

    return results;
}

/**
 * Checks if an object looks like a form field
 * Characteristics:
 * - Has 'fieldKey' property (unique identifier)
 * - Has 'inputType' property (Text Field, Multiselect, etc.)
 * - Has 'isRequired' property (boolean)
 * - Usually has 'status', 'isSelected', 'canDelete'
 */
function isFormField(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return false;
    }

    // Must have these core properties
    const hasFieldKey = typeof obj.fieldKey === 'string';
    const hasInputType = typeof obj.inputType === 'string';
    const hasIsRequired = typeof obj.isRequired === 'boolean';

    // Should have at least 2 of these common properties
    const commonProps = [
        typeof obj.status === 'number',
        typeof obj.isSelected === 'boolean',
        typeof obj.canDelete === 'boolean',
        typeof obj.isMasked === 'boolean',
        typeof obj.isInternal === 'boolean'
    ];
    const hasCommonProps = commonProps.filter(Boolean).length >= 2;

    return hasFieldKey && hasInputType && hasIsRequired && hasCommonProps;
}

/**
 * Checks if an array is a collection of form fields
 * Must be an array where most items (>80%) are form fields
 */
function isFieldArray(obj) {
    if (!Array.isArray(obj) || obj.length === 0) {
        return false;
    }

    // Count how many items are form fields
    const fieldCount = obj.filter(isFormField).length;
    const ratio = fieldCount / obj.length;

    // At least 80% should be form fields
    return ratio >= 0.8 && fieldCount >= 1;
}

/**
 * Checks if an object looks like a workflow rule
 * Characteristics:
 * - Has 'ruleName' property (string identifier)
 * - Has 'criteriaInformation' property (rule criteria)
 * - Has 'ruleEventType' property (event trigger)
 * - Has 'ruleActionType' property (action to take)
 * - Has 'ruleSequence' property (execution order)
 */
function isWorkflowRule(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return false;
    }

    const hasRuleName = typeof obj.ruleName === 'string';
    const hasCriteriaInfo = obj.criteriaInformation !== undefined;
    const hasRuleEventType = typeof obj.ruleEventType === 'string';
    const hasRuleActionType = typeof obj.ruleActionType === 'string';
    const hasRuleSequence = typeof obj.ruleSequence === 'number';

    // Must have at least ruleName and 2 other rule properties
    return hasRuleName &&
           [hasCriteriaInfo, hasRuleEventType, hasRuleActionType, hasRuleSequence]
               .filter(Boolean).length >= 2;
}

/**
 * Checks if an array is a collection of workflow rules
 */
function isWorkflowRuleArray(obj) {
    if (!Array.isArray(obj) || obj.length === 0) {
        return false;
    }

    const ruleCount = obj.filter(isWorkflowRule).length;
    const ratio = ruleCount / obj.length;

    return ratio >= 0.8 && ruleCount >= 1;
}

/**
 * Checks if an object looks like a field-level visibility rule
 * These are embedded in fields and control when fields are shown
 * Characteristics:
 * - Has 'ruleName' property
 * - Has 'ruleConditions' array
 * - Has 'actions' array
 * - Has 'logicalOperatorForConditions' (AND/OR)
 */
function isFieldVisibilityRule(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return false;
    }

    const hasRuleName = typeof obj.ruleName === 'string';
    const hasRuleConditions = Array.isArray(obj.ruleConditions);
    const hasActions = Array.isArray(obj.actions);
    const hasLogicalOp = typeof obj.logicalOperatorForConditions === 'string';

    return hasRuleName && hasRuleConditions && hasActions && hasLogicalOp;
}

/**
 * Checks if an object looks like a UI field
 * Characteristics:
 * - Has 'fieldKey' matching pattern 'DSAR.Webform.*'
 * - Has 'translations' object
 * - Usually has 'hasVisibilityRule' property
 * - May have 'visibilityRules' property
 */
function isUIField(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return false;
    }

    const hasFieldKey = typeof obj.fieldKey === 'string';
    const fieldKeyMatchesPattern = hasFieldKey &&
        (obj.fieldKey.startsWith('DSAR.Webform.') ||
         obj.fieldKey.includes('VisibilityRule') ||
         obj.fieldKey.includes('Button'));

    const hasTranslations = obj.translations !== undefined &&
                            typeof obj.translations === 'object';

    const hasVisibilityRuleFlag = typeof obj.hasVisibilityRule === 'boolean';

    return fieldKeyMatchesPattern && (hasTranslations || hasVisibilityRuleFlag);
}

/**
 * Checks if an array is a collection of UI fields
 */
function isUIFieldArray(obj) {
    if (!Array.isArray(obj) || obj.length === 0) {
        return false;
    }

    const uiFieldCount = obj.filter(isUIField).length;
    const ratio = uiFieldCount / obj.length;

    return ratio >= 0.8 && uiFieldCount >= 1;
}

/**
 * Checks if an object looks like a translations object
 * Characteristics:
 * - Object (not array) with keys that are language codes
 * - Language codes match pattern: 2-letter code or locale (en-us, fr, de, es, etc.)
 * - Values are objects containing translation key-value pairs
 */
function isTranslationsObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return false;
    }

    const keys = Object.keys(obj);
    if (keys.length === 0) {
        return false;
    }

    // Language code pattern: 2 letters, optionally followed by - and 2 more letters
    const langCodePattern = /^[a-z]{2}(-[a-z]{2})?$/i;

    // Check if keys look like language codes
    const langCodeCount = keys.filter(key => langCodePattern.test(key)).length;
    const ratio = langCodeCount / keys.length;

    // At least 80% of keys should be language codes
    if (ratio < 0.8) {
        return false;
    }

    // Check if values are objects (translation maps)
    const objectValueCount = keys.filter(key =>
        typeof obj[key] === 'object' &&
        obj[key] !== null
    ).length;

    return objectValueCount / keys.length >= 0.8;
}

/**
 * Checks if an object looks like webform metadata (webFormDto)
 * Characteristics:
 * - Has 'templateName' property
 * - Has 'languageList' array
 * - Has 'defaultLanguage' string
 * - Has 'requestTypes' or 'subjectTypes' arrays
 */
function isWebFormMetadata(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return false;
    }

    const hasTemplateName = typeof obj.templateName === 'string';
    const hasLanguageList = Array.isArray(obj.languageList);
    const hasDefaultLanguage = typeof obj.defaultLanguage === 'string';
    const hasRequestTypes = Array.isArray(obj.requestTypes);
    const hasSubjectTypes = Array.isArray(obj.subjectTypes);

    // Must have template name and at least 2 other metadata properties
    return hasTemplateName &&
           [hasLanguageList, hasDefaultLanguage, hasRequestTypes, hasSubjectTypes]
               .filter(Boolean).length >= 2;
}

/**
 * ============================================================================
 * PUBLIC API FUNCTIONS
 * ============================================================================
 */

/**
 * Finds all form fields in the JSON data
 * @param {Object} jsonData - The webform JSON data
 * @returns {Array} - Array of field objects
 */
function findFields(jsonData) {
    // First look for arrays of fields
    const fieldArrays = recursiveFind(jsonData, (obj) => isFieldArray(obj), 'root', 5);

    if (fieldArrays.length > 0) {
        // Return the largest field array found (likely the main fields array)
        const largestArray = fieldArrays.reduce((max, current) =>
            current.data.length > max.data.length ? current : max
        );

        return {
            fields: largestArray.data,
            path: largestArray.path,
            count: largestArray.data.length
        };
    }

    // Fallback: look for individual fields
    const individualFields = recursiveFind(jsonData, (obj) => isFormField(obj), 'root', 5);

    return {
        fields: individualFields.map(item => item.data),
        path: 'scattered',
        count: individualFields.length
    };
}

/**
 * Finds all workflow rules in the JSON data
 * @param {Object} jsonData - The webform JSON data
 * @returns {Array} - Array of workflow rule objects
 */
function findWorkflowRules(jsonData) {
    // Look for arrays of workflow rules
    const ruleArrays = recursiveFind(jsonData, (obj) => isWorkflowRuleArray(obj), 'root', 5);

    const allRules = [];
    const paths = [];

    ruleArrays.forEach(item => {
        allRules.push(...item.data);
        paths.push(item.path);
    });

    // Also look for individual workflow rules
    if (allRules.length === 0) {
        const individualRules = recursiveFind(jsonData, (obj) => isWorkflowRule(obj), 'root', 5);
        return {
            rules: individualRules.map(item => item.data),
            paths: individualRules.map(item => item.path),
            count: individualRules.length
        };
    }

    return {
        rules: allRules,
        paths: paths,
        count: allRules.length
    };
}

/**
 * Finds field-level visibility rules in the JSON data
 * These are rules embedded in field definitions
 * @param {Object} jsonData - The webform JSON data
 * @returns {Object} - Map of fieldKey to visibility rules
 */
function findFieldVisibilityRules(jsonData) {
    const fields = findFields(jsonData).fields;
    const visibilityRulesByField = {};

    fields.forEach(field => {
        if (field.hasVisibilityRule && field.visibilityRules && field.visibilityRules.rules) {
            visibilityRulesByField[field.fieldKey] = {
                fieldKey: field.fieldKey,
                inputType: field.inputType,
                rules: field.visibilityRules.rules,
                ruleCount: field.visibilityRules.rules.length
            };
        }
    });

    return {
        fieldVisibilityRules: visibilityRulesByField,
        fieldCount: Object.keys(visibilityRulesByField).length,
        totalRuleCount: Object.values(visibilityRulesByField)
            .reduce((sum, item) => sum + item.ruleCount, 0)
    };
}

/**
 * Finds all translations in the JSON data
 * @param {Object} jsonData - The webform JSON data
 * @returns {Object} - Translations object with language codes as keys
 */
function findTranslations(jsonData) {
    const translationObjects = recursiveFind(
        jsonData,
        (obj) => isTranslationsObject(obj),
        'root',
        5
    );

    if (translationObjects.length === 0) {
        return {
            translations: {},
            path: null,
            languages: []
        };
    }

    // Return the largest translations object (likely the main one)
    const largestTranslations = translationObjects.reduce((max, current) =>
        Object.keys(current.data).length > Object.keys(max.data).length ? current : max
    );

    return {
        translations: largestTranslations.data,
        path: largestTranslations.path,
        languages: Object.keys(largestTranslations.data)
    };
}

/**
 * Finds all UI fields in the JSON data
 * @param {Object} jsonData - The webform JSON data
 * @returns {Array} - Array of UI field objects
 */
function findUIFields(jsonData) {
    // Look for arrays of UI fields
    const uiFieldArrays = recursiveFind(jsonData, (obj) => isUIFieldArray(obj), 'root', 5);

    if (uiFieldArrays.length > 0) {
        const largestArray = uiFieldArrays.reduce((max, current) =>
            current.data.length > max.data.length ? current : max
        );

        return {
            uiFields: largestArray.data,
            path: largestArray.path,
            count: largestArray.data.length
        };
    }

    // Fallback: look for individual UI fields
    const individualUIFields = recursiveFind(jsonData, (obj) => isUIField(obj), 'root', 5);

    return {
        uiFields: individualUIFields.map(item => item.data),
        path: 'scattered',
        count: individualUIFields.length
    };
}

/**
 * Finds webform metadata in the JSON data
 * @param {Object} jsonData - The webform JSON data
 * @returns {Object} - Metadata object
 */
function findWebFormMetadata(jsonData) {
    const metadataObjects = recursiveFind(
        jsonData,
        (obj) => isWebFormMetadata(obj),
        'root',
        5
    );

    if (metadataObjects.length === 0) {
        return {
            metadata: null,
            path: null
        };
    }

    // Return the first metadata object found
    return {
        metadata: metadataObjects[0].data,
        path: metadataObjects[0].path,
        templateName: metadataObjects[0].data.templateName,
        defaultLanguage: metadataObjects[0].data.defaultLanguage,
        languages: metadataObjects[0].data.languageList || [],
        requestTypes: metadataObjects[0].data.requestTypes || [],
        subjectTypes: metadataObjects[0].data.subjectTypes || []
    };
}

/**
 * Master function that extracts all components from webform JSON
 * @param {Object} jsonData - The webform JSON data
 * @returns {Object} - Complete parsed webform structure
 */
function parseWebForm(jsonData) {
    console.log('🔍 Starting agnostic webform parsing...');

    const result = {
        metadata: findWebFormMetadata(jsonData),
        fields: findFields(jsonData),
        uiFields: findUIFields(jsonData),
        translations: findTranslations(jsonData),
        workflowRules: findWorkflowRules(jsonData),
        fieldVisibilityRules: findFieldVisibilityRules(jsonData)
    };

    console.log('✅ Parsing complete!');
    console.log(`   - Template: ${result.metadata.templateName || 'Unknown'}`);
    console.log(`   - Fields found: ${result.fields.count}`);
    console.log(`   - UI Fields found: ${result.uiFields.count}`);
    console.log(`   - Languages found: ${result.translations.languages.length}`);
    console.log(`   - Workflow rules found: ${result.workflowRules.count}`);
    console.log(`   - Fields with visibility rules: ${result.fieldVisibilityRules.fieldCount}`);

    return result;
}

/**
 * ============================================================================
 * USAGE EXAMPLES
 * ============================================================================
 */

/**
 * Example 1: Parse a webform JSON file
 *
 * const fs = require('fs');
 * const jsonData = JSON.parse(fs.readFileSync('webform.json', 'utf8'));
 * const parsed = parseWebForm(jsonData);
 *
 * console.log('Template Name:', parsed.metadata.templateName);
 * console.log('Total Fields:', parsed.fields.count);
 * console.log('Available Languages:', parsed.translations.languages.join(', '));
 */

/**
 * Example 2: Find specific field by fieldKey
 *
 * const parsed = parseWebForm(jsonData);
 * const emailField = parsed.fields.fields.find(f => f.fieldKey === 'email');
 * console.log('Email field:', emailField);
 */

/**
 * Example 3: Get all fields with visibility rules
 *
 * const parsed = parseWebForm(jsonData);
 * const fieldsWithRules = parsed.fieldVisibilityRules.fieldVisibilityRules;
 * Object.keys(fieldsWithRules).forEach(fieldKey => {
 *     const fieldRules = fieldsWithRules[fieldKey];
 *     console.log(`${fieldKey} has ${fieldRules.ruleCount} visibility rules`);
 * });
 */

/**
 * Example 4: Extract all translations for a specific language
 *
 * const parsed = parseWebForm(jsonData);
 * const enTranslations = parsed.translations.translations['en-us'];
 * console.log('English translations:', enTranslations);
 */

// Export functions for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseWebForm,
        findFields,
        findUIFields,
        findTranslations,
        findWorkflowRules,
        findFieldVisibilityRules,
        findWebFormMetadata
    };
}
