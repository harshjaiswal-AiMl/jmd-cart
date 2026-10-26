/**
 * Web Bluetooth ESC/POS Thermal Printer Driver.
 *
 * Connects to portable Bluetooth thermal receipt printers (58mm/80mm)
 * via Web Bluetooth API (supported on Chrome for Android & desktop).
 * Handles GATT service discovery, chunked byte transmission to avoid
 * printer buffer overrun, and connection state management.
 */

export const KNOWN_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Standard ESC/POS printer service
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Common mini Bluetooth thermal service
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC Transparent UART service
  "0000fee7-0000-1000-8000-00805f9b34fb", // Tencent / standard BLE printer
  "0000ff00-0000-1000-8000-00805f9b34fb", // Common Chinese thermal printer
  "0000fff0-0000-1000-8000-00805f9b34fb", // Common POS thermal printer
  "0000ae30-0000-1000-8000-00805f9b34fb", // Zhuhai / PT-210 series
  "00001101-0000-1000-8000-00805f9b34fb", // Serial Port Profile (SPP)
];

export type BluetoothPrinterStatus = "disconnected" | "connecting" | "connected";

export interface BluetoothPrinterInfo {
  status: BluetoothPrinterStatus;
  deviceName?: string;
  paperWidth: 58 | 80;
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.bluetooth);
}

export class BluetoothPrinterService {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private status: BluetoothPrinterStatus = "disconnected";
  private deviceName = "";
  private paperWidth: 58 | 80 = 58;
  private listeners: Set<(info: BluetoothPrinterInfo) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      const savedWidth = localStorage.getItem("jmd_printer_width");
      if (savedWidth === "80") {
        this.paperWidth = 80;
      }
    }
  }

  public getInfo(): BluetoothPrinterInfo {
    return {
      status: this.status,
      deviceName: this.deviceName || undefined,
      paperWidth: this.paperWidth,
    };
  }

  public setPaperWidth(width: 58 | 80): void {
    this.paperWidth = width;
    if (typeof window !== "undefined") {
      localStorage.setItem("jmd_printer_width", String(width));
    }
    this.notify();
  }

  public subscribe(callback: (info: BluetoothPrinterInfo) => void): () => void {
    this.listeners.add(callback);
    callback(this.getInfo());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(): void {
    const info = this.getInfo();
    this.listeners.forEach((cb) => cb(info));
  }

  private setStatus(status: BluetoothPrinterStatus, name?: string): void {
    this.status = status;
    if (name !== undefined) {
      this.deviceName = name;
    }
    this.notify();
  }

  /**
   * Request Bluetooth device pair and connect GATT server.
   * MUST be invoked directly from a user gesture (tap/click event).
   */
  public async connect(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    if (!isBluetoothSupported() || !navigator.bluetooth) {
      return {
        success: false,
        error: "Web Bluetooth is not supported on this browser. Please use Chrome on Android or Desktop.",
      };
    }

    try {
      this.setStatus("connecting");

      // 1. Request device picker
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_PRINTER_SERVICES,
      });

      this.device = device;
      this.deviceName = device.name || "Bluetooth Printer";

      // Listen for unexpected disconnect
      device.addEventListener("gattserverdisconnected", () => {
        this.characteristic = null;
        this.setStatus("disconnected");
      });

      // 2. Connect GATT Server
      if (!device.gatt) {
        throw new Error("Device GATT server is not available.");
      }

      const server = await device.gatt.connect();

      // 3. Discover writable characteristic across known printer services
      let foundCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

      // Try known service UUIDs first
      for (const serviceUuid of KNOWN_PRINTER_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const characteristics = await service.getCharacteristics();

          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              foundCharacteristic = char;
              break;
            }
          }

          if (foundCharacteristic) break;
        } catch {
          // Service not supported on this specific device, check next
        }
      }

      // If not found in known UUIDs, discover all primary services
      if (!foundCharacteristic) {
        try {
          const services = await server.getPrimaryServices();
          for (const service of services) {
            const characteristics = await service.getCharacteristics();
            for (const char of characteristics) {
              if (char.properties.write || char.properties.writeWithoutResponse) {
                foundCharacteristic = char;
                break;
              }
            }
            if (foundCharacteristic) break;
          }
        } catch {
          // Ignore getPrimaryServices fallback errors
        }
      }

      if (!foundCharacteristic) {
        throw new Error(
          "Could not find a writable print characteristic on this Bluetooth device. Ensure the printer is turned on and paired."
        );
      }

      this.characteristic = foundCharacteristic;
      this.setStatus("connected", this.deviceName);

      return { success: true, deviceName: this.deviceName };
    } catch (err: unknown) {
      this.setStatus("disconnected");
      let message = err instanceof Error ? err.message : "Bluetooth connection cancelled or failed.";
      if (
        message.toLowerCase().includes("globally disabled") ||
        message.toLowerCase().includes("web bluetooth api")
      ) {
        message = "Web Bluetooth API is globally disabled in your browser settings (common in Brave Browser). Please enable brave://flags/#enable-web-bluetooth or use Google Chrome.";
      } else if (message.toLowerCase().includes("user cancelled") || message.toLowerCase().includes("cancelled")) {
        message = "Bluetooth pairing was cancelled.";
      }
      return { success: false, error: message };
    }
  }

  /**
   * Disconnect from current Bluetooth printer.
   */
  public async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
    this.setStatus("disconnected", "");
  }

  /**
   * Transmit raw ESC/POS binary data to the connected printer in chunks.
   * Uses 100-byte packets with 25ms delay to prevent buffer overflows on handheld printers.
   */
  public async printData(data: Uint8Array): Promise<{ success: boolean; error?: string }> {
    if (!this.characteristic || !this.device?.gatt?.connected) {
      return {
        success: false,
        error: "Printer is not connected. Please connect via Bluetooth first.",
      };
    }

    try {
      const CHUNK_SIZE = 100;
      const DELAY_MS = 25;

      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        const chunk = data.slice(offset, offset + CHUNK_SIZE);

        if (this.characteristic.writeValueWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.characteristic.writeValue(chunk);
        }

        if (offset + CHUNK_SIZE < data.length) {
          await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        }
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to transmit print data.";
      return { success: false, error: message };
    }
  }
}

// Global singleton instance for van PWA
export const bluetoothPrinter = new BluetoothPrinterService();
