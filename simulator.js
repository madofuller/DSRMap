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
let countryHashLookup = {}; // Maps SHA-512 hashes back to country codes
let stateHashLookup = {}; // Maps SHA-512 hashes back to state codes

// SHA-512 implementation for hash matching
async function sha512(str) {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-512', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Build lookup table for country hashes
async function buildCountryHashLookup() {
    console.log('� Building country hash lookup table...');
    countryHashLookup = {}; // Reset lookup table

    // Find the country field - try multiple strategies
    let countryField = allFields.find(f => f.key === 'country');
    
    if (!countryField) {
        // Try case-insensitive match
        countryField = allFields.find(f => f.key.toLowerCase() === 'country');
    }
    
    if (!countryField) {
        // Try partial match
        countryField = allFields.find(f => f.key.toLowerCase().includes('country'));
    }

    if (!countryField) {
        console.warn('⚠️ No country field found in allFields');
        console.log(`   allFields.length = ${allFields.length}`);
        if (allFields.length > 0) {
            console.log(`   First 10 field keys: ${allFields.slice(0, 10).map(f => `"${f.key}"`).join(', ')}`);
            // Also check for any field with 'country' in the key
            const fieldsWithCountry = allFields.filter(f => f.key && f.key.toLowerCase().includes('country'));
            if (fieldsWithCountry.length > 0) {
                console.log(`   Found ${fieldsWithCountry.length} field(s) with 'country' in key: ${fieldsWithCountry.map(f => `"${f.key}"`).join(', ')}`);
            }
        } else {
            console.warn('   allFields is empty! Fields may not have been parsed yet.');
        }
        
        // FALLBACK: Try to find country field directly in webformData.fields
        if (webformData && webformData.fields) {
            console.log('   🔄 Trying fallback: checking webformData.fields directly...');
            const rawCountryField = webformData.fields.find(f => 
                f.fieldKey === 'country' || 
                (f.fieldKey && f.fieldKey.toLowerCase().includes('country'))
            );
            if (rawCountryField && rawCountryField.options && rawCountryField.options.length > 0) {
                console.log(`   ✅ Found country field in webformData.fields: "${rawCountryField.fieldKey}" with ${rawCountryField.options.length} options`);
                // Use this field directly
                countryField = {
                    key: rawCountryField.fieldKey,
                    label: getFieldLabel(rawCountryField.fieldKey),
                    options: rawCountryField.options || []
                };
            } else {
                console.warn('   ❌ Country field not found in webformData.fields either');
                return;
            }
        } else {
            console.warn('   ❌ webformData.fields is not available for fallback');
            return;
        }
    }

    if (!countryField.options || countryField.options.length === 0) {
        console.log('️ Country field found but has no options in JSON');
        console.log('Country field key:', countryField.key);
        console.log('Country field label:', countryField.label);
        console.log('Country field type:', countryField.type);
        console.log('� Using comprehensive ISO country list as fallback...');
        
        // Use comprehensive country list as fallback
        countryField.options = getWorldCountriesOptions();
        console.log(`✅ Using fallback list with ${countryField.options.length} countries`);
    }

    console.log(`📋 Found country field "${countryField.key}" (${countryField.label}) with ${countryField.options.length} options`);

    // Hash all possible country values
    let hashCount = 0;
    const processedOptions = [];
    
    for (const option of countryField.options) {
        const key = option.key;
        const value = option.value;
        processedOptions.push(`${key} (${value})`);

        // Try multiple variations (lowercase seems to be what OneTrust uses)
        const variations = [
            key,
            key.toLowerCase(),
            key.toUpperCase(),
            value,
            value.toLowerCase(),
            value.toUpperCase()
        ];

        for (const variant of variations) {
            if (variant) { // Skip empty/null variants
                const hash = await sha512(variant);
                countryHashLookup[hash] = {
                    originalKey: key,
                    originalValue: value,
                    hashedVariant: variant
                };
                hashCount++;
            }
        }
    }
    
    console.log(`📝 Processing ${processedOptions.length} country options: ${processedOptions.slice(0, 5).join(', ')}${processedOptions.length > 5 ? '...' : ''}`);

    console.log(`✅ Built hash lookup with ${Object.keys(countryHashLookup).length} unique hashes from ${hashCount} variations`);
    
    // Show a few example hashes for debugging
    const exampleKeys = Object.keys(countryHashLookup).slice(0, 3);
    if (exampleKeys.length > 0) {
        console.log('� Example hash mappings:');
        exampleKeys.forEach(hash => {
            const entry = countryHashLookup[hash];
            console.log(`   ${hash.substring(0, 16)}... → ${entry.originalKey} (from "${entry.hashedVariant}")`);
        });
    }
}

// Build lookup table for state hashes
async function buildStateHashLookup() {
    console.log('� Building state hash lookup table...');
    stateHashLookup = {}; // Reset lookup table

    // Find the state field - try multiple strategies
    let stateField = allFields.find(f => f.key === 'state');
    
    if (!stateField) {
        // Try case-insensitive match
        stateField = allFields.find(f => f.key.toLowerCase() === 'state');
    }
    
    if (!stateField) {
        // Try partial match
        stateField = allFields.find(f => f.key.toLowerCase().includes('state'));
    }

    if (!stateField) {
        console.log('️ No state field found in allFields');
        console.log(`   allFields.length = ${allFields.length}`);
        if (allFields.length > 0) {
            console.log(`   First 10 field keys: ${allFields.slice(0, 10).map(f => `"${f.key}"`).join(', ')}`);
            // Also check for any field with 'state' in the key
            const fieldsWithState = allFields.filter(f => f.key && f.key.toLowerCase().includes('state'));
            if (fieldsWithState.length > 0) {
                console.log(`   Found ${fieldsWithState.length} field(s) with 'state' in key: ${fieldsWithState.map(f => `"${f.key}"`).join(', ')}`);
            }
        } else {
            console.warn('   allFields is empty! Fields may not have been parsed yet.');
        }
        
        // FALLBACK: Try to find state field directly in webformData.fields
        if (webformData && webformData.fields) {
            console.log('   🔄 Trying fallback: checking webformData.fields directly...');
            const rawStateField = webformData.fields.find(f => 
                f.fieldKey === 'state' || 
                (f.fieldKey && f.fieldKey.toLowerCase().includes('state'))
            );
            if (rawStateField && rawStateField.options && rawStateField.options.length > 0) {
                console.log(`   ✅ Found state field in webformData.fields: "${rawStateField.fieldKey}" with ${rawStateField.options.length} options`);
                // Use this field directly
                stateField = {
                    key: rawStateField.fieldKey,
                    label: getFieldLabel(rawStateField.fieldKey),
                    options: rawStateField.options || []
                };
            } else {
                console.log('   ℹ️ State field not found in webformData.fields - will use US states fallback');
            }
        } else {
            console.log('   ℹ️ webformData.fields is not available - will use US states fallback');
        }
    }

    // If no state field found or it has no options, use US states as fallback
    if (!stateField || !stateField.options || stateField.options.length === 0) {
        console.log('� Using comprehensive US states list as fallback...');
        stateField = {
            key: 'state',
            label: 'State',
            options: getUSStatesOptions()
        };
        console.log(`✅ Using fallback list with ${stateField.options.length} states`);
    } else {
        console.log(`📋 Found state field "${stateField.key}" (${stateField.label}) with ${stateField.options.length} options`);
    }

    // Hash all possible state values
    let hashCount = 0;
    const processedOptions = [];
    
    for (const option of stateField.options) {
        const key = option.key;
        const value = option.value;
        const abbrev = option.abbrev; // State abbreviation (e.g., "CA")
        processedOptions.push(`${key} (${value})${abbrev ? ` [${abbrev}]` : ''}`);

        // Build variations array - include both abbreviation and full name
        const variations = [];
        
        // Add abbreviation variations if available
        if (abbrev) {
            variations.push(
                abbrev,              // "CA"
                abbrev.toLowerCase(), // "ca"
                abbrev.toUpperCase()  // "CA" (same, but explicit)
            );
        }
        
        // Add full name variations
        variations.push(
            value,                   // "California"
            value.toLowerCase(),     // "california"
            value.toUpperCase(),     // "CALIFORNIA"
            key,                     // "California" (spaces removed)
            key.toLowerCase(),       // "california"
            key.toUpperCase(),       // "CALIFORNIA"
            value.replace(/\s+/g, ''), // "California" (spaces removed)
            value.replace(/\s+/g, '').toLowerCase(), // "california"
            value.replace(/\s+/g, '').toUpperCase()  // "CALIFORNIA"
        );

        // Hash all variations
        for (const variant of variations) {
            if (variant) { // Skip empty/null variants
                const hash = await sha512(variant);
                stateHashLookup[hash] = {
                    originalKey: key,
                    originalValue: value,
                    originalAbbrev: abbrev || null,
                    hashedVariant: variant
                };
                hashCount++;
            }
        }
    }
    
    console.log(`📝 Processing ${processedOptions.length} state options: ${processedOptions.slice(0, 5).join(', ')}${processedOptions.length > 5 ? '...' : ''}`);

    console.log(`✅ Built state hash lookup with ${Object.keys(stateHashLookup).length} unique hashes from ${hashCount} variations`);
    
    // Show a few example hashes for debugging
    const exampleKeys = Object.keys(stateHashLookup).slice(0, 3);
    if (exampleKeys.length > 0) {
        console.log('� Example state hash mappings:');
        exampleKeys.forEach(hash => {
            const entry = stateHashLookup[hash];
            console.log(`   ${hash.substring(0, 16)}... → ${entry.originalKey} (from "${entry.hashedVariant}")`);
        });
    }
}

// Smart field detection helpers
function isLikelyCountryField(field) {
    const fieldKey = (field.key || '').toLowerCase();
    const label = (field.label || '').toLowerCase();

    // Check if field name/label contains "country" or "residence" (common in country fields)
    return fieldKey.includes('country') || label.includes('country') || label.includes('residence');
}

function isLikelyUSStatesField(field) {
    const fieldKey = (field.key || '').toLowerCase();
    const label = (field.label || '').toLowerCase();

    // Check if field name/label contains "state"
    const hasStateInName = fieldKey.includes('state') || label.includes('state');

    // Check if it has visibility rule dependent on country = US
    const hasDependencyOnUS = field.hasVisibilityRule &&
        field.visibilityRules?.rules?.some(rule =>
            rule.ruleConditions?.some(condition =>
                condition.selectedField === 'country' &&
                condition.ruleSubConditions?.some(sub =>
                    sub.valueToCompareWith === 'US'
                )
            )
        );

    return hasStateInName && hasDependencyOnUS;
}

function getWorldCountriesOptions() {
    // Comprehensive ISO 3166-1 alpha-2 country codes (all 249 countries)
    // This is used as a fallback when country field has no options in JSON
    const countries = [
        { key: 'AD', value: 'Andorra' }, { key: 'AE', value: 'United Arab Emirates' },
        { key: 'AF', value: 'Afghanistan' }, { key: 'AG', value: 'Antigua and Barbuda' },
        { key: 'AI', value: 'Anguilla' }, { key: 'AL', value: 'Albania' },
        { key: 'AM', value: 'Armenia' }, { key: 'AO', value: 'Angola' },
        { key: 'AQ', value: 'Antarctica' }, { key: 'AR', value: 'Argentina' },
        { key: 'AS', value: 'American Samoa' }, { key: 'AT', value: 'Austria' },
        { key: 'AU', value: 'Australia' }, { key: 'AW', value: 'Aruba' },
        { key: 'AX', value: 'Åland Islands' }, { key: 'AZ', value: 'Azerbaijan' },
        { key: 'BA', value: 'Bosnia and Herzegovina' }, { key: 'BB', value: 'Barbados' },
        { key: 'BD', value: 'Bangladesh' }, { key: 'BE', value: 'Belgium' },
        { key: 'BF', value: 'Burkina Faso' }, { key: 'BG', value: 'Bulgaria' },
        { key: 'BH', value: 'Bahrain' }, { key: 'BI', value: 'Burundi' },
        { key: 'BJ', value: 'Benin' }, { key: 'BL', value: 'Saint Barthélemy' },
        { key: 'BM', value: 'Bermuda' }, { key: 'BN', value: 'Brunei' },
        { key: 'BO', value: 'Bolivia' }, { key: 'BQ', value: 'Caribbean Netherlands' },
        { key: 'BR', value: 'Brazil' }, { key: 'BS', value: 'Bahamas' },
        { key: 'BT', value: 'Bhutan' }, { key: 'BV', value: 'Bouvet Island' },
        { key: 'BW', value: 'Botswana' }, { key: 'BY', value: 'Belarus' },
        { key: 'BZ', value: 'Belize' }, { key: 'CA', value: 'Canada' },
        { key: 'CC', value: 'Cocos Islands' }, { key: 'CD', value: 'Congo (DRC)' },
        { key: 'CF', value: 'Central African Republic' }, { key: 'CG', value: 'Congo' },
        { key: 'CH', value: 'Switzerland' }, { key: 'CI', value: 'Côte d\'Ivoire' },
        { key: 'CK', value: 'Cook Islands' }, { key: 'CL', value: 'Chile' },
        { key: 'CM', value: 'Cameroon' }, { key: 'CN', value: 'China' },
        { key: 'CO', value: 'Colombia' }, { key: 'CR', value: 'Costa Rica' },
        { key: 'CU', value: 'Cuba' }, { key: 'CV', value: 'Cape Verde' },
        { key: 'CW', value: 'Curaçao' }, { key: 'CX', value: 'Christmas Island' },
        { key: 'CY', value: 'Cyprus' }, { key: 'CZ', value: 'Czech Republic' },
        { key: 'DE', value: 'Germany' }, { key: 'DJ', value: 'Djibouti' },
        { key: 'DK', value: 'Denmark' }, { key: 'DM', value: 'Dominica' },
        { key: 'DO', value: 'Dominican Republic' }, { key: 'DZ', value: 'Algeria' },
        { key: 'EC', value: 'Ecuador' }, { key: 'EE', value: 'Estonia' },
        { key: 'EG', value: 'Egypt' }, { key: 'EH', value: 'Western Sahara' },
        { key: 'ER', value: 'Eritrea' }, { key: 'ES', value: 'Spain' },
        { key: 'ET', value: 'Ethiopia' }, { key: 'FI', value: 'Finland' },
        { key: 'FJ', value: 'Fiji' }, { key: 'FK', value: 'Falkland Islands' },
        { key: 'FM', value: 'Micronesia' }, { key: 'FO', value: 'Faroe Islands' },
        { key: 'FR', value: 'France' }, { key: 'GA', value: 'Gabon' },
        { key: 'GB', value: 'United Kingdom' }, { key: 'GD', value: 'Grenada' },
        { key: 'GE', value: 'Georgia' }, { key: 'GF', value: 'French Guiana' },
        { key: 'GG', value: 'Guernsey' }, { key: 'GH', value: 'Ghana' },
        { key: 'GI', value: 'Gibraltar' }, { key: 'GL', value: 'Greenland' },
        { key: 'GM', value: 'Gambia' }, { key: 'GN', value: 'Guinea' },
        { key: 'GP', value: 'Guadeloupe' }, { key: 'GQ', value: 'Equatorial Guinea' },
        { key: 'GR', value: 'Greece' }, { key: 'GS', value: 'South Georgia' },
        { key: 'GT', value: 'Guatemala' }, { key: 'GU', value: 'Guam' },
        { key: 'GW', value: 'Guinea-Bissau' }, { key: 'GY', value: 'Guyana' },
        { key: 'HK', value: 'Hong Kong' }, { key: 'HM', value: 'Heard Island' },
        { key: 'HN', value: 'Honduras' }, { key: 'HR', value: 'Croatia' },
        { key: 'HT', value: 'Haiti' }, { key: 'HU', value: 'Hungary' },
        { key: 'ID', value: 'Indonesia' }, { key: 'IE', value: 'Ireland' },
        { key: 'IL', value: 'Israel' }, { key: 'IM', value: 'Isle of Man' },
        { key: 'IN', value: 'India' }, { key: 'IO', value: 'British Indian Ocean Territory' },
        { key: 'IQ', value: 'Iraq' }, { key: 'IR', value: 'Iran' },
        { key: 'IS', value: 'Iceland' }, { key: 'IT', value: 'Italy' },
        { key: 'JE', value: 'Jersey' }, { key: 'JM', value: 'Jamaica' },
        { key: 'JO', value: 'Jordan' }, { key: 'JP', value: 'Japan' },
        { key: 'KE', value: 'Kenya' }, { key: 'KG', value: 'Kyrgyzstan' },
        { key: 'KH', value: 'Cambodia' }, { key: 'KI', value: 'Kiribati' },
        { key: 'KM', value: 'Comoros' }, { key: 'KN', value: 'Saint Kitts and Nevis' },
        { key: 'KP', value: 'North Korea' }, { key: 'KR', value: 'South Korea' },
        { key: 'KW', value: 'Kuwait' }, { key: 'KY', value: 'Cayman Islands' },
        { key: 'KZ', value: 'Kazakhstan' }, { key: 'LA', value: 'Laos' },
        { key: 'LB', value: 'Lebanon' }, { key: 'LC', value: 'Saint Lucia' },
        { key: 'LI', value: 'Liechtenstein' }, { key: 'LK', value: 'Sri Lanka' },
        { key: 'LR', value: 'Liberia' }, { key: 'LS', value: 'Lesotho' },
        { key: 'LT', value: 'Lithuania' }, { key: 'LU', value: 'Luxembourg' },
        { key: 'LV', value: 'Latvia' }, { key: 'LY', value: 'Libya' },
        { key: 'MA', value: 'Morocco' }, { key: 'MC', value: 'Monaco' },
        { key: 'MD', value: 'Moldova' }, { key: 'ME', value: 'Montenegro' },
        { key: 'MF', value: 'Saint Martin' }, { key: 'MG', value: 'Madagascar' },
        { key: 'MH', value: 'Marshall Islands' }, { key: 'MK', value: 'North Macedonia' },
        { key: 'ML', value: 'Mali' }, { key: 'MM', value: 'Myanmar' },
        { key: 'MN', value: 'Mongolia' }, { key: 'MO', value: 'Macao' },
        { key: 'MP', value: 'Northern Mariana Islands' }, { key: 'MQ', value: 'Martinique' },
        { key: 'MR', value: 'Mauritania' }, { key: 'MS', value: 'Montserrat' },
        { key: 'MT', value: 'Malta' }, { key: 'MU', value: 'Mauritius' },
        { key: 'MV', value: 'Maldives' }, { key: 'MW', value: 'Malawi' },
        { key: 'MX', value: 'Mexico' }, { key: 'MY', value: 'Malaysia' },
        { key: 'MZ', value: 'Mozambique' }, { key: 'NA', value: 'Namibia' },
        { key: 'NC', value: 'New Caledonia' }, { key: 'NE', value: 'Niger' },
        { key: 'NF', value: 'Norfolk Island' }, { key: 'NG', value: 'Nigeria' },
        { key: 'NI', value: 'Nicaragua' }, { key: 'NL', value: 'Netherlands' },
        { key: 'NO', value: 'Norway' }, { key: 'NP', value: 'Nepal' },
        { key: 'NR', value: 'Nauru' }, { key: 'NU', value: 'Niue' },
        { key: 'NZ', value: 'New Zealand' }, { key: 'OM', value: 'Oman' },
        { key: 'PA', value: 'Panama' }, { key: 'PE', value: 'Peru' },
        { key: 'PF', value: 'French Polynesia' }, { key: 'PG', value: 'Papua New Guinea' },
        { key: 'PH', value: 'Philippines' }, { key: 'PK', value: 'Pakistan' },
        { key: 'PL', value: 'Poland' }, { key: 'PM', value: 'Saint Pierre and Miquelon' },
        { key: 'PN', value: 'Pitcairn' }, { key: 'PR', value: 'Puerto Rico' },
        { key: 'PS', value: 'Palestine' }, { key: 'PT', value: 'Portugal' },
        { key: 'PW', value: 'Palau' }, { key: 'PY', value: 'Paraguay' },
        { key: 'QA', value: 'Qatar' }, { key: 'RE', value: 'Réunion' },
        { key: 'RO', value: 'Romania' }, { key: 'RS', value: 'Serbia' },
        { key: 'RU', value: 'Russia' }, { key: 'RW', value: 'Rwanda' },
        { key: 'SA', value: 'Saudi Arabia' }, { key: 'SB', value: 'Solomon Islands' },
        { key: 'SC', value: 'Seychelles' }, { key: 'SD', value: 'Sudan' },
        { key: 'SE', value: 'Sweden' }, { key: 'SG', value: 'Singapore' },
        { key: 'SH', value: 'Saint Helena' }, { key: 'SI', value: 'Slovenia' },
        { key: 'SJ', value: 'Svalbard and Jan Mayen' }, { key: 'SK', value: 'Slovakia' },
        { key: 'SL', value: 'Sierra Leone' }, { key: 'SM', value: 'San Marino' },
        { key: 'SN', value: 'Senegal' }, { key: 'SO', value: 'Somalia' },
        { key: 'SR', value: 'Suriname' }, { key: 'SS', value: 'South Sudan' },
        { key: 'ST', value: 'São Tomé and Príncipe' }, { key: 'SV', value: 'El Salvador' },
        { key: 'SX', value: 'Sint Maarten' }, { key: 'SY', value: 'Syria' },
        { key: 'SZ', value: 'Eswatini' }, { key: 'TC', value: 'Turks and Caicos Islands' },
        { key: 'TD', value: 'Chad' }, { key: 'TF', value: 'French Southern Territories' },
        { key: 'TG', value: 'Togo' }, { key: 'TH', value: 'Thailand' },
        { key: 'TJ', value: 'Tajikistan' }, { key: 'TK', value: 'Tokelau' },
        { key: 'TL', value: 'Timor-Leste' }, { key: 'TM', value: 'Turkmenistan' },
        { key: 'TN', value: 'Tunisia' }, { key: 'TO', value: 'Tonga' },
        { key: 'TR', value: 'Turkey' }, { key: 'TT', value: 'Trinidad and Tobago' },
        { key: 'TV', value: 'Tuvalu' }, { key: 'TW', value: 'Taiwan' },
        { key: 'TZ', value: 'Tanzania' }, { key: 'UA', value: 'Ukraine' },
        { key: 'UG', value: 'Uganda' }, { key: 'UM', value: 'U.S. Outlying Islands' },
        { key: 'US', value: 'United States' }, { key: 'UY', value: 'Uruguay' },
        { key: 'UZ', value: 'Uzbekistan' }, { key: 'VA', value: 'Vatican City' },
        { key: 'VC', value: 'Saint Vincent and the Grenadines' }, { key: 'VE', value: 'Venezuela' },
        { key: 'VG', value: 'British Virgin Islands' }, { key: 'VI', value: 'U.S. Virgin Islands' },
        { key: 'VN', value: 'Vietnam' }, { key: 'VU', value: 'Vanuatu' },
        { key: 'WF', value: 'Wallis and Futuna' }, { key: 'WS', value: 'Samoa' },
        { key: 'YE', value: 'Yemen' }, { key: 'YT', value: 'Mayotte' },
        { key: 'ZA', value: 'South Africa' }, { key: 'ZM', value: 'Zambia' },
        { key: 'ZW', value: 'Zimbabwe' }
    ];

    return countries;
}

function getUSStatesOptions() {
    // US states with their standard abbreviations
    const statesWithAbbrevs = [
        { abbrev: 'AL', name: 'Alabama' },
        { abbrev: 'AK', name: 'Alaska' },
        { abbrev: 'AZ', name: 'Arizona' },
        { abbrev: 'AR', name: 'Arkansas' },
        { abbrev: 'CA', name: 'California' },
        { abbrev: 'CO', name: 'Colorado' },
        { abbrev: 'CT', name: 'Connecticut' },
        { abbrev: 'DE', name: 'Delaware' },
        { abbrev: 'FL', name: 'Florida' },
        { abbrev: 'GA', name: 'Georgia' },
        { abbrev: 'HI', name: 'Hawaii' },
        { abbrev: 'ID', name: 'Idaho' },
        { abbrev: 'IL', name: 'Illinois' },
        { abbrev: 'IN', name: 'Indiana' },
        { abbrev: 'IA', name: 'Iowa' },
        { abbrev: 'KS', name: 'Kansas' },
        { abbrev: 'KY', name: 'Kentucky' },
        { abbrev: 'LA', name: 'Louisiana' },
        { abbrev: 'ME', name: 'Maine' },
        { abbrev: 'MD', name: 'Maryland' },
        { abbrev: 'MA', name: 'Massachusetts' },
        { abbrev: 'MI', name: 'Michigan' },
        { abbrev: 'MN', name: 'Minnesota' },
        { abbrev: 'MS', name: 'Mississippi' },
        { abbrev: 'MO', name: 'Missouri' },
        { abbrev: 'MT', name: 'Montana' },
        { abbrev: 'NE', name: 'Nebraska' },
        { abbrev: 'NV', name: 'Nevada' },
        { abbrev: 'NH', name: 'New Hampshire' },
        { abbrev: 'NJ', name: 'New Jersey' },
        { abbrev: 'NM', name: 'New Mexico' },
        { abbrev: 'NY', name: 'New York' },
        { abbrev: 'NC', name: 'North Carolina' },
        { abbrev: 'ND', name: 'North Dakota' },
        { abbrev: 'OH', name: 'Ohio' },
        { abbrev: 'OK', name: 'Oklahoma' },
        { abbrev: 'OR', name: 'Oregon' },
        { abbrev: 'PA', name: 'Pennsylvania' },
        { abbrev: 'RI', name: 'Rhode Island' },
        { abbrev: 'SC', name: 'South Carolina' },
        { abbrev: 'SD', name: 'South Dakota' },
        { abbrev: 'TN', name: 'Tennessee' },
        { abbrev: 'TX', name: 'Texas' },
        { abbrev: 'UT', name: 'Utah' },
        { abbrev: 'VT', name: 'Vermont' },
        { abbrev: 'VA', name: 'Virginia' },
        { abbrev: 'WA', name: 'Washington' },
        { abbrev: 'WV', name: 'West Virginia' },
        { abbrev: 'WI', name: 'Wisconsin' },
        { abbrev: 'WY', name: 'Wyoming' },
        { abbrev: 'DC', name: 'District of Columbia' }
    ];

    return statesWithAbbrevs.map(state => ({
        key: state.name.replace(/\s+/g, ''),
        value: state.name,
        abbrev: state.abbrev
    }));
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadTranslations();
});

