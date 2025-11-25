/**
 * Example usage of the HashDecryptor library
 * 
 * This demonstrates how to use the hash decryptor to reverse lookup
 * SHA-512 hashes found in OneTrust webforms.
 */

// Import the library (adjust path as needed)
const HashDecryptor = require('./hash-decryptor.js');

async function example() {
    console.log('='.repeat(80));
    console.log('HASH DECRYPTOR LIBRARY - EXAMPLE USAGE');
    console.log('='.repeat(80));

    // Create a new decryptor instance
    const decryptor = new HashDecryptor();

    // Build all lookup tables
    console.log('\n📦 Step 1: Building lookup tables...\n');
    await decryptor.buildLookups();

    // Show statistics
    console.log('\n📊 Statistics:');
    const stats = decryptor.getStats();
    console.log(JSON.stringify(stats, null, 2));

    // Test with known values
    console.log('\n🧪 Step 2: Testing with known values...\n');
    await decryptor.testDecryption('US', 'country');
    await decryptor.testDecryption('BR', 'country');
    await decryptor.testDecryption('California', 'state');

    // Example hashes from webform-template-6904500676217895167.json
    console.log('\n🔍 Step 3: Decrypting hashes from webform...\n');
    
    // These are actual hashes from the webform file
    const webformHashes = [
        {
            hash: '2ce4459020619b5d56e2fbe4854800f43a18fb4cd2ffe979be29637e0653ade1c88c2d3daf16c207457be50d780f634641ebac1dacac2c4196b70490f085ce30',
            field: 'countryHash',
            rule: 'CCPA Rule'
        },
        {
            hash: 'b0339a8be620a63342627417436d831ad5e63015f31538bf9a09a57e24a0b46fe4d76bd1f28a34b0d3d793b225edbf24ee0ab19664cea867a380e3323555b7aa',
            field: 'countryHash',
            rule: 'LGPD Rule'
        },
        {
            hash: 'b09d2f7ed7c8b35c0a538d502a0c6b807e4b326bd1b4985b24b3a1bf6df8a10f931b4e6a368d80452bdbbb8162cf1ef514fdc920ba259fe00ca7970e79e21bbd',
            field: 'countryHash',
            rule: 'REJECT Rule'
        }
    ];

    for (const item of webformHashes) {
        console.log(`\n📝 Hash from "${item.rule}" (${item.field}):`);
        console.log(`   ${item.hash.substring(0, 32)}...`);
        
        const result = decryptor.decrypt(item.hash, item.field);
        if (result) {
            console.log(`   ✅ DECRYPTED: ${result.originalKey} (${result.originalValue})`);
            console.log(`   Variant used: "${result.hashedVariant}"`);
        } else {
            console.log(`   ❌ NOT FOUND: Hash not in lookup table`);
        }
    }

    // Demonstrate batch decryption
    console.log('\n📦 Step 4: Batch decryption...\n');
    const hashes = webformHashes.map(h => h.hash);
    const results = decryptor.decryptMultiple(hashes, 'countryHash');
    
    console.log(`Decrypted ${results.filter(r => r !== null).length} of ${hashes.length} hashes:`);
    results.forEach((result, idx) => {
        if (result) {
            console.log(`   ${idx + 1}. ${result.originalKey} (${result.originalValue})`);
        } else {
            console.log(`   ${idx + 1}. [NOT FOUND]`);
        }
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Example completed!');
    console.log('='.repeat(80));
}

// Run the example
if (require.main === module) {
    example().catch(console.error);
}

module.exports = { example };



