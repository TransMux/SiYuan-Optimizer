/**
 * 重复文件清理器 - 处理文件夹下的重复文件检测和清理
 */

import {
    readDir,
    listDocsByPath,
    removeDoc,
    lsNotebooks,
    exportMdContent,
    sql,
    getFileBlob,
    pushMsg,
    pushErrMsg
} from './api';
import { showMessage } from 'siyuan';

export interface FileInfo {
    name: string;
    path: string;
    fullPath: string;
    size: number;
    updated: number;
    isDir: boolean;
    hash?: string;
    content?: string;
    notebook?: string;
}

export interface DuplicateFileGroup {
    name: string;
    files: FileInfo[];
    duplicateType: 'name' | 'content' | 'hash';
    totalSize: number;
}

export interface CleanupOptions {
    /** 检测重复类型 */
    duplicateType: 'name' | 'content' | 'hash';
    /** 保留策略：最新文件 | 最旧文件 | 最大文件 | 最小文件 */
    keepStrategy: 'newest' | 'oldest' | 'largest' | 'smallest';
    /** 是否递归子文件夹 */
    recursive: boolean;
    /** 文件大小过滤器（字节），小于此大小的文件会被忽略 */
    minFileSize?: number;
    /** 忽略的文件扩展名 */
    ignoreExtensions?: string[];
    /** 是否在删除前进行确认 */
    confirmBeforeDelete: boolean;
}

export class DuplicateFileCleaner {
    private notebooks: any[] = [];

    /**
     * 初始化，获取所有笔记本信息
     */
    async initialize(): Promise<void> {
        try {
            const result = await lsNotebooks();
            this.notebooks = result.notebooks || [];
        } catch (error) {
            console.error('Failed to initialize notebooks:', error);
            throw error;
        }
    }

    /**
     * 扫描指定文件夹下的重复文件
     * @param notebook 笔记本ID
     * @param folderPath 文件夹路径
     * @param options 清理选项
     */
    async scanDuplicateFiles(
        notebook: string, 
        folderPath: string, 
        options: CleanupOptions
    ): Promise<DuplicateFileGroup[]> {
        try {
            await pushMsg(`开始扫描文件夹: ${folderPath}`, 3000);
            
            const allFiles = await this.getAllFiles(notebook, folderPath, options.recursive);
            
            // 过滤文件
            const filteredFiles = this.filterFiles(allFiles, options);
            
            await pushMsg(`找到 ${filteredFiles.length} 个文件，正在检测重复...`, 3000);
            
            // 根据选择的重复类型进行检测
            let duplicateGroups: DuplicateFileGroup[] = [];
            
            switch (options.duplicateType) {
                case 'name':
                    duplicateGroups = await this.findDuplicatesByName(filteredFiles);
                    break;
                case 'content':
                    duplicateGroups = await this.findDuplicatesByContent(filteredFiles);
                    break;
                case 'hash':
                    duplicateGroups = await this.findDuplicatesByHash(filteredFiles);
                    break;
            }
            
            await pushMsg(`检测完成，找到 ${duplicateGroups.length} 组重复文件`, 5000);
            
            return duplicateGroups;
        } catch (error) {
            console.error('Error scanning duplicate files:', error);
            await pushErrMsg(`扫描失败: ${error.message}`, 7000);
            throw error;
        }
    }

    /**
     * 清理重复文件
     * @param duplicateGroups 重复文件组
     * @param options 清理选项
     */
    async cleanupDuplicateFiles(
        duplicateGroups: DuplicateFileGroup[], 
        options: CleanupOptions
    ): Promise<number> {
        let deletedCount = 0;
        
        try {
            for (const group of duplicateGroups) {
                if (group.files.length <= 1) continue;
                
                // 确定要保留的文件
                const fileToKeep = this.selectFileToKeep(group.files, options.keepStrategy);
                const filesToDelete = group.files.filter(f => f !== fileToKeep);
                
                if (options.confirmBeforeDelete) {
                    // 这里可以添加确认对话框的逻辑
                    // 暂时跳过确认，直接删除
                }
                
                // 删除重复文件
                for (const file of filesToDelete) {
                    try {
                        // 使用 removeDoc API 删除文档
                        if (file.notebook) {
                            await removeDoc(file.notebook, file.path);
                            deletedCount++;
                            await pushMsg(`已删除: ${file.name}`, 2000);
                        } else {
                            console.warn(`No notebook specified for file: ${file.name}`);
                        }
                    } catch (deleteError) {
                        console.error(`Failed to delete file ${file.fullPath}:`, deleteError);
                        await pushErrMsg(`删除失败: ${file.name}`, 3000);
                    }
                }
            }
            
            await pushMsg(`清理完成，共删除 ${deletedCount} 个重复文件`, 5000);
            return deletedCount;
            
        } catch (error) {
            console.error('Error cleaning up duplicate files:', error);
            await pushErrMsg(`清理失败: ${error.message}`, 7000);
            throw error;
        }
    }