function setupEventListeners() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput) {
        console.error('File input element not found! Make sure id="fileInput" exists in HTML.');
        return;
    }
    console.log('File input found, setting up event listener');
    fileInput.addEventListener('change', handleFileSelect);
    
    // Also support drag and drop
    const uploadArea = document.querySelector('.upload-area');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.background = '#e8f4f8';
        });
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.style.background = '';
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.background = '';
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                console.log('File dropped:', files[0].name);
                processFile(files[0]);
            }
        });
    }
}

async function loadTranslations() {
    try {
        // Add cache-busting parameter to force fresh load
        const response = await fetch(`field_translations.json?t=${Date.now()}`);
        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            translations = await response.json();
        } else {
            // No translation file available, use empty translations
            translations = { fields: {}, options: {}, requestTypes: {}, subjectTypes: {} };
        }
    } catch (error) {
        // Translation file not found or error loading, use empty translations
        translations = { fields: {}, options: {}, requestTypes: {}, subjectTypes: {} };
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        console.log('File selected:', file.name, file.size, 'bytes');
        processFile(file);
    } else {
        console.log('No file selected');
    }
}

function processFile(file) {
    console.log('Processing file:', file.name);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            console.log('File read successfully, parsing JSON...');
            const jsonData = JSON.parse(e.target.result);
            console.log('JSON parsed successfully');

            // Normalize webform data - handle both old and new formats
            // Old format: data wrapped in "webformData"
            // New format: data at root level
            if (jsonData.webformData) {
                webformData = jsonData.webformData;
                console.log('Using old format (webformData wrapper)');
            } else {
                // New format - data is already at root level
                webformData = jsonData;
                console.log('Using new format (root level)');
            }

            console.log('Parsing webform...');
            await parseWebform();
            console.log('Starting simulator...');
            startSimulator();
            console.log('Simulator started successfully!');
        } catch (error) {
            console.error('Error parsing JSON:', error);
            console.error('Error stack:', error.stack);
            alert('Error parsing JSON: ' + error.message + '\n\nCheck the browser console for details.');
        }
    };
    
    reader.onerror = (error) => {
        console.error('Error reading file:', error);
        alert('Error reading file. Please try again.');
    };
    
    reader.onprogress = (e) => {
        if (e.lengthComputable) {
            const percentLoaded = Math.round((e.loaded / e.total) * 100);
            console.log(`Loading file: ${percentLoaded}%`);
        }
    };
    
    console.log('Starting to read file...');
    reader.readAsText(file);
}

