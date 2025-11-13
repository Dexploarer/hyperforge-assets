/**
 * File System Helper Utilities
 * Recursive file listing and path manipulation
 */

import { join, extname, relative } from "path";
import { readdirSync, statSync } from "fs";

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  modified: string;
  type: string;
}

/**
 * Recursively get all files in a directory with metadata
 */
export function getAllFiles(dir: string, fileList: FileInfo[] = []): FileInfo[] {
  try {
    const files = readdirSync(dir);
    files.forEach((file) => {
      const filePath = join(dir, file);
      try {
        const stat = statSync(filePath);
        if (stat.isDirectory()) {
          getAllFiles(filePath, fileList);
        } else {
          fileList.push({
            path: filePath,
            name: file,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            type: extname(file),
          });
        }
      } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
      }
    });
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }
  return fileList;
}

/**
 * Convert absolute paths to relative paths for API responses
 */
export function toRelativePaths(files: FileInfo[], rootDir: string): FileInfo[] {
  return files.map((file) => ({
    ...file,
    path: relative(rootDir, file.path),
  }));
}