    /**
     * 递归获取所有文件
     */
    private async getAllFiles(
        notebook: string, 
        folderPath: string, 
        recursive: boolean
    ): Promise<FileInfo[]> {
        const allFiles: FileInfo[] = [];
        
        try {
            // 首先尝试获取文档列表
            try {
                const docResult = await listDocsByPath(notebook, folderPath);
                if (docResult && docResult.files) {
                    for (const item of docResult.files) {
                        if (item.subFileCount === 0) {
                            allFiles.push({
                                name: item.name,
                                path: item.path, // 这是文档的完整路径，如 /20250827235836-921okcz/20250831140053-c2cbvvf.sy
                                fullPath: item.path,
                                size: 0, // 将在后续计算
                                updated: item.updated || 0,
                                isDir: false,
                                notebook: notebook
                            });
                        }
                        if (recursive && item.subFileCount > 0) {
                            // 递归处理子文件夹
                            const subFiles = await this.getAllFiles(notebook, item.path, recursive);
                            allFiles.push(...subFiles);
                        }
                    }
                }
            } catch (docError) {
                console.warn('listDocsByPath failed, trying readDir:', docError);
            }
            
            // 然后尝试读取文件系统
            // try {
            //     const fileEntries = await readDir(folderPath);
            //     for (const entry of fileEntries) {
            //         if (!entry.isDir) {
            //             const fullPath = `${folderPath}/${entry.name}`;
            //             allFiles.push({
            //                 name: entry.name,
            //                 path: folderPath,
            //                 fullPath: fullPath,
            //                 size: 0, // 将在后续计算
            //                 updated: entry.updated,
            //                 isDir: false,
            //                 notebook: notebook
            //             });
            //         } else if (recursive) {
            //             // 递归处理子文件夹
            //             const subPath = `${folderPath}/${entry.name}`;
            //             const subFiles = await this.getAllFiles(notebook, subPath, recursive);
            //             allFiles.push(...subFiles);
            //         }
            //     }
            // } catch (fileError) {
            //     console.warn('readDir failed:', fileError);
            // }
            
        } catch (error) {
            console.error(`Error getting files from ${folderPath}:`, error);
        }
        
        return allFiles;
    }

    /**
     * 过滤文件
     */
    private filterFiles(files: FileInfo[], options: CleanupOptions): FileInfo[] {
        return files.filter(file => {
            // 跳过目录
            if (file.isDir) return false;
            
            // 检查文件大小
            if (options.minFileSize && file.size < options.minFileSize) {
                return false;
            }
            
            // 检查文件扩展名
            if (options.ignoreExtensions && options.ignoreExtensions.length > 0) {
                const ext = file.name.split('.').pop()?.toLowerCase();
                if (ext && options.ignoreExtensions.includes(ext)) {
                    return false;
                }
            }
            
            return true;
        });
    }

    /**
     * 按文件名查找重复文件
     */
    private async findDuplicatesByName(files: FileInfo[]): Promise<DuplicateFileGroup[]> {
        const nameGroups = new Map<string, FileInfo[]>();
        
        files.forEach(file => {
            const name = file.name.toLowerCase(); // 忽略大小写
            if (!nameGroups.has(name)) {
                nameGroups.set(name, []);
            }
            nameGroups.get(name)!.push(file);
        });
        
        const duplicateGroups: DuplicateFileGroup[] = [];
        nameGroups.forEach((groupFiles, name) => {
            if (groupFiles.length > 1) {
                const totalSize = groupFiles.reduce((sum, file) => sum + file.size, 0);
                duplicateGroups.push({
                    name: name,
                    files: groupFiles,
                    duplicateType: 'name',
                    totalSize: totalSize
                });
            }
        });
        
        return duplicateGroups;
    }

    /**
     * 按文件内容查找重复文件
     */
    private async findDuplicatesByContent(files: FileInfo[]): Promise<DuplicateFileGroup[]> {
        const contentGroups = new Map<string, FileInfo[]>();
        
        for (const file of files) {
            try {
                const content = await this.getFileContent(file);
                file.content = content;
                
                if (!contentGroups.has(content)) {
                    contentGroups.set(content, []);
                }
                contentGroups.get(content)!.push(file);
            } catch (error) {
                console.warn(`Failed to get content for ${file.fullPath}:`, error);
            }
        }
        
        const duplicateGroups: DuplicateFileGroup[] = [];
        contentGroups.forEach((groupFiles, content) => {
            if (groupFiles.length > 1) {
                const totalSize = groupFiles.reduce((sum, file) => sum + file.size, 0);
                duplicateGroups.push({
                    name: `内容相同的文件组 (${groupFiles[0].name})`,
                    files: groupFiles,
                    duplicateType: 'content',
                    totalSize: totalSize
                });
            }
        });
        
        return duplicateGroups;
    }

