import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  BluetoothPrinterService,
  isBluetoothSupported,
  KNOWN_PRINTER_SERVICES,
} from "@/lib/bluetooth-printer";

describe("Task 2.5: Web Bluetooth Printer Client Service", () => {
  let service: BluetoothPrinterService;

  beforeEach(() => {
    service = new BluetoothPrinterService();
  });

  describe("Initial State & Config", () => {
    it("should initialize in disconnected state with default 58mm paper width", () => {
      const info = service.getInfo();
      expect(info.status).toBe("disconnected");
      expect(info.paperWidth).toBe(58);
      expect(info.deviceName).toBeUndefined();
    });

    it("should update paper width and notify subscribers", () => {
      const updates: number[] = [];
      const unsubscribe = service.subscribe((info) => {
        updates.push(info.paperWidth);
      });

      service.setPaperWidth(80);
      expect(service.getInfo().paperWidth).toBe(80);

      service.setPaperWidth(58);
      expect(service.getInfo().paperWidth).toBe(58);

      unsubscribe();
      service.setPaperWidth(80);
      // After unsubscribing, updates array shouldn't receive the third update
      expect(updates).toEqual([58, 80, 58]);
    });
  });

  describe("Connection Guard on Unsupported Environments", () => {
    it("should report unsupported when navigator.bluetooth is missing", () => {
      expect(isBluetoothSupported()).toBe(false);
    });

    it("should return error gracefully when attempting to connect without Web Bluetooth support", async () => {
      const result = await service.connect();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Web Bluetooth is not supported/);
      expect(service.getInfo().status).toBe("disconnected");
    });

    it("should fail printData immediately when not connected", async () => {
      const data = new Uint8Array([0x1b, 0x40]);
      const result = await service.printData(data);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Printer is not connected/);
    });
  });

  describe("Mocked Web Bluetooth Connection & Transmission Flow", () => {
    it("should successfully connect, discover characteristic, write chunked data, and disconnect", async () => {
      const writtenChunks: Uint8Array[] = [];

      const mockCharacteristic = {
        properties: { write: true, writeWithoutResponse: false },
        writeValue: vi.fn(async (buf: Uint8Array) => {
          writtenChunks.push(buf);
        }),
      };

      const mockService = {
        getCharacteristics: vi.fn(async () => [mockCharacteristic]),
      };

      const mockServer = {
        connect: vi.fn(async () => mockServer),
        disconnect: vi.fn(),
        getPrimaryService: vi.fn(async (uuid: string) => {
          if (uuid === KNOWN_PRINTER_SERVICES[0]) {
            return mockService;
          }
          throw new Error("Service not found");
        }),
        getPrimaryServices: vi.fn(async () => [mockService]),
        connected: true,
      };

      const mockDevice = {
        name: "Everycom POS-58BT",
        gatt: mockServer,
        addEventListener: vi.fn(),
      };

      // Mock navigator.bluetooth
      const originalNavigator = globalThis.navigator;
      Object.defineProperty(globalThis, "navigator", {
        value: {
          bluetooth: {
            requestDevice: vi.fn(async () => mockDevice),
          },
        },
        configurable: true,
        writable: true,
      });

      try {
        // Connect
        const connectRes = await service.connect();
        expect(connectRes.success).toBe(true);
        expect(connectRes.deviceName).toBe("Everycom POS-58BT");
        expect(service.getInfo().status).toBe("connected");
        expect(service.getInfo().deviceName).toBe("Everycom POS-58BT");

        // Send 250 bytes of data (should be chunked into 100 + 100 + 50)
        const testPayload = new Uint8Array(250);
        testPayload.fill(0xaa);

        const printRes = await service.printData(testPayload);
        expect(printRes.success).toBe(true);
        expect(writtenChunks.length).toBe(3);
        expect(writtenChunks[0].length).toBe(100);
        expect(writtenChunks[1].length).toBe(100);
        expect(writtenChunks[2].length).toBe(50);

        // Disconnect
        await service.disconnect();
        expect(mockServer.disconnect).toHaveBeenCalled();
        expect(service.getInfo().status).toBe("disconnected");
        expect(service.getInfo().deviceName).toBeUndefined();
      } finally {
        // Restore navigator
        Object.defineProperty(globalThis, "navigator", {
          value: originalNavigator,
          configurable: true,
          writable: true,
        });
      }
    });
  });
});
