/**
 * 优化器自定义页签组件
 */

import { DocumentOptimizer, DuplicateGroup, DocumentInfo } from '../optimizer';

export class OptimizerTab {
    private element: HTMLElement;
    private optimizer: DocumentOptimizer;
    private i18n: any;
    
    constructor(element: HTMLElement, i18n: any) {
        this.element = element;
        this.optimizer = new DocumentOptimizer();
        this.i18n = i18n;
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
                    <h2>${this.i18n.addTopBarIcon}</h2>
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
                    <div class="b3-tab-bar">
                        <div class="b3-tab-bar__space"></div>
                        <div class="b3-tab-bar__tab b3-tab-bar__tab--current" data-tab="merge">
                            <svg><use xlink:href="#iconCombine"></use></svg>
                            ${this.i18n.mergeDuplicateDocs}
                        </div>
                        <div class="b3-tab-bar__tab" data-tab="delete">
                            <svg><use xlink:href="#iconTrashcan"></use></svg>
                            ${this.i18n.deleteEmptyDocs}
                        </div>
                        <div class="b3-tab-bar__space"></div>
                    </div>
                    
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
        // 标签页切换
        this.element.querySelectorAll('.b3-tab-bar__tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const tabType = target.getAttribute('data-tab');
                this.switchTab(tabType);
            });
        });
        
        // 刷新按钮
        this.element.querySelector('#refreshBtn')?.addEventListener('click', () => {
            this.refresh();
        });
        
        // 关闭按钮
        this.element.querySelector('#closeBtn')?.addEventListener('click', () => {
            this.close();
        });
        
        // 初始加载合并页面
        this.loadMergePanel();
    }
    
    private switchTab(tabType: string) {
        // 更新标签页状态
        this.element.querySelectorAll('.b3-tab-bar__tab').forEach(tab => {
            tab.classList.remove('b3-tab-bar__tab--current');
        });
        this.element.querySelector(`[data-tab="${tabType}"]`)?.classList.add('b3-tab-bar__tab--current');
        
        // 切换面板
        this.element.querySelectorAll('.optimizer-tab-panel').forEach(panel => {
            panel.style.display = 'none';
        });
        
        if (tabType === 'merge') {
            this.element.querySelector('#mergePanel').style.display = 'block';
            this.loadMergePanel();
        } else if (tabType === 'delete') {
            this.element.querySelector('#deletePanel').style.display = 'block';
            this.loadDeletePanel();
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
                                <label class="b3-form__label">
                                    <input type="checkbox" class="b3-form__checkbox" data-group="${groupIndex}" data-doc="${docIndex}">
                                    <span class="optimizer-doc-info">
                                        <span class="optimizer-doc-title">${doc.title}</span>
                                        <span class="optimizer-doc-path">${doc.hpath}</span>
                                        <span class="optimizer-doc-meta">
                                            ${this.formatDate(doc.updated)} | ${this.formatSize(doc.size)}
                                        </span>
                                    </span>
                                </label>
                                <button class="b3-button b3-button--small" data-action="setMain" data-group="${groupIndex}" data-doc="${docIndex}">
                                    ${this.i18n.setAsMainDoc}
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <div class="optimizer-group-actions">
                        <button class="b3-button b3-button--outline" data-action="selectAll" data-group="${groupIndex}">
                            ${this.i18n.selectAll}
                        </button>
                        <button class="b3-button b3-button--outline" data-action="deselectAll" data-group="${groupIndex}">
                            ${this.i18n.deselectAll}
                        </button>
                        <button class="b3-button b3-button--primary" data-action="merge" data-group="${groupIndex}">
                            ${this.i18n.mergeSelected}
                        </button>
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
                <button class="b3-button b3-button--outline" id="selectAllEmpty">
                    ${this.i18n.selectAll}
                </button>
                <button class="b3-button b3-button--outline" id="deselectAllEmpty">
                    ${this.i18n.deselectAll}
                </button>
                <button class="b3-button b3-button--primary" id="deleteSelected">
                    ${this.i18n.deleteSelected}
                </button>
            </div>
            <div class="optimizer-doc-list">
        `;
        
        docs.forEach((doc, index) => {
            html += `
                <div class="optimizer-doc-item" data-doc-id="${doc.id}">
                    <label class="b3-form__label">
                        <input type="checkbox" class="b3-form__checkbox empty-doc-checkbox" data-index="${index}">
                        <span class="optimizer-doc-info">
                            <span class="optimizer-doc-title">${doc.title}</span>
                            <span class="optimizer-doc-path">${doc.hpath}</span>
                            <span class="optimizer-doc-meta">
                                ${this.formatDate(doc.updated)}
                            </span>
                        </span>
                    </label>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }
    
    private bindMergeEvents() {
        // 设置主文档按钮
        this.element.querySelectorAll('[data-action="setMain"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const groupIndex = target.getAttribute('data-group');
                const docIndex = target.getAttribute('data-doc');
                this.setMainDocument(parseInt(groupIndex), parseInt(docIndex));
            });
        });

        // 全选/取消全选按钮
        this.element.querySelectorAll('[data-action="selectAll"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const groupIndex = target.getAttribute('data-group');
                this.selectAllInGroup(parseInt(groupIndex), true);
            });
        });

        this.element.querySelectorAll('[data-action="deselectAll"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const groupIndex = target.getAttribute('data-group');
                this.selectAllInGroup(parseInt(groupIndex), false);
            });
        });

        // 合并按钮
        this.element.querySelectorAll('[data-action="merge"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const groupIndex = target.getAttribute('data-group');
                this.mergeGroup(parseInt(groupIndex));
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

    private selectAllInGroup(groupIndex: number, select: boolean) {
        const checkboxes = this.element.querySelectorAll(`input[data-group="${groupIndex}"]`);
        checkboxes.forEach(checkbox => {
            (checkbox as HTMLInputElement).checked = select;
        });
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
            alert('请先设置主文档');
            return;
        }

        const mainDocId = mainDocItem.getAttribute('data-doc-id');

        // 获取选中的文档
        const selectedDocs: string[] = [];
        const checkboxes = group.querySelectorAll('input[type="checkbox"]:checked');
        checkboxes.forEach(checkbox => {
            const docItem = checkbox.closest('.optimizer-doc-item');
            const docId = docItem?.getAttribute('data-doc-id');
            if (docId && docId !== mainDocId) {
                selectedDocs.push(docId);
            }
        });

        if (selectedDocs.length === 0) {
            alert('请选择要合并的文档');
            return;
        }

        // 确认合并
        if (!confirm(this.i18n.confirmMerge)) {
            return;
        }

        try {
            // 显示加载状态
            const mergeBtn = group.querySelector('[data-action="merge"]') as HTMLButtonElement;
            const originalText = mergeBtn.textContent;
            mergeBtn.textContent = this.i18n.merging;
            mergeBtn.disabled = true;

            await this.optimizer.mergeDocuments(mainDocId, selectedDocs);

            // 刷新页面
            this.loadMergePanel();
        } catch (error) {
            console.error('Merge failed:', error);
            alert(this.i18n.mergeError.replace('${error}', error.message));
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
            alert('请选择要删除的空文档');
            return;
        }

        // 确认删除
        if (!confirm(this.i18n.confirmDelete)) {
            return;
        }

        try {
            // 显示加载状态
            const deleteBtn = this.element.querySelector('#deleteSelected') as HTMLButtonElement;
            const originalText = deleteBtn.textContent;
            deleteBtn.textContent = this.i18n.deleting;
            deleteBtn.disabled = true;

            await this.optimizer.deleteEmptyDocuments(selectedDocs);

            // 刷新页面
            this.loadDeletePanel();
        } catch (error) {
            console.error('Delete failed:', error);
            alert(this.i18n.deleteError.replace('${error}', error.message));
        }
    }
    
    private formatDate(timestamp: number): string {
        return new Date(timestamp).toLocaleString();
    }
    
    private formatSize(size: number): string {
        if (size < 1024) return `${size}B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
        return `${(size / (1024 * 1024)).toFixed(1)}MB`;
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
