// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

"use strict";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { Constants } from  "../constants";
import { DeviceItem } from "../Model/DeviceItem";
import { Utility } from "../utility";
import { LocalServer } from "./localserver";
import { Simulator } from "../simulator";


const simulatorWebviewPanelViewType = "IoT Device Simulator";
const simulatorWebviewPanelViewTitle = "IoT Device Simulator";

export class SimulatorWebview {
    public static getInstance(context: vscode.ExtensionContext) {
        if (!SimulatorWebview.instance) {
            SimulatorWebview.instance = new SimulatorWebview(context);
        }
        return SimulatorWebview.instance;
    }

    private static instance: SimulatorWebview;
    private panel: vscode.WebviewPanel;
    private localServer: LocalServer;

    private constructor(private context: vscode.ExtensionContext) {
        this.localServer = new LocalServer(context);
    }

    public async showWebview(deviceItem: DeviceItem, forceReload: boolean) {
        if (forceReload && this.panel) {
            this.panel.dispose();
        }
        await this.openSimulatorWebviewPage(deviceItem);
    }

    private async openSimulatorWebviewPage(deviceItem: DeviceItem): Promise<any> {
        if (!this.panel) {
            this.localServer.startServer();
            this.localServer.setPreSelectedDevice(deviceItem);
            this.panel = vscode.window.createWebviewPanel(
                simulatorWebviewPanelViewType,
                simulatorWebviewPanelViewTitle,
                vscode.ViewColumn.One,
                {
                    enableCommandUris: true,
                    enableScripts: true,
                    retainContextWhenHidden: true,
                },
            );
            let html = fs.readFileSync(this.context.asAbsolutePath(path.join("src", "simulatorwebview", "assets", "index.html")), "utf8");
            html = html
                .replace(/{{root}}/g, vscode.Uri.file(this.context.asAbsolutePath(".")).with({ scheme: "vscode-resource" }).toString())
                .replace(/{{endpoint}}/g, this.localServer.getServerUri());
            this.panel.webview.html = html;
            this.panel.onDidDispose(() => {
                this.panel = undefined;
                this.localServer.stopServer();
            });
        } else {
            this.panel.reveal();
        }
    }
}
