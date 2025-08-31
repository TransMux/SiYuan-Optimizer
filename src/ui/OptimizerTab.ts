/**
 * 优化器自定义页签组件
 */

import { DocumentOptimizer, DuplicateGroup, DocumentInfo } from '../optimizer';
import { DuplicateFileGroup, CleanupOptions } from '../duplicate-cleaner';
import { showMessage } from 'siyuan';
import { confirmDialog } from '../libs/dialog';

export class OptimizerTab {
    private element: HTMLElement;
    private optimizer: DocumentOptimizer;
    private i18n: any;
    private defaultTab: 'merge' | 'delete' | 'cleanup';
    private app: any;
    // 缓存与状态
    private duplicateGroupsCache: DuplicateGroup[] = [];
    private emptyDocsCache: DocumentInfo[] = [];
    private duplicateFilesCache: DuplicateFileGroup[] = [];
    private excludeUntitled: boolean = false;
    private hideBacklinkedInEmpty: boolean = false;
    private previewEditors: Map<string, any> = new Map();
    
    // 文件清理相关状态
    private currentNotebook: string = '';
    private currentPath: string = '';
    private cleanupOptions: CleanupOptions = {
        duplicateType: 'name',
        keepStrategy: 'newest',
        recursive: true,
        minFileSize: 0,
        ignoreExtensions: [],
        confirmBeforeDelete: true
    };

    constructor(element: HTMLElement, i18n: any, defaultTab: 'merge' | 'delete' | 'cleanup' = 'merge', app?: any) {
        this.element = element;
        this.optimizer = new DocumentOptimizer();
        this.i18n = i18n;
        this.defaultTab = defaultTab;
        this.app = app;
        this.init();
    }

    private async init() {
        this.element.innerHTML = this.getMainHTML();
        await this.optimizer.initialize();
        this.bindEvents();
    }

