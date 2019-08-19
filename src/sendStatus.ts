export class SendStatus {
    private readonly deviceId: string;
    private readonly total: number;
    private sent: number;
    private succeed: number;
    private failed: number;

    constructor(deviceId: string, total: number) {
        this.deviceId = deviceId;
        this.total = total;
        this.sent = 0;
        this.succeed = 0;
        this.failed = 0;
    }

    public getDeviceId(): string {
        return this.deviceId;
    }
    public getTotal(): number {
        return this.total;
    }
    public getSent(): number {
        return this.sent;
    }
    public getSucceed(): number {
        return this.succeed;
    }
    public getFailed(): number {
        return this.failed;
    }

    public addSent(deviceCount: number): void {
        this.sent += deviceCount;
    }
    public addSucceed(): void {
        this.succeed++;
    }
    public addFailed(): void {
        this.failed++;
    }

    public sum(): number {
        return this.succeed + this.failed;
    }
}
