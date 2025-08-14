/**
 * 优化器自定义页签组件
 */

import { DocumentOptimizer, DuplicateGroup, DocumentInfo } from '../optimizer';
import { showMessage } from 'siyuan';
import { confirmDialog } from '../libs/dialog';

export class OptimizerTab {
    private element: HTMLElement;
    private optimizer: DocumentOptimizer;
    private i18n: any;
    private defaultTab: 'merge' | 'delete';
    private app: any;

    constructor(element: HTMLElement, i18n: any, defaultTab: 'merge' | 'delete' = 'merge', app?: any) {
        this.element = element;
        this.optimizer = new DocumentOptimizer();
        this.i18n = i18n;
        this.defaultTab = defaultTab;
        this.app = app;
        this.init();
    }

    private init() {
        this.element.innerHTML = this.getMainHTML();
        this.bindEvents();
    }

    private getMainHTML(): string {
        return `
            <div class="optimizer-container">
                <div class="optimizer-header">
                    <h2>${this.defaultTab === 'delete' ? this.i18n.deleteEmptyDocs : this.i18n.mergeDuplicateDocs}</h2>
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

        // 根据默认标签初始化（无 Tab 栏，直接按默认加载一次）
        if (this.defaultTab === 'delete') {
            this.loadDeletePanel();
        } else {
            this.loadMergePanel();
        }
    }



    private async loadMergePanel() {
        const loadingEl = this.element.querySelector('#mergeLoading') as HTMLElement;
        const contentEl = this.element.querySelector('#mergeContent') as HTMLElement;

        loadingEl.style.display = 'block';
        contentEl.style.display = 'none';

        try {
            const duplicateGroups = await this.optimizer.getDuplicateDocumentGroups();

            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';

            if (duplicateGroups.length === 0) {
                contentEl.innerHTML = `
                    <div class="optimizer-empty">
                        <svg><use xlink:href="#iconInfo"></use></svg>
                        <p>${this.i18n.noDuplicateDocsFound}</p>
                    </div>
                `;
            } else {
                contentEl.innerHTML = this.getMergeContentHTML(duplicateGroups);
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
            const emptyDocs = await this.optimizer.getEmptyDocuments();

            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';

            if (emptyDocs.length === 0) {
                contentEl.innerHTML = `
                    <div class="optimizer-empty">
                        <svg><use xlink:href="#iconInfo"></use></svg>
                        <p>${this.i18n.noEmptyDocsFound}</p>
                    </div>
                `;
            } else {
                contentEl.innerHTML = this.getDeleteContentHTML(emptyDocs);
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
                                            ${this.formatDate(doc.updated)}
                                        </span>
                                    </span>
                                </div>
                                <div class="optimizer-doc-actions">
                                    <button class="b3-button" data-action="setMain" data-group="${groupIndex}" data-doc="${docIndex}">
                                        ${this.i18n.setAsMainDoc}
                                    </button>
                                    <button class="b3-button b3-button--primary fn__none" data-action="confirmMerge" data-group="${groupIndex}" data-doc="${docIndex}">
                                        ${this.i18n.mergeSelected}
                                    </button>
                                </div>
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
                                ${this.formatDate(doc.updated)}
                            </span>
                        </span>
                    </div>
                    <div class="optimizer-doc-actions">
                        <input type="checkbox" class="b3-form__checkbox empty-doc-checkbox" data-id="${doc.id}">
                    </div>
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
                this.mergeGroup(groupIndex);
            });
        });
    }

    private bindDeleteEvents() {
        // 全选空文档
        this.element.querySelector('#selectAllEmpty')?.addEventListener('click', () => {
            this.selectAllEmptyDocs(true);
        });

        // 取消全选空文档
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

        // 确认合并（Dialog）
        const ele = document.createElement('div');
        ele.textContent = this.i18n.confirmMerge;
        confirmDialog({
            title: this.i18n.mergeDuplicateDocs,
            content: ele,
            confirm: async () => {
                try {
                    const mergeBtn = group.querySelector('[data-action="confirmMerge"]') as HTMLButtonElement;
                    if (mergeBtn) {
                        mergeBtn.textContent = this.i18n.merging;
                        mergeBtn.disabled = true;
                    }
                    await this.optimizer.mergeDocuments(mainDocId, selectedDocs);
                    this.loadMergePanel();
                } catch (error) {
                    console.error('Merge failed:', error);
                    (window as any).siyuan?.ws?.showMessage?.(this.i18n.mergeError.replace('${error}', error.message));
                }
            }
        });

        try {
            // 显示加载状态
            const mergeBtn = group.querySelector('[data-action="merge"]') as HTMLButtonElement;
            mergeBtn.textContent = this.i18n.merging;
            mergeBtn.disabled = true;

            await this.optimizer.mergeDocuments(mainDocId, selectedDocs);

            // 刷新页面
            this.loadMergePanel();
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
        const currentTab = this.element.querySelector('.b3-tab-bar__tab--current')?.getAttribute('data-tab');
        if (currentTab === 'merge') {
            this.loadMergePanel();
        } else if (currentTab === 'delete') {
            this.loadDeletePanel();
        }
    }

    private close() {
        // 关闭页签的逻辑会在主插件中实现
        this.element.dispatchEvent(new CustomEvent('close-tab'));
    }
}
