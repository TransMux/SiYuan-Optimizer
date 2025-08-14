/**
 * 文档优化器 - 处理文档合并和删除逻辑
 */

import {
    findDuplicateDocuments,
    findEmptyDocuments,
    transferAllReferences,
    mergeDocumentContent,
    removeDoc,
    sql,
    getDocumentReferences
} from './api';
import { showMessage } from 'siyuan';

export interface DocumentInfo {
    id: string;
    title: string;
    hpath: string;
    box: string;
    path: string;
    updated: number;
    size: number; // 保留字段（兼容），不再展示
    // 新增统计字段
    refCount?: number;     // 反链个数
    childCount?: number;   // 子文档数量
    bytes?: number;        // 文档内容字节大小（按 markdown 长度汇总）
}

export interface DuplicateGroup {
    title: string;
    documents: DocumentInfo[];
    count: number;
}

export class DocumentOptimizer {

    /**
     * 获取所有同名文档组
     */
    async getDuplicateDocumentGroups(): Promise<DuplicateGroup[]> {
        try {
            const results = await findDuplicateDocuments();
            const groups: DuplicateGroup[] = [];

            for (const result of results) {
                const ids = result.ids.split(',');
                const hpaths = result.hpaths.split(',');
                const boxes = result.boxes.split(',');
                const paths = result.paths.split(',');
                const updateds = result.updateds.split(',');
                const sizes = result.sizes.split(',');

                const documents: DocumentInfo[] = [];
                for (let i = 0; i < ids.length; i++) {
                    documents.push({
                        id: ids[i],
                        title: result.content,
                        hpath: hpaths[i],
                        box: boxes[i],
                        path: paths[i],
                        updated: parseInt(updateds[i]),
                        size: parseInt(sizes[i])
                    });
                }

                groups.push({
                    title: result.content,
                    documents: documents,
                    count: result.count
                });
            }

            // 填充反链统计（取消大小与子文档计算）
            for (const group of groups) {
                for (const doc of group.documents) {
                    try {
                        const refs = await getDocumentReferences(doc.id);
                        doc.refCount = Array.isArray(refs) ? refs.length : 0;
                    } catch {}
                }
            }

            return groups;

        } catch (error) {
            console.error('Error getting duplicate document groups:', error);
            throw error;
        }
    }

    /**
     * 获取所有空文档
     */
    async getEmptyDocuments(): Promise<DocumentInfo[]> {
        try {
            const results = await findEmptyDocuments();
            return results.map(result => ({
                id: result.id,
                title: result.content,
                hpath: result.hpath,
                box: result.box,
                path: result.path,
                updated: result.updated,
                size: 0
            }));
        } catch (error) {
            console.error('Error getting empty documents:', error);
            throw error;
        }
    }

    /**
     * 合并文档
     * @param mainDocId 主文档ID
     * @param sourceDocIds 要合并的源文档ID列表
     */
    async mergeDocuments(mainDocId: string, sourceDocIds: string[]): Promise<void> {
        try {
            for (const sourceDocId of sourceDocIds) {
                if (sourceDocId === mainDocId) continue;

                // 1. 转移引用（后端安全处理 refs 表）
                await transferAllReferences(sourceDocId, mainDocId);

                // 2. 合并内容（导出 Markdown 后追加）
                await mergeDocumentContent(mainDocId, sourceDocId);

                // 3. 删除源文档
                const sourceDoc = await this.getDocumentInfo(sourceDocId);
                if (sourceDoc) {
                    await removeDoc(sourceDoc.box, sourceDoc.path);
                }
            }

            showMessage(`成功合并 ${sourceDocIds.length} 个文档`);
        } catch (error) {
            console.error('Error merging documents:', error);
            showMessage(`合并失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 删除空文档
     * @param docIds 要删除的文档ID列表
     */
    async deleteEmptyDocuments(docIds: string[]): Promise<void> {
        try {
            let deletedCount = 0;

            for (const docId of docIds) {
                const doc = await this.getDocumentInfo(docId);
                if (doc) {
                    await removeDoc(doc.box, doc.path);
                    deletedCount++;
                }
            }

            showMessage(`成功删除 ${deletedCount} 个空文档`);
        } catch (error) {
            console.error('Error deleting empty documents:', error);
            showMessage(`删除失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 获取文档信息
     * @param docId 文档ID
     */
    private async getDocumentInfo(docId: string): Promise<DocumentInfo | null> {
        try {
            const results = await sql(`SELECT id, content, hpath, box, path, updated, length(content) as size
                                      FROM blocks
                                      WHERE id = '${docId}' AND type = 'd'`);

            if (results.length > 0) {
                const result = results[0];
                return {
                    id: result.id,
                    title: result.content,
                    hpath: result.hpath,
                    box: result.box,
                    path: result.path,
                    updated: result.updated,
                    size: result.size
                };
            }

            return null;
        } catch (error) {
            console.error('Error getting document info:', error);
            return null;
        }
    }

    /**
     * 验证文档是否可以安全删除
     * @param docId 文档ID
     */
    async canSafelyDelete(docId: string): Promise<boolean> {
        try {
            // 检查是否有引用
            const references = await getDocumentReferences(docId);
            return references.length === 0;
        } catch (error) {
            console.error('Error checking if document can be safely deleted:', error);
            return false;
        }
    }

    /**
     * 获取文档的引用统计
     * @param docId 文档ID
     */
    async getDocumentReferenceCount(docId: string): Promise<number> {
        try {
            const references = await getDocumentReferences(docId);
            return references.length;
        } catch (error) {
            console.error('Error getting document reference count:', error);
            return 0;
        }
    }
}