    private getMainHTML(): string {
        return `
            <div class="optimizer-container">
                <div class="optimizer-header">
                    <h2>${this.defaultTab === 'delete' ? this.i18n.deleteEmptyDocs : 
                         this.defaultTab === 'cleanup' ? '清理重复文件' : this.i18n.mergeDuplicateDocs}</h2>
                    <div class="optimizer-actions">
                        <button class="b3-button b3-button--outline" id="refreshBtn">
                            <svg><use xlink:href="#iconRefresh"></use></svg>
                            ${this.i18n.refresh}
                        </button>
                        <button class="b3-button b3-button--outline" id="closeBtn">
                            <svg><use xlink:href="#iconClose"></use></svg>
                            ${this.i18n.close}
                        </button>
                    </div>
                </div>

                <div class="optimizer-tabs">
                    <div class="optimizer-tab-content">
                        <div class="optimizer-tab-panel" id="mergePanel">
                            <div class="optimizer-loading" id="mergeLoading">
                                <svg class="fn__rotate"><use xlink:href="#iconLoading"></use></svg>
                                ${this.i18n.searchingDocs}
                            </div>
                            <div class="optimizer-content" id="mergeContent" style="display: none;"></div>
                        </div>

                        <div class="optimizer-tab-panel" id="deletePanel" style="display: none;">
                            <div class="optimizer-loading" id="deleteLoading">
                                <svg class="fn__rotate"><use xlink:href="#iconLoading"></use></svg>
                                ${this.i18n.searchingDocs}
                            </div>
                            <div class="optimizer-content" id="deleteContent" style="display: none;"></div>
                        </div>

                        <div class="optimizer-tab-panel" id="cleanupPanel" style="display: none;">
                            <div class="optimizer-cleanup-settings" id="cleanupSettings">
                                <div class="b3-form__group">
                                    <label class="b3-label">
                                        笔记本选择
                                        <select class="b3-select fn__size200" id="notebookSelect">
                                            <option value="">请选择笔记本</option>
                                        </select>
                                    </label>
                                </div>
                                <div class="b3-form__group">
                                    <label class="b3-label">
                                        文件夹路径
                                        <input class="b3-text-field fn__size200" id="folderPath" placeholder="/path/to/folder" value="/">
                                    </label>
                                </div>
                                <div class="b3-form__group">
                                    <label class="b3-label">
                                        重复检测类型
                                        <select class="b3-select fn__size200" id="duplicateType">
                                            <option value="name">文件名</option>
                                            <option value="content">文件内容</option>
                                            <option value="hash">文件哈希</option>
                                        </select>
                                    </label>
                                </div>
                                <div class="b3-form__group">
                                    <label class="b3-label">
                                        保留策略
                                        <select class="b3-select fn__size200" id="keepStrategy">
                                            <option value="newest">最新文件</option>
                                            <option value="oldest">最旧文件</option>
                                            <option value="largest">最大文件</option>
                                            <option value="smallest">最小文件</option>
                                        </select>
                                    </label>
                                </div>
                                <div class="b3-form__group">
                                    <label class="b3-label">
                                        <input type="checkbox" class="b3-switch" id="recursive" checked>
                                        递归子文件夹
                                    </label>
                                </div>
                                <div class="b3-form__group">
                                    <label class="b3-label">
                                        <input type="checkbox" class="b3-switch" id="confirmBeforeDelete" checked>
                                        删除前确认
                                    </label>
                                </div>
                                <div class="b3-form__group">
                                    <button class="b3-button b3-button--primary" id="scanFilesBtn">
                                        <svg><use xlink:href="#iconSearch"></use></svg>
                                        扫描重复文件
                                    </button>
                                </div>
                            </div>
                            <div class="optimizer-loading" id="cleanupLoading" style="display: none;">
                                <svg class="fn__rotate"><use xlink:href="#iconLoading"></use></svg>
                                正在扫描文件...
                            </div>
                            <div class="optimizer-content" id="cleanupContent" style="display: none;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    private bindEvents() {


        // 刷新按钮
        this.element.querySelector('#refreshBtn')?.addEventListener('click', () => {
            this.refresh();
        });

        // 关闭按钮
        this.element.querySelector('#closeBtn')?.addEventListener('click', () => {
            this.close();
        });

        // 根据默认标签初始化（无 Tab 栏，切换对应面板可见性后再加载一次）
        const mergePanel = this.element.querySelector('#mergePanel') as HTMLElement;
        const deletePanel = this.element.querySelector('#deletePanel') as HTMLElement;
        const cleanupPanel = this.element.querySelector('#cleanupPanel') as HTMLElement;
        
        if (this.defaultTab === 'delete') {
            if (mergePanel) mergePanel.style.display = 'none';
            if (deletePanel) deletePanel.style.display = 'block';
            if (cleanupPanel) cleanupPanel.style.display = 'none';
            this.loadDeletePanel();
        } else if (this.defaultTab === 'cleanup') {
            if (mergePanel) mergePanel.style.display = 'none';
            if (deletePanel) deletePanel.style.display = 'none';
            if (cleanupPanel) cleanupPanel.style.display = 'block';
            this.loadCleanupPanel();
        } else {
            if (mergePanel) mergePanel.style.display = 'block';
            if (deletePanel) deletePanel.style.display = 'none';
            if (cleanupPanel) cleanupPanel.style.display = 'none';
            this.loadMergePanel();
        }
        
        // 绑定文件清理相关事件
        this.bindCleanupEvents();
    }



    private async loadMergePanel() {
        const loadingEl = this.element.querySelector('#mergeLoading') as HTMLElement;
        const contentEl = this.element.querySelector('#mergeContent') as HTMLElement;

        loadingEl.style.display = 'block';
        contentEl.style.display = 'none';

        try {
            // 进入前销毁所有预览，避免泄漏
            this.destroyAllPreviews();
            const duplicateGroups = await this.optimizer.getDuplicateDocumentGroups();
            this.duplicateGroupsCache = duplicateGroups;

            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';

            const displayGroups = this.applyMergeFilters(this.duplicateGroupsCache);
            if (displayGroups.length === 0) {
                contentEl.innerHTML = `
                    <div class="optimizer-empty">
                        <svg><use xlink:href="#iconInfo"></use></svg>
                        <p>${this.i18n.noDuplicateDocsFound}</p>
                    </div>
                `;
            } else {
                contentEl.innerHTML = this.getMergeContentHTML(displayGroups);
                this.bindMergeEvents();
            }
        } catch (error) {
            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';
            contentEl.innerHTML = `
                <div class="optimizer-error">
                    <svg><use xlink:href="#iconCloseRound"></use></svg>
                    <p>${this.i18n.mergeError.replace('${error}', error.message)}</p>
                </div>
            `;
        }
    }

    private async loadDeletePanel() {
        const loadingEl = this.element.querySelector('#deleteLoading') as HTMLElement;
        const contentEl = this.element.querySelector('#deleteContent') as HTMLElement;

        loadingEl.style.display = 'block';
        contentEl.style.display = 'none';

        try {
            // 进入前销毁所有预览，避免泄漏
            this.destroyAllPreviews();
            const emptyDocs = await this.optimizer.getEmptyDocuments();
            this.emptyDocsCache = emptyDocs;

            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';

            const displayDocs = this.applyDeleteFilters(this.emptyDocsCache);
            if (displayDocs.length === 0) {
                contentEl.innerHTML = `
                    <div class="optimizer-empty">
                        <svg><use xlink:href="#iconInfo"></use></svg>
                        <p>${this.i18n.noEmptyDocsFound}</p>
                    </div>
                `;
            } else {
                contentEl.innerHTML = this.getDeleteContentHTML(displayDocs);
                this.bindDeleteEvents();
            }
        } catch (error) {
            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';
            contentEl.innerHTML = `
                <div class="optimizer-error">
                    <svg><use xlink:href="#iconCloseRound"></use></svg>
                    <p>${this.i18n.deleteError.replace('${error}', error.message)}</p>
                </div>
            `;
        }
    }

    private getMergeContentHTML(groups: DuplicateGroup[]): string {
        let html = `
            <div class="optimizer-summary">
                <p>${this.i18n.foundDuplicateDocs.replace('${count}', groups.length.toString())}</p>
                <label class="b3-form__checkbox" style="margin-left: 8px;">
                    <input type="checkbox" id="excludeUntitledToggle" ${this.excludeUntitled ? 'checked' : ''}>
                    ${this.i18n.excludeUntitled || '排除未命名文档'}
                </label>
            </div>
        `;

        groups.forEach((group, groupIndex) => {
            html += `
                <div class="optimizer-group" data-group="${groupIndex}">
                    <div class="optimizer-group-header">
                        <h3>${group.title}</h3>
                        <span class="optimizer-count">${group.count} ${this.i18n.docTitle}</span>
                    </div>
                    <div class="optimizer-group-content">
                        ${group.documents.map((doc, docIndex) => `
                            <div class="optimizer-doc-item" data-doc-id="${doc.id}">
                                <div class="optimizer-doc-body">
                                    <span class="optimizer-doc-info">
                                        <a href="#" class="optimizer-doc-title" data-open-id="${doc.id}" title="${doc.hpath}">${doc.title}</a>
                                        <span class="optimizer-doc-path">${doc.hpath}</span>
                                        <span class="optimizer-doc-meta">
                                            ${this.formatDate(doc.updated)} | 反链: ${doc.refCount ?? '-'}
                                        </span>
                                    </span>
                                </div>
                                <div class="optimizer-doc-actions">
                                    <button class="b3-button b3-button--primary fn__none" data-action="confirmMerge" data-group="${groupIndex}" data-doc="${docIndex}">
                                        ${this.i18n.mergeSelected}
                                    </button>
                                    <button class="b3-button" data-action="setMain" data-group="${groupIndex}" data-doc="${docIndex}">
                                        ${this.i18n.setAsMainDoc}
                                    </button>
                                    <button class="b3-button" data-action="previewDoc" data-doc-id="${doc.id}" style="display: none;">
                                        ${this.i18n.preview || '预览'}
                                    </button>
                                    <button class="b3-button b3-button--remove" data-action="deleteDoc" data-doc-id="${doc.id}" data-box="${doc.box}" data-path="${doc.path}">
                                        ${this.i18n.delete}
                                    </button>
                                </div>
                                <div class="optimizer-preview fn__flex-1" style="margin-top: 4px; display: none;"></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        return html;
    }

    private getDeleteContentHTML(docs: DocumentInfo[]): string {
        let html = `
            <div class="optimizer-summary">
                <p>${this.i18n.foundEmptyDocs.replace('${count}', docs.length.toString())}</p>
            </div>
            <div class="optimizer-actions-bar">
                <button class="b3-button b3-button--primary" id="deleteSelected">
                    ${this.i18n.deleteSelected}
                </button>
                <label class="b3-form__checkbox" style="margin-left: 8px;">
                    <input type="checkbox" id="hideBacklinkedToggle" ${this.hideBacklinkedInEmpty ? 'checked' : ''}>
                    ${this.i18n.hideBacklinked || '过滤掉有反链的文档'}
                </label>
            </div>
            <div class="optimizer-doc-list">
        `;

        docs.forEach((doc) => {
            html += `
                <div class="optimizer-doc-item" data-doc-id="${doc.id}">
                    <div class="optimizer-doc-body">
                        <span class="optimizer-doc-info">
                            <a href="#" class="optimizer-doc-title" data-open-id="${doc.id}" title="${doc.hpath}">${doc.title}</a>
                            <span class="optimizer-doc-path">${doc.hpath}</span>
                            <span class="optimizer-doc-meta">
                                ${this.formatDate(doc.updated)} | 反链: ${doc.refCount ?? '-'}
                            </span>
                        </span>
                    </div>
                    <div class="optimizer-doc-actions">
                        <button class="b3-button" data-action="previewDoc" data-doc-id="${doc.id}" style="display: none;">${this.i18n.preview || '预览'}</button>
                        <input type="checkbox" class="b3-form__checkbox empty-doc-checkbox" data-id="${doc.id}">
                    </div>
                    <div class="optimizer-preview fn__flex-1" style="margin-top: 4px; display: none;"></div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    private bindMergeEvents() {
        // 点击标题在侧边栏打开（右侧）
        this.element.querySelectorAll('.optimizer-doc-title').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const id = (e.currentTarget as HTMLElement).getAttribute('data-open-id');
                if (!id) return;
                // 使用 SiYuan 插件 API openTab，通过事件派发给主插件处理
                this.element.dispatchEvent(new CustomEvent('optimizer-open-doc', { detail: { id, position: 'right' } }));
            });
        });

