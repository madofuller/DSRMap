/**
 * EXAMPLE USAGE: Agnostic OneTrust Webform Parser
 *
 * This file shows the most common use cases for the parser.
 * Copy and adapt these examples for your own projects.
 */

const fs = require('fs');
const path = require('path');
const parser = require('../../onetrust-webform-parser-agnostic.js');

// ============================================================================
// EXAMPLE 1: Basic Parsing
// ============================================================================

console.log('\n=== EXAMPLE 1: Basic Parsing ===\n');

// Load webform JSON
const webformPath = process.argv[2];

if (!webformPath) {
    console.error('Usage: node example-usage.js <path-to-webform.json>');
    process.exit(1);
}

const jsonData = JSON.parse(
    fs.readFileSync(path.resolve(webformPath), 'utf8')
);

// Parse the webform (this is the main function you'll use)
const parsed = parser.parseWebForm(jsonData);

console.log('Template Name:', parsed.metadata.templateName);
console.log('Total Fields:', parsed.fields.count);
console.log('Available Languages:', parsed.translations.languages.join(', '));

// ============================================================================
// EXAMPLE 2: Get Specific Field
// ============================================================================

console.log('\n=== EXAMPLE 2: Get Specific Field ===\n');

// Find the email field
const emailField = parsed.fields.fields.find(f => f.fieldKey === 'email');

if (emailField) {
    console.log('Email Field:');
    console.log('  Key:', emailField.fieldKey);
    console.log('  Type:', emailField.inputType);
    console.log('  Required:', emailField.isRequired);
    console.log('  Validation:', emailField.validationExpression ? 'Yes' : 'No');
}

// ============================================================================
// EXAMPLE 3: List All Required Fields
// ============================================================================

console.log('\n=== EXAMPLE 3: List All Required Fields ===\n');

const requiredFields = parsed.fields.fields.filter(f => f.isRequired);

console.log(`Found ${requiredFields.length} required fields:`);
requiredFields.forEach(field => {
    console.log(`  - ${field.fieldKey} (${field.inputType})`);
});

// ============================================================================
// EXAMPLE 4: Get Translations for a Field
// ============================================================================

console.log('\n=== EXAMPLE 4: Get Translations for a Field ===\n');

const translations = parsed.translations.translations;

// Get "firstName" field label in different languages
const fieldKey = 'firstName';
console.log(`Translations for "${fieldKey}":`);
parsed.translations.languages.forEach(lang => {
    const label = translations[lang][fieldKey];
    if (label) {
        console.log(`  ${lang}: ${label}`);
    }
});

// ============================================================================
// EXAMPLE 5: Analyze Field Types
// ============================================================================

console.log('\n=== EXAMPLE 5: Analyze Field Types ===\n');

// Count fields by type
const fieldTypeCounts = {};
parsed.fields.fields.forEach(field => {
    const type = field.inputType;
    fieldTypeCounts[type] = (fieldTypeCounts[type] || 0) + 1;
});

console.log('Field Type Distribution:');
Object.keys(fieldTypeCounts)
    .sort((a, b) => fieldTypeCounts[b] - fieldTypeCounts[a])
    .forEach(type => {
        console.log(`  ${type}: ${fieldTypeCounts[type]}`);
    });

// ============================================================================
// EXAMPLE 6: Find Fields with Options (Dropdown/Multiselect)
// ============================================================================

console.log('\n=== EXAMPLE 6: Find Fields with Options ===\n');

const fieldsWithOptions = parsed.fields.fields.filter(f =>
    f.options && Array.isArray(f.options) && f.options.length > 0
);

console.log(`Found ${fieldsWithOptions.length} fields with options:`);
fieldsWithOptions.slice(0, 3).forEach(field => {
    console.log(`  ${field.fieldKey}: ${field.options.length} options`);
    // Show first 3 options
    field.options.slice(0, 3).forEach(opt => {
        console.log(`    - ${opt.key}: ${opt.value}`);
    });
    if (field.options.length > 3) {
        console.log(`    ... and ${field.options.length - 3} more`);
    }
});

// ============================================================================
// EXAMPLE 7: Find Fields with Conditional Logic
// ============================================================================

console.log('\n=== EXAMPLE 7: Find Fields with Conditional Logic ===\n');

const fieldsWithRules = parsed.fieldVisibilityRules.fieldVisibilityRules;
const fieldKeys = Object.keys(fieldsWithRules);

console.log(`Found ${fieldKeys.length} fields with visibility rules:`);
fieldKeys.slice(0, 5).forEach(fieldKey => {
    const fieldInfo = fieldsWithRules[fieldKey];
    console.log(`  ${fieldKey}:`);
    fieldInfo.rules.forEach(rule => {
        console.log(`    - ${rule.ruleName}`);
        console.log(`      Conditions: ${rule.ruleConditions.length}`);
        console.log(`      Actions: ${rule.actions.length}`);
    });
});

// ============================================================================
// EXAMPLE 8: Analyze Workflow Rules
// ============================================================================

console.log('\n=== EXAMPLE 8: Analyze Workflow Rules ===\n');

if (parsed.workflowRules.count > 0) {
    console.log(`Found ${parsed.workflowRules.count} workflow rules:`);
    parsed.workflowRules.rules.forEach(rule => {
        console.log(`  ${rule.ruleName}:`);
        console.log(`    Event: ${rule.ruleEventType}`);
        console.log(`    Action: ${rule.ruleActionType}`);
        console.log(`    Sequence: ${rule.ruleSequence}`);
    });
} else {
    console.log('No workflow rules found in this webform.');
}

