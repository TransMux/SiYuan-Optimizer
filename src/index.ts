import {
    Plugin,
    showMessage,
    openTab,
    getFrontend,
    Menu
} from "siyuan";
import "@/index.scss";
import "./ui/optimizer.scss";

import { OptimizerTab } from "./ui/OptimizerTab";

const TAB_TYPE = "optimizer_tab";

export default class SiYuanOptimizer extends Plugin {

    private isMobile: boolean;

    async onload() {
        console.log("loading siyuan-optimizer", this.i18n);

        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";

        // 添加优化器图标
        this.addIcons(`
            <symbol id="iconOptimizer" viewBox="0 0 32 32">
                <path d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2zm0 26C9.373 28 4 22.627 4 16S9.373 4 16 4s12 5.373 12 12-5.373 12-12 12z"/>
                <path d="M22 11h-3V8c0-.553-.447-1-1-1h-4c-.553 0-1 .447-1 1v3h-3c-.553 0-1 .447-1 1v4c0 .553.447 1 1 1h3v3c0 .553.447 1 1 1h4c.553 0 1-.447 1-1v-3h3c.553 0 1-.447 1-1v-4c0-.553-.447-1-1-1z"/>
            </symbol>
        `);

        // 添加顶栏按钮
        const topBarElement = this.addTopBar({
            icon: "iconOptimizer",
            title: this.i18n.addTopBarIcon,
            position: "right",
            callback: () => {
                if (this.isMobile) {
                    this.addMenu();
                } else {
                    let rect = topBarElement.getBoundingClientRect();
                    if (rect.width === 0) {
                        rect = document.querySelector("#barMore").getBoundingClientRect();
                    }
                    if (rect.width === 0) {
                        rect = document.querySelector("#barPlugins").getBoundingClientRect();
                    }
                    this.addMenu(rect);
                }
            }
        });

        // 添加命令
        this.addCommand({
            langKey: "mergeDuplicateDocs",
            hotkey: "⇧⌘M",
            callback: () => {
                this.openOptimizerTab("merge");
            }
        });

        this.addCommand({
            langKey: "deleteEmptyDocs",
            hotkey: "⇧⌘D",
            callback: () => {
                this.openOptimizerTab("delete");
            }
        });

        // 注册自定义页签
        this.addTab({
            type: TAB_TYPE,
            init: () => {
                this.element.innerHTML = '<div class="optimizer-tab-container"></div>';
                const container = this.element.querySelector('.optimizer-tab-container') as HTMLElement;
                new OptimizerTab(container, this.i18n);
            },
            beforeDestroy: () => {
                console.log("optimizer tab before destroy");
            },
            destroy: () => {
                console.log("optimizer tab destroyed");
            }
        });

        console.log(this.i18n.helloPlugin);
    }

    onLayoutReady() {
        console.log(`frontend: ${getFrontend()}`);
    }

    async onunload() {
        console.log(this.i18n.byePlugin);
        showMessage("Goodbye SiYuan Optimizer");
    }

    private openOptimizerTab(defaultTab?: string) {
        const tab = openTab({
            app: this.app,
            custom: {
                icon: "iconOptimizer",
                title: this.i18n.addTopBarIcon,
                data: {
                    defaultTab: defaultTab || "merge"
                },
                id: this.name + TAB_TYPE
            },
        });
        console.log("Opened optimizer tab:", tab);
    }

    private addMenu(rect?: DOMRect) {
        const menu = new Menu("optimizerMenu", () => {
            console.log(this.i18n.byeMenu);
        });

        menu.addItem({
            icon: "iconCombine",
            label: this.i18n.mergeDuplicateDocs,
            click: () => {
                this.openOptimizerTab("merge");
            }
        });

        menu.addItem({
            icon: "iconTrashcan",
            label: this.i18n.deleteEmptyDocs,
            click: () => {
                this.openOptimizerTab("delete");
            }
        });

        if (this.isMobile) {
            menu.fullscreen();
        } else {
            menu.open({
                x: rect.right,
                y: rect.bottom,
                isLeft: true,
            });
        }
    }
}