        // 过滤未命名
        const excludeEl = this.element.querySelector('#excludeUntitledToggle') as HTMLInputElement | null;
        if (excludeEl) {
            excludeEl.addEventListener('change', () => {
                this.excludeUntitled = !!excludeEl.checked;
                this.renderMergeContentFromCache();
            });
        }

        // 设置主文档 => 显示“确认合并”按钮，隐藏其他文档按钮
        this.element.querySelectorAll('[data-action="setMain"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const groupIndex = Number(target.getAttribute('data-group'));
                const docIndex = Number(target.getAttribute('data-doc'));
                if (Number.isNaN(groupIndex) || Number.isNaN(docIndex)) return;
                this.setMainDocument(groupIndex, docIndex);
                const group = this.element.querySelector(`[data-group="${groupIndex}"]`);
                if (!group) return;
                // 当前主文档显示确认按钮，其余文档隐藏按钮
                group.querySelectorAll('.optimizer-doc-item').forEach((item, idx) => {
                    const setBtn = item.querySelector('[data-action="setMain"]') as HTMLButtonElement;
                    const confirmBtn = item.querySelector('[data-action="confirmMerge"]') as HTMLButtonElement;
                    if (idx === docIndex) {
                        setBtn.classList.add('fn__none');
                        confirmBtn.classList.remove('fn__none');
                    } else {
                        setBtn.classList.add('fn__none');
                        confirmBtn.classList.add('fn__none');
                    }
                });
            });
        });

        // 确认合并（以当前主文档为目标，其他同名文档全部合并）
        this.element.querySelectorAll('[data-action="confirmMerge"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const groupIndex = Number(target.getAttribute('data-group'));
                if (Number.isNaN(groupIndex)) return;
        // 删除单个文档（在合并列表中）
        this.element.querySelectorAll('[data-action="deleteDoc"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.currentTarget as HTMLElement;
                const box = target.getAttribute('data-box');
                const path = target.getAttribute('data-path');
                if (!box || !path) return;
                try {
                    const { removeDoc } = await import('../api');
                    await removeDoc(box as any, path);
                    // 就地更新：移除该文档行，如组为空则移除组并更新计数
                    const item = target.closest('.optimizer-doc-item');
                    const groupEl = target.closest('.optimizer-group') as HTMLElement;
                    item?.remove();
                    if (groupEl && groupEl.querySelectorAll('.optimizer-doc-item').length === 0) {
                        const contentEl = this.element.querySelector('#mergeContent') as HTMLElement;
                        groupEl.remove();
                        const summaryP = contentEl?.querySelector('.optimizer-summary p') as HTMLElement;
                        if (summaryP) {
                            const remaining = contentEl.querySelectorAll('.optimizer-group').length;
                            summaryP.textContent = this.i18n.foundDuplicateDocs.replace('${count}', remaining.toString());
                        }
                        if (contentEl.querySelectorAll('.optimizer-group').length === 0) {
                            contentEl.innerHTML = `
                                <div class="optimizer-empty">
                                    <svg><use xlink:href="#iconInfo"></use></svg>
                                    <p>${this.i18n.noDuplicateDocsFound}</p>
                                </div>
                            `;
                        }
                    }
                } catch (err) {
                    console.error('Delete doc failed:', err);
                    (window as any).siyuan?.ws?.showMessage?.(this.i18n.deleteError.replace('${error}', err.message));
                }
            });
        });
                this.mergeGroup(groupIndex);
            });
        });

        // 预览文档
        this.element.querySelectorAll('[data-action="previewDoc"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const docId = target.getAttribute('data-doc-id');
                if (!docId) return;
                const item = target.closest('.optimizer-doc-item');
                if (!item) return;
                this.togglePreviewForDoc(docId, item);
            });
        });

        // 删除单个文档（事件委托，避免绑定错位导致无效）
        this.element.addEventListener('click', async (e) => {
            const btn = (e.target as HTMLElement).closest('[data-action="deleteDoc"]') as HTMLElement | null;
            if (!btn || !this.element.contains(btn)) return;
            const box = btn.getAttribute('data-box');
            const path = btn.getAttribute('data-path');
            if (!box || !path) return;
            try {
                const { removeDoc } = await import('../api');
                await removeDoc(box as any, path);
                // 就地更新：移除该文档行，如组为空则移除组并更新计数
                const item = btn.closest('.optimizer-doc-item');
                const groupEl = btn.closest('.optimizer-group') as HTMLElement;
                item?.remove();
                if (groupEl && groupEl.querySelectorAll('.optimizer-doc-item').length === 0) {
                    const contentEl = this.element.querySelector('#mergeContent') as HTMLElement;
                    groupEl.remove();
                    const summaryP = contentEl?.querySelector('.optimizer-summary p') as HTMLElement;
                    if (summaryP) {
                        const remaining = contentEl.querySelectorAll('.optimizer-group').length;
                        summaryP.textContent = this.i18n.foundDuplicateDocs.replace('${count}', remaining.toString());
                    }
                    if (contentEl.querySelectorAll('.optimizer-group').length === 0) {
                        contentEl.innerHTML = `
                            <div class="optimizer-empty">
                                <svg><use xlink:href="#iconInfo"></use></svg>
                                <p>${this.i18n.noDuplicateDocsFound}</p>
                            </div>
                        `;
                    }
                }
            } catch (err: any) {
                console.error('Delete doc failed:', err);
                (window as any).siyuan?.ws?.showMessage?.(this.i18n.deleteError.replace('${error}', err?.message ?? err));
            }
        });
    }

    private bindDeleteEvents() {
        // 点击标题在侧边栏打开（右侧），并阻止默认跳转以避免界面重载
        this.element.querySelectorAll('#deleteContent .optimizer-doc-title').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const id = (e.currentTarget as HTMLElement).getAttribute('data-open-id');
                if (!id) return;
                this.element.dispatchEvent(new CustomEvent('optimizer-open-doc', { detail: { id, position: 'right' } }));
            });
        });

        // 过滤掉有反链的文档
        const hideBacklinkedEl = this.element.querySelector('#hideBacklinkedToggle') as HTMLInputElement | null;
        if (hideBacklinkedEl) {
            hideBacklinkedEl.addEventListener('change', () => {
                this.hideBacklinkedInEmpty = !!hideBacklinkedEl.checked;
                this.renderDeleteContentFromCache();
            });
        }

        // 预览文档
        this.element.querySelectorAll('[data-action="previewDoc"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const docId = target.getAttribute('data-doc-id');
                if (!docId) return;
                const item = target.closest('.optimizer-doc-item');
                if (!item) return;
                this.togglePreviewForDoc(docId, item);
            });
        });

        // 全选空文档（按钮可能不存在，做兼容处理）
        this.element.querySelector('#selectAllEmpty')?.addEventListener('click', () => {
            this.selectAllEmptyDocs(true);
        });

        // 取消全选空文档（按钮可能不存在，做兼容处理）
        this.element.querySelector('#deselectAllEmpty')?.addEventListener('click', () => {
            this.selectAllEmptyDocs(false);
        });

        // 删除选中的空文档
        this.element.querySelector('#deleteSelected')?.addEventListener('click', () => {
            this.deleteSelectedEmptyDocs();
        });
    }

    private setMainDocument(groupIndex: number, docIndex: number) {
        const group = this.element.querySelector(`[data-group="${groupIndex}"]`);
        if (!group) return;

        // 移除其他主文档标记
        group.querySelectorAll('.optimizer-doc-item').forEach(item => {
            item.classList.remove('optimizer-main-doc');
        });

        // 设置新的主文档
        const docItem = group.querySelector(`[data-doc="${docIndex}"]`)?.closest('.optimizer-doc-item');
        if (docItem) {
            docItem.classList.add('optimizer-main-doc');
        }
    }



    private selectAllEmptyDocs(select: boolean) {
        const checkboxes = this.element.querySelectorAll('.empty-doc-checkbox');
        checkboxes.forEach(checkbox => {
            (checkbox as HTMLInputElement).checked = select;
        });
    }

    private async mergeGroup(groupIndex: number) {
        const group = this.element.querySelector(`[data-group="${groupIndex}"]`);
        if (!group) return;

        // 获取主文档
        const mainDocItem = group.querySelector('.optimizer-main-doc');
        if (!mainDocItem) {
            // 思源风格提示
            showMessage('请先设置主文档');
            return;
        }

        const mainDocId = mainDocItem.getAttribute('data-doc-id');

        // 不再需要选择：选中主文档后，其他同名文档全部合并
        const selectedDocs: string[] = [];
        group.querySelectorAll('.optimizer-doc-item').forEach(item => {
            const id = item.getAttribute('data-doc-id');
            if (id && id !== mainDocId) selectedDocs.push(id);
        });

        // 直接执行合并（无确认弹窗）
        try {
            const mergeBtn = group.querySelector('[data-action="confirmMerge"]') as HTMLButtonElement;
            if (mergeBtn) {
                mergeBtn.textContent = this.i18n.merging;
                mergeBtn.disabled = true;
            }
            await this.optimizer.mergeDocuments(mainDocId, selectedDocs);
            // 就地更新 UI：移除当前分组，不重新加载搜索结果
            const contentEl = this.element.querySelector('#mergeContent') as HTMLElement;
            // 先移除分组
            group.remove();
            // 更新顶部汇总数量
            const summaryP = contentEl?.querySelector('.optimizer-summary p') as HTMLElement;
            if (summaryP) {
                const remaining = contentEl.querySelectorAll('.optimizer-group').length;
                summaryP.textContent = this.i18n.foundDuplicateDocs.replace('${count}', remaining.toString());
            }
            // 如果没有剩余分组，显示空态
            if (contentEl.querySelectorAll('.optimizer-group').length === 0) {
                contentEl.innerHTML = `
                    <div class="optimizer-empty">
                        <svg><use xlink:href="#iconInfo"></use></svg>
                        <p>${this.i18n.noDuplicateDocsFound}</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Merge failed:', error);
            (window as any).siyuan?.ws?.showMessage?.(this.i18n.mergeError.replace('${error}', error.message));
        }
    }

    private async deleteSelectedEmptyDocs() {
        const selectedDocs: string[] = [];
        const checkboxes = this.element.querySelectorAll('.empty-doc-checkbox:checked');

        checkboxes.forEach(checkbox => {
            const docItem = checkbox.closest('.optimizer-doc-item');
            const docId = docItem?.getAttribute('data-doc-id');
            if (docId) {
                selectedDocs.push(docId);
            }
        });

        if (selectedDocs.length === 0) {
            (window as any).siyuan?.ws?.showMessage?.('请选择要删除的空文档');
            return;
        }

        // 确认删除
        const ele = document.createElement('div');
        ele.textContent = this.i18n.confirmDelete;
        confirmDialog({
            title: this.i18n.deleteEmptyDocs,
            content: ele,
            confirm: async () => {
                try {
                    const deleteBtn = this.element.querySelector('#deleteSelected') as HTMLButtonElement;
                    deleteBtn.textContent = this.i18n.deleting;
                    deleteBtn.disabled = true;
                    await this.optimizer.deleteEmptyDocuments(selectedDocs);
                    this.loadDeletePanel();
                } catch (error) {
                    console.error('Delete failed:', error);
                    (window as any).siyuan?.ws?.showMessage?.(this.i18n.deleteError.replace('${error}', error.message));
                }
            }
        });

        try {
            // 显示加载状态
            const deleteBtn = this.element.querySelector('#deleteSelected') as HTMLButtonElement;
            deleteBtn.textContent = this.i18n.deleting;
            deleteBtn.disabled = true;

            await this.optimizer.deleteEmptyDocuments(selectedDocs);

            // 刷新页面
            this.loadDeletePanel();
        } catch (error) {
            console.error('Delete failed:', error);
            (window as any).siyuan?.ws?.showMessage?.(this.i18n.deleteError.replace('${error}', error.message));
        }
    }

    private formatDate(updated: number | string): string {
        // 支持 14 位数：yyyyMMddHHmmss
        const s = String(updated || '').trim();
        if (/^\d{14}$/.test(s)) {
            const y = s.slice(0,4), mo = s.slice(4,6), d = s.slice(6,8);
            const h = s.slice(8,10), mi = s.slice(10,12), se = s.slice(12,14);
            return `${y}-${mo}-${d} ${h}:${mi}:${se}`;
        }
        // 兜底：时间戳毫秒/秒
        const n = Number(updated);
        if (!Number.isNaN(n)) {
            const ms = n > 1e12 ? n : n * 1000; // 如果是 10 位当秒
            return new Date(ms).toLocaleString();
        }
        return String(updated ?? '');
    }





    private refresh() {
        const mergePanel = this.element.querySelector('#mergePanel') as HTMLElement;
        const deletePanel = this.element.querySelector('#deletePanel') as HTMLElement;
        const mergeVisible = !!mergePanel && mergePanel.style.display !== 'none';
        if (mergeVisible) {
            this.loadMergePanel();
        } else {
            this.loadDeletePanel();
        }
    }

    private close() {
        // 关闭页签的逻辑会在主插件中实现
        this.element.dispatchEvent(new CustomEvent('close-tab'));
    }

    // 工具：应用过滤
    private applyMergeFilters(groups: DuplicateGroup[]): DuplicateGroup[] {
        if (!this.excludeUntitled) return groups;
        const untitled = ((window as any)?.siyuan?.languages?._kernel[16] ?? 'Untitled').trim();
        return groups.filter(g => (g.title || '').trim() !== untitled);
    }

    private applyDeleteFilters(docs: DocumentInfo[]): DocumentInfo[] {
        if (!this.hideBacklinkedInEmpty) return docs;
        return docs.filter(d => (d.refCount ?? 0) === 0);
    }

    private renderMergeContentFromCache() {
        const contentEl = this.element.querySelector('#mergeContent') as HTMLElement;
        if (!contentEl) return;
        const displayGroups = this.applyMergeFilters(this.duplicateGroupsCache);
        if (displayGroups.length === 0) {
            contentEl.innerHTML = `
                <div class="optimizer-empty">
                    <svg><use xlink:href="#iconInfo"></use></svg>
                    <p>${this.i18n.noDuplicateDocsFound}</p>
                </div>
            `;
            return;
        }
        contentEl.innerHTML = this.getMergeContentHTML(displayGroups);
        this.bindMergeEvents();
    }

    private renderDeleteContentFromCache() {
        const contentEl = this.element.querySelector('#deleteContent') as HTMLElement;
        if (!contentEl) return;
        const displayDocs = this.applyDeleteFilters(this.emptyDocsCache);
        if (displayDocs.length === 0) {
            contentEl.innerHTML = `
                <div class="optimizer-empty">
                    <svg><use xlink:href="#iconInfo"></use></svg>
                    <p>${this.i18n.noEmptyDocsFound}</p>
                </div>
            `;
            return;
        }
        contentEl.innerHTML = this.getDeleteContentHTML(displayDocs);
        this.bindDeleteEvents();
    }

    private togglePreviewForDoc(docId: string, itemEl: Element) {
        const previewEl = itemEl.querySelector('.optimizer-preview') as HTMLElement | null;
        if (!previewEl) return;
        const isVisible = previewEl.style.display !== 'none';
        if (isVisible) {
            // 关闭并销毁
            const editor = this.previewEditors.get(docId);
            try { editor?.destroy?.(); } catch {}
            this.previewEditors.delete(docId);
            previewEl.style.display = 'none';
            previewEl.innerHTML = '';
            return;
        }
        // 打开预览
        previewEl.style.display = 'block';
        const ProtyleCtor = (window as any).Protyle;
        if (!ProtyleCtor || !this.app) {
            // 回退：使用右侧打开
            this.element.dispatchEvent(new CustomEvent('optimizer-open-doc', { detail: { id: docId, position: 'right' } }));
            return;
        }
        try {
            const editor = new ProtyleCtor(this.app, previewEl, {
                blockId: docId,
                rootId: docId,
                mode: 'wysiwyg',
                action: [],
                render: { title: false, background: false, scroll: true },
            });
            this.previewEditors.set(docId, editor);
        } catch (e) {
            console.warn('Protyle preview failed, fallback to open tab', e);
            this.element.dispatchEvent(new CustomEvent('optimizer-open-doc', { detail: { id: docId, position: 'right' } }));
        }
    }

    private destroyAllPreviews() {
        this.previewEditors.forEach((ed) => {
            try { ed?.destroy?.(); } catch {}
        });
        this.previewEditors.clear();
        this.element.querySelectorAll('.optimizer-preview').forEach(el => {
            (el as HTMLElement).style.display = 'none';
            (el as HTMLElement).innerHTML = '';
        });
    }

    // **************************************** 文件清理相关方法 ****************************************

    private async loadCleanupPanel() {
        await this.loadNotebooks();
    }

    private async loadNotebooks() {
        try {
            const notebookSelect = this.element.querySelector('#notebookSelect') as HTMLSelectElement;
            if (!notebookSelect) return;

            // 使用 API 获取笔记本列表
            const { lsNotebooks } = await import('../api');
            const result = await lsNotebooks();
            const notebooks = result.notebooks || [];
            
            notebookSelect.innerHTML = '<option value="">请选择笔记本</option>';
            
            notebooks.forEach((notebook: any) => {
                const option = document.createElement('option');
                option.value = notebook.id;
                option.textContent = notebook.name;
                notebookSelect.appendChild(option);
            });
            
        } catch (error) {
            console.error('Error loading notebooks:', error);
            showMessage('加载笔记本列表失败');
        }
    }

    private bindCleanupEvents() {
        // 扫描文件按钮
        this.element.querySelector('#scanFilesBtn')?.addEventListener('click', () => {
            this.scanFiles();
        });

        // 设置项更新
        this.element.querySelector('#duplicateType')?.addEventListener('change', (e) => {
            this.cleanupOptions.duplicateType = (e.target as HTMLSelectElement).value as any;
        });

        this.element.querySelector('#keepStrategy')?.addEventListener('change', (e) => {
            this.cleanupOptions.keepStrategy = (e.target as HTMLSelectElement).value as any;
        });

        this.element.querySelector('#recursive')?.addEventListener('change', (e) => {
            this.cleanupOptions.recursive = (e.target as HTMLInputElement).checked;
        });

        this.element.querySelector('#confirmBeforeDelete')?.addEventListener('change', (e) => {
            this.cleanupOptions.confirmBeforeDelete = (e.target as HTMLInputElement).checked;
        });
    }

    private async scanFiles() {
        const notebookSelect = this.element.querySelector('#notebookSelect') as HTMLSelectElement;
        const folderPathInput = this.element.querySelector('#folderPath') as HTMLInputElement;
        
        const notebook = notebookSelect.value;
        const folderPath = folderPathInput.value;

        if (!notebook) {
            showMessage('请选择笔记本');
            return;
        }

        if (!folderPath) {
            showMessage('请输入文件夹路径');
            return;
        }

        const settingsEl = this.element.querySelector('#cleanupSettings') as HTMLElement;
        const loadingEl = this.element.querySelector('#cleanupLoading') as HTMLElement;
        const contentEl = this.element.querySelector('#cleanupContent') as HTMLElement;

        settingsEl.style.display = 'none';
        loadingEl.style.display = 'block';
        contentEl.style.display = 'none';

        try {
            this.currentNotebook = notebook;
            this.currentPath = folderPath;
            
            const duplicateGroups = await this.optimizer.scanDuplicateFiles(
                notebook, 
                folderPath, 
                this.cleanupOptions
            );
            
            this.duplicateFilesCache = duplicateGroups;

            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';

            if (duplicateGroups.length === 0) {
                contentEl.innerHTML = `
                    <div class="optimizer-empty">
                        <svg><use xlink:href="#iconInfo"></use></svg>
                        <p>未找到重复文件</p>
                        <button class="b3-button b3-button--outline" onclick="this.closest('#cleanupContent').style.display='none'; this.closest('.optimizer-container').querySelector('#cleanupSettings').style.display='block';">
                            返回设置
                        </button>
                    </div>
                `;
            } else {
                contentEl.innerHTML = this.getCleanupContentHTML(duplicateGroups);
                this.bindCleanupContentEvents();
            }

        } catch (error) {
            console.error('Error scanning files:', error);
            loadingEl.style.display = 'none';
            showMessage(`扫描失败: ${error.message}`);
            
            // 返回设置界面
            settingsEl.style.display = 'block';
        }
    }

    private getCleanupContentHTML(duplicateGroups: DuplicateFileGroup[]): string {
        const totalFiles = duplicateGroups.reduce((sum, group) => sum + group.files.length, 0);
        const duplicateCount = duplicateGroups.reduce((sum, group) => sum + (group.files.length - 1), 0);
        
        return `
            <div class="optimizer-cleanup-header">
                <div class="optimizer-stats">
                    <div class="stat-item">
                        <span class="stat-label">重复文件组:</span>
                        <span class="stat-value">${duplicateGroups.length}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">总文件数:</span>
                        <span class="stat-value">${totalFiles}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">可删除文件:</span>
                        <span class="stat-value">${duplicateCount}</span>
                    </div>
                </div>
                <div class="optimizer-actions">
                    <button class="b3-button b3-button--outline" id="backToSettingsBtn">
                        <svg><use xlink:href="#iconLeft"></use></svg>
                        返回设置
                    </button>
                    <button class="b3-button b3-button--warning" id="cleanupAllBtn">
                        <svg><use xlink:href="#iconTrashcan"></use></svg>
                        清理所有重复文件
                    </button>
                </div>
            </div>
            <div class="optimizer-cleanup-list">
                ${duplicateGroups.map((group, index) => this.getCleanupGroupHTML(group, index)).join('')}
            </div>
        `;
    }

    private getCleanupGroupHTML(group: DuplicateFileGroup, index: number): string {
        return `
            <div class="optimizer-cleanup-group" data-group-index="${index}">
                <div class="group-header">
                    <h4>${group.name}</h4>
                    <div class="group-info">
                        <span>类型: ${group.duplicateType === 'name' ? '文件名' : group.duplicateType === 'content' ? '内容' : '哈希'}</span>
                        <span>文件数: ${group.files.length}</span>
                        <span>总大小: ${this.formatFileSize(group.totalSize)}</span>
                    </div>
                    <button class="b3-button b3-button--small b3-button--warning" onclick="window.cleanupGroup(${index})">
                        清理此组
                    </button>
                </div>
                <div class="group-files">
                    ${group.files.map((file, fileIndex) => this.getCleanupFileHTML(file, index, fileIndex)).join('')}
                </div>
            </div>
        `;
    }

    private getCleanupFileHTML(file: any, groupIndex: number, fileIndex: number): string {
        return `
            <div class="cleanup-file-item" data-group="${groupIndex}" data-file="${fileIndex}">
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-path">${file.path}</div>
                    <div class="file-meta">
                        <span>大小: ${this.formatFileSize(file.size)}</span>
                        <span>修改时间: ${new Date(file.updated * 1000).toLocaleString()}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="b3-button b3-button--small b3-button--outline" onclick="window.previewFile(${groupIndex}, ${fileIndex})">
                        预览
                    </button>
                    <button class="b3-button b3-button--small b3-button--warning" onclick="window.deleteFile(${groupIndex}, ${fileIndex})">
                        删除
                    </button>
                </div>
            </div>
        `;
    }

    private bindCleanupContentEvents() {
        // 返回设置按钮
        this.element.querySelector('#backToSettingsBtn')?.addEventListener('click', () => {
            const settingsEl = this.element.querySelector('#cleanupSettings') as HTMLElement;
            const contentEl = this.element.querySelector('#cleanupContent') as HTMLElement;
            
            settingsEl.style.display = 'block';
            contentEl.style.display = 'none';
        });

        // 清理所有重复文件按钮
        this.element.querySelector('#cleanupAllBtn')?.addEventListener('click', () => {
            this.cleanupAllFiles();
        });

        // 绑定全局方法
        (window as any).cleanupGroup = (groupIndex: number) => {
            this.cleanupGroup(groupIndex);
        };

        (window as any).deleteFile = (groupIndex: number, fileIndex: number) => {
            this.deleteFile(groupIndex, fileIndex);
        };

        (window as any).previewFile = (groupIndex: number, fileIndex: number) => {
            this.previewFile(groupIndex, fileIndex);
        };
    }

    private async cleanupAllFiles() {
        if (this.cleanupOptions.confirmBeforeDelete) {
            const confirmed = await confirmDialog('确认清理', `即将清理 ${this.duplicateFilesCache.length} 组重复文件，此操作不可撤销。是否继续？`);
            if (!confirmed) return;
        }

        try {
            const deletedCount = await this.optimizer.cleanupDuplicateFiles(
                this.duplicateFilesCache, 
                this.cleanupOptions
            );
            
            showMessage(`成功清理 ${deletedCount} 个重复文件`);
            
            // 重新扫描
            this.scanFiles();
        } catch (error) {
            console.error('Error cleaning up files:', error);
            showMessage(`清理失败: ${error.message}`);
        }
    }

    private async cleanupGroup(groupIndex: number) {
        const group = this.duplicateFilesCache[groupIndex];
        if (!group) return;

        try {
            // 清理此组时不需要确认，直接执行删除
            const deletedCount = await this.optimizer.cleanupDuplicateFiles(
                [group], 
                {
                    ...this.cleanupOptions,
                    confirmBeforeDelete: false // 强制不确认
                }
            );
            
            showMessage(`成功清理 ${deletedCount} 个重复文件`);
            
            // 删除后不重新扫描，直接从缓存中移除该组
            this.duplicateFilesCache.splice(groupIndex, 1);
            this.updateCleanupDisplay();
            
        } catch (error) {
            console.error('Error cleaning up group:', error);
            showMessage(`清理失败: ${error.message}`);
        }
    }

    private async deleteFile(groupIndex: number, fileIndex: number) {
        const group = this.duplicateFilesCache[groupIndex];
        if (!group || !group.files[fileIndex]) return;

        const file = group.files[fileIndex];
        
        if (this.cleanupOptions.confirmBeforeDelete) {
            const confirmed = await confirmDialog('确认删除', `即将删除文件 "${file.name}"，此操作不可撤销。是否继续？`);
            if (!confirmed) return;
        }

        try {
            // 创建只包含这一个文件的临时组
            const tempGroup: DuplicateFileGroup = {
                name: group.name,
                files: [file],
                duplicateType: group.duplicateType,
                totalSize: file.size
            };
            
            await this.optimizer.cleanupDuplicateFiles([tempGroup], {
                ...this.cleanupOptions,
                confirmBeforeDelete: false // 已经确认过了
            });
            
            showMessage(`成功删除文件: ${file.name}`);
            
            // 删除后不重新扫描，直接从缓存中移除该文件
            group.files.splice(fileIndex, 1);
            
            // 如果组中只剩一个文件，移除整个组
            if (group.files.length <= 1) {
                this.duplicateFilesCache.splice(groupIndex, 1);
            }
            
            this.updateCleanupDisplay();
        } catch (error) {
            console.error('Error deleting file:', error);
            showMessage(`删除失败: ${error.message}`);
        }
    }

    private previewFile(groupIndex: number, fileIndex: number) {
        const group = this.duplicateFilesCache[groupIndex];
        if (!group || !group.files[fileIndex]) return;

        const file = group.files[fileIndex];
        // 这里可以实现文件预览功能
        showMessage(`预览文件: ${file.name}`);
    }

    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 更新清理界面显示
     */
    private updateCleanupDisplay() {
        const contentEl = this.element.querySelector('#cleanupContent') as HTMLElement;
        if (!contentEl) return;

        if (this.duplicateFilesCache.length === 0) {
            contentEl.innerHTML = `
                <div class="optimizer-empty">
                    <svg><use xlink:href="#iconInfo"></use></svg>
                    <p>所有重复文件已清理完成</p>
                    <button class="b3-button b3-button--outline" onclick="this.closest('#cleanupContent').style.display='none'; this.closest('.optimizer-container').querySelector('#cleanupSettings').style.display='block';">
                        返回设置
                    </button>
                </div>
            `;
        } else {
            contentEl.innerHTML = this.getCleanupContentHTML(this.duplicateFilesCache);
            this.bindCleanupContentEvents();
        }
    }
}