async function parseWebform() {
    allFields = [];
    workflowRules = [];
    defaultWorkflowId = null;
    workflowSettings = {};
    uiFields = [];
    submitButtonRules = null;
    attachmentRules = null;

    // Load translations from webform JSON if available
    if (webformData.formTranslations && webformData.formTranslations['en-us']) {
        const formTrans = webformData.formTranslations['en-us'];

        // Initialize translations if not already loaded
        if (!translations) {
            translations = { fields: {}, options: {}, requestTypes: {}, subjectTypes: {} };
        }

        // Merge form translations into our translations object
        Object.assign(translations.fields, formTrans);
        Object.assign(translations.options, formTrans);
        Object.assign(translations.requestTypes, formTrans);
        Object.assign(translations.subjectTypes, formTrans);
    }

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
        console.log(`📝 Parsing ${webformData.fields.length} fields...`);
        webformData.fields.forEach(field => {
            let options = field.options || [];
            
            // Sort country field options alphabetically when first loaded
            const fieldKey = field.fieldKey || '';
            const fieldLabel = getFieldLabel(fieldKey) || '';
            const isCountryField = fieldKey.toLowerCase().includes('country') || 
                                   fieldLabel.toLowerCase().includes('country') ||
                                   fieldLabel.toLowerCase().includes('residence');
            
            if (isCountryField && options.length > 0) {
                options = [...options].sort((a, b) => {
                    const labelA = (a.value || getOptionLabel(a.key) || a.key || '').trim().toLowerCase();
                    const labelB = (b.value || getOptionLabel(b.key) || b.key || '').trim().toLowerCase();
                    return labelA.localeCompare(labelB, undefined, { sensitivity: 'base' });
                });
                console.log(`🔤 Pre-sorted ${options.length} country options for field "${fieldKey}"`);
            }
            
            allFields.push({
                key: field.fieldKey,
                label: getFieldLabel(field.fieldKey),
                type: field.inputType,
                description: field.description,
                isRequired: field.isRequired,
                hasVisibilityRule: field.hasVisibilityRule,
                visibilityRules: field.visibilityRules,
                options: options,
                isMasked: field.isMasked,
                status: field.status,
                isSelected: field.isSelected
            });
        });
        console.log(`✅ Parsed ${allFields.length} fields into allFields`);
        
        // Debug: Check if country field was added
        const countryFieldCheck = allFields.find(f => f.key === 'country');
        if (countryFieldCheck) {
            console.log(`✅ Country field found in allFields: key="${countryFieldCheck.key}", options=${countryFieldCheck.options?.length || 0}`);
        } else {
            console.log(`⚠️ Country field NOT found in allFields after parsing`);
            console.log(`   Sample field keys: ${allFields.slice(0, 5).map(f => f.key).join(', ')}`);
        }
    } else {
        console.log('️ webformData.fields is undefined or null');
    }

    // Build hash lookup AFTER parsing fields (needed for brute force decryption)
    // This must happen after allFields is populated so we can find the country/state fields
    console.log(`🔍 About to build hash lookup. allFields.length = ${allFields.length}`);
    await buildCountryHashLookup();
    await buildStateHashLookup();

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

                // BRUTE FORCE: If workflow has hashed criteria, reverse the hashes
                const ruleName = rule.ruleName || '';
                
                // Check for hashed criteria - look for fields with "Hash" in the name
                // Also check if values look like SHA-512 hashes (128 hex characters)
                const hasHashedCriteria = conditionGroups.some(group =>
                    group.conditions?.some(c => {
                        const fieldHasHash = c.field && c.field.includes('Hash');
                        const valueIsHash = c.value && typeof c.value === 'string' && c.value.length === 128 && /^[0-9a-f]+$/i.test(c.value);
                        return fieldHasHash || valueIsHash;
                    })
                );

                if (hasHashedCriteria) {
                    console.log(`🔍 Workflow "${ruleName}" has hashed criteria - attempting brute force reversal...`);
                    console.log(`   Country hash lookup table size: ${Object.keys(countryHashLookup).length} entries`);
                    console.log(`   State hash lookup table size: ${Object.keys(stateHashLookup).length} entries`);

                    // Extract and reverse hashed values
                    const decryptedCountries = new Set();
                    const decryptedStates = new Set();
                    let hasDecryptedAny = false;
                    let totalHashesChecked = 0;

                    conditionGroups.forEach((group, groupIdx) => {
                        const conditions = group.conditions || [];
                        console.log(`   Processing condition group ${groupIdx + 1} with ${conditions.length} conditions`);
                        
                        conditions.forEach((condition, condIdx) => {
                            // Check if this is a hashed field (by name or by value format)
                            const fieldHasHash = condition.field && condition.field.includes('Hash');
                            const valueIsHash = condition.value && typeof condition.value === 'string' && condition.value.length === 128 && /^[0-9a-f]+$/i.test(condition.value);
                            
                            if (fieldHasHash || valueIsHash) {
                                const isCountryHash = condition.field && condition.field.toLowerCase().includes('country');
                                const isStateHash = condition.field && condition.field.toLowerCase().includes('state');
                                
                                console.log(`   🔎 Found hashed condition ${condIdx + 1}: field="${condition.field}", value length=${condition.value?.length || 0}, type=${isCountryHash ? 'country' : isStateHash ? 'state' : 'unknown'}`);
                                
                                // Handle both single value and array of values
                                const hashValues = Array.isArray(condition.value) ? condition.value : [condition.value];
                                
                                hashValues.forEach((hashValue, hashIdx) => {
                                    totalHashesChecked++;
                                    if (hashValue && typeof hashValue === 'string') {
                                        console.log(`      Checking hash ${hashIdx + 1}: ${hashValue.substring(0, 16)}...`);
                                        
                                        let decrypted = null;
                                        let decryptedValue = null;
                                        
                                        // Try country hash lookup first
                                        if (isCountryHash && countryHashLookup[hashValue]) {
                                            decrypted = countryHashLookup[hashValue];
                                            decryptedValue = decrypted.originalKey || decrypted.originalValue;
                                            decryptedCountries.add(decryptedValue);
                                            hasDecryptedAny = true;
                                            console.log(`      ✅ DECRYPTED COUNTRY: ${hashValue.substring(0, 16)}... → ${decryptedValue} (from "${decrypted.hashedVariant}")`);
                                        }
                                        // Try state hash lookup
                                        else if (isStateHash && stateHashLookup[hashValue]) {
                                            decrypted = stateHashLookup[hashValue];
                                            decryptedValue = decrypted.originalKey || decrypted.originalValue;
                                            decryptedStates.add(decryptedValue);
                                            hasDecryptedAny = true;
                                            console.log(`      ✅ DECRYPTED STATE: ${hashValue.substring(0, 16)}... → ${decryptedValue} (from "${decrypted.hashedVariant}")`);
                                        }
                                        // Try both lookups if field type is unknown
                                        else if (!isCountryHash && !isStateHash) {
                                            if (countryHashLookup[hashValue]) {
                                                decrypted = countryHashLookup[hashValue];
                                                decryptedValue = decrypted.originalKey || decrypted.originalValue;
                                                decryptedCountries.add(decryptedValue);
                                                hasDecryptedAny = true;
                                                console.log(`      ✅ DECRYPTED (as country): ${hashValue.substring(0, 16)}... → ${decryptedValue} (from "${decrypted.hashedVariant}")`);
                                            } else if (stateHashLookup[hashValue]) {
                                                decrypted = stateHashLookup[hashValue];
                                                decryptedValue = decrypted.originalKey || decrypted.originalValue;
                                                decryptedStates.add(decryptedValue);
                                                hasDecryptedAny = true;
                                                console.log(`      ✅ DECRYPTED (as state): ${hashValue.substring(0, 16)}... → ${decryptedValue} (from "${decrypted.hashedVariant}")`);
                                            } else {
                                                console.log(`      ⚠️ Hash not found in any lookup: ${hashValue.substring(0, 16)}... (checked ${Object.keys(countryHashLookup).length} country + ${Object.keys(stateHashLookup).length} state entries)`);
                                            }
                                        } else {
                                            // Hash not found in the expected lookup
                                            const lookupSize = isCountryHash ? Object.keys(countryHashLookup).length : Object.keys(stateHashLookup).length;
                                            console.log(`      ⚠️ Hash not found in ${isCountryHash ? 'country' : 'state'} lookup: ${hashValue.substring(0, 16)}... (checked ${lookupSize} entries)`);
                                        }
                                    }
                                });
                            }
                        });
                    });

                    const totalDecrypted = decryptedCountries.size + decryptedStates.size;
                    console.log(`   📊 Brute force results: checked ${totalHashesChecked} hash(es), decrypted ${decryptedCountries.size} country value(s), ${decryptedStates.size} state value(s)`);

                    // Track which hashes we found but couldn't decrypt
                    const undecryptedStateHashes = new Set();
                    const undecryptedCountryHashes = new Set();
                    
                    // Re-check for undecrypted hashes
                    conditionGroups.forEach((group) => {
                        const conditions = group.conditions || [];
                        conditions.forEach((condition) => {
                            const fieldHasHash = condition.field && condition.field.includes('Hash');
                            const valueIsHash = condition.value && typeof condition.value === 'string' && condition.value.length === 128 && /^[0-9a-f]+$/i.test(condition.value);
                            
                            if (fieldHasHash || valueIsHash) {
                                const isCountryHash = condition.field && condition.field.toLowerCase().includes('country');
                                const isStateHash = condition.field && condition.field.toLowerCase().includes('state');
                                const hashValues = Array.isArray(condition.value) ? condition.value : [condition.value];
                                
                                hashValues.forEach((hashValue) => {
                                    if (hashValue && typeof hashValue === 'string') {
                                        if (isStateHash && !stateHashLookup[hashValue]) {
                                            undecryptedStateHashes.add(hashValue);
                                        } else if (isCountryHash && !countryHashLookup[hashValue]) {
                                            undecryptedCountryHashes.add(hashValue);
                                        } else if (!isCountryHash && !isStateHash) {
                                            // Unknown type - check both
                                            if (!countryHashLookup[hashValue] && !stateHashLookup[hashValue]) {
                                                // Can't determine type, but it's a hash
                                                if (condition.field && condition.field.toLowerCase().includes('state')) {
                                                    undecryptedStateHashes.add(hashValue);
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    });

                    if (hasDecryptedAny && totalDecrypted > 0) {
                        // Successfully decrypted! Use the actual values, but mark as originally hashed
                        if (decryptedCountries.size > 0) {
                            ruleCriteria.push({
                                field: 'country',
                                values: Array.from(decryptedCountries),
                                isHashed: true, // Mark as originally hashed
                                inferred: false,
                                decrypted: true
                            });
                            console.log(`✅ Successfully decrypted ${decryptedCountries.size} country value(s): ${Array.from(decryptedCountries).join(', ')}`);
                        }
                        if (decryptedStates.size > 0) {
                            ruleCriteria.push({
                                field: 'state',
                                values: Array.from(decryptedStates),
                                isHashed: true, // Mark as originally hashed
                                inferred: false,
                                decrypted: true
                            });
                            console.log(`✅ Successfully decrypted ${decryptedStates.size} state value(s): ${Array.from(decryptedStates).join(', ')}`);
                        }
                    }
                    
                    // Also add undecrypted hashes if any
                    if (undecryptedStateHashes.size > 0) {
                        ruleCriteria.push({
                            field: 'state',
                            values: Array.from(undecryptedStateHashes).map(h => `[HASHED: ${h.substring(0, 16)}...]`),
                            isHashed: true,
                            inferred: false,
                            decrypted: false,
                            originalHashes: Array.from(undecryptedStateHashes)
                        });
                        console.log(`⚠️ Found ${undecryptedStateHashes.size} undecrypted state hash(es)`);
                    }
                    if (undecryptedCountryHashes.size > 0) {
                        ruleCriteria.push({
                            field: 'country',
                            values: Array.from(undecryptedCountryHashes).map(h => `[HASHED: ${h.substring(0, 16)}...]`),
                            isHashed: true,
                            inferred: false,
                            decrypted: false,
                            originalHashes: Array.from(undecryptedCountryHashes)
                        });
                        console.log(`⚠️ Found ${undecryptedCountryHashes.size} undecrypted country hash(es)`);
                    }
                    
                    if (!hasDecryptedAny && totalDecrypted === 0 && undecryptedStateHashes.size === 0 && undecryptedCountryHashes.size === 0) {
                        // Fallback: Try to infer from workflow name if brute force failed
                        console.log(`⚠️ Brute force failed, falling back to workflow name inference...`);
                        if (ruleName.toUpperCase().includes('CCPA')) {
                            ruleCriteria.push({
                                field: 'country',
                                values: ['US'],
                                isHashed: false,
                                inferred: true,
                                decrypted: false
                            });
                            console.log(' Inferred: CCPA = Country is US');
                        } else if (ruleName.toUpperCase().includes('LGPD')) {
                            ruleCriteria.push({
                                field: 'country',
                                values: ['BR'],
                                isHashed: false,
                                inferred: true,
                                decrypted: false
                            });
                            console.log(' Inferred: LGPD = Country is Brazil');
                        } else if (ruleName.toUpperCase().includes('GDPR')) {
                            ruleCriteria.push({
                                field: 'country',
                                values: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'],
                                isHashed: false,
                                inferred: true,
                                decrypted: false
                            });
                            console.log(' Inferred: GDPR = Country is EU member state');
                        } else {
                            // Unknown encrypted workflow - mark as such
                            ruleCriteria.push({
                                field: 'encrypted_criteria',
                                values: ['[Could not decrypt - hash not in lookup table]'],
                                isHashed: true,
                                inferred: false,
                                decrypted: false
                            });
                            console.log(' Could not decrypt or infer criteria');
                        }
                    }
                    // Skip normal parsing for hashed workflows - we already handled them
                } else {
                    // Normal workflow parsing (no hashes detected in field names)
                    // But we still need to check if values themselves are hashes
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

                        // Check if value is a hash (128-character hex string)
                        const valueIsHash = value && typeof value === 'string' && value.length === 128 && /^[0-9a-f]+$/i.test(value);
                        const isStateField = field && (field.toLowerCase().includes('state') || field === 'state');
                        const isCountryField = field && (field.toLowerCase().includes('country') || field === 'country');
                        
                        // If it's a state/country field with a hash value, try to decrypt it
                        if (valueIsHash && (isStateField || isCountryField)) {
                            let decrypted = null;
                            if (isStateField && stateHashLookup[value]) {
                                decrypted = stateHashLookup[value];
                                value = decrypted.originalKey || decrypted.originalValue;
                                console.log(`   🔓 Decrypted state hash in normal parsing: ${value}`);
                            } else if (isCountryField && countryHashLookup[value]) {
                                decrypted = countryHashLookup[value];
                                value = decrypted.originalKey || decrypted.originalValue;
                                console.log(`   🔓 Decrypted country hash in normal parsing: ${value}`);
                            }
                            
                            // If we decrypted it, mark as originally hashed
                            if (decrypted) {
                                const existingCriteria = ruleCriteria.find(c => c.field === (isStateField ? 'state' : 'country'));
                                if (existingCriteria) {
                                    if (!existingCriteria.values.includes(value)) {
                                        existingCriteria.values.push(value);
                                    }
                                    existingCriteria.isHashed = true;
                                    existingCriteria.decrypted = true;
                                } else {
                                    ruleCriteria.push({
                                        field: isStateField ? 'state' : 'country',
                                        values: [value],
                                        isHashed: true,
                                        decrypted: true,
                                        inferred: false
                                    });
                                }
                                return; // Skip normal processing for this condition
                            } else if (valueIsHash) {
                                // Hash found but couldn't decrypt - mark as hashed
                                const existingCriteria = ruleCriteria.find(c => c.field === (isStateField ? 'state' : 'country'));
                                if (existingCriteria) {
                                    if (!existingCriteria.values.includes(`[HASHED: ${value.substring(0, 16)}...]`)) {
                                        existingCriteria.values.push(`[HASHED: ${value.substring(0, 16)}...]`);
                                    }
                                    existingCriteria.isHashed = true;
                                    existingCriteria.decrypted = false;
                                } else {
                                    ruleCriteria.push({
                                        field: isStateField ? 'state' : 'country',
                                        values: [`[HASHED: ${value.substring(0, 16)}...]`],
                                        isHashed: true,
                                        decrypted: false,
                                        originalHashes: [value]
                                    });
                                }
                                return; // Skip normal processing for this condition
                            }
                        }

                        // Check if we already have this field in ruleCriteria
                        let existingCriteria = ruleCriteria.find(c => c.field === field);

                        if (!existingCriteria) {
                            existingCriteria = {
                                field: field,
                                values: [],
                                isHashed: false
                            };
                            ruleCriteria.push(existingCriteria);
                        }

                        // Add value if not already present
                        if (value && !existingCriteria.values.includes(value)) {
                            existingCriteria.values.push(value);
                        }
                    });
                });
                } // End of else block for normal parsing

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

async function startSimulator() {
    document.getElementById('uploadSection').classList.add('hidden');
    document.getElementById('mainSection').classList.remove('hidden');

    currentSelections = {};
    visibleFields = new Set();

    // Hash lookup is already built in parseWebform() before workflow parsing
    // No need to rebuild it here

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
            // Sort options alphabetically for country fields
            const isCountryField = isLikelyCountryField(field);
            if (isCountryField && availableOptions.length > 0) {
                availableOptions = [...availableOptions].sort((a, b) => {
                    const labelA = (a.value || getOptionLabel(a.key) || a.key || '').trim().toLowerCase();
                    const labelB = (b.value || getOptionLabel(b.key) || b.key || '').trim().toLowerCase();
                    return labelA.localeCompare(labelB, undefined, { sensitivity: 'base' });
                });
            }
            
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
        let options = field.options || [];

        // Smart detection: If field is empty but likely a country field, populate it
        if (options.length === 0 && isLikelyCountryField(field)) {
            options = getWorldCountriesOptions();
        }

        // Smart detection: If field is empty but likely US states, populate them
        if (options.length === 0 && isLikelyUSStatesField(field)) {
            options = getUSStatesOptions();
        }

        // If still no options, show message
        if (options.length === 0) {
            return `
                <div class="form-field">
                    <label class="form-label">${field.label}${required}${inactiveBadge}</label>
                    ${description}
                    <div style="padding: 0.75rem; background: #f8f9fa; border: 2px solid #e0e6ed; border-radius: 6px; color: #6c757d; font-style: italic;">
                        Options dynamically loaded (not available in simulator)
                    </div>
                </div>
            `;
        }

        // Sort options alphabetically by display name (especially important for country fields)
        const isCountryField = isLikelyCountryField(field);
        if (isCountryField && options.length > 0) {
            // Create a sorted copy to avoid mutating the original
            const originalCount = options.length;
            options = [...options].sort((a, b) => {
                const labelA = (a.value || getOptionLabel(a.key) || a.key || '').trim().toLowerCase();
                const labelB = (b.value || getOptionLabel(b.key) || b.key || '').trim().toLowerCase();
                return labelA.localeCompare(labelB, undefined, { sensitivity: 'base' });
            });
            console.log(`🔤 Sorted ${originalCount} country options alphabetically for field "${field.key}"`);
        }

        // Render select with options
        const optionsHtml = options.map(opt => {
            const optLabel = opt.value || getOptionLabel(opt.key);
            const selected = currentSelections[field.key] === opt.key ? 'selected' : '';
            return `<option value="${opt.key}" ${selected}>${optLabel}</option>`;
        }).join('');

        return `
            <div class="form-field">
                <label class="form-label">${field.label}${required}${inactiveBadge}</label>
                ${description}
                <select class="form-select" onchange="selectOption('${field.key}', this.value)" ${!isActive ? 'disabled style="opacity: 0.6;"' : ''}>
                    <option value="">-- Choose --</option>
                    ${optionsHtml}
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

        // Show workflows with matches OR workflows with encrypted criteria (always show those)
        // A workflow has encrypted criteria if it has hashed criteria OR decrypted criteria (which means it originally had hashed criteria)
        const hasEncryptedCriteria = workflow.ruleCriteria?.some(c => c.isHashed || c.decrypted === true);

        if (result.matchedCount > 0 || hasEncryptedCriteria) {
            scoredWorkflows.push({
                workflow,
                reasons: result.reasons,
                unmatchedReasons: result.unmatchedReasons,
                matchedCount: result.matchedCount,
                totalCriteria: result.totalCriteria,
                isComplete: result.triggered,
                matchPercentage: result.totalCriteria > 0 ? (result.matchedCount / result.totalCriteria) * 100 : 0,
                hasEncryptedCriteria: hasEncryptedCriteria
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

    workflowList.innerHTML = scoredWorkflows.map(({ workflow, reasons, unmatchedReasons, matchedCount, totalCriteria, isComplete, matchPercentage, hasEncryptedCriteria }) => {
        const params = Array.isArray(workflow.ruleActionParameters)
            ? workflow.ruleActionParameters
            : [];
        const workflowId = params.find(p => p.field === 'WORKFLOWID')?.value || 'N/A';
        const deadline = params.find(p => p.field === 'DEADLINE')?.value || 'N/A';
        const isDefaultWorkflow = workflowId === defaultWorkflowId;

        let cardStyle, statusBadge;

        // Normal workflow status handling (no special decryption badges)
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
                <div class="workflow-detail">
                    <div class="workflow-detail-label">Deadline:</div>
                    ${deadline} days
                </div>
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

// Smart Workflow Analysis: Analyzes workflow rules to identify decision dimensions
function analyzeWorkflowDimensions() {
    console.log('� Analyzing workflow dimensions...');
    const criteriaMap = {};

    // Extract all criteria fields from all workflows
    workflowRules.forEach(workflow => {
        if (!workflow.ruleCriteria) return;

        workflow.ruleCriteria.forEach(criterion => {
            const field = criterion.field;
            if (!criteriaMap[field]) {
                criteriaMap[field] = {
                    field: field,
                    label: getFieldLabel(field),
                    workflows: [],
                    values: new Set(),
                    count: 0
                };
            }
            if (!criteriaMap[field].workflows.includes(workflow.ruleName)) {
                criteriaMap[field].workflows.push(workflow.ruleName);
            }
            criterion.values.forEach(v => criteriaMap[field].values.add(v));
            criteriaMap[field].count++;
        });
    });

    // Convert Sets to Arrays for easier handling
    Object.values(criteriaMap).forEach(crit => {
        crit.values = Array.from(crit.values);
    });

    console.log('� Criteria found:', Object.keys(criteriaMap).join(', '));
    return criteriaMap;
}

// Rank dimensions by importance (workflow frequency)
function rankDimensions(criteriaMap, topN = 3) {
    console.log('� Ranking dimensions by importance...');

    const ranked = Object.values(criteriaMap)
        .sort((a, b) => b.workflows.length - a.workflows.length)
        .slice(0, topN);

    console.log(`Top ${topN} dimensions:`);
    ranked.forEach((dim, idx) => {
        console.log(`  ${idx + 1}. ${dim.label || dim.field} (${dim.workflows.length} workflows, ${dim.values.length} values)`);
    });

    return ranked;
}

// Build dynamic coverage matrix based on actual workflow dimensions
function buildDynamicCoverageMatrix() {
    console.log('� Building dynamic coverage matrix...');

    // Step 1: Analyze what workflows actually care about
    const analysis = analyzeWorkflowDimensions();
    const criteriaMap = analysis.criteriaMap || analysis; // Handle both old and new format
    
    if (Object.keys(criteriaMap).length === 0) {
        console.warn('⚠️ No workflow criteria found');
        alert('⚠️ Cannot generate diagram:\nNo workflow criteria found. Check that workflows are configured.');
        return null;
    }

    // Step 2: Get the top dimensions (1 or 2)
    const actualMap = analysis.criteriaMap || criteriaMap;
    const topDimensions = rankDimensions(actualMap, 2);

    if (topDimensions.length === 0) {
        console.warn('⚠️ No dimensions found');
        alert('⚠️ Cannot generate diagram:\nNo criteria fields found in workflows.');
        return null;
    }

    // Handle single dimension case (list view instead of matrix)
    if (topDimensions.length === 1) {
        console.log(`📋 Single dimension found, creating list view: ${topDimensions[0].label}`);
        return buildSingleDimensionView(topDimensions[0], criteriaMap);
    }

    const [dim1, dim2] = topDimensions;
    
    console.log(`📋 Creating matrix: ${dim1.label} × ${dim2.label}`);
    
    // Get ALL values from the actual field (not just from workflows)
    // This ensures we show all possible options, including ones that might not have workflows yet
    function getAllFieldValues(fieldKey) {
        const field = allFields.find(f => f.key === fieldKey);
        if (field && field.options && field.options.length > 0) {
            return field.options.map(opt => opt.key);
        }
        return [];
    }
    
    // Filter: Show all values from the field, enhanced with workflow stats
    function filterImportantValues(dimension, includeCatchAll = true) {
        // First, get ALL possible values from the actual field
        const allFieldValues = getAllFieldValues(dimension.field);
        console.log(`   Field ${dimension.field} has ${allFieldValues.length} total options in field definition`);
        
        // If valueStats exists, use enhanced filtering but include ALL field values
        if (dimension.valueStats && dimension.valueStats.length > 0) {
            // Create a map of valueStats for quick lookup
            const valueStatsMap = {};
            dimension.valueStats.forEach(vs => {
                valueStatsMap[vs.value] = vs;
            });
            
            // Return ALL field values, enhanced with stats where available
            return allFieldValues.map(value => {
                const stats = valueStatsMap[value];
                if (stats) {
                    return {
                        value: stats.value,
                        label: getOptionLabel(stats.value) || stats.value,
                        workflowCount: stats.totalWorkflowCount,
                        looseWorkflowCount: stats.looseWorkflowCount,
                        specificWorkflowCount: stats.specificWorkflowCount,
                        workflows: stats.workflows,
                        isCatchAll: stats.isCatchAll,
                        importance: stats.importance,
                        coverageType: stats.coverageType
                    };
                } else {
                    // Value exists in field but not in any workflow
                    return {
                        value: value,
                        label: getOptionLabel(value) || value,
                        workflowCount: 0,
                        looseWorkflowCount: 0,
                        specificWorkflowCount: 0,
                        workflows: [],
                        isCatchAll: false,
                        importance: 'LOW',
                        coverageType: 'NONE'
                    };
                }
            });
        }
        
        // Fallback: use all values from field definition
        const values = allFieldValues.length > 0 ? allFieldValues : (dimension.values || []);
        return values.map(value => {
            // Try to find this value in workflows to get basic stats
            let workflowCount = 0;
            const workflows = [];
            workflowRules.forEach(workflow => {
                if (!workflow.ruleCriteria) return;
                workflow.ruleCriteria.forEach(criterion => {
                    if (criterion.field === dimension.field && criterion.values.includes(value)) {
                        if (!workflows.includes(workflow.ruleName)) {
                            workflows.push(workflow.ruleName);
                            workflowCount++;
                        }
                    }
                });
            });
            
            return {
                value: value,
                label: getOptionLabel(value) || value,
                workflowCount: workflowCount,
                looseWorkflowCount: 0,
                specificWorkflowCount: 0,
                workflows: workflows,
                isCatchAll: false,
                importance: workflowCount > 0 ? 'MEDIUM' : 'LOW',
                coverageType: 'NONE'
            };
        });
    }
    
    // Debug: Check if dimensions have values
    console.log('🔍 Debug - dim1:', {
        field: dim1.field,
        valuesCount: dim1.values ? dim1.values.length : 0,
        hasValueStats: !!dim1.valueStats,
        valueStatsCount: dim1.valueStats ? dim1.valueStats.length : 0
    });
    console.log('🔍 Debug - dim2:', {
        field: dim2.field,
        valuesCount: dim2.values ? dim2.values.length : 0,
        hasValueStats: !!dim2.valueStats,
        valueStatsCount: dim2.valueStats ? dim2.valueStats.length : 0
    });
    
    const dim1Values = filterImportantValues(dim1, true);
    const dim2Values = filterImportantValues(dim2, true);
    
    console.log(`📊 Filtered values: ${dim1Values.length} rows × ${dim2Values.length} columns`);
    
    if (dim1Values.length === 0 || dim2Values.length === 0) {
        console.warn('⚠️ No values found after filtering!');
        console.warn('   dim1.values:', dim1.values);
        console.warn('   dim2.values:', dim2.values);
        // Fallback: use all values from dimensions
        if (dim1Values.length === 0 && dim1.values && dim1.values.length > 0) {
            console.log('   Using all dim1 values as fallback');
            dim1Values.push(...dim1.values.map(v => ({
                value: v,
                label: getOptionLabel(v) || v,
                workflowCount: 1,
                looseWorkflowCount: 0,
                specificWorkflowCount: 0,
                workflows: [],
                isCatchAll: false,
                importance: 'MEDIUM',
                coverageType: 'NONE'
            })));
        }
        if (dim2Values.length === 0 && dim2.values && dim2.values.length > 0) {
            console.log('   Using all dim2 values as fallback');
            dim2Values.push(...dim2.values.map(v => ({
                value: v,
                label: getOptionLabel(v) || v,
                workflowCount: 1,
                looseWorkflowCount: 0,
                specificWorkflowCount: 0,
                workflows: [],
                isCatchAll: false,
                importance: 'MEDIUM',
                coverageType: 'NONE'
            })));
        }
    }
    const catchAllCount1 = dim1Values.filter(v => v.isCatchAll).length;
    const catchAllCount2 = dim2Values.filter(v => v.isCatchAll).length;
    if (catchAllCount1 > 0 || catchAllCount2 > 0) {
        console.log(`   Catch-all values: ${catchAllCount1} rows, ${catchAllCount2} columns`);
    }
    
    // Step 3: Build the matrix
    const matrix = [];
    const stats = { total: 0, covered: 0, gaps: 0, catchAllCovered: 0 };
    
    console.log('🔍 Building matrix cells...');
    console.log('   dim1Values:', dim1Values.length, 'values', dim1Values.slice(0, 2));
    console.log('   dim2Values:', dim2Values.length, 'values', dim2Values.slice(0, 2));
    console.log('   dim1.field:', dim1.field);
    console.log('   dim2.field:', dim2.field);
    
    if (dim1Values.length === 0 || dim2Values.length === 0) {
        console.error('❌ ERROR: Empty value arrays!');
        console.error('   dim1Values:', dim1Values);
        console.error('   dim2Values:', dim2Values);
        return null;
    }
    
    dim1Values.forEach((val1, idx1) => {
        if (!val1 || !val1.value) {
            console.error(`❌ ERROR: Invalid val1 at index ${idx1}:`, val1);
            return;
        }
        const row = {
            value: val1.value,
            label: val1.label,
            importance: val1.importance,
            workflowCount: val1.workflowCount,
            looseWorkflowCount: val1.looseWorkflowCount,
            specificWorkflowCount: val1.specificWorkflowCount,
            isCatchAll: val1.isCatchAll,
            coverageType: val1.coverageType,
            cells: []
        };
        
        dim2Values.forEach((val2, idx2) => {
            if (!val2 || !val2.value) {
                console.error(`❌ ERROR: Invalid val2 at index ${idx2}:`, val2);
                return;
            }
            
            // Check if this combination is actually visible (fields can appear together)
            // For coverage analysis, we want to show ALL combinations by default
            // Only mark as "not visible" if we can definitively prove it's not visible
            let cellVisible = true;
            
            // For system fields like requestTypes/subjectTypes, check option-level visibility
            const isSystemField = (fieldKey) => {
                return fieldKey === 'requestTypes' || fieldKey === 'subjectTypes' || 
                       !allFields.find(f => f.key === fieldKey);
            };
            
            // Special handling for request type + "who" combinations
            // Check if the request type is visible for the "who" selection
            if (isSystemField(dim1.field) && dim1.field === 'requestTypes') {
                // dim1 is request type, dim2 is "who"
                const visibilityResult = isRequestTypeVisibleForWho(val1.value, dim2.field, val2.value);
                if (visibilityResult === false) {
                    // Definitively not visible
                    cellVisible = false;
                } else if (visibilityResult === true) {
                    // Definitively visible
                    cellVisible = true;
                } else {
                    // Uncertain (null) - default to visible for coverage analysis
                    cellVisible = true;
                }
            } else if (isSystemField(dim2.field) && dim2.field === 'requestTypes') {
                // dim2 is request type, dim1 is "who"
                const visibilityResult = isRequestTypeVisibleForWho(val2.value, dim1.field, val1.value);
                if (visibilityResult === false) {
                    // Definitively not visible
                    cellVisible = false;
                } else if (visibilityResult === true) {
                    // Definitively visible
                    cellVisible = true;
                } else {
                    // Uncertain (null) - default to visible for coverage analysis
                    cellVisible = true;
                }
            } else if (isSystemField(dim1.field) || isSystemField(dim2.field)) {
                // Other system fields - always visible
                cellVisible = true;
            } else {
                // For regular fields, use isCombinationVisible
                cellVisible = isCombinationVisible([dim1.field, dim2.field], [val1.value, val2.value]);
            }
            
            // Test if any workflow triggers for this combination
            // For request type dimension (dim1): Must match exactly - workflows must check this request type
            // For "who" dimension (dim2): If workflow doesn't check it, it matches (loose rule)
            const triggeredWorkflows = workflowRules.filter(workflow => {
                if (!workflow.ruleCriteria) return false;
                
                // Check if workflow has criteria for dimension 1 (request type)
                const hasDim1Criteria = workflow.ruleCriteria.some(c => c.field === dim1.field);
                let dim1Match = false;
                if (hasDim1Criteria) {
                    // Workflow checks this dimension - must match exactly
                    dim1Match = evaluateDimensionMatch(workflow, dim1.field, val1.value);
                } else {
                    // Workflow doesn't check request type at all - doesn't match
                    dim1Match = false;
                }
                
                // Check if workflow has criteria for dimension 2 (who is making request)
                const hasDim2Criteria = workflow.ruleCriteria.some(c => c.field === dim2.field);
                let dim2Match = false;
                if (hasDim2Criteria) {
                    // Workflow checks this dimension - must match exactly
                    dim2Match = evaluateDimensionMatch(workflow, dim2.field, val2.value);
                } else {
                    // Workflow doesn't check "who" dimension - matches any (loose rule)
                    dim2Match = true;
                }
                
                return dim1Match && dim2Match;
            });
            
            // Categorize triggered workflows
            const looseWorkflows = triggeredWorkflows.filter(w => (w.ruleCriteria || []).length === 1);
            const specificWorkflows = triggeredWorkflows.filter(w => (w.ruleCriteria || []).length > 1);
            
            const cell = {
                value: val2.value,
                label: val2.label,
                covered: triggeredWorkflows.length > 0,
                isVisible: cellVisible,
                workflowCount: triggeredWorkflows.length,
                looseWorkflowCount: looseWorkflows.length,
                specificWorkflowCount: specificWorkflows.length,
                isCatchAllCoverage: looseWorkflows.length > 0 && specificWorkflows.length === 0,
                workflows: triggeredWorkflows.map(w => w.ruleName),
                looseWorkflows: looseWorkflows.map(w => w.ruleName),
                specificWorkflows: specificWorkflows.map(w => w.ruleName)
            };
            
            row.cells.push(cell);
            
            // Count all cells, but mark not-visible ones separately
            // For coverage analysis, we want to see ALL combinations
            stats.total++;
            if (cell.covered) {
                stats.covered++;
                if (cell.isCatchAllCoverage) {
                    stats.catchAllCovered++;
                }
            } else if (cellVisible) {
                // Only count as gap if it's visible but not covered
                stats.gaps++;
            }
            // If not visible, it's marked as "not applicable" in the UI but not counted as a gap
            // If not visible, it's "not applicable" - don't count it as a gap
            
            // Debug first few cells
            if (idx1 < 2 && idx2 < 2) {
                console.log(`   Cell [${idx1},${idx2}]: ${val1.label} × ${val2.label} - ${triggeredWorkflows.length} workflows`);
            }
        });
        
        // Always add row, even if it has no cells (shouldn't happen now)
        matrix.push(row);
        if (idx1 === 0) {
            console.log(`   First row has ${row.cells.length} cells, stats.total=${stats.total}`);
        }
    });
    
    console.log(`📊 Matrix summary: ${matrix.length} rows, ${stats.total} total cells, ${stats.covered} covered, ${stats.gaps} gaps`);
    
    if (stats.total === 0) {
        console.error('❌ ERROR: No cells were added to matrix!');
        console.error('   dim1Values:', dim1Values);
        console.error('   dim2Values:', dim2Values);
        console.error('   dim1.field:', dim1.field);
        console.error('   dim2.field:', dim2.field);
    }
    
    stats.coverage = stats.total > 0 ? ((stats.covered / stats.total) * 100).toFixed(1) : '0';

    console.log(`✅ Matrix built: ${stats.covered}/${stats.total} covered (${stats.coverage}%)`);

    return {
        matrix,
        dimensions: [
            {
                ...dim1,
                values: dim1Values,
                filteredCount: dim1Values.length,
                totalAvailableValues: dim1.values.length
            },
            {
                ...dim2,
                values: dim2Values,
                filteredCount: dim2Values.length,
                totalAvailableValues: dim2.values.length
            }
        ],
        stats
    };
}

// Check if a dimension combination is actually visible (not prevented by visibility rules)
// Returns true if visible, false if definitively not visible, or true if uncertain (optimistic)
function isCombinationVisible(dimensionFields, dimensionValues) {
    // Create a mock selection with the given dimension values
    const mockSelections = {};

    // Set the dimension values
    dimensionFields.forEach((field, idx) => {
        mockSelections[field] = dimensionValues[idx];
    });

    // Check if both dimension fields are visible with these selections
    for (let i = 0; i < dimensionFields.length; i++) {
        const fieldKey = dimensionFields[i];
        const field = allFields.find(f => f.key === fieldKey);
        
        // Special handling for system fields like requestTypes/subjectTypes
        // These are not in allFields but are always "visible" in the sense that they can be selected
        if (!field) {
            // Field doesn't exist in allFields - assume it's a system field and always visible
            continue;
        }

        // If field has no visibility rules, it's always visible
        if (!field.visibilityRules || !field.visibilityRules.rules || field.visibilityRules.rules.length === 0) {
            continue;
        }

        // Check if any visibility rule would show this field
        const rules = field.visibilityRules.rules;
        let isVisible = false;
        let hasEvaluableRules = false;

        for (let rule of rules) {
            // Check if this rule depends on fields we haven't set
            const ruleFields = extractFieldsFromRule(rule);
            const hasUnsetFields = ruleFields.some(f => !mockSelections.hasOwnProperty(f) && !currentSelections.hasOwnProperty(f));
            
            // If rule depends on unset fields, we can't evaluate it - default to visible (optimistic)
            if (hasUnsetFields) {
                continue; // Skip this rule, can't evaluate
            }
            
            hasEvaluableRules = true;
            
            // Temporarily set currentSelections for evaluateRule
            const originalSelections = Object.assign({}, currentSelections);
            Object.assign(currentSelections, mockSelections);

            const ruleResult = evaluateRule(rule);

            // Restore original selections
            Object.assign(currentSelections, originalSelections);

            if (ruleResult) {
                isVisible = true;
                break;
            }
        }

        // If we have evaluable rules and none passed, the field is not visible
        // If we have no evaluable rules (all depend on unset fields), default to visible (optimistic)
        if (hasEvaluableRules && !isVisible) {
            return false;
        }
    }

    return true; // Default to visible if uncertain
}

// Extract all field keys referenced in a visibility rule
function extractFieldsFromRule(rule) {
    const fields = new Set();
    const conditions = rule.ruleConditions || [];
    
    conditions.forEach(condition => {
        if (condition.selectedField) {
            fields.add(condition.selectedField);
        }
    });
    
    return Array.from(fields);
}

// Check if a specific request type is visible for a given "who" selection
// Returns true if visible, false if not visible, or null if uncertain
function isRequestTypeVisibleForWho(requestTypeValue, whoFieldKey, whoValue) {
    // Find the request type field in allFields
    // Request type field might be named "requestType", "requestTypes", or similar
    const requestTypeField = allFields.find(f => 
        f.key === 'requestType' || 
        f.key === 'requestTypes' ||
        f.key.toLowerCase().includes('requesttype')
    );
    
    if (!requestTypeField) {
        // Can't find request type field, assume visible (uncertain)
        return null;
    }
    
    // Check if the request type field has visibility rules that depend on the "who" field
    if (!requestTypeField.visibilityRules || !requestTypeField.visibilityRules.rules) {
        // No visibility rules, assume all request types are visible
        return null;
    }
    
    // Create mock selections with the "who" value
    const mockSelections = {};
    mockSelections[whoFieldKey] = whoValue;
    
    // Check if any visibility rule would show/hide the request type field
    const rules = requestTypeField.visibilityRules.rules;
    let fieldVisible = false;
    let hasEvaluableRules = false;
    let visibleOptions = null; // Track which options are visible if rule specifies them
    
    for (let rule of rules) {
        // Check if this rule depends on the "who" field
        const ruleFields = extractFieldsFromRule(rule);
        const dependsOnWho = ruleFields.includes(whoFieldKey);
        
        if (!dependsOnWho) {
            // Rule doesn't depend on "who" field, skip it
            continue;
        }
        
        hasEvaluableRules = true;
        
        // Temporarily set currentSelections for evaluateRule
        const originalSelections = Object.assign({}, currentSelections);
        Object.assign(currentSelections, mockSelections);
        
        const ruleResult = evaluateRule(rule);
        
        // Restore original selections
        Object.assign(currentSelections, originalSelections);
        
        if (ruleResult) {
            fieldVisible = true;
            // Check if this rule specifies which options should be shown
            const action = rule.actions?.[0];
            if (action && action.action === 'SHOW_QUESTION_WITH_CONFIGURED_OPTIONS' && action.selectedOptions) {
                // This rule specifies which options are visible
                visibleOptions = action.selectedOptions;
            }
            break;
        }
    }
    
    // If we have evaluable rules and none passed, the field is not visible
    // This means NO request types are visible for this "who" selection
    if (hasEvaluableRules && !fieldVisible) {
        return false; // Field is not visible, so no request types are available
    }
    
    // If a rule specifies which options are visible, check if this request type is in that list
    if (visibleOptions && visibleOptions.length > 0) {
        // Get request types from webform data to map GUIDs to fieldNames
        const requestTypes = webformData?.webFormDto?.requestTypes || [];
        const guidToFieldName = {};
        requestTypes.forEach(rt => {
            if (rt.id) guidToFieldName[rt.id] = rt.fieldName;
            if (rt.fieldName) guidToFieldName[rt.fieldName] = rt.fieldName; // Also map fieldName to itself
        });
        
        // Convert requestTypeValue to fieldName if it's a GUID
        const requestTypeFieldName = guidToFieldName[requestTypeValue] || requestTypeValue;
        
        // Check if the request type fieldName is in the visible options
        // visibleOptions might contain GUIDs or fieldNames
        const isVisible = visibleOptions.some(opt => {
            // Convert option to fieldName if it's a GUID
            const optFieldName = guidToFieldName[opt] || opt;
            // Match if the fieldNames match
            return optFieldName === requestTypeFieldName;
        });
        
        return isVisible;
    }
    
    // If field is visible but no specific options are specified, assume all request types are visible
    return hasEvaluableRules ? fieldVisible : null; // Return null if uncertain
}

// Build single dimension view (when workflows only use one criteria field)
function buildSingleDimensionView(dimension, criteriaMap) {
    console.log(`Building single dimension view for: ${dimension.label}`);

    const stats = { total: 0, covered: 0, gaps: 0 };
    const items = [];

    dimension.values.forEach(val => {
        // Check if this combination is actually visible (not blocked by visibility rules)
        const isVisible = isCombinationVisible([dimension.field], [val]);
        if (!isVisible) {
            // Skip combinations that visibility rules prevent
            return;
        }

        // Test if any workflow triggers for this value
        const triggeredWorkflows = workflowRules.filter(workflow => {
            if (!workflow.ruleCriteria) return false;
            return evaluateDimensionMatch(workflow, dimension.field, val);
        });

        const covered = triggeredWorkflows.length > 0;
        items.push({
            value: val,
            label: getOptionLabel(val) || val,
            covered: covered,
            workflowCount: triggeredWorkflows.length,
            workflows: triggeredWorkflows.map(w => w.ruleName)
        });

        stats.total++;
        if (covered) {
            stats.covered++;
        } else {
            stats.gaps++;
        }
    });

    stats.coverage = ((stats.covered / stats.total) * 100).toFixed(1);

    return {
        matrix: items,
        dimensions: [dimension],
        stats,
        isSingleDimension: true
    };
}

// Helper: Check if a workflow matches a dimension value
// If a workflow doesn't check a dimension, it's considered a match (workflow doesn't care about that dimension)
function evaluateDimensionMatch(workflow, dimensionField, dimensionValue) {
    const criterion = workflow.ruleCriteria?.find(c => c.field === dimensionField);
    if (!criterion) {
        // This workflow doesn't check this dimension at all
        // For loose/catch-all workflows, this means they match ANY value for this dimension
        return true; // Workflow doesn't care about this dimension, so it matches
    }
    
    return criterion.values.includes(dimensionValue);
}

// Generate Smart Coverage Diagram
function generateSmartCoverageDiagram() {
    console.log('� Generating smart coverage diagram...');

    const analysis = analyzeWorkflowCoverage();
    if (!analysis) {
        alert('⚠️ Could not generate coverage analysis. Make sure workflows are loaded.');
        return;
    }

    const diagramHTML = buildWorkflowCoverageHTML(analysis);

    // Open in new window
    const newWindow = window.open('', 'WorkflowCoverage', 'width=1400,height=900');
    newWindow.document.write(diagramHTML);
    newWindow.document.close();
}

// NEW: Workflow-based coverage analysis (no visibility checks)
function analyzeWorkflowCoverage() {
    if (!workflowRules || workflowRules.length === 0) {
        console.warn('⚠️ No workflow rules found');
        return null;
    }

    console.log(`📋 Analyzing ${workflowRules.length} workflow rules...`);

    // Step 1: Analyze what criteria fields are used
    const criteriaFields = new Map(); // field -> { workflows: [], values: Set }
    
    workflowRules.forEach(workflow => {
        if (!workflow.ruleCriteria || workflow.ruleCriteria.length === 0) {
            console.log(`   ⚠️ Workflow "${workflow.ruleName}" has no criteria`);
            return;
        }

        workflow.ruleCriteria.forEach(criterion => {
            const field = criterion.field;
            if (!criteriaFields.has(field)) {
                criteriaFields.set(field, {
                    field: field,
                    label: getFieldLabel(field) || field,
                    workflows: [],
                    values: new Set(),
                    workflowDetails: []
                });
            }
            
            const fieldData = criteriaFields.get(field);
            fieldData.workflows.push(workflow.ruleName);
            criterion.values.forEach(v => fieldData.values.add(v));
            fieldData.workflowDetails.push({
                workflowName: workflow.ruleName,
                values: criterion.values,
                isLoose: workflow.ruleCriteria.length === 1
            });
        });
    });

    // Step 2: Rank fields by importance (number of workflows using them)
    const rankedFields = Array.from(criteriaFields.values())
        .sort((a, b) => b.workflows.length - a.workflows.length);

    console.log(`   Found ${rankedFields.length} criteria fields:`);
    rankedFields.forEach((f, idx) => {
        console.log(`   ${idx + 1}. ${f.label} (${f.workflows.length} workflows, ${f.values.size} values)`);
    });

    // Step 3: For each workflow, show what it covers
    const workflowCoverage = workflowRules.map(workflow => {
        const criteria = workflow.ruleCriteria || [];
        const isLoose = criteria.length === 1;
        const isSpecific = criteria.length > 1;
        
        // Build a description of what this workflow covers
        const coverageDescription = criteria.map(c => {
            const fieldLabel = getFieldLabel(c.field) || c.field;
            const valueLabels = c.values.map(v => getOptionLabel(v) || v).join(', ');
            return `${fieldLabel}: ${valueLabels}`;
        }).join(' AND ');

        // Check if any criteria were decrypted from hashes
        const hasDecryptedCriteria = criteria.some(c => c.decrypted === true);
        const decryptedFields = criteria.filter(c => c.decrypted === true).map(c => c.field);

        return {
            name: workflow.ruleName,
            criteria: criteria,
            coverageDescription: coverageDescription,
            isLoose: isLoose,
            isSpecific: isSpecific,
            criteriaCount: criteria.length,
            hasDecryptedCriteria: hasDecryptedCriteria,
            decryptedFields: decryptedFields
        };
    });

    // Step 4: Identify potential gaps (if we have 2+ dimensions)
    let gaps = [];
    if (rankedFields.length >= 2) {
        const topField = rankedFields[0];
        const secondField = rankedFields[1];
        
        // Get all combinations from the top 2 fields
        const allCombinations = [];
        topField.values.forEach(v1 => {
            secondField.values.forEach(v2 => {
                allCombinations.push({
                    [topField.field]: v1,
                    [secondField.field]: v2
                });
            });
        });

        // Check which combinations have no workflow
        allCombinations.forEach(combo => {
            const hasWorkflow = workflowRules.some(workflow => {
                if (!workflow.ruleCriteria) return false;
                
                // Check if workflow matches this combination
                const matchesTop = !workflow.ruleCriteria.some(c => c.field === topField.field) ||
                    workflow.ruleCriteria.find(c => c.field === topField.field)?.values.includes(combo[topField.field]);
                const matchesSecond = !workflow.ruleCriteria.some(c => c.field === secondField.field) ||
                    workflow.ruleCriteria.find(c => c.field === secondField.field)?.values.includes(combo[secondField.field]);
                
                return matchesTop && matchesSecond;
            });

            if (!hasWorkflow) {
                const v1Label = getOptionLabel(combo[topField.field]) || combo[topField.field];
                const v2Label = getOptionLabel(combo[secondField.field]) || combo[secondField.field];
                gaps.push({
                    [topField.field]: combo[topField.field],
                    [topField.field + 'Label']: v1Label,
                    [secondField.field]: combo[secondField.field],
                    [secondField.field + 'Label']: v2Label
                });
            }
        });
    }

    return {
        totalWorkflows: workflowRules.length,
        criteriaFields: rankedFields,
        workflowCoverage: workflowCoverage,
        gaps: gaps,
        templateName: webformData?.webFormDto?.templateName || 'DSAR Form',
        timestamp: new Date().toLocaleString()
    };
}

// Build HTML for workflow coverage analysis
function buildWorkflowCoverageHTML(analysis) {
    const { totalWorkflows, criteriaFields, workflowCoverage, gaps, templateName, timestamp } = analysis;

    // Build workflow list HTML
    let workflowsHTML = '';
    workflowCoverage.forEach((wf, idx) => {
        const typeBadge = wf.isLoose 
            ? '<span style="background: #3498db; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px;">LOOSE</span>'
            : '<span style="background: #27ae60; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px;">SPECIFIC</span>';
        
        const criteriaHTML = wf.criteria.map(c => {
            const fieldLabel = getFieldLabel(c.field) || c.field;
            const valueLabels = c.values.map(v => getOptionLabel(v) || v).join(', ');
            // Show HASHED badge if the field was originally hashed (either decrypted or still hashed)
            const wasHashed = c.isHashed === true || c.decrypted === true;
            const hashBadge = wasHashed 
                ? `<span style="background: #e67e22; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.7rem; margin-left: 6px;" title="${c.decrypted ? 'This field was originally hashed (SHA-512) and has been decrypted' : 'This field contains hashed values (SHA-512) that could not be decrypted'}">🔐 HASHED</span>`
                : '';
            return `<div style="margin-left: 1.5rem; margin-top: 0.5rem; color: #555;">
                <strong>${fieldLabel}:</strong> ${valueLabels} ${hashBadge}
            </div>`;
        }).join('');

        workflowsHTML += `
            <div style="background: white; padding: 1.5rem; border-radius: 8px; border-left: 4px solid ${wf.isLoose ? '#3498db' : '#27ae60'}; margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                    <strong style="font-size: 1.1rem;">${wf.name}</strong>
                    ${typeBadge}
                </div>
                <div style="color: #7f8c8d; font-size: 0.9rem; margin-top: 0.5rem;">
                    <strong>Coverage:</strong> ${wf.coverageDescription}
                </div>
                ${criteriaHTML}
            </div>
        `;
    });

    // Build gaps HTML
    let gapsHTML = '';
    if (gaps.length > 0) {
        const field1 = criteriaFields[0];
        const field2 = criteriaFields[1];
        gapsHTML = gaps.map(gap => {
            return `
                <div style="background: #fadbd8; padding: 1rem; border-radius: 6px; border-left: 4px solid #e74c3c; margin-bottom: 0.5rem;">
                    <strong>${gap[field1.field + 'Label']}</strong> × <strong>${gap[field2.field + 'Label']}</strong>
                    <div style="color: #c0392b; font-size: 0.85rem; margin-top: 0.25rem;">No workflow configured</div>
                </div>
            `;
        }).join('');
    } else {
        gapsHTML = '<div style="color: #27ae60; font-style: italic;">✅ All combinations appear to be covered</div>';
    }

    // Build criteria fields summary
    let fieldsHTML = '';
    criteriaFields.forEach((field, idx) => {
        const valuesList = Array.from(field.values).map(v => getOptionLabel(v) || v).join(', ');
        fieldsHTML += `
            <div style="background: white; padding: 1rem; border-radius: 6px; border-left: 4px solid #FFD700; margin-bottom: 1rem;">
                <strong>${idx + 1}. ${field.label}</strong>
                <div style="color: #7f8c8d; font-size: 0.85rem; margin-top: 0.5rem;">
                    Used by ${field.workflows.length} workflow(s) | ${field.values.size} value(s)
                </div>
                <div style="color: #555; font-size: 0.85rem; margin-top: 0.5rem;">
                    Values: ${valuesList}
                </div>
            </div>
        `;
    });

    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Workflow Coverage Analysis - ${templateName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: "Segoe UI", Tahoma, Geneva, sans-serif; background: #f5f7fa; padding: 2rem; color: #2c3e50; line-height: 1.6; }
        .container { max-width: 1400px; margin: 0 auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { margin-bottom: 2rem; border-bottom: 3px solid #FFD700; padding-bottom: 1rem; }
        .header h1 { font-size: 2rem; color: #2c3e50; margin-bottom: 0.5rem; }
        .header p { color: #7f8c8d; font-size: 0.9rem; }
        .section { margin-bottom: 3rem; }
        .section-title { font-size: 1.5rem; color: #2c3e50; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #ecf0f1; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: #f8f9fa; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #FFD700; }
        .stat-label { color: #7f8c8d; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; }
        .stat-value { font-size: 2rem; font-weight: bold; color: #2c3e50; margin-top: 0.5rem; }
        .print-button { background: #FFD700; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-size: 1rem; margin-bottom: 1rem; }
        @media print { body { background: white; } .print-button { display: none; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Workflow Coverage Analysis</h1>
            <p><strong>Form:</strong> ${templateName}</p>
            <p><strong>Generated:</strong> ${timestamp}</p>
            <p style="color: #27ae60; margin-top: 0.5rem;">✅ Analysis based on workflow rules only (no visibility checks)</p>
        </div>
        
        <button class="print-button" onclick="window.print()">🖨️ Print / Save as PDF</button>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-label">Total Workflows</div>
                <div class="stat-value">${totalWorkflows}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Criteria Fields</div>
                <div class="stat-value">${criteriaFields.length}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Potential Gaps</div>
                <div class="stat-value" style="color: ${gaps.length > 0 ? '#e74c3c' : '#27ae60'};">${gaps.length}</div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">📋 Criteria Fields Used</h2>
            ${fieldsHTML}
        </div>

        <div class="section">
            <h2 class="section-title">🔧 Workflow Coverage</h2>
            ${workflowsHTML}
        </div>

        <div class="section">
            <h2 class="section-title">⚠️ Potential Gaps</h2>
            <p style="color: #7f8c8d; margin-bottom: 1rem;">
                Combinations that may not have a workflow (based on top 2 criteria fields):
            </p>
            ${gapsHTML}
        </div>
    </div>
</body>
</html>`;

    return html;
}

// Build HTML for single dimension view
function buildSingleDimensionDiagramHTML(coverageData) {
    const { matrix, dimensions, stats } = coverageData;
    const [dimension] = dimensions;
    const timestamp = new Date().toLocaleString();
    const templateName = webformData.webFormDto?.templateName || 'DSAR Form';

    // Build the item cards
    let itemsHtml = '';
    matrix.forEach((item, idx) => {
        const itemClass = item.covered ? 'item-covered' : 'item-gap';
        const status = item.covered ? '[Covered]' : '[Gap]';
        const dropdownId = 'dropdown-item-' + idx;

        let workflowsHtml = '<div class="workflow-dropdown" id="' + dropdownId + '" style="display:none; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.1);">';
        if (item.workflows.length > 0) {
            item.workflows.forEach(wf => {
                workflowsHtml += '<div style="font-size: 0.85rem; padding: 4px 0; color: #2c3e50;">• ' + wf + '</div>';
            });
        } else {
            workflowsHtml += '<div style="color: #e74c3c; font-style: italic;">No workflows configured</div>';
        }
        workflowsHtml += '</div>';

        itemsHtml += '<div class="item-card ' + itemClass + '" onclick="toggleWorkflows(\'' + dropdownId + '\')" style="cursor: pointer;">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">' +
            '<strong style="font-size: 1.1rem;">' + item.label + '</strong>' +
            '<span style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">' + item.workflowCount + ' workflow' + (item.workflowCount !== 1 ? 's' : '') + '</span>' +
            '</div>' +
            workflowsHtml +
            '</div>';
    });

    const html = '<!DOCTYPE html><html><head><title>Smart Coverage Analysis - ' + templateName + '</title><style>' +
        '* { margin: 0; padding: 0; box-sizing: border-box; }' +
        'body { font-family: "Segoe UI", Tahoma, Geneva, sans-serif; background: #f5f7fa; padding: 2rem; color: #2c3e50; }' +
        '.container { max-width: 1000px; margin: 0 auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }' +
        '.header { margin-bottom: 2rem; border-bottom: 3px solid #FFD700; padding-bottom: 1rem; }' +
        '.header h1 { font-size: 2rem; color: #2c3e50; margin-bottom: 0.5rem; }' +
        '.header p { color: #7f8c8d; font-size: 0.9rem; }' +
        '.method-tag { background: #FFD700; color: white; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.8rem; margin-left: 1rem; }' +
        '.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }' +
        '.stat-card { background: #f8f9fa; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #FFD700; }' +
        '.stat-label { color: #7f8c8d; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; }' +
        '.stat-value { font-size: 2rem; font-weight: bold; color: #2c3e50; margin-top: 0.5rem; }' +
        '.dimension-info { background: #ecf0f1; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; }' +
        '.dimension-title { font-weight: 600; color: #2c3e50; margin-bottom: 0.5rem; }' +
        '.items-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }' +
        '.item-card { padding: 1.5rem; border-radius: 8px; border-left: 4px solid #FFD700; transition: all 0.2s; }' +
        '.item-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.1); }' +
        '.item-covered { background: #d5f4e6; border-left-color: #27ae60; }' +
        '.item-gap { background: #fadbd8; border-left-color: #e74c3c; }' +
        '.print-button { background: #FFD700; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-size: 1rem; margin-bottom: 1rem; }' +
        '@media print { body { background: white; } .print-button { display: none; } }' +
        '</style></head><body><div class="container">' +
        '<div class="header">' +
        '<h1>Smart Coverage Analysis <span class="method-tag">Single Dimension</span></h1>' +
        '<p><strong>Form:</strong> ' + templateName + '</p>' +
        '<p><strong>Generated:</strong> ' + timestamp + '</p>' +
        '<p><strong>Analysis:</strong> Workflows use a single decision criterion: <strong>' + (dimension.label || dimension.field) + '</strong></p>' +
        '</div>' +
        '<button class="print-button" onclick="window.print()">🖨️ Print / Save as PDF</button>' +
        '<div class="stats">' +
        '<div class="stat-card"><div class="stat-label">Total Values</div><div class="stat-value">' + stats.total + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Covered</div><div class="stat-value" style="color: #27ae60;">' + stats.covered + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Gaps</div><div class="stat-value" style="color: #e74c3c;">' + stats.gaps + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Coverage</div><div class="stat-value" style="color: #2c3e50;">' + stats.coverage + '%</div></div>' +
        '</div>' +
        '<div class="dimension-info">' +
        '<div class="dimension-title">Decision Criterion</div>' +
        '<p style="font-size: 0.9rem; color: #7f8c8d;">' + (dimension.label || dimension.field) + ' - Used by ' + dimension.workflows.length + ' workflow' + (dimension.workflows.length !== 1 ? 's' : '') + '</p>' +
        '</div>' +
        '<div class="items-container">' + itemsHtml + '</div>' +
        '<div style="padding: 1.5rem; background: #f8f9fa; border-left: 4px solid #FFD700; border-radius: 8px;">' +
        '<h3 style="color: #2c3e50; margin-bottom: 1rem;">What This Shows</h3>' +
        '<ul style="margin-left: 1.5rem; line-height: 1.8; color: #555;">' +
        '<li><strong>Green cards (✅):</strong> Workflow exists for this value</li>' +
        '<li><strong>Red cards (❌):</strong> Gap - no workflow for this value</li>' +
        '<li><strong>Click a card</strong> to see all assigned workflows</li>' +
        '</ul></div>' +
        '</div>' +
        '<script>' +
        'function toggleWorkflows(dropdownId) {' +
        '  const dropdown = document.getElementById(dropdownId);' +
        '  if (dropdown.style.display === "none") {' +
        '    dropdown.style.display = "block";' +
        '  } else {' +
        '    dropdown.style.display = "none";' +
        '  }' +
        '}' +
        '</script>' +
        '</body></html>';

    return html;
}

// Build the HTML for smart diagram
function buildSmartDiagramHTML(coverageData) {
    const { matrix, dimensions, stats } = coverageData;
    const [dim1, dim2] = dimensions;
    const timestamp = new Date().toLocaleString();
    const templateName = webformData.webFormDto?.templateName || 'DSAR Form';

    // Build header columns with catch-all indicators
    const headerCols = dim2.values.map(val => {
        let badge = '';
        if (val.isCatchAll) {
            badge = '<span style="background: #3498db; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.7rem; margin-left: 4px;" title="Catch-all rule - covers all cases">CATCH-ALL</span>';
        } else if (val.looseWorkflowCount > 0) {
            badge = '<span style="background: #9b59b6; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.7rem; margin-left: 4px;" title="Has catch-all coverage">LOOSE</span>';
        }
        return '<th>' + val.label + ' <small style="color: #7f8c8d;">(' + val.workflowCount + ')</small>' + badge + '</th>';
    }).join('');

    // Build table rows with expandable workflow details
    let cellId = 0;
    const tableRows = matrix.map(row => {
        const cells = row.cells.map(cell => {
            // Determine cell class: covered, gap, catch-all, or not applicable
            let cellClass;
            if (cell.isVisible === false) {
                cellClass = 'cell-not-applicable'; // Field combination not visible
            } else if (cell.covered) {
                cellClass = cell.isCatchAllCoverage ? 'cell-catchall' : 'cell-covered';
            } else {
                cellClass = 'cell-gap';
            }
            const cellIdStr = 'cell-' + (cellId++);
            const dropdownId = 'dropdown-' + cellIdStr;

            // Build workflow list for dropdown
            let workflowsHtml = '';
            if (cell.workflows.length > 0) {
                workflowsHtml = '<div class="workflow-dropdown" id="' + dropdownId + '" style="display:none; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.1);">';
                if (cell.looseWorkflows.length > 0) {
                    workflowsHtml += '<div style="font-size: 0.7rem; color: #3498db; font-weight: bold; margin-bottom: 4px;">Catch-All Workflows:</div>';
                    cell.looseWorkflows.forEach(wf => {
                        workflowsHtml += '<div style="font-size: 0.75rem; padding: 2px 0; color: #2c3e50; padding-left: 12px;">• ' + wf + '</div>';
                    });
                }
                if (cell.specificWorkflows.length > 0) {
                    if (cell.looseWorkflows.length > 0) {
                        workflowsHtml += '<div style="font-size: 0.7rem; color: #7f8c8d; font-weight: bold; margin-top: 8px; margin-bottom: 4px;">Specific Workflows:</div>';
                    }
                    cell.specificWorkflows.forEach(wf => {
                        workflowsHtml += '<div style="font-size: 0.75rem; padding: 2px 0; color: #2c3e50; padding-left: 12px;">• ' + wf + '</div>';
                    });
                }
                workflowsHtml += '</div>';
            } else {
                workflowsHtml = '<div class="workflow-dropdown" id="' + dropdownId + '" style="display:none; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.1); color: #e74c3c; font-style: italic;">No workflows configured</div>';
            }

            // Make clickable if there are workflows or it's a gap
            const clickableAttr = ' onclick="toggleWorkflows(\'' + dropdownId + '\')" style="cursor: pointer;"';
            let summary = '';
            if (!cell.isVisible) {
                summary = '<strong style="color: #95a5a6;">N/A</strong><br><small>Not visible</small>';
            } else if (cell.covered) {
                if (cell.isCatchAllCoverage) {
                    summary = '<strong style="color: #3498db;">Catch-All</strong><br><small>Loose rule</small>';
                } else {
                    summary = '<strong>' + cell.workflowCount + '</strong><br><small>' + (cell.workflowCount === 1 ? 'workflow' : 'workflows') + '</small>';
                }
                if (cell.workflows.length > 1) {
                    summary += '<br><small style="color: #2c3e50; font-weight: 500;">Click to expand</small>';
                }
            } else {
                summary = '<strong>Gap</strong>';
            }

            return '<td id="' + cellIdStr + '" class="' + cellClass + '"' + clickableAttr + '>' + summary + workflowsHtml + '</td>';
        }).join('');
        let rowHeader = row.label;
        if (row.isCatchAll) {
            rowHeader += ' <span style="background: #3498db; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.7rem; margin-left: 4px;">CATCH-ALL</span>';
        }
        rowHeader += ' <small style="color: #7f8c8d;">(' + row.workflowCount + ')</small>';
        return '<tr><td class="row-header">' + rowHeader + '</td>' + cells + '</tr>';
    }).join('');

    const html = '<!DOCTYPE html><html><head><title>Smart Coverage Analysis - ' + templateName + '</title><style>' +
        '* { margin: 0; padding: 0; box-sizing: border-box; }' +
        'body { font-family: "Segoe UI", Tahoma, Geneva, sans-serif; background: #f5f7fa; padding: 2rem; color: #2c3e50; }' +
        '.container { max-width: 1400px; margin: 0 auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }' +
        '.header { margin-bottom: 2rem; border-bottom: 3px solid #FFD700; padding-bottom: 1rem; }' +
        '.header h1 { font-size: 2rem; color: #2c3e50; margin-bottom: 0.5rem; }' +
        '.header p { color: #7f8c8d; font-size: 0.9rem; }' +
        '.method-tag { background: #FFD700; color: white; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.8rem; margin-left: 1rem; }' +
        '.matrix-wrapper { overflow-x: auto; margin-bottom: 2rem; }' +
        'table { width: 100%; border-collapse: collapse; background: white; }' +
        'th, td { padding: 0.8rem; text-align: center; border: 2px solid #ecf0f1; font-size: 0.9rem; }' +
        'th { background: #34495e; color: white; font-weight: 600; }' +
        '.row-header { text-align: left; font-weight: 600; background: #f8f9fa; color: #2c3e50; }' +
        '.cell-covered { background: #d5f4e6; border-left: 4px solid #27ae60; }' +
        '.cell-catchall { background: #d6eaf8; border-left: 4px solid #3498db; }' +
        '.cell-gap { background: #fadbd8; border-left: 4px solid #e74c3c; }' +
        '.cell-not-applicable { background: #f5f5f5; border-left: 4px solid #95a5a6; opacity: 0.6; }' +
        '.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }' +
        '.stat-card { background: #f8f9fa; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #FFD700; }' +
        '.stat-label { color: #7f8c8d; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; }' +
        '.stat-value { font-size: 2rem; font-weight: bold; color: #2c3e50; margin-top: 0.5rem; }' +
        '.dimension-info { background: #ecf0f1; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; }' +
        '.dimension-title { font-weight: 600; color: #2c3e50; margin-bottom: 0.5rem; }' +
        '.dimension-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; }' +
        '.dimension-item { background: white; padding: 0.8rem; border-radius: 6px; border-left: 3px solid #FFD700; font-size: 0.9rem; }' +
        '.print-button { background: #FFD700; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-size: 1rem; margin-bottom: 1rem; }' +
        '@media print { body { background: white; } .print-button { display: none; } }' +
        '</style></head><body><div class="container">' +
        '<div class="header">' +
        '<h1>Smart Coverage Analysis <span class="method-tag">Workflow-Driven</span></h1>' +
        '<p><strong>Form:</strong> ' + templateName + '</p>' +
        '<p><strong>Generated:</strong> ' + timestamp + '</p>' +
        '<p><strong>Analysis Method:</strong> Analyzed workflow rules to identify primary decision dimensions</p>' +
        '</div>' +
        '<button class="print-button" onclick="window.print()">Print / Save as PDF</button>' +
        '<div class="stats">' +
        '<div class="stat-card"><div class="stat-label">Total Combinations</div><div class="stat-value">' + stats.total + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Covered</div><div class="stat-value" style="color: #27ae60;">' + stats.covered + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Gaps</div><div class="stat-value" style="color: #e74c3c;">' + stats.gaps + '</div></div>' +
        '<div class="stat-card"><div class="stat-label">Coverage</div><div class="stat-value" style="color: #2c3e50;">' + stats.coverage + '%</div></div>' +
        '</div>' +
        '<div class="dimension-info">' +
        '<div class="dimension-title">Analysis Dimensions (derived from workflow rules)</div>' +
        '<p style="font-size: 0.9rem; color: #7f8c8d; margin-bottom: 1rem;">These dimensions were automatically identified as the most important for workflow routing:</p>' +
        '<div class="dimension-list">' +
        '<div class="dimension-item"><strong>Primary:</strong> ' + (dim1.label || dim1.field) + '<br><small>' + dim1.workflows.length + ' workflows use this</small></div>' +
        '<div class="dimension-item"><strong>Secondary:</strong> ' + (dim2.label || dim2.field) + '<br><small>' + dim2.workflows.length + ' workflows use this</small></div>' +
        '</div></div>' +
        '<div class="matrix-wrapper">' +
        '<table><thead><tr><th style="text-align: left;">' + (dim1.label || dim1.field) + ' / ' + (dim2.label || dim2.field) + ' →</th>' + headerCols + '</tr></thead>' +
        '<tbody>' + tableRows + '</tbody></table></div>' +
        '<div style="margin-top: 3rem; padding: 1.5rem; background: #f8f9fa; border-left: 4px solid #FFD700; border-radius: 8px;">' +
        '<h3 style="color: #2c3e50; margin-bottom: 1rem;">What This Shows</h3>' +
        '<ul style="margin-left: 1.5rem; line-height: 1.8; color: #555;">' +
        '<li><strong>Green cells (✅):</strong> Workflow exists to handle this combination</li>' +
        '<li><strong>Blue cells (🔵):</strong> Catch-all rule - loose workflow that doesn\'t check all dimensions</li>' +
        '<li><strong>Red cells (❌):</strong> Gap - no workflow configured for this combination</li>' +
        '<li><strong>Gray cells (⚪):</strong> Not Applicable - field combination not visible (visibility rules prevent it)</li>' +
        '<li><strong>Dimensions:</strong> Automatically selected from workflow criteria (most frequently used)</li>' +
        '</ul></div>' +
        '</div>' +
        '<script>' +
        'function toggleWorkflows(dropdownId) {' +
        '  const dropdown = document.getElementById(dropdownId);' +
        '  if (dropdown.style.display === "none") {' +
        '    dropdown.style.display = "block";' +
        '  } else {' +
        '    dropdown.style.display = "none";' +
        '  }' +
        '}' +
        '</script>' +
        '</body></html>';

    return html;
}

// Coverage Matrix Diagram: Visual representation for customer discussion
function generateCoverageMatrix() {
    console.log('� Generating coverage matrix diagram...');

    // Extract subject types and request types
    const subjectTypes = (webformData.webFormDto?.subjectTypes || [])
        .filter(st => st.isSelected !== false && st.status !== 20);

    const requestTypes = (webformData.webFormDto?.requestTypes || [])
        .filter(rt => rt.isSelected !== false && rt.status !== 20);

    if (subjectTypes.length === 0 || requestTypes.length === 0) {
        alert('⚠️ Cannot generate diagram:\nForm needs subject types and request types configured.');
        return;
    }

    // Find subject type and request type fields in allFields
    const subjectTypeField = allFields.find(f =>
        f.key === 'subjectType' || f.key.toLowerCase().includes('subjecttype')
    );
    const requestTypeField = allFields.find(f =>
        f.key === 'requestType' || f.key.toLowerCase().includes('requesttype')
    );

    if (!subjectTypeField || !requestTypeField) {
        alert('⚠️ Cannot generate diagram:\nCould not find subject type or request type fields.');
        return;
    }

    // Build coverage matrix
    const matrix = [];
    for (const subject of subjectTypes) {
        const row = { subject: subject.fieldName };
        for (const request of requestTypes) {
            // Simulate selection
            const savedSelections = { ...currentSelections };
            currentSelections[subjectTypeField.key] = subject.fieldName;
            currentSelections[requestTypeField.key] = request.fieldName;

            // Check which workflows trigger
            const triggeredWorkflows = workflowRules.filter(wf =>
                evaluateWorkflowRule(wf).triggered
            );

            // Restore selections
            currentSelections = savedSelections;

            row[request.fieldName] = {
                triggered: triggeredWorkflows.length > 0,
                workflowCount: triggeredWorkflows.length,
                workflows: triggeredWorkflows.map(w => w.ruleName)
            };
        }
        matrix.push(row);
    }

    // Generate HTML diagram
    const diagramHTML = buildCoverageDiagram(matrix, subjectTypes, requestTypes);

    // Open in new window
    const newWindow = window.open('', 'CoverageMatrix', 'width=1200,height=800');
    newWindow.document.write(diagramHTML);
    newWindow.document.close();
}

function buildCoverageDiagram(matrix, subjectTypes, requestTypes) {
    const timestamp = new Date().toLocaleString();
    const templateName = webformData.webFormDto?.templateName || 'DSAR Form';

    const html = `<!DOCTYPE html>
<html><head><title>Coverage Matrix - ${templateName}</title><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fa; padding: 2rem; color: #2c3e50; }
.container { max-width: 1400px; margin: 0 auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.header { margin-bottom: 2rem; border-bottom: 3px solid #3498db; padding-bottom: 1rem; }
.header h1 { font-size: 2rem; color: #2c3e50; margin-bottom: 0.5rem; }
.header p { color: #7f8c8d; font-size: 0.9rem; }
.matrix-wrapper { overflow-x: auto; margin-bottom: 2rem; }
table { width: 100%; border-collapse: collapse; background: white; }
th, td { padding: 1rem; text-align: center; border: 2px solid #ecf0f1; }
th { background: #34495e; color: white; font-weight: 600; }
.row-header { text-align: left; font-weight: 600; background: #f8f9fa; color: #2c3e50; }
.cell-covered { background: #d5f4e6; border-left: 4px solid #27ae60; }
.cell-covered::before { content: '✅ '; font-weight: bold; }
.cell-gap { background: #fadbd8; border-left: 4px solid #e74c3c; }
.cell-gap::before { content: '❌ '; font-weight: bold; }
.cell-content { font-size: 0.85rem; line-height: 1.4; }
.workflow-list { font-size: 0.75rem; color: #555; margin-top: 0.5rem; font-style: italic; }
.legend { margin: 2rem 0; padding: 1.5rem; background: #ecf0f1; border-radius: 8px; }
.legend-item { display: inline-block; margin-right: 2rem; margin-bottom: 0.5rem; }
.legend-box { display: inline-block; width: 20px; height: 20px; margin-right: 0.5rem; border-radius: 4px; vertical-align: middle; }
.legend-covered { background: #d5f4e6; border: 2px solid #27ae60; }
.legend-gap { background: #fadbd8; border: 2px solid #e74c3c; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
.stat-card { background: #f8f9fa; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #3498db; }
.stat-label { color: #7f8c8d; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; }
.stat-value { font-size: 2rem; font-weight: bold; color: #2c3e50; margin-top: 0.5rem; }
.print-button { background: #3498db; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-size: 1rem; margin-bottom: 1rem; }
@media print { body { background: white; } .print-button { display: none; } }
</style></head><body><div class="container"><div class="header"><h1>📊 Coverage Matrix Diagram</h1><p><strong>Form:</strong> ${templateName}</p><p><strong>Generated:</strong> ${timestamp}</p></div><button class="print-button" onclick="window.print()">🖨️ Print / Save as PDF</button><div class="stats"><div class="stat-card"><div class="stat-label">Subject Types</div><div class="stat-value">${subjectTypes.length}</div></div><div class="stat-card"><div class="stat-label">Request Types</div><div class="stat-value">${requestTypes.length}</div></div><div class="stat-card"><div class="stat-label">Total Combinations</div><div class="stat-value">${subjectTypes.length * requestTypes.length}</div></div><div class="stat-card"><div class="stat-label">Covered</div><div class="stat-value" style="color: #27ae60;">${calculateCovered(matrix)}</div></div><div class="stat-card"><div class="stat-label">Gaps</div><div class="stat-value" style="color: #e74c3c;">${calculateGaps(matrix)}</div></div></div><div class="legend"><h3>Legend</h3><div class="legend-item"><span class="legend-box legend-covered"></span><span>Covered - Workflow exists</span></div><div class="legend-item"><span class="legend-box legend-gap"></span><span>Gap - No workflow</span></div></div><div class="matrix-wrapper"><table><thead><tr><th style="text-align: left;">WHO / WHAT →</th>${requestTypes.map(rt => `<th>${getOptionLabel(rt.fieldName) || rt.fieldName}</th>`).join('')}</tr></thead><tbody>${matrix.map(row => `<tr><td class="row-header">${getOptionLabel(row.subject) || row.subject}</td>${requestTypes.map(rt => `<td class="${row[rt.fieldName].triggered ? 'cell-covered' : 'cell-gap'}"><div class="cell-content">${row[rt.fieldName].workflowCount} workflow${row[rt.fieldName].workflowCount !== 1 ? 's' : ''}</div></td>`).join('')}</tr>`).join('')}</tbody></table></div></div></body></html>`;

    return html;
}

function calculateCovered(matrix) {
    let count = 0;
    matrix.forEach(row => {
        Object.keys(row).forEach(key => {
            if (key !== 'subject' && row[key].triggered) count++;
        });
    });
    return count;
}

function calculateGaps(matrix) {
    let count = 0;
    matrix.forEach(row => {
        Object.keys(row).forEach(key => {
            if (key !== 'subject' && !row[key].triggered) count++;
        });
    });
    return count;
}

// Gap Detection System: Finds combinations of WHO+WHAT that don't trigger workflows
function detectWorkflowGaps() {
    console.log('� Gap Detection starting...');
    console.log('webformData:', !!webformData);
    console.log('allFields:', allFields.length, 'fields loaded');
    console.log('workflowRules:', workflowRules.length, 'workflows loaded');

    // Extract request types and subject types (WHO + WHAT)
    const requestTypes = (webformData.webFormDto?.requestTypes || [])
        .filter(rt => rt.isSelected !== false && rt.status !== 20); // Only active ones

    const subjectTypes = (webformData.webFormDto?.subjectTypes || [])
        .filter(st => st.isSelected !== false && st.status !== 20); // Only active ones

    console.log('Found', requestTypes.length, 'request types:', requestTypes.map(rt => rt.fieldName));
    console.log('Found', subjectTypes.length, 'subject types:', subjectTypes.map(st => st.fieldName));

    // Find the field keys for requestType and subjectType in allFields
    const requestTypeField = allFields.find(f =>
        f.key === 'requestType' || f.key.toLowerCase().includes('requesttype')
    );
    const subjectTypeField = allFields.find(f =>
        f.key === 'subjectType' || f.key.toLowerCase().includes('subjecttype')
    );

    if (!requestTypeField || !subjectTypeField) {
        console.warn('Gap detection: Could not find requestType or subjectType fields');
        console.log('Available fields:', allFields.map(f => f.key).join(', '));
        console.log('Subject types:', subjectTypes.map(st => st.fieldName).join(', '));
        console.log('Request types:', requestTypes.map(rt => rt.fieldName).join(', '));
        alert(`⚠️ Gap detection error:\n\nCould not find subject type or request type fields.\n\nAvailable fields: ${allFields.map(f => f.key).slice(0, 10).join(', ')}...`);
        return {
            gaps: [],
            total: 0,
            message: 'Gap detection: Missing request or subject type fields'
        };
    }

    // Build all possible WHO+WHAT combinations
    const combinations = [];
    for (const subjectType of subjectTypes) {
        for (const requestType of requestTypes) {
            combinations.push({
                subjectType: subjectType.fieldName,
                subjectTypeLabel: getOptionLabel(subjectType.fieldName) || subjectType.fieldName,
                requestType: requestType.fieldName,
                requestTypeLabel: getOptionLabel(requestType.fieldName) || requestType.fieldName
            });
        }
    }

    console.log(`🔍 Gap Detection: Testing ${combinations.length} WHO+WHAT combinations...`);

    // Test each combination to find gaps
    const gaps = [];
    const coverage = {};

    combinations.forEach(combo => {
        // Simulate selections for this combination
        const testSelections = {
            [subjectTypeField.key]: combo.subjectType,
            [requestTypeField.key]: combo.requestType
        };

        // Find workflows that trigger for this combination
        const triggeredWorkflows = workflowRules.filter(workflow => {
            // Temporarily set selections
            const savedSelections = { ...currentSelections };
            Object.assign(currentSelections, testSelections);

            // Evaluate workflow
            const result = evaluateWorkflowRule(workflow);

            // Restore original selections
            currentSelections = savedSelections;

            return result.triggered;
        });

        const key = `${combo.subjectType}|${combo.requestType}`;
        coverage[key] = {
            subjectType: combo.subjectTypeLabel,
            requestType: combo.requestTypeLabel,
            workflowCount: triggeredWorkflows.length,
            workflows: triggeredWorkflows.map(w => w.ruleName)
        };

        // If no workflows triggered, it's a gap
        if (triggeredWorkflows.length === 0) {
            gaps.push({
                subjectType: combo.subjectTypeLabel,
                subjectTypeKey: combo.subjectType,
                requestType: combo.requestTypeLabel,
                requestTypeKey: combo.requestType,
                issue: 'NO_WORKFLOW_TRIGGERED',
                severity: 'HIGH',
                message: `User type "${combo.subjectTypeLabel}" requesting "${combo.requestTypeLabel}" has no assigned workflow`
            });
        }
    });

    console.log(`✅ Gap Detection Complete: Found ${gaps.length} gaps out of ${combinations.length} combinations`);

    return {
        gaps: gaps,
        coverage: coverage,
        total: combinations.length,
        gapCount: gaps.length,
        coverage_percentage: ((combinations.length - gaps.length) / combinations.length * 100).toFixed(1)
    };
}

// Analyze workflow rule ordering - detect when general rules come before specific ones
function analyzeWorkflowRuleOrdering() {
    const issues = [];
    
    // Calculate specificity score for each workflow
    // More criteria = more specific
    // Fewer values per criterion = more specific
    const workflowsWithScores = workflowRules.map((workflow, index) => {
        const criteria = workflow.ruleCriteria || [];
        const criteriaCount = criteria.length;
        
        // Calculate specificity: more criteria = more specific
        // Also consider: fewer values per criterion = more specific
        let specificityScore = criteriaCount * 10; // Base score from criteria count
        
        criteria.forEach(criterion => {
            const valueCount = (criterion.values || []).length;
            // Fewer values = more specific (e.g., 1 value is more specific than 10 values)
            specificityScore += (100 / Math.max(valueCount, 1));
        });
        
        return {
            workflow,
            originalIndex: index,
            specificityScore,
            criteriaCount,
            ruleSequence: workflow.ruleSequence || index
        };
    });
    
    // Sort by specificity (most specific first)
    const sortedBySpecificity = [...workflowsWithScores].sort((a, b) => b.specificityScore - a.specificityScore);
    
    // Check current order vs optimal order
    // Also check if one rule's criteria is a subset of another (the real problem)
    workflowsWithScores.forEach((current, currentIndex) => {
        const optimalIndex = sortedBySpecificity.findIndex(s => s.workflow.ruleName === current.workflow.ruleName);
        
        // Check all rules that come before this one
        for (let i = 0; i < currentIndex; i++) {
            const earlierRule = workflowsWithScores[i];
            
            // Check if current rule's criteria is a subset of earlier rule's criteria
            // This means the earlier rule will always match when current rule matches
            const currentFields = new Set(current.workflow.ruleCriteria.map(c => c.field));
            const earlierFields = new Set(earlierRule.workflow.ruleCriteria.map(c => c.field));
            
            // If current rule has all fields from earlier rule, check if values overlap
            const isSubset = Array.from(earlierFields).every(field => currentFields.has(field));
            
            if (isSubset && earlierFields.size < currentFields.size) {
                // Current rule is more specific (has more criteria)
                // Check if earlier rule would match when current rule matches
                let wouldBlock = true;
                earlierRule.workflow.ruleCriteria.forEach(earlierCriterion => {
                    const currentCriterion = current.workflow.ruleCriteria.find(c => c.field === earlierCriterion.field);
                    if (currentCriterion) {
                        // Check if there's any overlap in values
                        const overlap = earlierCriterion.values.some(v => currentCriterion.values.includes(v));
                        if (!overlap) {
                            wouldBlock = false;
                        }
                    }
                });
                
                if (wouldBlock) {
                    issues.push({
                        type: 'ORDERING_ISSUE',
                        severity: 'HIGH',
                        currentRule: current.workflow.ruleName,
                        currentIndex: currentIndex + 1,
                        blockingRule: earlierRule.workflow.ruleName,
                        blockingIndex: earlierRule.originalIndex + 1,
                        message: `Rule "${earlierRule.workflow.ruleName}" (${earlierRule.criteriaCount} criteria) will always trigger before "${current.workflow.ruleName}" (${current.criteriaCount} criteria) because it's less specific. Move the more specific rule first.`,
                        currentCriteria: current.workflow.ruleCriteria.map(c => `${c.field}=${c.values.join('|')}`).join(' & '),
                        blockingCriteria: earlierRule.workflow.ruleCriteria.map(c => `${c.field}=${c.values.join('|')}`).join(' & ')
                    });
                }
            }
        }
        
        // Also check if this rule should come earlier based on specificity
        if (optimalIndex < currentIndex) {
            const blockingRule = workflowsWithScores[currentIndex - 1];
            if (blockingRule && !issues.some(i => i.currentRule === current.workflow.ruleName && i.blockingRule === blockingRule.workflow.ruleName)) {
                issues.push({
                    type: 'ORDERING_ISSUE',
                    severity: 'MEDIUM',
                    currentRule: current.workflow.ruleName,
                    currentIndex: currentIndex + 1,
                    blockingRule: blockingRule.workflow.ruleName,
                    blockingIndex: blockingRule.originalIndex + 1,
                    message: `Rule "${current.workflow.ruleName}" (${current.criteriaCount} criteria, specificity: ${current.specificityScore.toFixed(1)}) is more specific than "${blockingRule.workflow.ruleName}" (${blockingRule.criteriaCount} criteria, specificity: ${blockingRule.specificityScore.toFixed(1)}) but comes after it.`,
                    currentCriteria: current.workflow.ruleCriteria.map(c => `${c.field}=${c.values.join('|')}`).join(' & '),
                    blockingCriteria: blockingRule.workflow.ruleCriteria.map(c => `${c.field}=${c.values.join('|')}`).join(' & ')
                });
            }
        }
    });
    
    return {
        currentOrder: workflowsWithScores.map(w => ({
            name: w.workflow.ruleName,
            index: w.originalIndex + 1,
            criteriaCount: w.criteriaCount,
            specificityScore: w.specificityScore.toFixed(1)
        })),
        suggestedOrder: sortedBySpecificity.map((w, idx) => ({
            name: w.workflow.ruleName,
            suggestedIndex: idx + 1,
            currentIndex: w.originalIndex + 1,
            criteriaCount: w.criteriaCount,
            specificityScore: w.specificityScore.toFixed(1)
        })),
        issues
    };
}

// Simple typo detection - check common spelling mistakes
function detectTypos() {
    const typos = [];
    const commonTypos = {
        'recieve': 'receive',
        'seperate': 'separate',
        'occured': 'occurred',
        'accomodate': 'accommodate',
        'definately': 'definitely',
        'authorised': 'authorized',
        'authorisation': 'authorization',
        'organise': 'organize',
        'organised': 'organized',
        'cancelled': 'canceled',
        'travelling': 'traveling',
        'labelled': 'labeled',
        'fulfil': 'fulfill',
        'fulfilment': 'fulfillment',
        'adress': 'address',
        'adres': 'address',
        'phonenumber': 'phone number',
        'phonenum': 'phone number',
        'emailadress': 'email address',
        'emailadres': 'email address'
    };
    
    // Check all field labels
    allFields.forEach(field => {
        const text = (field.label || '').toLowerCase();
        Object.keys(commonTypos).forEach(typo => {
            if (text.includes(typo)) {
                typos.push({
                    type: 'TYPO',
                    location: 'Field Label',
                    fieldKey: field.key,
                    fieldLabel: field.label,
                    found: typo,
                    suggestion: commonTypos[typo],
                    context: field.label
                });
            }
        });
        
        // Check field description
        if (field.description) {
            const descText = field.description.toLowerCase();
            Object.keys(commonTypos).forEach(typo => {
                if (descText.includes(typo)) {
                    typos.push({
                        type: 'TYPO',
                        location: 'Field Description',
                        fieldKey: field.key,
                        fieldLabel: field.label,
                        found: typo,
                        suggestion: commonTypos[typo],
                        context: field.description
                    });
                }
            });
        }
    });
    
    // Check workflow rule names
    workflowRules.forEach(workflow => {
        const text = (workflow.ruleName || '').toLowerCase();
        Object.keys(commonTypos).forEach(typo => {
            if (text.includes(typo)) {
                typos.push({
                    type: 'TYPO',
                    location: 'Workflow Rule Name',
                    fieldKey: workflow.ruleName,
                    fieldLabel: workflow.ruleName,
                    found: typo,
                    suggestion: commonTypos[typo],
                    context: workflow.ruleName
                });
            }
        });
    });
    
    return typos;
}

// Detect fields that are never shown or not configured in visibility rules
function detectUnusedFields() {
    const unusedFields = [];
    
    allFields.forEach(field => {
        // Check if field is disabled
        const isEnabled = field.isSelected === true && field.status !== 20;
        
        if (!isEnabled) {
            unusedFields.push({
                fieldKey: field.key,
                fieldLabel: field.label,
                reason: 'DISABLED',
                message: `Field is disabled (isSelected=${field.isSelected}, status=${field.status})`,
                severity: 'MEDIUM'
            });
            return;
        }
        
        // Check if field has visibility rules but they might never match
        if (field.hasVisibilityRule) {
            const rules = field.visibilityRules?.rules || [];
            if (rules.length === 0) {
                unusedFields.push({
                    fieldKey: field.key,
                    fieldLabel: field.label,
                    reason: 'NO_VISIBILITY_RULES',
                    message: 'Field has visibility rule flag but no actual rules configured - will never be shown',
                    severity: 'HIGH'
                });
                return;
            }
            
            // Check if visibility rules reference fields that don't exist
            rules.forEach(rule => {
                const ruleConditions = rule.ruleConditions || [];
                ruleConditions.forEach(condition => {
                    const referencedField = condition.selectedField;
                    const fieldExists = allFields.some(f => f.key === referencedField);
                    if (!fieldExists) {
                        unusedFields.push({
                            fieldKey: field.key,
                            fieldLabel: field.label,
                            reason: 'INVALID_REFERENCE',
                            message: `Visibility rule references non-existent field: "${referencedField}"`,
                            severity: 'HIGH',
                            referencedField: referencedField
                        });
                    }
                });
            });
        }
    });
    
    return unusedFields;
}

// Show analysis report in a modal/dialog
function showAnalysisReport() {
    const orderingAnalysis = analyzeWorkflowRuleOrdering();
    const typos = detectTypos();
    const unusedFields = detectUnusedFields();
    
    let report = '<div style="max-width: 1200px; margin: 0 auto; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">';
    report += '<h1 style="color: #2c3e50; margin-bottom: 2rem;">Analysis Report</h1>';
    
    // Workflow Ordering Issues
    report += '<div style="margin-bottom: 2rem; padding: 1.5rem; background: #fff9e6; border: 2px solid #f39c12; border-radius: 8px;">';
    report += '<h2 style="color: #f39c12; margin-bottom: 1rem;">Workflow Rule Ordering</h2>';
    if (orderingAnalysis.issues.length > 0) {
        report += `<p style="color: #e74c3c; font-weight: bold;">⚠️ Found ${orderingAnalysis.issues.length} ordering issue(s)</p>`;
        report += '<table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">';
        report += '<tr style="background: #ecf0f1;"><th style="padding: 0.5rem; text-align: left;">Current Rule</th><th style="padding: 0.5rem; text-align: left;">Position</th><th style="padding: 0.5rem; text-align: left;">Blocking Rule</th><th style="padding: 0.5rem; text-align: left;">Issue</th></tr>';
        orderingAnalysis.issues.forEach(issue => {
            report += `<tr style="border-bottom: 1px solid #ddd;"><td style="padding: 0.5rem;">${issue.currentRule}</td><td style="padding: 0.5rem;">#${issue.currentIndex}</td><td style="padding: 0.5rem;">${issue.blockingRule}</td><td style="padding: 0.5rem; color: #e74c3c;">${issue.message}</td></tr>`;
        });
        report += '</table>';
        
        report += '<h3 style="margin-top: 1.5rem; color: #2c3e50;">Suggested Order (Most Specific First)</h3>';
        report += '<ol style="padding-left: 1.5rem;">';
        orderingAnalysis.suggestedOrder.forEach(item => {
            const moved = item.currentIndex !== item.suggestedIndex;
            report += `<li style="margin: 0.5rem 0; ${moved ? 'color: #e74c3c; font-weight: bold;' : ''}">${item.name} (${item.criteriaCount} criteria, specificity: ${item.specificityScore})${moved ? ` ← Currently at position #${item.currentIndex}` : ''}</li>`;
        });
        report += '</ol>';
    } else {
        report += '<p style="color: #27ae60; font-weight: bold;">✅ No ordering issues found - rules are properly ordered from most specific to least specific</p>';
    }
    report += '</div>';
    
    // Typos
    report += '<div style="margin-bottom: 2rem; padding: 1.5rem; background: #e8f5e9; border: 2px solid #27ae60; border-radius: 8px;">';
    report += '<h2 style="color: #27ae60; margin-bottom: 1rem;">Typo Detection</h2>';
    if (typos.length > 0) {
        report += `<p style="color: #e74c3c; font-weight: bold;">⚠️ Found ${typos.length} typo(s)</p>`;
        report += '<table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">';
        report += '<tr style="background: #ecf0f1;"><th style="padding: 0.5rem; text-align: left;">Location</th><th style="padding: 0.5rem; text-align: left;">Field/Workflow</th><th style="padding: 0.5rem; text-align: left;">Found</th><th style="padding: 0.5rem; text-align: left;">Suggestion</th></tr>';
        typos.forEach(typo => {
            report += `<tr style="border-bottom: 1px solid #ddd;"><td style="padding: 0.5rem;">${typo.location}</td><td style="padding: 0.5rem;">${typo.fieldLabel}</td><td style="padding: 0.5rem; color: #e74c3c;">${typo.found}</td><td style="padding: 0.5rem; color: #27ae60;">${typo.suggestion}</td></tr>`;
        });
        report += '</table>';
    } else {
        report += '<p style="color: #27ae60; font-weight: bold;">✅ No typos found</p>';
    }
    report += '</div>';
    
    // Unused Fields
    report += '<div style="margin-bottom: 2rem; padding: 1.5rem; background: #fce4ec; border: 2px solid #e91e63; border-radius: 8px;">';
    report += '<h2 style="color: #e91e63; margin-bottom: 1rem;">Unused/Problematic Fields</h2>';
    if (unusedFields.length > 0) {
        report += `<p style="color: #e74c3c; font-weight: bold;">⚠️ Found ${unusedFields.length} issue(s)</p>`;
        report += '<table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">';
        report += '<tr style="background: #ecf0f1;"><th style="padding: 0.5rem; text-align: left;">Field</th><th style="padding: 0.5rem; text-align: left;">Reason</th><th style="padding: 0.5rem; text-align: left;">Severity</th><th style="padding: 0.5rem; text-align: left;">Message</th></tr>';
        unusedFields.forEach(field => {
            const severityColor = field.severity === 'HIGH' ? '#e74c3c' : '#f39c12';
            report += `<tr style="border-bottom: 1px solid #ddd;"><td style="padding: 0.5rem;">${field.fieldLabel}</td><td style="padding: 0.5rem;">${field.reason}</td><td style="padding: 0.5rem; color: ${severityColor}; font-weight: bold;">${field.severity}</td><td style="padding: 0.5rem;">${field.message}</td></tr>`;
        });
        report += '</table>';
    } else {
        report += '<p style="color: #27ae60; font-weight: bold;">✅ No unused fields found</p>';
    }
    report += '</div>';
    
    report += '<div style="text-align: center; margin-top: 2rem;">';
    report += '<button onclick="this.parentElement.parentElement.remove()" class="btn" style="padding: 0.75rem 2rem;">Close</button>';
    report += '</div>';
    report += '</div>';
    
    // Create modal overlay
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; overflow-y: auto; padding: 2rem;';
    modal.innerHTML = report;
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Export gap analysis results
function exportGapAnalysis() {
    console.log('� exportGapAnalysis() called');
    const gapAnalysis = detectWorkflowGaps();
    console.log('Gap analysis results:', gapAnalysis);

    if (!gapAnalysis.gaps || gapAnalysis.gaps.length === 0) {
        alert(`✅ No workflow gaps found!\n\nAll ${gapAnalysis.total} WHO+WHAT combinations have assigned workflows.\nCoverage: ${gapAnalysis.coverage_percentage}%`);
        return;
    }

    // Create workbook with gap analysis
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Gap Summary
    const summaryData = [
        ['Workflow Coverage Analysis'],
        [],
        ['Total Combinations', gapAnalysis.total],
        ['Covered Combinations', gapAnalysis.total - gapAnalysis.gapCount],
        ['Gaps (No Workflow)', gapAnalysis.gapCount],
        ['Coverage Percentage', `${gapAnalysis.coverage_percentage}%`],
        []
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Gap Summary');

    // Sheet 2: All Gaps
    const gapsData = [];
    gapsData.push(['Subject Type (WHO)', 'Request Type (WHAT)', 'Issue', 'Severity', 'Message']);

    gapAnalysis.gaps.forEach(gap => {
        gapsData.push([
            gap.subjectType,
            gap.requestType,
            gap.issue,
            gap.severity,
            gap.message
        ]);
    });

    const gapsSheet = XLSX.utils.aoa_to_sheet(gapsData);
    XLSX.utils.book_append_sheet(workbook, gapsSheet, 'Identified Gaps');

    // Sheet 3: Full Coverage Matrix
    const matrixData = [];
    matrixData.push(['Subject Type (WHO)', 'Request Type (WHAT)', 'Assigned Workflows', 'Workflow Count']);

    Object.entries(gapAnalysis.coverage).forEach(([key, info]) => {
        matrixData.push([
            info.subjectType,
            info.requestType,
            info.workflows.length > 0 ? info.workflows.join('; ') : 'NONE (GAP)',
            info.workflowCount
        ]);
    });

    const matrixSheet = XLSX.utils.aoa_to_sheet(matrixData);
    XLSX.utils.book_append_sheet(workbook, matrixSheet, 'Coverage Matrix');

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `workflow-gaps-${timestamp}.xlsx`;

    XLSX.writeFile(workbook, filename);
    alert(`✅ Gap analysis exported!\n\nFile: ${filename}\nGaps found: ${gapAnalysis.gapCount}/${gapAnalysis.total}`);
}

function exportToExcel() {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: All Fields
    const allFieldsData = [];
    allFieldsData.push(['Field Key', 'Label', 'Type', 'Required', 'Status', 'Has Visibility Rule', 'Description']);

    allFields.forEach(field => {
        allFieldsData.push([
            field.key,
            field.label,
            field.type,
            field.required ? 'Yes' : 'No',
            field.status === 10 ? 'Active' : 'Inactive',
            field.hasVisibilityRule ? 'Yes' : 'No',
            field.description || ''
        ]);
    });

    const allFieldsSheet = XLSX.utils.aoa_to_sheet(allFieldsData);
    XLSX.utils.book_append_sheet(workbook, allFieldsSheet, 'All Fields');

    // Sheet 2: Field Options (for multiselect/button fields)
    const optionsData = [];
    optionsData.push(['Field Key', 'Field Label', 'Option Key', 'Option Value']);

    allFields.forEach(field => {
        if (field.options && field.options.length > 0) {
            field.options.forEach(option => {
                optionsData.push([
                    field.key,
                    field.label,
                    option.key,
                    option.value
                ]);
            });
        }
    });

    const optionsSheet = XLSX.utils.aoa_to_sheet(optionsData);
    XLSX.utils.book_append_sheet(workbook, optionsSheet, 'Field Options');

    // Sheet 3: Visibility Rules
    const visibilityData = [];
    visibilityData.push(['What Shows', 'Rule Name', 'When This Field', 'Operator', 'Equals This Value', 'Action Type', 'Configured Options']);

    allFields.forEach(field => {
        if (field.hasVisibilityRule && field.visibilityRules && field.visibilityRules.rules) {
            field.visibilityRules.rules.forEach(rule => {
                const ruleName = rule.ruleName || 'Unnamed';
                const ruleConditions = rule.ruleConditions || [];
                const action = rule.actions?.[0];
                const actionType = action?.action || 'SHOW_QUESTION';

                // Get configured options if present
                let configuredOptions = '';
                if (action?.selectedOptions && action.selectedOptions.length > 0) {
                    const optionLabels = action.selectedOptions.map(opt => getOptionLabel(opt));
                    configuredOptions = optionLabels.join(', ');
                }

                ruleConditions.forEach(condition => {
                    const conditionField = condition.selectedField;
                    const subConditions = condition.ruleSubConditions || [];

                    subConditions.forEach(sub => {
                        const expectedValue = getOptionLabel(sub.valueToCompareWith);

                        visibilityData.push([
                            field.label,
                            ruleName,
                            getFieldLabel(conditionField),
                            sub.comparisonOperator,
                            expectedValue,
                            actionType,
                            configuredOptions
                        ]);
                    });
                });
            });
        }
    });

    const visibilitySheet = XLSX.utils.aoa_to_sheet(visibilityData);
    XLSX.utils.book_append_sheet(workbook, visibilitySheet, 'Visibility Rules');

    // Sheet 4: All Workflows
    const workflowData = [];
    workflowData.push(['Workflow Name', 'Workflow ID', 'Deadline (days)', 'Criteria Count']);

    workflowRules.forEach(workflow => {
        const params = Array.isArray(workflow.ruleActionParameters) ? workflow.ruleActionParameters : [];
        const workflowId = params.find(p => p.field === 'WORKFLOWID')?.value || 'N/A';
        const deadline = params.find(p => p.field === 'DEADLINE')?.value || 'N/A';
        const criteriaCount = workflow.ruleCriteria?.length || 0;

        workflowData.push([
            workflow.ruleName || 'Unnamed Workflow',
            workflowId,
            deadline,
            criteriaCount
        ]);
    });

    const workflowSheet = XLSX.utils.aoa_to_sheet(workflowData);
    XLSX.utils.book_append_sheet(workbook, workflowSheet, 'All Workflows');

    // Sheet 5: Workflow Criteria (one row per workflow)
    const criteriaData = [];
    const maxCriteria = Math.max(...workflowRules.map(wf => (wf.ruleCriteria || []).length), 0);

    // Build dynamic header
    const header = ['Workflow Name', 'Workflow ID', 'Deadline (days)', 'Total Steps'];
    for (let i = 1; i <= maxCriteria; i++) {
        header.push(`Step ${i} - Field`, `Step ${i} - Values`);
    }
    criteriaData.push(header);

    workflowRules.forEach(workflow => {
        const workflowName = workflow.ruleName || 'Unnamed Workflow';
        const params = Array.isArray(workflow.ruleActionParameters) ? workflow.ruleActionParameters : [];
        const workflowId = params.find(p => p.field === 'WORKFLOWID')?.value || 'N/A';
        const deadline = params.find(p => p.field === 'DEADLINE')?.value || 'N/A';
        const criteria = workflow.ruleCriteria || [];

        const row = [
            workflowName,
            workflowId,
            deadline,
            criteria.length
        ];

        // Add each criterion as field/value pair
        criteria.forEach(criterion => {
            const fieldLabel = getFieldLabel(criterion.field);
            const values = criterion.values || [];
            const valueLabels = values.map(v => getOptionLabel(v)).join(' OR ');

            row.push(fieldLabel);
            row.push(valueLabels);
        });

        // Fill remaining columns with empty strings
        while (row.length < header.length) {
            row.push('');
        }

        criteriaData.push(row);
    });

    const criteriaSheet = XLSX.utils.aoa_to_sheet(criteriaData);
    XLSX.utils.book_append_sheet(workbook, criteriaSheet, 'Workflow Criteria');

    // Sheet 5b: Workflow Trigger Walkthrough
    const walkthroughData = [];
    walkthroughData.push(['Workflow Name', 'Step-by-Step Guide']);

    workflowRules.forEach(workflow => {
        const workflowName = workflow.ruleName || 'Unnamed Workflow';
        const params = Array.isArray(workflow.ruleActionParameters) ? workflow.ruleActionParameters : [];
        const workflowId = params.find(p => p.field === 'WORKFLOWID')?.value || 'N/A';
        const deadline = params.find(p => p.field === 'DEADLINE')?.value || 'N/A';
        const criteria = workflow.ruleCriteria || [];

        let instructions = `To trigger "${workflowName}" (Deadline: ${deadline} days):\n\n`;

        if (criteria.length === 0) {
            instructions += 'No criteria defined (workflow may trigger by default)';
        } else {
            instructions += `You must complete ALL ${criteria.length} step(s) below:\n\n`;

            criteria.forEach((criterion, index) => {
                const fieldLabel = getFieldLabel(criterion.field);
                const values = criterion.values || [];
                const valueLabels = values.map(v => getOptionLabel(v));

                instructions += `STEP ${index + 1}: "${fieldLabel}"\n`;
                if (valueLabels.length === 1) {
                    instructions += `   → Select: ${valueLabels[0]}\n`;
                } else {
                    instructions += `   → Select ANY of: ${valueLabels.join(' OR ')}\n`;
                }
                instructions += '\n';
            });

            instructions += 'All steps must be completed to trigger this workflow.';
        }

        walkthroughData.push([
            workflowName,
            instructions
        ]);
    });

    const walkthroughSheet = XLSX.utils.aoa_to_sheet(walkthroughData);
    XLSX.utils.book_append_sheet(workbook, walkthroughSheet, 'Workflow Walkthrough');

    // Sheet 6: Submit Button Rules
    const submitData = [];
    submitData.push(['Rule Name', 'Condition Field', 'Operator', 'Expected Value', 'Action', 'Error Message']);

    if (submitButtonRules && submitButtonRules.visibilityRules) {
        const rules = submitButtonRules.visibilityRules.rules || [];
        rules.forEach(rule => {
            const ruleName = rule.ruleName || 'Unnamed';
            const ruleConditions = rule.ruleConditions || [];

            ruleConditions.forEach(condition => {
                const conditionField = condition.selectedField;
                const subConditions = condition.ruleSubConditions || [];

                subConditions.forEach(sub => {
                    const expectedValue = getOptionLabel(sub.valueToCompareWith);
                    const action = rule.actions?.[0]?.action || '';
                    const errorMessage = rule.actions?.[0]?.errorMessage || '';

                    submitData.push([
                        ruleName,
                        getFieldLabel(conditionField),
                        sub.comparisonOperator,
                        expectedValue,
                        action,
                        errorMessage
                    ]);
                });
            });
        });
    }

    const submitSheet = XLSX.utils.aoa_to_sheet(submitData);
    XLSX.utils.book_append_sheet(workbook, submitSheet, 'Submit Button Rules');

    // Sheet 7: Attachment Rules
    const attachmentData = [];
    attachmentData.push(['Rule Name', 'Condition Field', 'Operator', 'Expected Value', 'Action']);

    if (attachmentRules && attachmentRules.visibilityRules) {
        const rules = attachmentRules.visibilityRules.rules || [];
        rules.forEach(rule => {
            const ruleName = rule.ruleName || 'Unnamed';
            const ruleConditions = rule.ruleConditions || [];

            ruleConditions.forEach(condition => {
                const conditionField = condition.selectedField;
                const subConditions = condition.ruleSubConditions || [];

                subConditions.forEach(sub => {
                    const expectedValue = getOptionLabel(sub.valueToCompareWith);
                    const action = rule.actions?.[0]?.action || '';

                    attachmentData.push([
                        ruleName,
                        getFieldLabel(conditionField),
                        sub.comparisonOperator,
                        expectedValue,
                        action
                    ]);
                });
            });
        });
    }

    const attachmentSheet = XLSX.utils.aoa_to_sheet(attachmentData);
    XLSX.utils.book_append_sheet(workbook, attachmentSheet, 'Attachment Rules');

    // Sheet 8: Request Types
    const requestTypesData = [];
    requestTypesData.push(['Field Name', 'ID', 'Order', 'Status', 'Selected']);

    if (webformData.webFormDto && webformData.webFormDto.requestTypes) {
        webformData.webFormDto.requestTypes.forEach(rt => {
            const label = translations?.requestTypes?.[rt.fieldName] || rt.fieldName;
            requestTypesData.push([
                label,
                rt.id,
                rt.order,
                rt.status === 10 ? 'Active' : 'Inactive',
                rt.isSelected ? 'Yes' : 'No'
            ]);
        });
    }

    const requestTypesSheet = XLSX.utils.aoa_to_sheet(requestTypesData);
    XLSX.utils.book_append_sheet(workbook, requestTypesSheet, 'Request Types');

    // Sheet 9: Subject Types
    const subjectTypesData = [];
    subjectTypesData.push(['Field Name', 'ID', 'Order', 'Status', 'Selected']);

    if (webformData.webFormDto && webformData.webFormDto.subjectTypes) {
        webformData.webFormDto.subjectTypes.forEach(st => {
            const label = translations?.subjectTypes?.[st.fieldName] || st.fieldName;
            subjectTypesData.push([
                label,
                st.id,
                st.order,
                st.status === 10 ? 'Active' : 'Inactive',
                st.isSelected ? 'Yes' : 'No'
            ]);
        });
    }

    const subjectTypesSheet = XLSX.utils.aoa_to_sheet(subjectTypesData);
    XLSX.utils.book_append_sheet(workbook, subjectTypesSheet, 'Subject Types');

    // Sheet 11: Workflow Rule Ordering Analysis
    const orderingAnalysis = analyzeWorkflowRuleOrdering();
    const orderingData = [];
    orderingData.push(['Current Order', 'Workflow Name', 'Criteria Count', 'Specificity Score']);
    orderingAnalysis.currentOrder.forEach(item => {
        orderingData.push([item.index, item.name, item.criteriaCount, item.specificityScore]);
    });
    orderingData.push([]);
    orderingData.push(['Suggested Order', 'Workflow Name', 'Suggested Position', 'Current Position', 'Criteria Count', 'Specificity Score']);
    orderingAnalysis.suggestedOrder.forEach(item => {
        orderingData.push([item.suggestedIndex, item.name, item.suggestedIndex, item.currentIndex, item.criteriaCount, item.specificityScore]);
    });
    if (orderingAnalysis.issues.length > 0) {
        orderingData.push([]);
        orderingData.push(['Issues Found']);
        orderingData.push(['Severity', 'Current Rule', 'Current Position', 'Blocking Rule', 'Blocking Position', 'Message']);
        orderingAnalysis.issues.forEach(issue => {
            orderingData.push([
                issue.severity,
                issue.currentRule,
                issue.currentIndex,
                issue.blockingRule,
                issue.blockingIndex,
                issue.message
            ]);
        });
    }
    const orderingSheet = XLSX.utils.aoa_to_sheet(orderingData);
    XLSX.utils.book_append_sheet(workbook, orderingSheet, 'Workflow Ordering');

    // Sheet 12: Typo Detection
    const typos = detectTypos();
    const typosData = [];
    typosData.push(['Location', 'Field/Workflow', 'Found Typo', 'Suggestion', 'Context']);
    typos.forEach(typo => {
        typosData.push([
            typo.location,
            typo.fieldLabel,
            typo.found,
            typo.suggestion,
            typo.context
        ]);
    });
    if (typos.length === 0) {
        typosData.push(['No typos found']);
    }
    const typosSheet = XLSX.utils.aoa_to_sheet(typosData);
    XLSX.utils.book_append_sheet(workbook, typosSheet, 'Typos');

    // Sheet 13: Unused Fields
    const unusedFields = detectUnusedFields();
    const unusedData = [];
    unusedData.push(['Field Key', 'Field Label', 'Reason', 'Severity', 'Message', 'Referenced Field']);
    unusedFields.forEach(field => {
        unusedData.push([
            field.fieldKey,
            field.fieldLabel,
            field.reason,
            field.severity,
            field.message,
            field.referencedField || ''
        ]);
    });
    if (unusedFields.length === 0) {
        unusedData.push(['No unused fields found']);
    }
    const unusedSheet = XLSX.utils.aoa_to_sheet(unusedData);
    XLSX.utils.book_append_sheet(workbook, unusedSheet, 'Unused Fields');

    // Generate filename with template name and timestamp
    const templateName = webformData.webFormDto?.templateName || 'webform';
    const cleanTemplateName = templateName.replace(/[^a-zA-Z0-9]/g, '-');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `${cleanTemplateName}-${timestamp}.xlsx`;

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
    if (!optionKey) return optionKey;
    
    // Check translations first
    if (translations && translations.options && translations.options[optionKey]) {
        return translations.options[optionKey];
    }
    if (translations && translations.requestTypes && translations.requestTypes[optionKey]) {
        return translations.requestTypes[optionKey];
    }
    if (translations && translations.subjectTypes && translations.subjectTypes[optionKey]) {
        return translations.subjectTypes[optionKey];
    }
    
    // For country codes, try to find the country name from the country field options
    // Country codes are typically 2-letter ISO codes (like "US", "BR", "DZ")
    if (optionKey.length === 2 && /^[A-Z]{2}$/i.test(optionKey)) {
        const countryField = allFields.find(f => 
            f.key && (f.key.toLowerCase().includes('country') || 
                     (f.label && f.label.toLowerCase().includes('country')))
        );
        
        if (countryField && countryField.options) {
            const countryOption = countryField.options.find(opt => 
                opt.key === optionKey || opt.key === optionKey.toUpperCase() || opt.key === optionKey.toLowerCase()
            );
            if (countryOption && countryOption.value) {
                return countryOption.value;
            }
        }
        
        // Fallback: Try the comprehensive country list
        const worldCountries = getWorldCountriesOptions();
        const countryOption = worldCountries.find(opt => 
            opt.key === optionKey || opt.key === optionKey.toUpperCase() || opt.key === optionKey.toLowerCase()
        );
        if (countryOption && countryOption.value) {
            return countryOption.value;
        }
    }
    
    return optionKey;
}

// Test function to verify brute-force decryption (exposed to console)
window.testBruteForce = async function(testHash) {
    console.log('🧪 Testing brute-force decryption...');
    console.log(`Hash lookup table size: ${Object.keys(countryHashLookup).length} entries`);
    
    if (!testHash) {
        // Test with a known country code
        const testCountry = 'US';
        console.log(`\n📝 Testing with country code: ${testCountry}`);
        const testHash = await sha512(testCountry.toLowerCase());
        console.log(`Generated hash: ${testHash}`);
        
        if (countryHashLookup[testHash]) {
            console.log(`✅ SUCCESS: Hash found in lookup!`);
            console.log(`   Decrypted to: ${countryHashLookup[testHash].originalKey}`);
            console.log(`   Original variant: "${countryHashLookup[testHash].hashedVariant}"`);
        } else {
            console.log(`❌ FAILED: Hash not found in lookup`);
            console.log(`   This means the hash lookup table was not built correctly.`);
        }
    } else {
        // Test with provided hash
        console.log(`\n📝 Testing with provided hash: ${testHash.substring(0, 16)}...`);
        if (countryHashLookup[testHash]) {
            console.log(`✅ SUCCESS: Hash found in lookup!`);
            console.log(`   Decrypted to: ${countryHashLookup[testHash].originalKey}`);
            console.log(`   Original variant: "${countryHashLookup[testHash].hashedVariant}"`);
        } else {
            console.log(`❌ FAILED: Hash not found in lookup`);
            console.log(`   This hash does not match any country in the lookup table.`);
        }
    }
    
    // Show some example hashes
    console.log(`\n📋 Sample hashes in lookup table (first 5):`);
    const sampleHashes = Object.keys(countryHashLookup).slice(0, 5);
    sampleHashes.forEach((hash, idx) => {
        const entry = countryHashLookup[hash];
        console.log(`   ${idx + 1}. ${hash.substring(0, 16)}... → ${entry.originalKey} (from "${entry.hashedVariant}")`);
    });
};
