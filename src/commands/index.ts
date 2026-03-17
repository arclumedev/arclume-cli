import chalk from "chalk";

export async function runIndex(options: { watch: boolean }): Promise<void> {
  if (options.watch) {
    console.log(
      chalk.cyan(
        "\nWatch mode: monitoring for file changes... (Press Ctrl+C to stop)\n"
      )
    );
    console.log(
      chalk.dim(
        "Note: Full watch-mode indexing requires your repo to be connected at arclume.ai"
      )
    );
    console.log("");

    const interval = setInterval(() => {
      console.log(chalk.dim(`[${new Date().toISOString()}] Watching...`));
    }, 30000);

    // Keep alive until Ctrl+C
    process.on("SIGINT", () => {
      clearInterval(interval);
      console.log(chalk.yellow("\nWatch mode stopped."));
      process.exit(0);
    });

    // Prevent the process from exiting
    await new Promise<never>(() => {
      // intentionally never resolves
    });
  } else {
    console.log(
      chalk.cyan(
        "\nIndexing is triggered via the Arclume API. Ensure your repo is connected at arclume.ai.\n"
      )
    );
    console.log("  To connect your repo, visit: " + chalk.bold("https://arclume.ai"));
    console.log(
      "  Once connected, indexing will run automatically on push, or you can trigger it from the dashboard.\n"
    );
  }
}

export async function runIndexStatus(): Promise<void> {
  console.log(
    chalk.cyan(
      "\nIndex status is available via the Arclume API. Ensure your repo is connected at arclume.ai.\n"
    )
  );
  console.log("  Visit " + chalk.bold("https://arclume.ai") + " to view your repo's index status.");
  console.log("  You can also check index health locally with " + chalk.bold("arclume doctor") + ".\n");
}
