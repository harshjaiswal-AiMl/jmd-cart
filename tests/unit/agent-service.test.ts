import { describe, it, expect } from "vitest";
import { agentService } from "@/modules/billing/agent.service";

describe("AgentService Code Generator", () => {
  it("generates AG001 when no existing codes exist or increments correctly", async () => {
    const nextCode = await agentService.generateNextAgentCode("AG");
    expect(nextCode).toMatch(/^AG\d{3,}$/);
  });
});
