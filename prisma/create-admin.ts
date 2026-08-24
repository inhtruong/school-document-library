import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createAdminUser } from "../src/lib/auth/create-admin";
import { prisma } from "../src/lib/prisma";

/**
 * One-time interactive bootstrap for the first production ADMIN account —
 * there is no Admin registration page and production seeding is blocked
 * (see seed.ts). Prompts for the password without echoing it to the
 * terminal when stdin is an interactive TTY; falls back to a visible
 * prompt otherwise (e.g. piped input in CI), since raw-mode input requires
 * a real TTY.
 */

function askPasswordHidden(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    stdout.write(query);
    let input = "";

    const onData = (chunk: Buffer) => {
      const char = chunk.toString("utf8");

      switch (char) {
        case "\n":
        case "\r":
        case "": // Ctrl+D
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          stdout.write("\n");
          resolve(input);
          break;
        case "": // Ctrl+C
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write("\n");
          reject(new Error("Cancelled"));
          break;
        case "": // Backspace
          input = input.slice(0, -1);
          break;
        default:
          input += char;
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
  });
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  // `rl.question()` hangs on the second call when stdin is piped/non-TTY —
  // a documented Node quirk. Reading via the interface's own async iterator
  // works correctly for both interactive TTY and piped input.
  const lines = rl[Symbol.asyncIterator]();

  async function ask(prompt: string): Promise<string> {
    stdout.write(prompt);
    const { value, done } = await lines.next();
    if (done) throw new Error("Input ended unexpectedly");
    return value;
  }

  console.log("Create the first production ADMIN account.\n");

  const name = await ask("Name: ");
  const email = await ask("Email: ");

  let password: string;
  if (stdin.isTTY) {
    rl.close();
    password = await askPasswordHidden("Password (min 8 characters, not shown): ");
  } else {
    password = await ask("Password (min 8 characters): ");
    rl.close();
  }

  const result = await createAdminUser({ name, email, password });

  if (!result.success) {
    console.error(`\nFailed to create admin account: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n✓ Admin account created: ${result.user.email} (id: ${result.user.id})`);
}

main()
  .catch((error) => {
    console.error("Unexpected error creating admin account:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
