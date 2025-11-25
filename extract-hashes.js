/**
 * Extract encrypted hashes from webform for decryption testing
 */

const fs = require('fs');

// Load the webform
const webformPath = 'webform-template-6904500676217895167.json';
console.log(`Loading webform: ${webformPath}\n`);

const webformData = JSON.parse(fs.readFileSync(webformPath, 'utf8'));

// Function to recursively search for hashes
function findHashes(obj, path = '', results = []) {
    if (typeof obj !== 'object' || obj === null) {
        return results;
    }

    if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
            findHashes(item, `${path}[${index}]`, results);
        });
        return results;
    }

    // Check for fields with "Hash" in the name
    Object.keys(obj).forEach(key => {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (key.toLowerCase().includes('hash')) {
            const value = obj[key];
            
            // Check if the value looks like a hash (long hex string)
            if (typeof value === 'string' && /^[a-f0-9]{64,}$/i.test(value)) {
                results.push({
                    path: currentPath,
                    field: key,
                    hash: value,
                    hashLength: value.length,
                    context: {
                        parent: path,
                        fullObject: JSON.stringify(obj, null, 2).substring(0, 500)
                    }
                });
            } else if (Array.isArray(value)) {
                // Check array values
                value.forEach((item, idx) => {
                    if (typeof item === 'string' && /^[a-f0-9]{64,}$/i.test(item)) {
                        results.push({
                            path: `${currentPath}[${idx}]`,
                            field: key,
                            hash: item,
                            hashLength: item.length,
                            context: {
                                parent: path,
                                fullObject: JSON.stringify(obj, null, 2).substring(0, 500)
                            }
                        });
                    }
                });
            }
        }
        
        // Also check for "value" fields that might contain hashes
        if (key === 'value' || key === 'fieldValues') {
            const value = obj[key];
            if (typeof value === 'string' && /^[a-f0-9]{64,}$/i.test(value)) {
                // Check if parent field name contains "Hash"
                const parentKeys = Object.keys(obj);
                const hasHashField = parentKeys.some(k => k.toLowerCase().includes('hash'));
                
                if (hasHashField) {
                    results.push({
                        path: currentPath,
                        field: key,
                        hash: value,
                        hashLength: value.length,
                        context: {
                            parent: path,
                            parentObject: JSON.stringify(obj, null, 2).substring(0, 500)
                        }
                    });
                }
            } else if (Array.isArray(value)) {
                value.forEach((item, idx) => {
                    if (typeof item === 'string' && /^[a-f0-9]{64,}$/i.test(item)) {
                        const parentKeys = Object.keys(obj);
                        const hasHashField = parentKeys.some(k => k.toLowerCase().includes('hash'));
                        
                        if (hasHashField) {
                            results.push({
                                path: `${currentPath}[${idx}]`,
                                field: key,
                                hash: item,
                                hashLength: item.length,
                                context: {
                                    parent: path,
                                    parentObject: JSON.stringify(obj, null, 2).substring(0, 500)
                                }
                            });
                        }
                    }
                });
            }
        }
        
        // Recursively search nested objects
        findHashes(obj[key], currentPath, results);
    });

    return results;
}

// Search for hashes
console.log('Searching for encrypted hashes...\n');
const hashes = findHashes(webformData);

if (hashes.length === 0) {
    console.log('❌ No encrypted hashes found in the webform.');
    console.log('\nTrying alternative search patterns...\n');
    
    // Try searching for long hex strings in workflow rules
    function findHashesInWorkflows(obj, path = '', results = []) {
        if (typeof obj !== 'object' || obj === null) {
            return results;
        }
        
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                findHashesInWorkflows(item, `${path}[${index}]`, results);
            });
            return results;
        }
        
        Object.keys(obj).forEach(key => {
            const currentPath = path ? `${path}.${key}` : key;
            const value = obj[key];
            
            // Look for long hex strings (SHA-512 is 128 hex chars)
            if (typeof value === 'string' && /^[a-f0-9]{100,}$/i.test(value)) {
                results.push({
                    path: currentPath,
                    field: key,
                    hash: value,
                    hashLength: value.length,
                    preview: value.substring(0, 32) + '...' + value.substring(value.length - 8)
                });
            } else if (Array.isArray(value)) {
                value.forEach((item, idx) => {
                    if (typeof item === 'string' && /^[a-f0-9]{100,}$/i.test(item)) {
                        results.push({
                            path: `${currentPath}[${idx}]`,
                            field: key,
                            hash: item,
                            hashLength: item.length,
                            preview: item.substring(0, 32) + '...' + item.substring(item.length - 8)
                        });
                    }
                });
            }
            
            findHashesInWorkflows(value, currentPath, results);
        });
        
        return results;
    }
    
    const allHashes = findHashesInWorkflows(webformData);
    console.log(`Found ${allHashes.length} potential hash strings:\n`);
    
    // Group by length (SHA-512 should be 128 chars)
    const byLength = {};
    allHashes.forEach(h => {
        const len = h.hashLength;
        if (!byLength[len]) byLength[len] = [];
        byLength[len].push(h);
    });
    
    Object.keys(byLength).sort((a, b) => b - a).forEach(len => {
        console.log(`\n📏 Length ${len} (${byLength[len].length} found):`);
        byLength[len].slice(0, 5).forEach((h, idx) => {
            console.log(`\n  ${idx + 1}. Path: ${h.path}`);
            console.log(`     Field: ${h.field}`);
            console.log(`     Hash: ${h.preview || h.hash.substring(0, 40) + '...'}`);
            console.log(`     Full: ${h.hash}`);
        });
        if (byLength[len].length > 5) {
            console.log(`     ... and ${byLength[len].length - 5} more`);
        }
    });
    
    // Show SHA-512 hashes (128 chars) specifically
    const sha512Hashes = allHashes.filter(h => h.hashLength === 128);
    if (sha512Hashes.length > 0) {
        console.log(`\n\n✅ Found ${sha512Hashes.length} SHA-512 hashes (128 characters):\n`);
        sha512Hashes.slice(0, 10).forEach((h, idx) => {
            console.log(`\n${idx + 1}. ${h.field} at ${h.path}`);
            console.log(`   ${h.hash}`);
        });
        
        // Save to file
        const hashList = sha512Hashes.map(h => ({
            path: h.path,
            field: h.field,
            hash: h.hash
        }));
        
        fs.writeFileSync('extracted-hashes.json', JSON.stringify(hashList, null, 2));
        console.log(`\n💾 Saved ${sha512Hashes.length} hashes to extracted-hashes.json`);
    }
} else {
    console.log(`✅ Found ${hashes.length} encrypted hashes:\n`);
    hashes.forEach((h, idx) => {
        console.log(`${idx + 1}. ${h.field} at ${h.path}`);
        console.log(`   Hash (${h.hashLength} chars): ${h.hash}`);
        console.log(`   Context: ${h.context.parent || 'root'}\n`);
    });
    
    // Save to file
    fs.writeFileSync('extracted-hashes.json', JSON.stringify(hashes, null, 2));
    console.log(`\n💾 Saved ${hashes.length} hashes to extracted-hashes.json`);
}




