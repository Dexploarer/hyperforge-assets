#!/usr/bin/env bun
/**
 * Cleanup script to delete all incorrectly uploaded files from Railway CDN
 * Usage: bun cleanup-railway.ts
 */

const CDN_URL = 'https://hyperforge-cdn.up.railway.app';
const API_KEY = process.env.CDN_API_KEY || process.env.API_KEY;

if (!API_KEY) {
  console.error('❌ Error: CDN_API_KEY or API_KEY environment variable not set');
  console.error('Set it with: export CDN_API_KEY=your-api-key');
  process.exit(1);
}

async function getAllFiles() {
  const response = await fetch(`${CDN_URL}/api/files`);
  const data = await response.json();
  return data.files;
}

async function deleteFile(filePath: string) {
  const response = await fetch(`${CDN_URL}/api/delete/${encodeURIComponent(filePath)}`, {
    method: 'DELETE',
    headers: {
      'X-API-Key': API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Delete failed: ${error}`);
  }

  return await response.json();
}

async function main() {
  console.log('🗑️  Fetching all files from Railway CDN...\n');

  const files = await getAllFiles();
  console.log(`Found ${files.length} files to delete\n`);

  let deleted = 0;
  let failed = 0;

  for (const file of files) {
    try {
      process.stdout.write(`Deleting ${file.path}...`);
      await deleteFile(file.path);
      deleted++;
      console.log(' ✅');
    } catch (error) {
      failed++;
      console.log(` ❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('📊 Cleanup Summary');
  console.log('═══════════════════════════════════════');
  console.log(`✅ Deleted:    ${deleted}`);
  console.log(`❌ Failed:     ${failed}`);
  console.log('═══════════════════════════════════════\n');

  if (failed > 0) {
    console.log('⚠️  Some files failed to delete. Check the errors above.');
    process.exit(1);
  } else {
    console.log('🎉 All files deleted successfully!');
  }
}

main().catch(console.error);
