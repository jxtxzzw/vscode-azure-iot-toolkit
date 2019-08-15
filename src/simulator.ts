// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

"use strict";
import * as vscode from "vscode";
import { Constants } from "./constants";
import { clientFromConnectionString } from "azure-iot-device-mqtt";
import { DeviceItem } from "./Model/DeviceItem";
import { SimulatorWebview } from "./simulatorwebview/simulatorwebview";
import { Utility } from "./utility";
import { ConnectionString } from "azure-iot-common";
import { Client } from "azure-iot-device";
import * as dummyjson from "dummy-json";
import { SendStatus } from "./sendStatus";
import { TelemetryClient } from "./telemetryClient";
import { Message } from "azure-iot-device";
import { IoTHubResourceExplorer } from "./iotHubResourceExplorer";
export class Simulator {

    private static instance: Simulator;
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private processing: boolean;
    private cancelToken: boolean;
    private totalStatus: SendStatus;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel(Constants.SimulatorOutputChannelTitle);
        this.processing = false;
        this.cancelToken = false;
    }

    public static getInstance(context?: vscode.ExtensionContext) {
        if (!Simulator.instance) {
            if (!context) {
                vscode.window.showErrorMessage("Cannot create Simulator instance.");
            } else {
                Simulator.instance = new Simulator(context);
            }
        }
        return Simulator.instance;
    }

    public async selectIoTHub() {
        const _IoTHubResourceExplorer = new IoTHubResourceExplorer(this.outputChannel);
        await _IoTHubResourceExplorer.selectIoTHub();
    }

    public async getInputDeviceList(): Promise<DeviceItem[]> {
        const iotHubConnectionString = await Utility.getConnectionString(Constants.IotHubConnectionStringKey, Constants.IotHubConnectionStringTitle, false);
        return await Utility.getFilteredDeviceList(iotHubConnectionString, false);
    }

    public isProcessing(): boolean {
        return this.processing;
    }

    public cancel() {
        this.cancelToken = true;
    }
    
    public async showWebview(deviceItem: DeviceItem): Promise<void> {
        const simulatorwebview = SimulatorWebview.getInstance(this.context);
        await simulatorwebview.openSimulatorWebviewPage(deviceItem);
        return;
    }

    public async sendD2CMessage(deviceConnectionStrings: string[], template: string, isTemplate: boolean, numbers: number, interval: number) {
        if (!this.processing) {
            this.processing = true;
            await this.sendD2CMessageFromMultipleDevicesRepeatedly(deviceConnectionStrings, template, isTemplate, numbers, interval);
            this.processing = false;
            // The cancel token can only be re-initialized out of any send() or delay() functions.
            this.cancelToken = false;
        } else {
            vscode.window.showErrorMessage('A previous simulation is in progress...');
        }
    }

    private output (message: string) {
        this.outputChannel.appendLine(`[${new Date().toLocaleTimeString("en-US")}] ${message}`);
    }

    private sendEventDoneCallback(client, aiEventName: string, status: SendStatus, totalStatus: SendStatus) {
        return (err, result) => {
            const total = status.getTotal();

            if (err) {
                TelemetryClient.sendEvent(aiEventName, { Result: "Fail" });
                status.addFailed();
                totalStatus.addFailed();
            }
            if (result) {
                TelemetryClient.sendEvent(aiEventName, { Result: "Success" });
                status.addSucceed();
                totalStatus.addSucceed();
            }
            const sum = status.sum();
            if (sum === total) {
                client.close(() => { return; });
            }
        };
    }

    private async sendD2CMessageCore(client: Client, message: string, status: SendStatus, totalStatus: SendStatus) {
        let stringify = Utility.getConfig<boolean>(Constants.IoTHubD2CMessageStringifyKey);
        await client.sendEvent(new Message(stringify ? JSON.stringify(message) : message),
            this.sendEventDoneCallback(client, Constants.IoTHubAIMessageDoneEvent, status, totalStatus));
    }
    
    private async delay(milliSecond: number) {
        return new Promise( (resolve) => setTimeout(resolve, milliSecond));
    }

    private async cancellableDelay(milliSecond: number) {
        while (milliSecond > 1000) {
            await this.delay(1000);
            if (this.cancelToken) {
                return;
            } else {
                milliSecond -= 1000;
            }
        }
        if (milliSecond > 0) {
            await this.delay(milliSecond);
        }
    }

    private async sendD2CMessageFromMultipleDevicesRepeatedly(deviceConnectionStrings: string[], template: string, isTemplate: boolean, numbers: number, interval: number) {
        const deviceCount = deviceConnectionStrings.length;
        const total = deviceCount * numbers;
        if (total <= 0) {
            this.output(`Invalid Operation.`);
            return Promise.reject();
        }
        const startTime = new Date();
        this.output(`Start sending messages from ${deviceCount} device(s) to IoT Hub.`);
        let clients = [];
        let statuses = [];
        let ids = [];
        this.totalStatus = new SendStatus("Total", total);
        for (let i = 0; i < deviceCount; i++) {
            clients.push(await clientFromConnectionString(deviceConnectionStrings[i]));
            statuses.push(new SendStatus(ConnectionString.parse(deviceConnectionStrings[i]).DeviceId, numbers));
            ids.push(i);
        }
        for (let i = 0; i < numbers; i++) {
            // No await here, beacause the interval should begin as soon as it called send(), not after it sent.
            ids.map((j) => {
                // We use a template so that each time the message can be randomly generated.
                const generatedMessage = isTemplate ? dummyjson.parse(template) : template;
                console.log(generatedMessage)
                this.sendD2CMessageCore(clients[j], generatedMessage, statuses[j], this.totalStatus);
            }); 
            if (this.cancelToken) {
                break;
            }
            if (i < numbers - 1) {
                // There won't be a delay after the last iteration.
                await this.cancellableDelay(interval);
            }
        }
        const endTime = new Date();
            this.output(`${this.cancelToken ? "User aborted" : "All device(s) finished."}`,
            );
            while ((!this.cancelToken) && (this.totalStatus.sum() !== this.totalStatus.getTotal())) {
                await this.delay(500);
            }
            this.output(`Duration: ${(endTime.getTime() - startTime.getTime()) / 1000} second(s), with ${this.totalStatus.getSucceed()} succeed, and ${this.totalStatus.getFailed()} failed.`,
            );
    }

    public getStatus () : SendStatus {
        return this.totalStatus;
    }

}
