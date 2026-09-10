export type CliOptions = {
  rest: string[];
  keypair?: string;
  message?: string;
  api?: string;
  token?: string;
};

export function extractOptions(argv: string[]): CliOptions {
  const rest: string[] = [];
  let keypair: string | undefined;
  let message: string | undefined;
  let api: string | undefined;
  let token: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (
      item === "--keypair" ||
      item === "-m" ||
      item === "--message" ||
      item === "--api" ||
      item === "--token"
    ) {
      const value = argv[++i];
      if (!value || value.startsWith("-")) {
        throw new Error(`${item} needs a value`);
      }
      if (item === "--keypair") {
        keypair = value;
      } else if (item === "--api") {
        api = value;
      } else if (item === "--token") {
        token = value;
      } else {
        message = value;
      }
      continue;
    }
    if (item.startsWith("--keypair=")) {
      keypair = item.slice("--keypair=".length);
      continue;
    }
    if (item.startsWith("--message=")) {
      message = item.slice("--message=".length);
      continue;
    }
    if (item.startsWith("--api=")) {
      api = item.slice("--api=".length);
      continue;
    }
    if (item.startsWith("--token=")) {
      token = item.slice("--token=".length);
      continue;
    }
    rest.push(item);
  }
  return { rest, keypair, message, api, token };
}
