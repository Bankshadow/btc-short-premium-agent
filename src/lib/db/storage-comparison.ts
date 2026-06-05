import type { StorageSourceComparison } from "./types";

export function compareStorageSources(input: {
  decisionLogsLocal: number;
  decisionLogsWarehouse: number;
  paperTradesLocal: number;
  paperTradesWarehouse: number;
  liveTradesLocal: number;
  liveTradesWarehouse: number;
}): StorageSourceComparison[] {
  return [
    {
      domain: "decision_logs",
      localCount: input.decisionLogsLocal,
      warehouseCount: input.decisionLogsWarehouse,
      inSync: input.decisionLogsWarehouse >= input.decisionLogsLocal,
    },
    {
      domain: "paper_trades",
      localCount: input.paperTradesLocal,
      warehouseCount: input.paperTradesWarehouse,
      inSync: input.paperTradesWarehouse >= input.paperTradesLocal,
    },
    {
      domain: "live_trades",
      localCount: input.liveTradesLocal,
      warehouseCount: input.liveTradesWarehouse,
      inSync: input.liveTradesWarehouse >= input.liveTradesLocal,
    },
  ];
}
