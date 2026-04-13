#!/usr/bin/env node

import { runContinuityCommand } from "../continuity-commands.js";

process.exit(runContinuityCommand(process.argv.slice(2)));
