import { connect as connectBase, type ConnectOpts } from "./connect";
import { IrysPageStore } from "./store-irys";

export { IrysPageStore } from "./store-irys";

export async function connect(
  opts: Omit<ConnectOpts, "store"> & { store?: ConnectOpts["store"] }
) {
  return connectBase({
    ...opts,
    store: opts.store ?? new IrysPageStore(),
  });
}

export const Slab = { connect };
