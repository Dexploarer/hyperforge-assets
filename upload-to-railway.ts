#!/usr/bin/env bun
/**
 * Bulk upload script to sync local assets to Railway CDN
 * Usage: bun upload-to-railway.ts
 */

import { readdir, stat } from 'fs/promises';
import { join } from 'path';

const CDN_URL = 'https://hyperforge-cdn.up.railway.app';
const API_KEY = process.env.CDN_API_KEY || process.env.API_KEY;

if (!API_KEY) {
  console.error('❌ Error: CDN_API_KEY or API_KEY environment variable not set');
  console.error('Set it with: export CDN_API_KEY=your-api-key');
  process.exit(1);
}

const DIRECTORIES = ['models', 'emotes', 'music'];

async function getAllFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await getAllFiles(fullPath, baseDir));
    } else {
      // Get relative path from base directory
      const relativePath = fullPath.replace(baseDir + '/', '');
      files.push(relativePath);
    }
  }

  return files;
}

async function uploadFile(filePath: string, directory: string) {
  const fullPath = join(process.cwd(), directory, filePath);
  const file = Bun.file(fullPath);

  // Read file as buffer first, then create File with the relative path
  // filePath is already relative to the directory (e.g., "tree/tree.glb" or "file.glb")
  const buffer = await file.arrayBuffer();
  const fileWithCorrectName = new File([buffer], filePath, { type: file.type });

  const formData = new FormData();
  formData.append('files', fileWithCorrectName);
  formData.append('directory', directory);

  const response = await fetch(`${CDN_URL}/api/upload`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${error}`);
  }

  return await response.json();
}

async function main() {
  console.log('🚀 Starting bulk upload to Railway CDN...\n');

  let totalFiles = 0;
  let uploadedFiles = 0;
  let failedFiles = 0;

  for (const directory of DIRECTORIES) {
    console.log(`📁 Processing ${directory}/...`);

    try {
      const dirPath = join(process.cwd(), directory);
      const files = await getAllFiles(dirPath);

      console.log(`   Found ${files.length} files`);
      totalFiles += files.length;

      for (const file of files) {
        try {
          process.stdout.write(`   Uploading ${file}...`);
          await uploadFile(file, directory);
          uploadedFiles++;
          console.log(' ✅');
        } catch (error) {
          failedFiles++;
          console.log(` ❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      console.log('');
    } catch (error) {
      console.error(`❌ Error processing ${directory}:`, error);
    }
  }

  console.log('═══════════════════════════════════════');
  console.log('📊 Upload Summary');
  console.log('═══════════════════════════════════════');
  console.log(`Total files:    ${totalFiles}`);
  console.log(`✅ Uploaded:    ${uploadedFiles}`);
  console.log(`❌ Failed:      ${failedFiles}`);
  console.log('═══════════════════════════════════════\n');

  if (failedFiles > 0) {
    console.log('⚠️  Some files failed to upload. Check the errors above.');
    process.exit(1);
  } else {
    console.log('🎉 All files uploaded successfully!');
  }
}

main().catch(console.error);