    /**
     * 按文件哈希查找重复文件
     */
    private async findDuplicatesByHash(files: FileInfo[]): Promise<DuplicateFileGroup[]> {
        const hashGroups = new Map<string, FileInfo[]>();
        
        for (const file of files) {
            try {
                const hash = await this.getFileHash(file);
                file.hash = hash;
                
                if (!hashGroups.has(hash)) {
                    hashGroups.set(hash, []);
                }
                hashGroups.get(hash)!.push(file);
            } catch (error) {
                console.warn(`Failed to get hash for ${file.fullPath}:`, error);
            }
        }
        
        const duplicateGroups: DuplicateFileGroup[] = [];
        hashGroups.forEach((groupFiles, hash) => {
            if (groupFiles.length > 1) {
                const totalSize = groupFiles.reduce((sum, file) => sum + file.size, 0);
                duplicateGroups.push({
                    name: `内容哈希相同的文件组 (${groupFiles[0].name})`,
                    files: groupFiles,
                    duplicateType: 'hash',
                    totalSize: totalSize
                });
            }
        });
        
        return duplicateGroups;
    }

    /**
     * 获取文件内容
     */
    private async getFileContent(file: FileInfo): Promise<string> {
        try {
            if (file.notebook && file.fullPath.endsWith('.sy')) {
                // 如果是思源文档，使用文档ID获取内容
                const docId = file.name.replace('.sy', '');
                const result = await exportMdContent(docId);
                return result.content || '';
            } else {
                // 对于其他文件，尝试获取文件内容
                const blob = await getFileBlob(file.fullPath);
                if (blob) {
                    return await blob.text();
                }
            }
        } catch (error) {
            console.warn(`Failed to get content for ${file.fullPath}:`, error);
        }
        return '';
    }

    /**
     * 计算文件哈希
     */
    private async getFileHash(file: FileInfo): Promise<string> {
        try {
            const content = await this.getFileContent(file);
            // 使用简单的哈希算法 (CRC32 或者更简单的字符串哈希)
            return await this.simpleHash(content);
        } catch (error) {
            console.warn(`Failed to calculate hash for ${file.fullPath}:`, error);
            return '';
        }
    }

    /**
     * 简单哈希算法
     */
    private async simpleHash(str: string): Promise<string> {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(16);
    }

    /**
     * 根据保留策略选择要保留的文件
     */
    private selectFileToKeep(files: FileInfo[], strategy: CleanupOptions['keepStrategy']): FileInfo {
        switch (strategy) {
            case 'newest':
                return files.reduce((newest, current) => 
                    current.updated > newest.updated ? current : newest
                );
            case 'oldest':
                return files.reduce((oldest, current) => 
                    current.updated < oldest.updated ? current : oldest
                );
            case 'largest':
                return files.reduce((largest, current) => 
                    current.size > largest.size ? current : largest
                );
            case 'smallest':
                return files.reduce((smallest, current) => 
                    current.size < smallest.size ? current : smallest
                );
            default:
                return files[0]; // 默认保留第一个
        }
    }

    /**
     * 获取扫描统计信息
     */
    async getScanStatistics(
        notebook: string, 
        folderPath: string, 
        options: CleanupOptions
    ): Promise<{
        totalFiles: number;
        totalSize: number;
        duplicateGroups: number;
        duplicateFiles: number;
        potentialSavings: number;
    }> {
        try {
            const duplicateGroups = await this.scanDuplicateFiles(notebook, folderPath, options);
            
            const totalDuplicateFiles = duplicateGroups.reduce(
                (sum, group) => sum + (group.files.length - 1), 0
            );
            
            const potentialSavings = duplicateGroups.reduce((sum, group) => {
                // 假设保留最大的文件，其他都可以删除
                const filesToDelete = group.files.slice().sort((a, b) => b.size - a.size).slice(1);
                return sum + filesToDelete.reduce((groupSum, file) => groupSum + file.size, 0);
            }, 0);
            
            const allFiles = await this.getAllFiles(notebook, folderPath, options.recursive);
            const totalSize = allFiles.reduce((sum, file) => sum + file.size, 0);
            
            return {
                totalFiles: allFiles.length,
                totalSize: totalSize,
                duplicateGroups: duplicateGroups.length,
                duplicateFiles: totalDuplicateFiles,
                potentialSavings: potentialSavings
            };
        } catch (error) {
            console.error('Error getting scan statistics:', error);
            throw error;
        }
    }
}
