/**
 * Test script for HashDecryptor library
 * Tests decryption of actual hashes from webform-template-6904500676217895167.json
 */

const HashDecryptor = require('./hash-decryptor.js');
const fs = require('fs');

async function testDecryption() {
    console.log('='.repeat(80));
    console.log('TESTING HASH DECRYPTOR LIBRARY');
    console.log('='.repeat(80));

    // Create decryptor instance
    const decryptor = new HashDecryptor();

    // Build lookups
    console.log('\n📦 Building lookup tables...');
    await decryptor.buildLookups();

    // Load extracted hashes
    let hashes = [];
    try {
        const hashData = JSON.parse(fs.readFileSync('extracted-hashes.json', 'utf8'));
        hashes = hashData;
        console.log(`\n📋 Loaded ${hashes.length} hashes from extracted-hashes.json`);
    } catch (err) {
        console.log('\n⚠️ Could not load extracted-hashes.json, using hardcoded hashes');
        // Use hardcoded hashes from the webform
        hashes = [
            {
                path: 'rules.REQUEST_CREATION[0].criteriaInformation.conditionGroups[0].conditions[0].value',
                field: 'value',
                hash: '2ce4459020619b5d56e2fbe4854800f43a18fb4cd2ffe979be29637e0653ade1c88c2d3daf16c207457be50d780f634641ebac1dacac2c4196b70490f085ce30'
            },
            {
                path: 'rules.REQUEST_CREATION[1].criteriaInformation.conditionGroups[0].conditions[0].value',
                field: 'value',
                hash: 'b0339a8be620a63342627417436d831ad5e63015f31538bf9a09a57e24a0b46fe4d76bd1f28a34b0d3d793b225edbf24ee0ab19664cea867a380e3323555b7aa'
            },
            {
                path: 'rules.REQUEST_CREATION[3].criteriaInformation.conditionGroups[0].conditions[0].value',
                field: 'value',
                hash: 'b09d2f7ed7c8b35c0a538d502a0c6b807e4b326bd1b4985b24b3a1bf6df8a10f931b4e6a368d80452bdbbb8162cf1ef514fdc920ba259fe00ca7970e79e21bbd'
            }
        ];
    }

    // Test decryption
    console.log('\n🔍 Testing decryption of webform hashes...\n');
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < hashes.length; i++) {
        const item = hashes[i];
        console.log(`${i + 1}. Hash from ${item.path}:`);
        console.log(`   ${item.hash.substring(0, 32)}...${item.hash.substring(item.hash.length - 8)}`);
        
        // Try decrypting as country hash
        const result = decryptor.decrypt(item.hash, 'countryHash');
        
        if (result) {
            console.log(`   ✅ DECRYPTED: ${result.originalKey} (${result.originalValue})`);
            console.log(`   Variant: "${result.hashedVariant}"`);
            successCount++;
        } else {
            console.log(`   ❌ NOT FOUND in lookup table`);
            failCount++;
        }
        console.log('');
    }

    // Summary
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Successfully decrypted: ${successCount}/${hashes.length}`);
    console.log(`❌ Failed to decrypt: ${failCount}/${hashes.length}`);
    
    const stats = decryptor.getStats();
    console.log(`\n📊 Lookup table statistics:`);
    console.log(`   Country hashes: ${stats.countryHashes}`);
    console.log(`   State hashes: ${stats.stateHashes}`);
    console.log(`   Total hashes: ${stats.totalHashes}`);

    // Test with known values to verify the library works
    console.log('\n🧪 Verifying library with known test values...\n');
    await decryptor.testDecryption('US', 'country');
    await decryptor.testDecryption('BR', 'country');
    await decryptor.testDecryption('CA', 'country');
}

// Run tests
if (require.main === module) {
    testDecryption().catch(err => {
        console.error('❌ Test failed:', err);
        process.exit(1);
    });
}

module.exports = { testDecryption };




