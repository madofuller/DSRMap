/**
 * SHA-512 Hash Decryptor Library
 * 
 * This library provides functionality to decrypt (reverse lookup) SHA-512 hashes
 * used in OneTrust webforms. It builds lookup tables for countries, states, and
 * other fields by hashing all possible values and creating reverse mappings.
 * 
 * Usage:
 *   const decryptor = new HashDecryptor();
 *   await decryptor.buildLookups();
 *   const result = decryptor.decrypt('hash_string_here');
 */

class HashDecryptor {
    constructor() {
        this.countryLookup = {};  // Maps SHA-512 hashes to country data
        this.stateLookup = {};    // Maps SHA-512 hashes to state data
        this.customLookups = {};  // Maps field names to their hash lookups
        this.isBuilt = false;
    }

    /**
     * Generate SHA-512 hash of a string
     * @param {string} str - String to hash
     * @returns {Promise<string>} - Hex-encoded SHA-512 hash
     */
    async sha512(str) {
        if (typeof str !== 'string') {
            str = String(str);
        }
        const buffer = new TextEncoder().encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-512', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Get comprehensive list of world countries (ISO 3166-1 alpha-2)
     * @returns {Array<{key: string, value: string}>}
     */
    getWorldCountries() {
        return [
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
    }

    /**
     * Get comprehensive list of US states
     * @returns {Array<{key: string, value: string}>}
     */
    getUSStates() {
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

    /**
     * Generate variations of a value for hashing
     * @param {string} key - The key (e.g., "US")
     * @param {string} value - The value (e.g., "United States")
     * @returns {Array<string>} - Array of variations to hash
     */
    generateVariations(key, value) {
        const variations = [
            key,
            key.toLowerCase(),
            key.toUpperCase(),
            value,
            value.toLowerCase(),
            value.toUpperCase()
        ];

        // For states, also try without spaces
        if (value && value.includes(' ')) {
            const noSpaces = value.replace(/\s+/g, '');
            variations.push(noSpaces, noSpaces.toLowerCase(), noSpaces.toUpperCase());
        }

        // Remove duplicates and empty values
        return [...new Set(variations.filter(v => v && v.trim()))];
    }

    /**
     * Build lookup table for countries
     * @param {Array<{key: string, value: string}>} customCountries - Optional custom country list
     * @returns {Promise<void>}
     */
    async buildCountryLookup(customCountries = null) {
        const countries = customCountries || this.getWorldCountries();
        this.countryLookup = {};
        let hashCount = 0;

        for (const country of countries) {
            const variations = this.generateVariations(country.key, country.value);

            for (const variant of variations) {
                const hash = await this.sha512(variant);
                this.countryLookup[hash] = {
                    originalKey: country.key,
                    originalValue: country.value,
                    hashedVariant: variant,
                    fieldType: 'country'
                };
                hashCount++;
            }
        }

        console.log(`✅ Built country lookup: ${Object.keys(this.countryLookup).length} unique hashes from ${hashCount} variations`);
    }

    /**
     * Build lookup table for states
     * @param {Array<{key: string, value: string}>} customStates - Optional custom state list
     * @returns {Promise<void>}
     */
    async buildStateLookup(customStates = null) {
        const states = customStates || this.getUSStates();
        this.stateLookup = {};
        let hashCount = 0;

        for (const state of states) {
            const variations = this.generateVariations(state.key, state.value);

            for (const variant of variations) {
                const hash = await this.sha512(variant);
                this.stateLookup[hash] = {
                    originalKey: state.key,
                    originalValue: state.value,
                    hashedVariant: variant,
                    fieldType: 'state'
                };
                hashCount++;
            }
        }

        console.log(`✅ Built state lookup: ${Object.keys(this.stateLookup).length} unique hashes from ${hashCount} variations`);
    }

    /**
     * Build lookup table for a custom field
     * @param {string} fieldName - Name of the field
     * @param {Array<{key: string, value: string}>} options - Field options
     * @returns {Promise<void>}
     */
    async buildCustomLookup(fieldName, options) {
        if (!Array.isArray(options) || options.length === 0) {
            throw new Error(`Invalid options for field "${fieldName}"`);
        }

        this.customLookups[fieldName] = {};
        let hashCount = 0;

        for (const option of options) {
            const key = option.key || option.value;
            const value = option.value || option.key;
            const variations = this.generateVariations(key, value);

            for (const variant of variations) {
                const hash = await this.sha512(variant);
                this.customLookups[fieldName][hash] = {
                    originalKey: key,
                    originalValue: value,
                    hashedVariant: variant,
                    fieldType: fieldName
                };
                hashCount++;
            }
        }

        console.log(`✅ Built custom lookup for "${fieldName}": ${Object.keys(this.customLookups[fieldName]).length} unique hashes from ${hashCount} variations`);
    }

    /**
     * Build all standard lookups (countries and states)
     * @param {Object} options - Configuration options
     * @param {Array} options.customCountries - Custom country list
     * @param {Array} options.customStates - Custom state list
     * @returns {Promise<void>}
     */
    async buildLookups(options = {}) {
        console.log('🔐 Building hash lookup tables...');
        
        await this.buildCountryLookup(options.customCountries);
        await this.buildStateLookup(options.customStates);
        
        this.isBuilt = true;
        console.log('✅ All lookups built successfully!');
    }

    /**
     * Decrypt a hash (reverse lookup)
     * @param {string} hash - SHA-512 hash to decrypt
     * @param {string} fieldType - Optional field type hint ('country', 'state', or custom field name)
     * @returns {Object|null} - Decrypted data or null if not found
     */
    decrypt(hash, fieldType = null) {
        if (!this.isBuilt) {
            console.warn('⚠️ Lookups not built yet. Call buildLookups() first.');
            return null;
        }

        // If field type is specified, check that lookup first
        if (fieldType) {
            if (fieldType === 'country' || fieldType === 'countryHash') {
                if (this.countryLookup[hash]) {
                    return this.countryLookup[hash];
                }
            } else if (fieldType === 'state' || fieldType === 'stateHash') {
                if (this.stateLookup[hash]) {
                    return this.stateLookup[hash];
                }
            } else if (this.customLookups[fieldType] && this.customLookups[fieldType][hash]) {
                return this.customLookups[fieldType][hash];
            }
        }

        // Try all lookups in order: country, state, then custom
        if (this.countryLookup[hash]) {
            return this.countryLookup[hash];
        }
        
        if (this.stateLookup[hash]) {
            return this.stateLookup[hash];
        }

        // Check all custom lookups
        for (const fieldName in this.customLookups) {
            if (this.customLookups[fieldName][hash]) {
                return this.customLookups[fieldName][hash];
            }
        }

        return null;
    }

    /**
     * Decrypt multiple hashes
     * @param {Array<string>} hashes - Array of hashes to decrypt
     * @param {string} fieldType - Optional field type hint
     * @returns {Array<Object|null>} - Array of decrypted results
     */
    decryptMultiple(hashes, fieldType = null) {
        return hashes.map(hash => this.decrypt(hash, fieldType));
    }

    /**
     * Get statistics about the lookup tables
     * @returns {Object}
     */
    getStats() {
        const customLookupSizes = {};
        for (const fieldName in this.customLookups) {
            customLookupSizes[fieldName] = Object.keys(this.customLookups[fieldName]).length;
        }

        return {
            isBuilt: this.isBuilt,
            countryHashes: Object.keys(this.countryLookup).length,
            stateHashes: Object.keys(this.stateLookup).length,
            customLookups: customLookupSizes,
            totalHashes: Object.keys(this.countryLookup).length + 
                         Object.keys(this.stateLookup).length +
                         Object.values(customLookupSizes).reduce((a, b) => a + b, 0)
        };
    }

    /**
     * Test decryption with a known value
     * @param {string} testValue - Value to hash and then decrypt
     * @param {string} fieldType - Field type ('country' or 'state')
     * @returns {Promise<Object>}
     */
    async testDecryption(testValue, fieldType = 'country') {
        console.log(`🧪 Testing decryption with value: "${testValue}"`);
        const hash = await this.sha512(testValue.toLowerCase());
        console.log(`   Generated hash: ${hash}`);
        
        const result = this.decrypt(hash, fieldType);
        if (result) {
            console.log(`   ✅ SUCCESS: Decrypted to "${result.originalKey}" (${result.originalValue})`);
            console.log(`   Original variant: "${result.hashedVariant}"`);
        } else {
            console.log(`   ❌ FAILED: Hash not found in lookup`);
        }
        
        return result;
    }
}

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HashDecryptor;
}

// Also make available globally in browser
if (typeof window !== 'undefined') {
    window.HashDecryptor = HashDecryptor;
}