// ============================================================================
// EXAMPLE 9: Build Field Dependency Map
// ============================================================================

console.log('\n=== EXAMPLE 9: Build Field Dependency Map ===\n');

const dependencyMap = {};

parsed.fields.fields.forEach(field => {
    if (field.hasVisibilityRule && field.visibilityRules && field.visibilityRules.rules) {
        const dependencies = new Set();

        field.visibilityRules.rules.forEach(rule => {
            rule.ruleConditions.forEach(condition => {
                if (condition.selectedField) {
                    dependencies.add(condition.selectedField);
                }
            });
        });

        if (dependencies.size > 0) {
            dependencyMap[field.fieldKey] = Array.from(dependencies);
        }
    }
});

console.log('Field Dependencies:');
Object.keys(dependencyMap).forEach(fieldKey => {
    console.log(`  ${fieldKey} depends on: ${dependencyMap[fieldKey].join(', ')}`);
});

// ============================================================================
// EXAMPLE 10: Export Field Catalog
// ============================================================================

console.log('\n=== EXAMPLE 10: Export Field Catalog ===\n');

const catalog = parsed.fields.fields.map(field => ({
    fieldKey: field.fieldKey,
    type: field.inputType,
    required: field.isRequired,
    hasOptions: field.options ? field.options.length : 0,
    hasValidation: !!field.validationExpression,
    hasConditionalLogic: field.hasVisibilityRule,
    label_en: translations['en-us'] ? translations['en-us'][field.fieldKey] : 'N/A'
}));

console.log('Field Catalog (first 5 fields):');
console.table(catalog.slice(0, 5));

// ============================================================================
// EXAMPLE 11: Find All Text Blocks
// ============================================================================

console.log('\n=== EXAMPLE 11: Find All Text Blocks ===\n');

const textBlocks = parsed.fields.fields.filter(f => f.inputType === 'TextBlock');

console.log(`Found ${textBlocks.length} text blocks:`);
textBlocks.forEach(block => {
    const content = block.displayTextValue || '(no content)';
    const preview = content.length > 100 ? content.substring(0, 97) + '...' : content;
    console.log(`  ${block.fieldKey}:`);
    console.log(`    ${preview.replace(/\n/g, ' ')}`);
});

// ============================================================================
// EXAMPLE 12: Validate Webform Structure
// ============================================================================

console.log('\n=== EXAMPLE 12: Validate Webform Structure ===\n');

const validation = {
    hasMetadata: !!parsed.metadata.metadata,
    hasFields: parsed.fields.count > 0,
    hasTranslations: parsed.translations.languages.length > 0,
    hasDefaultLanguage: !!parsed.metadata.defaultLanguage,
    hasRequestTypes: parsed.metadata.requestTypes && parsed.metadata.requestTypes.length > 0,
    hasSubjectTypes: parsed.metadata.subjectTypes && parsed.metadata.subjectTypes.length > 0,
    allRequiredFieldsHaveLabels: true // We'll check this below
};

// Check if all required fields have labels
const enTranslations = translations['en-us'] || {};
parsed.fields.fields.filter(f => f.isRequired).forEach(field => {
    if (!enTranslations[field.fieldKey]) {
        validation.allRequiredFieldsHaveLabels = false;
    }
});

console.log('Webform Validation:');
Object.keys(validation).forEach(check => {
    const status = validation[check] ? '✅' : '❌';
    console.log(`  ${status} ${check}`);
});

// ============================================================================
// EXAMPLE 13: Generate Statistics Report
// ============================================================================

console.log('\n=== EXAMPLE 13: Generate Statistics Report ===\n');

const stats = {
    'Template Name': parsed.metadata.templateName,
    'Total Fields': parsed.fields.count,
    'Required Fields': parsed.fields.fields.filter(f => f.isRequired).length,
    'Optional Fields': parsed.fields.fields.filter(f => !f.isRequired).length,
    'Fields with Options': parsed.fields.fields.filter(f => f.options && f.options.length > 0).length,
    'Fields with Validation': parsed.fields.fields.filter(f => f.validationExpression).length,
    'Fields with Conditional Logic': Object.keys(fieldsWithRules).length,
    'Total Visibility Rules': parsed.fieldVisibilityRules.totalRuleCount,
    'Workflow Rules': parsed.workflowRules.count,
    'UI Fields': parsed.uiFields.count,
    'Available Languages': parsed.translations.languages.length,
    'Default Language': parsed.metadata.defaultLanguage
};

console.log('Webform Statistics Report:');
console.log('-'.repeat(50));
Object.keys(stats).forEach(key => {
    console.log(`${key.padEnd(30)}: ${stats[key]}`);
});
console.log('-'.repeat(50));

// ============================================================================
// DONE!
// ============================================================================

console.log('\n✅ All examples completed successfully!\n');
console.log('To use these in your project:');
console.log('1. Copy the parser file: onetrust-webform-parser-agnostic.js');
console.log('2. Import it: const parser = require("./onetrust-webform-parser-agnostic.js")');
console.log('3. Parse your webform: const parsed = parser.parseWebForm(jsonData)');
console.log('4. Access the data using the patterns shown above\n');
