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
    console.log('🔐 Building country hash lookup table...');
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
        console.log('⚠️ Country field found but has no options in JSON');
        console.log('Country field key:', countryField.key);
        console.log('Country field label:', countryField.label);
        console.log('Country field type:', countryField.type);
        console.log('🔄 Using comprehensive ISO country list as fallback...');
        
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
        console.log('📝 Example hash mappings:');
        exampleKeys.forEach(hash => {
            const entry = countryHashLookup[hash];
            console.log(`   ${hash.substring(0, 16)}... → ${entry.originalKey} (from "${entry.hashedVariant}")`);
        });
    }
}

// Build lookup table for state hashes
async function buildStateHashLookup() {
    console.log('🔐 Building state hash lookup table...');
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
        console.log('⚠️ No state field found in allFields');
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
        console.log('🔄 Using comprehensive US states list as fallback...');
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
        processedOptions.push(`${key} (${value})`);

        // Try multiple variations (lowercase seems to be what OneTrust uses)
        const variations = [
            key,
            key.toLowerCase(),
            key.toUpperCase(),
            value,
            value.toLowerCase(),
            value.toUpperCase(),
            // Also try common abbreviations (e.g., "CA" for "California")
            value.replace(/\s+/g, ''), // Remove spaces
            value.replace(/\s+/g, '').toLowerCase(),
            value.replace(/\s+/g, '').toUpperCase()
        ];

        for (const variant of variations) {
            if (variant) { // Skip empty/null variants
                const hash = await sha512(variant);
                stateHashLookup[hash] = {
                    originalKey: key,
                    originalValue: value,
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
        console.log('📝 Example state hash mappings:');
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

    // Check if field name/label contains "country"
    return fieldKey.includes('country') || label.includes('country');
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
    const states = [
        'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
        'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
        'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
        'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
        'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
        'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
        'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
        'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
        'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
        'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia'
    ];

    return states.map(state => ({
        key: state.replace(/\s+/g, ''),
        value: state
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
        console.log('⚠️ webformData.fields is undefined or null');
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

                    if (hasDecryptedAny && totalDecrypted > 0) {
                        // Successfully decrypted! Use the actual values
                        if (decryptedCountries.size > 0) {
                            ruleCriteria.push({
                                field: 'country',
                                values: Array.from(decryptedCountries),
                                isHashed: false,
                                inferred: false,
                                decrypted: true
                            });
                            console.log(`✅ Successfully decrypted ${decryptedCountries.size} country value(s): ${Array.from(decryptedCountries).join(', ')}`);
                        }
                        if (decryptedStates.size > 0) {
                            ruleCriteria.push({
                                field: 'state',
                                values: Array.from(decryptedStates),
                                isHashed: false,
                                inferred: false,
                                decrypted: true
                            });
                            console.log(`✅ Successfully decrypted ${decryptedStates.size} state value(s): ${Array.from(decryptedStates).join(', ')}`);
                        }
                    } else {
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
                            console.log('✅ Inferred: CCPA = Country is US');
                        } else if (ruleName.toUpperCase().includes('LGPD')) {
                            ruleCriteria.push({
                                field: 'country',
                                values: ['BR'],
                                isHashed: false,
                                inferred: true,
                                decrypted: false
                            });
                            console.log('✅ Inferred: LGPD = Country is Brazil');
                        } else if (ruleName.toUpperCase().includes('GDPR')) {
                            ruleCriteria.push({
                                field: 'country',
                                values: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'],
                                isHashed: false,
                                inferred: true,
                                decrypted: false
                            });
                            console.log('✅ Inferred: GDPR = Country is EU member state');
                        } else {
                            // Unknown encrypted workflow - mark as such
                            ruleCriteria.push({
                                field: 'encrypted_criteria',
                                values: ['[Could not decrypt - hash not in lookup table]'],
                                isHashed: true,
                                inferred: false,
                                decrypted: false
                            });
                            console.log('❌ Could not decrypt or infer criteria');
                        }
                    }
                    // Skip normal parsing for hashed workflows - we already handled them
                } else {
                    // Normal workflow parsing (no hashes)
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


// Gap Detection System: Finds combinations of WHO+WHAT that don't trigger workflows
function detectWorkflowGaps() {
    // Extract request types and subject types (WHO + WHAT)
    const requestTypes = (webformData.webFormDto?.requestTypes || [])
        .filter(rt => rt.isSelected !== false && rt.status !== 20); // Only active ones

    const subjectTypes = (webformData.webFormDto?.subjectTypes || [])
        .filter(st => st.isSelected !== false && st.status !== 20); // Only active ones

    // Find the field keys for requestType and subjectType in allFields
    const requestTypeField = allFields.find(f =>
        f.key === 'requestType' || f.key.toLowerCase().includes('requesttype')
    );
    const subjectTypeField = allFields.find(f =>
        f.key === 'subjectType' || f.key.toLowerCase().includes('subjecttype')
    );

    if (!requestTypeField || !subjectTypeField) {
        console.warn('Gap detection: Could not find requestType or subjectType fields');
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

// Export gap analysis results
function exportGapAnalysis() {
    const gapAnalysis = detectWorkflowGaps();

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
